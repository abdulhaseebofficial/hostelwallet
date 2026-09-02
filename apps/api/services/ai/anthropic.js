/**
 * Claude provider.
 *
 * The logic here was the original body of aiService: the model chain, the
 * structured-output negotiation and the refusal guard. It moved out unchanged
 * when Gemini was added, and exposes the same shape as ./gemini so aiService
 * never learns which one is answering.
 */

const Anthropic = require('@anthropic-ai/sdk');

const DEFAULT_MODEL = 'claude-opus-5';

// Tried in order. The configured model goes first; if a key cannot reach it
// (wrong tier, model retired, typo in AI_MODEL) the next one is tried instead,
// so the advisor works on any Anthropic key rather than only a top-tier one.
const FALLBACK_MODELS = ['claude-sonnet-5', 'claude-haiku-4-5'];

const apiKey = () => process.env.ANTHROPIC_API_KEY || '';

const isConfigured = () => Boolean(apiKey());

const modelChain = () => {
  const configured = process.env.AI_MODEL || DEFAULT_MODEL;
  // AI_MODEL may name a Gemini model if the key was swapped; ignore it here.
  const first = /^claude/i.test(configured) ? configured : DEFAULT_MODEL;
  return [first, ...FALLBACK_MODELS].filter((m, i, all) => all.indexOf(m) === i);
};

// output_config.effort is rejected outright by the small/older models, so it is
// stripped for them rather than turning a working fallback into a 400.
const supportsEffort = (model) => !/haiku|sonnet-4-5|opus-4-5/.test(model);

// Once a model answers successfully it is pinned for the life of the process,
// so a dead first choice is not re-tried on every single request.
let resolvedModel = null;

const activeModel = () => resolvedModel || modelChain()[0];

let client = null;
const getClient = () => {
  if (!isConfigured()) return null;
  if (!client) client = new Anthropic({ apiKey: apiKey() });
  return client;
};

/* ------------------------------ reading ----------------------------- */

/** Joins every text block of a Messages API response into one string. */
const textOf = (response) =>
  response.content
    .filter((block) => block.type === 'text')
    .map((block) => block.text)
    .join('')
    .trim();

/** Reads a structured (json_schema) response back into a JS object. */
const jsonOf = (response) => {
  const raw = textOf(response);
  try {
    return JSON.parse(raw);
  } catch {
    const match = raw.match(/\{[\s\S]*\}/);
    if (!match) throw new Error('Claude did not return JSON');
    return JSON.parse(match[0]);
  }
};

/** Guards the refusal stop reason before any content is read. */
const assertAnswered = (response) => {
  if (response.stop_reason === 'refusal') {
    throw new Error('Claude declined to answer this one');
  }
};

/* ------------------------------ requests ---------------------------- */

/** A 404/403 (or a 400 naming the model) means this key cannot use that model. */
const isModelUnavailable = (err) => {
  const status = err && err.status;
  if (status === 404 || status === 403) return true;
  const message = String((err && err.message) || '').toLowerCase();
  return (
    status === 400 &&
    message.includes('model') &&
    (message.includes('not found') || message.includes('invalid') || message.includes('does not exist'))
  );
};

/** A 400 about a parameter the model does not accept, rather than about the model. */
const isUnsupportedParam = (err) => {
  const status = err && err.status;
  const message = String((err && err.message) || '').toLowerCase();
  return (
    status === 400 &&
    (message.includes('output_config') ||
      message.includes('effort') ||
      message.includes('format') ||
      message.includes('unsupported') ||
      message.includes('unexpected'))
  );
};

/** Adapts one request to what a given model actually accepts. */
const shapeFor = (model, base) => {
  const params = { ...base, model };
  if (params.output_config && !supportsEffort(model)) {
    const { effort, ...rest } = params.output_config;
    if (Object.keys(rest).length) params.output_config = rest;
    else delete params.output_config;
  }
  return params;
};

/**
 * Last resort for a model that cannot do structured outputs: drop the schema
 * and ask for raw JSON in the prompt instead. jsonOf() already recovers an
 * object from prose, so the endpoint still returns usable data.
 */
const withoutStructuredOutput = (params) => {
  const next = { ...params };
  const schema =
    next.output_config && next.output_config.format && next.output_config.format.schema;
  delete next.output_config;

  if (schema && schema.properties) {
    const keys = Object.keys(schema.properties).join(', ');
    const last = next.messages.length - 1;
    next.messages = next.messages.map((m, i) =>
      i === last && m.role === 'user'
        ? {
            ...m,
            content: `${m.content}

Reply with ONLY a raw JSON object - no markdown, no commentary - containing exactly these top-level keys: ${keys}.`,
          }
        : m
    );
  }
  return next;
};

/**
 * One request, walking the model chain until something answers.
 * Only model-availability failures advance the chain; a rate limit or a network
 * error is thrown so the caller can fall back to the rule-based advisor.
 */
const complete = async ({ system, messages, maxTokens, schema, effort = 'medium' }) => {
  const anthropic = getClient();
  if (!anthropic) throw new Error('ANTHROPIC_API_KEY is not set');

  const base = { max_tokens: maxTokens, system, messages };
  base.output_config = schema
    ? { effort, format: { type: 'json_schema', schema } }
    : { effort };

  const chain = resolvedModel
    ? [resolvedModel, ...modelChain().filter((m) => m !== resolvedModel)]
    : modelChain();

  let lastError = null;

  for (const model of chain) {
    const params = shapeFor(model, base);
    try {
      const response = await anthropic.messages.create(params);
      if (resolvedModel !== model) {
        console.log(`[ai] using ${model}`);
        resolvedModel = model;
      }
      assertAnswered(response);
      return { text: textOf(response), json: schema ? jsonOf(response) : null };
    } catch (err) {
      lastError = err;

      // The model is reachable but rejected a parameter - retry it plainly.
      if (isUnsupportedParam(err) && params.output_config) {
        try {
          const response = await anthropic.messages.create(withoutStructuredOutput(params));
          console.log(`[ai] using ${model} without structured output`);
          resolvedModel = model;
          assertAnswered(response);
          return { text: textOf(response), json: schema ? jsonOf(response) : null };
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

module.exports = {
  name: 'claude',
  keyVariable: 'ANTHROPIC_API_KEY',
  isConfigured,
  modelChain,
  activeModel,
  complete,
};
