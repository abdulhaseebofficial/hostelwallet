/**
 * Picks whichever AI provider has a key.
 *
 * The advisor is meant to work on one environment variable and nothing else:
 * set GEMINI_API_KEY or ANTHROPIC_API_KEY and the app follows it. Gemini is
 * checked first because its free tier is what a student product can actually
 * afford to run; Claude wins only when it is the one configured.
 *
 * With neither key set every call reports `unavailable`, and aiService answers
 * from its rule-based advisor instead - the product keeps working, it just
 * stops being clever.
 */

const gemini = require('./gemini');
const anthropic = require('./anthropic');

const PROVIDERS = [gemini, anthropic];

/** The provider that will answer, or null when no key is configured. */
const current = () => PROVIDERS.find((p) => p.isConfigured()) || null;

const isConfigured = () => Boolean(current());

/** Which provider is answering: 'gemini', 'claude', or null. */
const providerName = () => {
  const provider = current();
  return provider ? provider.name : null;
};

/** The model actually answering right now, or null with no key. */
const activeModel = () => {
  const provider = current();
  return provider ? provider.activeModel() : null;
};

/** The models that would be tried, in order. Empty with no key. */
const modelChain = () => {
  const provider = current();
  return provider ? provider.modelChain() : [];
};

/**
 * One request, in provider-neutral terms.
 *
 * `schema` is optional: pass one to get `json` back, leave it out to get `text`.
 * Throws when nothing is configured, which withFallback turns into rule-based
 * advice.
 */
const complete = async (request) => {
  const provider = current();
  if (!provider) throw new Error('No AI provider is configured');
  return provider.complete(request);
};

/** What to tell a developer who has not set a key yet. */
const SETUP_HINT =
  'Set GEMINI_API_KEY (free tier at https://aistudio.google.com/apikey) or ' +
  'ANTHROPIC_API_KEY to switch the advisor from rule-based to AI-written advice.';

module.exports = {
  isConfigured,
  providerName,
  activeModel,
  modelChain,
  complete,
  SETUP_HINT,
};
