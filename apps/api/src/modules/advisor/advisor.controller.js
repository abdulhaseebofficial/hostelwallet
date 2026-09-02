/**
 * AI advisor endpoints. Request in, JSON out; everything the advisor decides
 * is in advisor.service.
 */

const advisor = require('./advisor.service');
const asyncHandler = require('../../shared/http/asyncHandler');

/** GET /api/ai/status - lets the UI show an "AI offline" badge honestly. */
const status = asyncHandler(async (_req, res) => {
  res.json({ success: true, data: advisor.status() });
});

/**
 * POST /api/ai/advice
 * Analyses the month and returns structured, actionable tips.
 */
const advice = asyncHandler(async (req, res) => {
  const data = await advisor.advice(req.user, req.body);
  res.json({ success: true, data });
});

/**
 * POST /api/ai/chat
 * Conversational Q&A grounded in the student's real numbers.
 */
const chat = asyncHandler(async (req, res) => {
  const data = await advisor.chat(req.user, req.body.message);
  res.json({ success: true, data });
});

/** GET /api/ai/chat/history */
const chatHistory = asyncHandler(async (req, res) => {
  const messages = await advisor.history(req.user._id, req.query.limit);
  res.json({ success: true, data: { messages } });
});

/** DELETE /api/ai/chat - start a fresh conversation. */
const clearChat = asyncHandler(async (req, res) => {
  await advisor.clearChat(req.user._id);
  res.json({ success: true, message: 'Conversation cleared' });
});

/** GET /api/ai/tip - one short tip, cached per student per day. */
const tip = asyncHandler(async (req, res) => {
  const data = await advisor.dailyTip(req.user, { refresh: Boolean(req.query.refresh) });
  res.json({ success: true, data });
});

/**
 * POST /api/ai/suggest-budget
 * Returns a per-category plan as JSON. Nothing is saved until the student
 * hits "apply" on the Budget page (POST /api/budget/bulk).
 */
const suggestBudget = asyncHandler(async (req, res) => {
  const data = await advisor.suggestBudget(req.user, req.body);
  res.json({ success: true, data });
});

/** GET /api/ai/weekly-summary */
const weeklySummary = asyncHandler(async (req, res) => {
  const data = await advisor.weeklySummary(req.user);
  res.json({ success: true, data });
});

module.exports = {
  status,
  advice,
  chat,
  chatHistory,
  clearChat,
  tip,
  suggestBudget,
  weeklySummary,
};
