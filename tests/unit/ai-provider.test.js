/**
 * The AI provider layer.
 *
 * Which provider answers, how a JSON Schema is translated for Gemini, and how
 * a reply is read back. None of this is reachable end-to-end without a real
 * API key, so it is tested directly - otherwise the only proof the Gemini
 * support works would be "it compiled".
 */

const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');

const API = path.join(__dirname, '..', '..', 'apps', 'api', 'src');

/** Reloads the provider picker with a clean view of the environment. */
const freshProviders = () => {
  for (const key of Object.keys(require.cache)) {
    if (key.includes(path.join('infrastructure', 'ai'))) delete require.cache[key];
  }
  return require(path.join(API, 'infrastructure', 'ai'));
};

/**
 * The Gemini module keeps its translation helpers private. Loading the source
 * with them exposed lets them be tested without widening the real module's
 * surface just for the test.
 */
const geminiInternals = () => {
  const file = path.join(API, 'infrastructure', 'ai', 'gemini.js');
  let src = fs.readFileSync(file, 'utf8');
  src = src.replace(
    'module.exports = {',
    'module.exports = { _internals: { toGeminiSchema, textOf, jsonOf, assertAnswered, toContents },'
  );
  const module_ = { exports: {} };
  new Function('module', 'exports', 'require', src)(module_, module_.exports, require);
  return module_.exports._internals;
};

/* -------------------------- choosing a provider ---------------------- */

test('with no key at all, nothing is configured', () => {
  delete process.env.GEMINI_API_KEY;
  delete process.env.GOOGLE_API_KEY;
  delete process.env.ANTHROPIC_API_KEY;
  delete process.env.AI_MODEL;

  const ai = freshProviders();
  assert.strictEqual(ai.isConfigured(), false);
  assert.strictEqual(ai.providerName(), null);
  assert.strictEqual(ai.activeModel(), null);
  assert.deepStrictEqual(ai.modelChain(), []);
});

test('a Gemini key selects Gemini', () => {
  delete process.env.ANTHROPIC_API_KEY;
  process.env.GEMINI_API_KEY = 'AIza-not-a-real-key';

  const ai = freshProviders();
  assert.strictEqual(ai.providerName(), 'gemini');
  assert.ok(ai.activeModel().startsWith('gemini'));
  assert.ok(ai.modelChain().length > 1, 'there should be fallback models');
});

test('an Anthropic key alone selects Claude', () => {
  delete process.env.GEMINI_API_KEY;
  process.env.ANTHROPIC_API_KEY = 'sk-ant-not-a-real-key';

  const ai = freshProviders();
  assert.strictEqual(ai.providerName(), 'claude');
  assert.ok(ai.activeModel().startsWith('claude'));
});

test('with both keys, Gemini wins - its free tier is what this can run on', () => {
  process.env.GEMINI_API_KEY = 'AIza-not-a-real-key';
  process.env.ANTHROPIC_API_KEY = 'sk-ant-not-a-real-key';

  assert.strictEqual(freshProviders().providerName(), 'gemini');
});

test('AI_MODEL naming the other provider is ignored rather than obeyed', () => {
  delete process.env.ANTHROPIC_API_KEY;
  process.env.GEMINI_API_KEY = 'AIza-not-a-real-key';
  process.env.AI_MODEL = 'claude-opus-5';

  const ai = freshProviders();
  assert.ok(
    ai.activeModel().startsWith('gemini'),
    'a Claude model name must not become a Gemini request'
  );
  delete process.env.AI_MODEL;
});

test('complete() refuses rather than hanging when nothing is configured', async () => {
  delete process.env.GEMINI_API_KEY;
  delete process.env.GOOGLE_API_KEY;
  delete process.env.ANTHROPIC_API_KEY;

  await assert.rejects(() => freshProviders().complete({ messages: [] }), /No AI provider/);
});

/* ------------------------ translating the schema --------------------- */

test('the response schema drops keys Gemini rejects, at every depth', () => {
  const { toGeminiSchema } = geminiInternals();

  const converted = toGeminiSchema({
    type: 'object',
    properties: {
      headline: { type: 'string', description: 'one line' },
      tips: {
        type: 'array',
        items: {
          type: 'object',
          properties: { title: { type: 'string' }, saving: { type: 'number' } },
          required: ['title'],
          additionalProperties: false,
        },
      },
    },
    required: ['headline', 'tips'],
    additionalProperties: false,
  });

  const asText = JSON.stringify(converted);
  assert.ok(!asText.includes('additionalProperties'), 'Gemini rejects the whole request on this');
  assert.ok(asText.includes('description'), 'descriptions are kept - they steer the answer');
  assert.deepStrictEqual(converted.required, ['headline', 'tips'], 'required survives');
  assert.deepStrictEqual(converted.propertyOrdering, ['headline', 'tips']);
});

test('the message list is translated to Gemini roles', () => {
  const { toContents } = geminiInternals();

  const contents = toContents([
    { role: 'user', content: 'how much did I spend?' },
    { role: 'assistant', content: 'Rs 4,200 so far.' },
  ]);

  assert.deepStrictEqual(contents.map((c) => c.role), ['user', 'model']);
  assert.strictEqual(contents[0].parts[0].text, 'how much did I spend?');
});

/* -------------------------- reading the reply ------------------------ */

const reply = (text, finishReason = 'STOP') => ({
  candidates: [{ content: { parts: [{ text }] }, finishReason }],
});

test('a JSON reply is parsed', () => {
  const { jsonOf } = geminiInternals();
  assert.deepStrictEqual(jsonOf(reply('{"headline":"hi","tips":[]}')), {
    headline: 'hi',
    tips: [],
  });
});

test('JSON wrapped in prose or a code fence is still recovered', () => {
  const { jsonOf } = geminiInternals();
  assert.deepStrictEqual(jsonOf(reply('Here you go:\n```json\n{"a":1}\n```')), { a: 1 });
});

test('an answer that stopped early is an error, not a half-written card', () => {
  const { assertAnswered } = geminiInternals();

  // Truncated: rendering this would show a tip cut off mid-sentence.
  assert.throws(() => assertAnswered(reply('cut off here', 'MAX_TOKENS')), /MAX_TOKENS/);
  assert.throws(() => assertAnswered(reply('', 'SAFETY')), /SAFETY/);
  assert.throws(() => assertAnswered({ candidates: [] }), /no candidates/);
  assert.throws(
    () => assertAnswered({ promptFeedback: { blockReason: 'SAFETY' }, candidates: [] }),
    /blocked/
  );
});

test('a complete answer passes', () => {
  const { assertAnswered, textOf } = geminiInternals();
  const payload = reply('Keep chai under Rs 300 this week.');

  assert.doesNotThrow(() => assertAnswered(payload));
  assert.strictEqual(textOf(payload), 'Keep chai under Rs 300 this week.');
});
