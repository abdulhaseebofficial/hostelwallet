/**
 * Gemini provider.
 *
 * Speaks the Generative Language REST API directly rather than pulling in an
 * SDK: the surface used here is four fields wide, and Node 18+ already has
 * fetch. One less dependency to keep current.
 *
 * Exposes the same shape as ./anthropic so aiService never learns which one is
 * answering.
 */

const API_ROOT = 'https://generativelanguage.googleapis.com/v1beta/models';

const DEFAULT_MODEL = 'gemini-2.5-flash';

// Tried in order. The configured model goes first; if a key cannot reach it
// (wrong tier, model retired, typo in AI_MODEL) the next one is tried, so the
// advisor works on any Google key rather than only a particular one.
const FALLBACK_MODELS = ['gemini-2.0-flash', 'gemini-flash-latest'];

const apiKey = () => process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY || '';

const isConfigured = () => Boolean(apiKey());

const modelChain = () => {
  const configured = process.env.AI_MODEL || DEFAULT_MODEL;
  // AI_MODEL may name a Claude model if the key was swapped; ignore it here.
  const first = /^gemini/i.test(configured) ? configured : DEFAULT_MODEL;
  return [first, ...FALLBACK_MODELS].filter((m, i, all) => all.indexOf(m) === i);
};

// Once a model answers successfully it is pinned for the life of the process,
// so a dead first choice is not re-tried on every single request.
let resolvedModel = null;

const activeModel = () => resolvedModel || modelChain()[0];

/* --------------------------- schema mapping ------------------------- */

// Gemini accepts an OpenAPI subset, not full JSON Schema, and rejects the
// request outright on a key it does not know - `additionalProperties` being
// the one the shared schemas use.
const DROPPED_SCHEMA_KEYS = ['additionalProperties', '$schema', 'default', 'examples'];

/** Rewrites a JSON Schema into the subset Gemini's responseSchema accepts. */
const toGeminiSchema = (schema) => {
  if (Array.isArray(schema)) return schema.map(toGeminiSchema);
  if (!schema || typeof schema !== 'object') return schema;

  const out = {};
  for (const [key, value] of Object.entries(schema)) {
    if (DROPPED_SCHEMA_KEYS.includes(key)) continue;
    if (key === 'properties') {
      out.properties = Object.fromEntries(
        Object.entries(value).map(([name, sub]) => [name, toGeminiSchema(sub)])
      );
    } else if (key === 'items') {
      out.items = toGeminiSchema(value);
    } else {
      out[key] = value;
    }
  }

  // Keeping the declared order makes the model fill fields in the order the
  // prompt describes them, which measurably improves the JSON it returns.
  if (out.type === 'object' && out.properties && !out.propertyOrdering) {
    out.propertyOrdering = Object.keys(out.properties);
  }
  return out;
};

/* ------------------------------ requests ---------------------------- */

/** Anthropic's message list, translated to Gemini's `contents`. */
const toContents = (messages) =>
  messages.map((m) => ({
    role: m.role === 'assistant' ? 'model' : 'user',
    parts: [{ text: m.content }],
  }));

/**
 * An error carrying the HTTP status, so the retry logic below can tell a dead
 * model from a rate limit the same way the Anthropic provider does.
 */
const apiError = (status, message) => {
  const err = new Error(message);
  err.status = status;
  return err;
};

const postToModel = async (model, body) => {
  const response = await fetch(`${API_ROOT}/${model}:generateContent`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-goog-api-key': apiKey() },
    body: JSON.stringify(body),
  });

  const payload = await response.json().catch(() => ({}));

  if (!response.ok) {
    const detail = (payload && payload.error && payload.error.message) || response.statusText;
    throw apiError(response.status, detail);
  }
  return payload;
};

/** A 404/403, or a 400 naming the model, means this key cannot use that model. */
const isModelUnavailable = (err) => {
  const status = err && err.status;
  if (status === 404 || status === 403) return true;
  const message = String((err && err.message) || '').toLowerCase();
  return status === 400 && message.includes('model') && !message.includes('schema');
};

/** A 400 about the schema rather than about the model. */
const isSchemaRejected = (err) => {
  const status = err && err.status;
  const message = String((err && err.message) || '').toLowerCase();
  return (
    status === 400 &&
    (message.includes('schema') || message.includes('response_mime_type') || message.includes('json'))
  );
};

/* ------------------------------ reading ----------------------------- */

/** Joins every text part of the first candidate into one string. */
const textOf = (payload) => {
  const candidate = payload && payload.candidates && payload.candidates[0];
  if (!candidate) return '';
  const parts = (candidate.content && candidate.content.parts) || [];
  return parts
    .map((p) => p.text || '')
    .join('')
    .trim();
};

/**
 * Gemini stops for reasons other than "it finished". Surface those as errors so
 * withFallback downgrades to the rule-based advisor instead of showing a blank
 * card - a truncated answer is worse than a rule-based one.
 */
const assertAnswered = (payload) => {
  const blocked = payload && payload.promptFeedback && payload.promptFeedback.blockReason;
  if (blocked) throw new Error(`Gemini blocked the prompt (${blocked})`);

  const candidate = payload && payload.candidates && payload.candidates[0];
  if (!candidate) throw new Error('Gemini returned no candidates');

  const reason = candidate.finishReason;
  if (reason && reason !== 'STOP' && reason !== 'FINISH_REASON_UNSPECIFIED') {
    throw new Error(`Gemini stopped early (${reason})`);
  }
};

/** Reads a JSON response back into an object, tolerating fenced prose. */
const jsonOf = (payload) => {
  const raw = textOf(payload);
  try {
    return JSON.parse(raw);
  } catch {
    const match = raw.match(/\{[\s\S]*\}/);
    if (!match) throw new Error('Gemini did not return JSON');
    return JSON.parse(match[0]);
  }
};

/* ------------------------------- public ----------------------------- */

/**
 * One request, walking the model chain until something answers.
 * Only model-availability failures advance the chain; a rate limit or network
 * error is thrown so the caller can fall back to the rule-based advisor.
 */
const complete = async ({ system, messages, maxTokens, schema }) => {
  const base = {
    contents: toContents(messages),
    generationConfig: { maxOutputTokens: maxTokens },
  };
  if (system) base.systemInstruction = { parts: [{ text: system }] };
  if (schema) {
    base.generationConfig.responseMimeType = 'application/json';
    base.generationConfig.responseSchema = toGeminiSchema(schema);
  }

  const chain = resolvedModel
    ? [resolvedModel, ...modelChain().filter((m) => m !== resolvedModel)]
    : modelChain();

  let lastError = null;

  for (const model of chain) {
    try {
      const payload = await postToModel(model, base);
      if (resolvedModel !== model) {
        console.log(`[ai] using ${model}`);
        resolvedModel = model;
      }
      assertAnswered(payload);
      return { text: textOf(payload), json: schema ? jsonOf(payload) : null };
    } catch (err) {
      lastError = err;

      // The model is reachable but would not take the schema. Ask for raw JSON
      // in the prompt instead; jsonOf() already recovers an object from prose.
      if (schema && isSchemaRejected(err)) {
        try {
          const payload = await postToModel(model, withoutSchema(base, schema));
          console.log(`[ai] using ${model} without structured output`);
          resolvedModel = model;
          assertAnswered(payload);
          return { text: textOf(payload), json: jsonOf(payload) };
        } catch (retryError) {
          lastError = retryError;
        }
      }

      if (isModelUnavailable(err)) {
        console.warn(`[ai] ${model} not available on this key (${err.status}); trying the next model`);
        resolvedModel = null;
        continue;
      }

      throw err; // rate limit, overload, network - not a model problem
    }
  }

  throw lastError;
};

/** Drops the schema and asks for the same JSON in words instead. */
const withoutSchema = (base, schema) => {
  const next = {
    ...base,
    generationConfig: { maxOutputTokens: base.generationConfig.maxOutputTokens },
  };
  if (!schema.properties) return next;

  const keys = Object.keys(schema.properties).join(', ');
  const last = next.contents.length - 1;
  next.contents = next.contents.map((c, i) =>
    i === last && c.role === 'user'
      ? {
          ...c,
          parts: [
            {
              text: `${c.parts.map((p) => p.text).join('')}

Reply with ONLY a raw JSON object - no markdown, no commentary - containing exactly these top-level keys: ${keys}.`,
            },
          ],
        }
      : c
  );
  return next;
};

module.exports = {
  name: 'gemini',
  keyVariable: 'GEMINI_API_KEY',
  isConfigured,
  modelChain,
  activeModel,
  complete,
};
