/**
 * aiService — the only place in the codebase that talks to the Claude API.
 *
 * Design notes
 *  - The API key never leaves the server. The frontend calls /api/ai/* and this
 *    module makes the outbound request.
 *  - Every function degrades gracefully: if ANTHROPIC_API_KEY is missing or the
 *    API call fails, a deterministic rule-based advisor answers instead and the
 *    response is flagged with `aiPowered: false`. The product keeps working.
 *  - Structured endpoints (advice, budget suggestion) use the Messages API
 *    structured-output format so the frontend gets predictable JSON rather than
 *    prose it has to parse with regexes.
 */

const Anthropic = require('@anthropic-ai/sdk');
const { FALLBACK_BUDGET_SPLIT, DEFAULT_CATEGORIES } = require('../config/constants');
const { round2 } = require('../utils/calculations');

const DEFAULT_MODEL = 'claude-opus-5';

// Tried in order. The configured model goes first; if a key cannot reach it
// (wrong tier, model retired, typo in AI_MODEL) the next one is tried instead,
// so the advisor works on any Anthropic key rather than only a top-tier one.
const FALLBACK_MODELS = ['claude-sonnet-5', 'claude-haiku-4-5'];

const modelChain = () => {
  const configured = process.env.AI_MODEL || DEFAULT_MODEL;
  return [configured, ...FALLBACK_MODELS].filter((m, i, all) => all.indexOf(m) === i);
};

// output_config.effort is rejected outright by the small/older models, so it is
// stripped for them rather than turning a working fallback into a 400.
const supportsEffort = (model) => !/haiku|sonnet-4-5|opus-4-5/.test(model);

// Once a model answers successfully it is pinned for the life of the process,
// so a dead first choice is not re-tried on every single request.
let resolvedModel = null;

/** The model actually answering right now (or the configured one before any call). */
const activeModel = () => resolvedModel || modelChain()[0];

let client = null;
const getClient = () => {
  if (!process.env.ANTHROPIC_API_KEY) return null;
  if (!client) client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  return client;
};

const isConfigured = () => Boolean(process.env.ANTHROPIC_API_KEY);

/* ----------------------------- helpers ------------------------------ */

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
    // Very rare: the model wrapped the JSON in prose. Recover the outer object.
    const match = raw.match(/\{[\s\S]*\}/);
    if (match) return JSON.parse(match[0]);
    throw new Error('AI returned a response that was not valid JSON');
  }
};

/** Guards the refusal stop reason before any content is read. */
const assertAnswered = (response) => {
  if (response.stop_reason === 'refusal') {
    throw new Error('The AI declined to answer this request.');
  }
  return response;
};

// Indian grouping (1,25,000) only applies to INR; PKR and the rest read
// naturally with western grouping (125,000).
const localeFor = (currency) => (currency === 'INR' ? 'en-IN' : currency === 'PKR' ? 'en-PK' : 'en-US');

/**
 * Money as the advisor should say it: whole units, no paisa.
 *
 * Student money is round money. "Keep it under PKR 2,032.67 a day" is both
 * unsayable and slightly absurd advice, and the dashboard tile beside it shows
 * PKR 2,033 - two different numbers for the same figure reads as a bug.
 */
const money = (currency, n) =>
  `${currency} ${Math.round(Number(n) || 0).toLocaleString(localeFor(currency))}`;

/**
 * Renders the caller's spending snapshot as a compact, readable block of text.
 * Keeping it deterministic (sorted, fixed field order) means the system-prompt
 * prefix stays cache friendly across calls.
 */
const snapshotToText = (snapshot, currency = 'INR') => {
  const {
    monthLabel,
    income,
    totalSpent,
    remaining,
    breakdown = [],
    budgets = [],
    goals = [],
    daysLeftInMonth,
    previousMonthSpent,
    topCategory,
    dailyAverage,
  } = snapshot;

  const lines = [];
  lines.push(`Period: ${monthLabel}`);
  lines.push(`Monthly income / pocket money: ${money(currency, income)}`);
  lines.push(`Spent so far: ${money(currency, totalSpent)}`);
  lines.push(`Money left: ${money(currency, remaining)}`);
  lines.push(`Days remaining in the month: ${daysLeftInMonth}`);
  lines.push(`Average spend per day so far: ${money(currency, dailyAverage)}`);
  if (previousMonthSpent != null) {
    lines.push(`Last month total spend: ${money(currency, previousMonthSpent)}`);
  }
  if (topCategory) lines.push(`Biggest category this month: ${topCategory}`);

  lines.push('');
  lines.push('Spending by category:');
  if (breakdown.length === 0) {
    lines.push('  (no expenses logged yet this month)');
  } else {
    breakdown.forEach((b) => {
      lines.push(`  - ${b.category}: ${money(currency, b.amount)} (${b.percent}% of spending)`);
    });
  }

  if (budgets.length) {
    lines.push('');
    lines.push('Category budgets set by the student (limit vs spent):');
    budgets.forEach((b) => {
      lines.push(
        `  - ${b.category}: limit ${money(currency, b.limit)}, spent ${money(currency, b.spent)} (${b.status})`
      );
    });
  }

  if (goals.length) {
    lines.push('');
    lines.push('Active savings goals:');
    goals.forEach((g) => {
      const due = g.deadline ? new Date(g.deadline).toISOString().slice(0, 10) : 'no deadline';
      lines.push(
        `  - ${g.title}: saved ${money(currency, g.savedAmount)} of ${money(currency, g.targetAmount)} (${g.progress}%), due ${due}`
      );
    });
  }

  return lines.join('\n');
};

/**
 * The advisor persona. Deliberately stable text so the cached prefix is reused
 * across requests.
 */
const SYSTEM_PROMPT = [
  'You are HostelWallet, a warm and practical money coach for a university student living in a hostel in Pakistan.',
  '',
  'Who you are talking to: a student aged roughly 18 to 24 whose entire monthly budget is small pocket money sent',
  'from home. Their world is the hostel mess bill, chai and paratha at the canteen, samosas and rolls from the dhaba',
  'outside the gate, rickshaw and Careem fares, a Daewoo or train ticket home for Eid, mobile load and monthly',
  'internet packages on Jazz, Zong, Ufone or Telenor, photocopies and lab files from the shop near campus, a cricket',
  'match, a cheap outing with friends, a trip to the salon or barber, and the occasional medical expense.',
  '',
  'How you advise:',
  '- Be specific and numeric. Refer to their real categories and real amounts, never generic filler like "make a budget".',
  '- Every tip must be something they could do this week without a job, a credit card, or investing knowledge.',
  '- Amounts are small on purpose. Saving 500 or 1500 rupees a month is a genuine win here, so treat it as one.',
  '- Be warm and encouraging. Never shame them for spending. No lecturing, no moralising, no "you should have".',
  '- Respect Pakistani hostel life: eating the mess food they already paid for instead of ordering from the dhaba,',
  '  claiming a mess rebate when they go home, splitting a rickshaw or Careem ride with roommates, sharing a monthly',
  '  internet package, buying used books from seniors or the Sunday bazaar, booking Daewoo and train tickets early,',
  '  and watching how quickly small JazzCash and Easypaisa transfers add up.',
  '- If the data is thin (few or no expenses logged), say so kindly and give starter advice instead of inventing numbers.',
  '- Never invent transactions, balances or facts that were not in the data you were given.',
  '- Never assume the student is male or female, and never assume who they live with or how they get around.',
  '  Write so the advice fits any student in any hostel.',
  '- Never suggest saving money in a way that costs personal safety. Do not propose walking alone at night,',
  '  skipping a ride home after dark, or leaving somewhere late to avoid a fare. If a cheaper option is only',
  '  safe in daylight or in a group, say that plainly.',
  '- Plain English, the way a friendly senior at the hostel would talk. An occasional everyday Urdu word is fine.',
  '- Keep it short. Students skim.',
].join('\n');

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
 * Sends one request, walking the model chain until something answers.
 * Only model-availability failures advance the chain; a rate limit or a network
 * error is thrown so the caller can fall back to the rule-based advisor.
 */
const createMessage = async (anthropic, baseParams) => {
  const chain = resolvedModel
    ? [resolvedModel, ...modelChain().filter((m) => m !== resolvedModel)]
    : modelChain();

  let lastError = null;

  for (const model of chain) {
    const params = shapeFor(model, baseParams);
    try {
      const response = await anthropic.messages.create(params);
      if (resolvedModel !== model) {
        console.log(`[ai] using ${model}`);
        resolvedModel = model;
      }
      return response;
    } catch (err) {
      lastError = err;

      // The model is reachable but rejected a parameter - retry it plainly.
      if (isUnsupportedParam(err) && params.output_config) {
        try {
          const response = await anthropic.messages.create(withoutStructuredOutput(params));
          console.log(`[ai] using ${model} without structured output`);
          resolvedModel = model;
          return response;
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

/** Wraps a Claude call so any failure downgrades to the rule-based advisor. */
const withFallback = async (label, run, fallback) => {
  const anthropic = getClient();
  if (!anthropic) return { ...fallback(), aiPowered: false, reason: 'no_api_key' };

  try {
    const result = await run(anthropic);
    return { ...result, aiPowered: true };
  } catch (err) {
    console.error(`[ai] ${label} failed:`, err.message);
    return { ...fallback(), aiPowered: false, reason: 'api_error' };
  }
};

/* --------------------- 1. Personalised advice ----------------------- */

const ADVICE_SCHEMA = {
  type: 'object',
  properties: {
    headline: { type: 'string', description: 'One friendly sentence summarising the month.' },
    tips: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          title: { type: 'string', description: 'Short action, max 8 words.' },
          detail: { type: 'string', description: 'Two sentences max, with concrete numbers.' },
          category: { type: 'string', description: 'The spending category this tip targets.' },
          estimatedMonthlySaving: {
            type: 'number',
            description: 'Realistic monthly saving in the user currency.',
          },
        },
        required: ['title', 'detail', 'category', 'estimatedMonthlySaving'],
        additionalProperties: false,
      },
    },
    warning: {
      type: 'string',
      description: 'Overspending warning, or an empty string when nothing is off track.',
    },
    encouragement: { type: 'string', description: 'One short encouraging closing line.' },
  },
  required: ['headline', 'tips', 'warning', 'encouragement'],
  additionalProperties: false,
};

const getAdvice = async ({ user, snapshot, tipCount = 4 }) =>
  withFallback(
    'advice',
    async (anthropic) => {
      const response = await createMessage(anthropic, {
        max_tokens: 8000,
        system: SYSTEM_PROMPT,
        output_config: {
          effort: 'medium',
          format: { type: 'json_schema', schema: ADVICE_SCHEMA },
        },
        messages: [
          {
            role: 'user',
            content: [
              `Here is my money situation. Currency is ${user.currency}.`,
              '',
              snapshotToText(snapshot, user.currency),
              '',
              `Give me exactly ${tipCount} money-saving tips that fit my actual spending above.`,
              'Put the highest-impact tip first. Keep every detail field under 40 words.',
              'If a category is clearly over budget, say so in the warning field; otherwise leave warning empty.',
            ].join('\n'),
          },
        ],
      });

      assertAnswered(response);
      return jsonOf(response);
    },
    () => fallbackAdvice({ user, snapshot, tipCount })
  );

/* --------------------- 2. Conversational Q&A ------------------------ */

const chat = async ({ user, snapshot, history = [], message }) =>
  withFallback(
    'chat',
    async (anthropic) => {
      const response = await createMessage(anthropic, {
        max_tokens: 8000,
        system: SYSTEM_PROMPT,
        output_config: { effort: 'medium' },
        messages: [
          // The snapshot is injected as the opening turn so the stored chat
          // history can be replayed verbatim on every request.
          {
            role: 'user',
            content: [
              `Context about me (currency ${user.currency}, name ${user.name}). Do not reply to this message`,
              'directly, just use it as background for everything I ask next.',
              '',
              snapshotToText(snapshot, user.currency),
            ].join('\n'),
          },
          { role: 'assistant', content: 'Got it, I have your numbers in front of me. Ask away!' },
          ...history.map((m) => ({ role: m.role, content: m.content })),
          { role: 'user', content: message },
        ],
      });

      assertAnswered(response);
      return { reply: textOf(response) };
    },
    () => fallbackChat({ user, snapshot, message })
  );

/* ----------------------- 3. Tip of the day -------------------------- */

const dailyTip = async ({ user, snapshot }) =>
  withFallback(
    'tip',
    async (anthropic) => {
      const response = await createMessage(anthropic, {
        max_tokens: 4000,
        system: SYSTEM_PROMPT,
        output_config: { effort: 'low' },
        messages: [
          {
            role: 'user',
            content: [
              `Currency ${user.currency}. My numbers:`,
              '',
              snapshotToText(snapshot, user.currency),
              '',
              'Give me ONE money tip for today. Two sentences maximum, under 35 words total.',
              'Tie it to a real number from my data. Plain text only, no markdown, no preamble.',
            ].join('\n'),
          },
        ],
      });

      assertAnswered(response);
      return { tip: textOf(response) };
    },
    () => fallbackTip({ user, snapshot })
  );

/* ------------------ 4. AI suggested monthly budget ------------------ */

const BUDGET_SCHEMA = {
  type: 'object',
  properties: {
    summary: { type: 'string', description: 'One or two sentences explaining the plan.' },
    savingsTarget: {
      type: 'number',
      description: 'Amount to set aside each month once every category limit is funded.',
    },
    categories: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          category: { type: 'string' },
          limit: { type: 'number' },
          reason: { type: 'string', description: 'Max 15 words on why this number.' },
        },
        required: ['category', 'limit', 'reason'],
        additionalProperties: false,
      },
    },
  },
  required: ['summary', 'savingsTarget', 'categories'],
  additionalProperties: false,
};

const suggestBudget = async ({ user, snapshot, categories }) =>
  withFallback(
    'suggest-budget',
    async (anthropic) => {
      const response = await createMessage(anthropic, {
        max_tokens: 8000,
        system: SYSTEM_PROMPT,
        output_config: {
          effort: 'medium',
          format: { type: 'json_schema', schema: BUDGET_SCHEMA },
        },
        messages: [
          {
            role: 'user',
            content: [
              `Build me a realistic monthly budget. Currency ${user.currency}.`,
              `My monthly income is ${money(user.currency, user.monthlyIncome)}.`,
              '',
              'My recent spending pattern:',
              snapshotToText(snapshot, user.currency),
              '',
              `Use only these categories: ${categories.join(', ')}.`,
              'Rules: every category gets a limit (0 is fine if I never spend there).',
              'The limits plus savingsTarget must add up to my income or slightly less, never more.',
              'Base the numbers on what I actually spend, then trim the flexible categories, not the fixed ones.',
              'Round every number to the nearest 50.',
            ].join('\n'),
          },
        ],
      });

      assertAnswered(response);
      return jsonOf(response);
    },
    () => fallbackBudget({ user, snapshot, categories })
  );

/* -------------------- 5. Weekly summary report ---------------------- */

const weeklySummary = async ({ user, snapshot }) =>
  withFallback(
    'weekly-summary',
    async (anthropic) => {
      const response = await createMessage(anthropic, {
        max_tokens: 8000,
        system: SYSTEM_PROMPT,
        output_config: { effort: 'low' },
        messages: [
          {
            role: 'user',
            content: [
              `Currency ${user.currency}. Here is my week:`,
              '',
              snapshotToText(snapshot, user.currency),
              '',
              'Write a short weekly wrap-up: what I spent most on, one thing I did well, one thing to watch,',
              'and one small challenge for next week (something like a no-outing weekend).',
              'Under 120 words. Warm and casual. Plain text with simple line breaks, no markdown headings.',
            ].join('\n'),
          },
        ],
      });

      assertAnswered(response);
      return { summary: textOf(response) };
    },
    () => ({ summary: fallbackTip({ user, snapshot }).tip })
  );

/* ================= Rule-based fallback advisor ====================== */
/* Used when there is no API key or the API call failed. Not as sharp as
   Claude, but it keeps every screen functional and never shows an error. */

const fallbackAdvice = ({ user, snapshot, tipCount = 4 }) => {
  const cur = user.currency;
  const { breakdown = [], income = 0, totalSpent = 0, remaining = 0, daysLeftInMonth = 0 } = snapshot;
  const tips = [];

  const top = breakdown[0];
  if (top) {
    tips.push({
      title: `Trim your ${top.category} spend`,
      detail: `${top.category} is ${top.percent}% of your spending at ${money(cur, top.amount)}. Cutting it by a fifth frees about ${money(cur, top.amount * 0.2)} a month.`,
      category: top.category,
      estimatedMonthlySaving: round2(top.amount * 0.2),
    });
  }

  const food = breakdown.find((b) => /food|mess/i.test(b.category));
  if (food) {
    tips.push({
      title: 'Eat the mess meals you already paid for',
      detail: `You spent ${money(cur, food.amount)} on food. Skipping two dhaba meals a week keeps roughly ${money(cur, food.amount * 0.15)} in your pocket.`,
      category: food.category,
      estimatedMonthlySaving: round2(food.amount * 0.15),
    });
  }

  const fun = breakdown.find((b) => /entertain/i.test(b.category));
  if (fun) {
    tips.push({
      title: 'Make one weekend a no-spend weekend',
      detail: `Entertainment came to ${money(cur, fun.amount)}. One quiet weekend a month saves about ${money(cur, fun.amount / 4)} with almost no effort.`,
      category: fun.category,
      estimatedMonthlySaving: round2(fun.amount / 4),
    });
  }

  const travel = breakdown.find((b) => /travel/i.test(b.category));
  if (travel) {
    tips.push({
      title: 'Share rickshaws, book tickets early',
      detail: `Travel cost ${money(cur, travel.amount)}. Splitting a rickshaw or Careem with hostel mates and booking Daewoo tickets early usually shaves a quarter off.`,
      category: travel.category,
      estimatedMonthlySaving: round2(travel.amount * 0.25),
    });
  }

  tips.push({
    title: 'Pay yourself first',
    detail: `Move ${money(cur, Math.max(500, income * 0.1))} into a savings goal the day your pocket money lands, before you can spend it.`,
    category: 'Misc',
    estimatedMonthlySaving: round2(Math.max(500, income * 0.1)),
  });

  const overspending = income > 0 && totalSpent > income * 0.9;
  const dailySafe = daysLeftInMonth > 0 ? remaining / daysLeftInMonth : remaining;

  return {
    headline:
      totalSpent === 0
        ? 'No expenses logged yet this month, so here is a starter plan.'
        : `You have spent ${money(cur, totalSpent)} so far this month.`,
    tips: tips.slice(0, tipCount),
    warning: overspending
      ? `You have used ${Math.round((totalSpent / income) * 100)}% of your income with ${daysLeftInMonth} days to go. Try to stay under ${money(cur, dailySafe)} a day.`
      : '',
    encouragement: 'Small changes add up fast at this budget. You have got this.',
  };
};

const fallbackChat = ({ user, snapshot, message }) => {
  const advice = fallbackAdvice({ user, snapshot, tipCount: 3 });
  const lines = [
    `Here is what your numbers say about "${String(message).slice(0, 80)}":`,
    '',
    advice.headline,
    '',
    ...advice.tips.map((t, i) => `${i + 1}. ${t.title} - ${t.detail}`),
  ];
  if (advice.warning) lines.push('', advice.warning);
  lines.push('', '(The AI advisor is not configured, so this is HostelWallet built-in advice.)');
  return { reply: lines.join('\n') };
};

const fallbackTip = ({ user, snapshot }) => {
  const cur = user.currency;
  const { breakdown = [], remaining = 0, daysLeftInMonth = 1 } = snapshot;

  if (!breakdown.length) {
    return {
      tip: 'Log every expense for the next three days, even the chai at the canteen. You cannot cut what you cannot see.',
    };
  }

  const top = breakdown[0];

  // Already past the income for this month: a "safe daily spend" would be a
  // negative number, which is not advice. Say the honest thing instead.
  if (remaining <= 0) {
    return {
      tip: `You are ${money(cur, Math.abs(remaining))} past your income this month, with ${top.category} the biggest slice at ${money(cur, top.amount)}. Treat the next ${daysLeftInMonth} days as a spend-nothing stretch and start next month with a limit on ${top.category}.`,
    };
  }

  const perDay = daysLeftInMonth > 0 ? remaining / daysLeftInMonth : remaining;
  return {
    tip: `${top.category} is your biggest cost at ${money(cur, top.amount)}. With ${daysLeftInMonth} days left, keep it under ${money(cur, perDay)} a day and you will finish the month in the green.`,
  };
};

const fallbackBudget = ({ user, snapshot, categories }) => {
  const income = user.monthlyIncome || snapshot.income || 0;
  const list = categories && categories.length ? categories.slice() : DEFAULT_CATEGORIES.slice();

  // Blend the default split with the student's real habits, then round to 50.
  const spentBy = {};
  (snapshot.breakdown || []).forEach((b) => {
    spentBy[b.category] = b.amount;
  });

  const rows = list.map((category) => {
    const share = FALLBACK_BUDGET_SPLIT[category] != null ? FALLBACK_BUDGET_SPLIT[category] : 0.05;
    const fromSplit = income * share;
    const actual = spentBy[category] || 0;
    const blended = actual > 0 ? (fromSplit + actual) / 2 : fromSplit;
    return {
      category,
      limit: Math.round((blended * 0.9) / 50) * 50, // the 10% trim leaves room to save
      reason: actual > 0 ? 'Based on what you actually spend here' : 'Standard hostel-student allocation',
    };
  });

  const allocated = rows.reduce((sum, r) => sum + r.limit, 0);
  return {
    summary:
      income > 0
        ? `A starter plan for ${money(user.currency, income)} a month, trimmed by about 10% so there is always something left to save.`
        : 'Add your monthly pocket money in Settings to get a plan sized to your income.',
    savingsTarget: Math.max(0, Math.round((income - allocated) / 50) * 50),
    categories: rows,
  };
};

module.exports = {
  isConfigured,
  snapshotToText,
  getAdvice,
  chat,
  dailyTip,
  suggestBudget,
  weeklySummary,
  activeModel,
  modelChain,
};
