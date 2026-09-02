/**
 * Dashboard endpoint. Request in, JSON out; the assembly is in
 * dashboard.service.
 */

const dashboard = require('./dashboard.service');
const asyncHandler = require('../../shared/http/asyncHandler');

/**
 * GET /api/dashboard/summary
 * One call returns everything the home screen renders: headline numbers, the
 * pie chart data, the trend line, recent transactions and active goals.
 */
const getSummary = asyncHandler(async (req, res) => {
  const data = await dashboard.summary(req.user, req.query);
  res.json({ success: true, data });
});

module.exports = { getSummary };
