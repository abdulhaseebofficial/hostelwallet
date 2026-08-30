const chatRepo = require('../db/chatMessages');
const ApiError = require('../utils/ApiError');
const asyncHandler = require('../utils/asyncHandler');
const aiService = require('../services/aiService');
const { buildSnapshot, buildWeeklySnapshot } = require('../services/analyticsService');
const { currentPeriod } = require('../utils/calculations');

// The tip of the day is identical for a whole day, so it is cached in memory.
// One Claude call per user per day instead of one per page load.
const tipCache = new Map(); // userId -> { day, payload }
const today = () => new Date().toISOString().slice(0, 10);

const periodFrom = (query) => ({
  month: Number(query.month) || currentPeriod().month,
  year: Number(query.year) || currentPeriod().year,
});

/** GET /api/ai/status - lets the UI show an "AI offline" badge honestly. */
const status = asyncHandler(async (req, res) => {
  res.json({
    success: true,
    data: {
      configured: aiService.isConfigured(),
      // The model actually answering, which may not be the configured one if
      // this key could not reach it.
      model: aiService.isConfigured() ? aiService.activeModel() : null,
      modelChain: aiService.isConfigured() ? aiService.modelChain() : [],
      fallback: 'Built-in rule based advisor',
    },
  });
});

/**
 * POST /api/ai/advice
 * Analyses the month and returns structured, actionable tips.
 */
const advice = asyncHandler(async (req, res) => {
  const snapshot = await buildSnapshot(req.user, periodFrom(req.body));
  const tipCount = Math.min(5, Math.max(3, Number(req.body.tipCount) || 4));

  const result = await aiService.getAdvice({ user: req.user, snapshot, tipCount });

  res.json({
    success: true,
    data: {
      ...result,
      context: {
        monthLabel: snapshot.monthLabel,
        totalSpent: snapshot.totalSpent,
        remaining: snapshot.remaining,
        income: snapshot.income,
        topCategory: snapshot.topCategory,
      },
    },
  });
});

/**
 * POST /api/ai/chat
 * Conversational Q&A grounded in the student's real numbers. The last 20
 * messages are replayed so follow-up questions make sense.
 */
const chat = asyncHandler(async (req, res) => {
  const message = String(req.body.message || '').trim();
  if (!message) throw ApiError.badRequest('Type a question first');
  if (message.length > 1000) throw ApiError.badRequest('That question is a bit too long, try shortening it');

  const [snapshot, history] = await Promise.all([
    buildSnapshot(req.user, currentPeriod()),
    chatRepo.recentForUser(req.user._id, 20),
  ]);

  const orderedHistory = history.map((m) => ({ role: m.role, content: m.content }));

  const result = await aiService.chat({
    user: req.user,
    snapshot,
    history: orderedHistory,
    message,
  });

  // Persist both sides so the conversation survives a refresh.
  await chatRepo.addMany(req.user._id, [
    { role: 'user', content: message },
    { role: 'assistant', content: result.reply },
  ]);

  res.json({ success: true, data: result });
});

/** GET /api/ai/chat/history */
const chatHistory = asyncHandler(async (req, res) => {
  const limit = Math.min(100, Number(req.query.limit) || 50);
  const messages = await chatRepo.recentForUser(req.user._id, limit);

  res.json({ success: true, data: { messages } });
});

/** DELETE /api/ai/chat - start a fresh conversation. */
const clearChat = asyncHandler(async (req, res) => {
  await chatRepo.clear(req.user._id);
  res.json({ success: true, message: 'Conversation cleared' });
});

/** GET /api/ai/tip - one short tip, cached per user per day. */
const tip = asyncHandler(async (req, res) => {
  const key = String(req.user._id);
  const cached = tipCache.get(key);

  if (cached && cached.day === today() && !req.query.refresh) {
    return res.json({ success: true, data: { ...cached.payload, cached: true } });
  }

  const snapshot = await buildSnapshot(req.user, currentPeriod());
  const payload = await aiService.dailyTip({ user: req.user, snapshot });

  tipCache.set(key, { day: today(), payload });
  res.json({ success: true, data: { ...payload, cached: false } });
});

/**
 * POST /api/ai/suggest-budget
 * Returns a per-category plan as JSON. Nothing is saved until the student
 * hits "apply" on the Budget page (POST /api/budget/bulk).
 */
const suggestBudget = asyncHandler(async (req, res) => {
  const snapshot = await buildSnapshot(req.user, periodFrom(req.body));
  const categories = req.user.allCategories();

  const result = await aiService.suggestBudget({ user: req.user, snapshot, categories });

  // Never trust a model with the maths: clamp anything above the income.
  const income = req.user.monthlyIncome || snapshot.income || 0;
  const allocated = (result.categories || []).reduce((sum, c) => sum + Number(c.limit || 0), 0);

  res.json({
    success: true,
    data: {
      ...result,
      income,
      allocated: Math.round(allocated * 100) / 100,
      exceedsIncome: income > 0 && allocated > income,
    },
  });
});

/** GET /api/ai/weekly-summary */
const weeklySummary = asyncHandler(async (req, res) => {
  const snapshot = await buildWeeklySnapshot(req.user);
  const result = await aiService.weeklySummary({ user: req.user, snapshot });

  res.json({
    success: true,
    data: { ...result, totalSpent: snapshot.totalSpent, breakdown: snapshot.breakdown },
  });
});

module.exports = { status, advice, chat, chatHistory, clearChat, tip, suggestBudget, weeklySummary };
