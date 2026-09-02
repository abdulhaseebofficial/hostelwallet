const PDFDocument = require('pdfkit');
const expensesRepo = require('../expenses/expenses.repository');
const incomeRepo = require('../income/income.repository');
const analytics = require('../analytics/analytics.repository');
const asyncHandler = require('../../shared/http/asyncHandler');
const { buildSnapshot, MONTH_NAMES } = require('../analytics/analytics.service');
const {
  currentPeriod,
  previousPeriod,
  startOfMonth,
  endOfMonth,
  changePercent,
  round2,
} = require('../../shared/utils/calculations');

const periodFrom = (query) => {
  const now = currentPeriod();
  return { month: Number(query.month) || now.month, year: Number(query.year) || now.year };
};

/**
 * GET /api/reports/monthly
 * The full month in one payload: totals, category breakdown, this-vs-last
 * comparison, budget adherence and the biggest single expense.
 */
const monthlyReport = asyncHandler(async (req, res) => {
  const period = periodFrom(req.query);
  const prev = previousPeriod(period);

  const [snapshot, prevSnapshot, biggest, incomeRows] = await Promise.all([
    buildSnapshot(req.user, period),
    buildSnapshot(req.user, prev),
    analytics.topExpenses(
      req.user._id,
      startOfMonth(period.year, period.month),
      endOfMonth(period.year, period.month),
      1
    ),
    incomeRepo.totalsBySource(
      req.user._id,
      startOfMonth(period.year, period.month),
      endOfMonth(period.year, period.month)
    ),
  ]);

  // Category-by-category movement between the two months.
  const categories = new Set([
    ...Object.keys(snapshot.byCategory),
    ...Object.keys(prevSnapshot.byCategory),
  ]);
  const categoryComparison = [...categories]
    .map((category) => {
      const current = snapshot.byCategory[category] || 0;
      const previous = prevSnapshot.byCategory[category] || 0;
      return { category, current, previous, change: round2(current - previous), changePercent: changePercent(current, previous) };
    })
    .sort((a, b) => b.current - a.current);

  const overBudget = snapshot.budgets.filter((b) => b.status === 'over');

  res.json({
    success: true,
    data: {
      period,
      monthLabel: snapshot.monthLabel,
      currency: req.user.currency,

      totals: {
        income: snapshot.income,
        spent: snapshot.totalSpent,
        saved: snapshot.remaining,
        savingsRate: snapshot.income > 0 ? Math.round((snapshot.remaining / snapshot.income) * 100) : 0,
        dailyAverage: snapshot.dailyAverage,
        transactionCount: snapshot.expenseCount,
      },

      breakdown: snapshot.breakdown,
      trend: snapshot.trend,
      highestCategory: snapshot.breakdown[0] || null,
      biggestExpense: biggest[0] || null,
      incomeBySource: incomeRows.map((r) => ({ source: r.source, amount: round2(r.total) })),

      comparison: {
        previousLabel: prevSnapshot.monthLabel,
        previousSpent: prevSnapshot.totalSpent,
        change: round2(snapshot.totalSpent - prevSnapshot.totalSpent),
        changePercent: changePercent(snapshot.totalSpent, prevSnapshot.totalSpent),
        categories: categoryComparison,
      },

      budgets: snapshot.budgets,
      overBudget,
      goals: snapshot.goals,
    },
  });
});

/**
 * Escapes one CSV cell.
 *
 * Quoting alone is not enough: Excel and Sheets treat a leading =, +, - or @ as
 * a FORMULA, so an expense described as `=HYPERLINK("http://evil","hi")` would
 * execute when the student opens their own export. Prefixing a single quote
 * neutralises it while still displaying the original text.
 */
const FORMULA_TRIGGERS = ['=', '+', '-', '@', String.fromCharCode(9), String.fromCharCode(13)];

const csvCell = (value) => {
  let text = value === null || value === undefined ? '' : String(value);

  if (text.length && FORMULA_TRIGGERS.includes(text[0])) {
    text = `'${text}`;
  }

  return '"' + text.split('"').join('""') + '"';
};

const toCsv = (rows) => rows.map((row) => row.map(csvCell).join(',')).join('\r\n');

/**
 * GET /api/reports/export?format=csv|pdf&month=&year=
 * Streams the month as a spreadsheet or a printable one-page PDF.
 */
const exportReport = asyncHandler(async (req, res) => {
  const period = periodFrom(req.query);
  const format = (req.query.format || 'csv').toLowerCase();
  const from = startOfMonth(period.year, period.month);
  const to = endOfMonth(period.year, period.month);
  const label = `${MONTH_NAMES[period.month - 1]}-${period.year}`;

  const [snapshot, expenses] = await Promise.all([
    buildSnapshot(req.user, period),
    expensesRepo.listForRange(req.user._id, from, to),
  ]);

  const cur = req.user.currency;

  if (format === 'csv') {
    const rows = [
      ['HostelWallet expense report'],
      ['Student', req.user.name],
      ['Period', snapshot.monthLabel],
      ['Currency', cur],
      [],
      ['Income', snapshot.income],
      ['Total spent', snapshot.totalSpent],
      ['Money left', snapshot.remaining],
      ['Transactions', expenses.length],
      [],
      ['Spending by category'],
      ['Category', 'Amount', 'Share %'],
      ...snapshot.breakdown.map((b) => [b.category, b.amount, b.percent]),
      [],
      ['All transactions'],
      ['Date', 'Category', 'Description', 'Payment method', 'Amount'],
      ...expenses.map((e) => [
        new Date(e.date).toISOString().slice(0, 10),
        e.category,
        e.description,
        e.paymentMethod,
        e.amount,
      ]),
    ];

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="hostelwallet-${label}.csv"`);
    // UTF-8 BOM so Excel renders currency symbols correctly.
    return res.send('\uFEFF' + toCsv(rows));
  }

  // ---------- PDF ----------
  const doc = new PDFDocument({ size: 'A4', margin: 48 });
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="hostelwallet-${label}.pdf"`);
  doc.pipe(res);

  const money = (n) => `${cur} ${round2(n).toLocaleString('en-IN')}`;
  const line = () => doc.moveDown(0.4).strokeColor('#e5e7eb').lineWidth(1)
    .moveTo(48, doc.y).lineTo(547, doc.y).stroke().moveDown(0.6);

  doc.fillColor('#4f46e5').fontSize(22).text('HostelWallet', { continued: true })
    .fillColor('#6b7280').fontSize(12).text('   monthly report');
  doc.moveDown(0.2);
  doc.fillColor('#111827').fontSize(16).text(snapshot.monthLabel);
  doc.fillColor('#6b7280').fontSize(10)
    .text(`${req.user.name}${req.user.hostelName ? ' - ' + req.user.hostelName : ''}`)
    .text(`Generated ${new Date().toDateString()}`);
  line();

  doc.fillColor('#111827').fontSize(13).text('Summary');
  doc.moveDown(0.3).fontSize(11).fillColor('#374151');
  doc.text(`Income: ${money(snapshot.income)}`);
  doc.text(`Total spent: ${money(snapshot.totalSpent)}`);
  doc.text(`Money left: ${money(snapshot.remaining)}   (${100 - snapshot.spentPercent}% of income)`);
  doc.text(`Average per day: ${money(snapshot.dailyAverage)}`);
  doc.text(`Transactions: ${expenses.length}`);
  line();

  doc.fillColor('#111827').fontSize(13).text('Spending by category');
  doc.moveDown(0.3).fontSize(11);
  if (!snapshot.breakdown.length) {
    doc.fillColor('#9ca3af').text('No expenses recorded for this month.');
  } else {
    snapshot.breakdown.forEach((b) => {
      // A simple text bar keeps the PDF dependency-free.
      const bar = '\u2588'.repeat(Math.max(1, Math.round(b.percent / 4)));
      doc.fillColor('#374151').text(`${b.category.padEnd(20, ' ')} ${money(b.amount).padStart(14, ' ')}  ${String(b.percent).padStart(5, ' ')}%`, { continued: true });
      doc.fillColor('#818cf8').text(`  ${bar}`);
    });
  }
  line();

  if (snapshot.budgets.length) {
    doc.fillColor('#111827').fontSize(13).text('Budget adherence');
    doc.moveDown(0.3).fontSize(11);
    snapshot.budgets.forEach((b) => {
      const colour = b.status === 'over' ? '#dc2626' : b.status === 'warning' ? '#d97706' : '#16a34a';
      doc.fillColor('#374151').text(`${b.category.padEnd(20, ' ')} ${money(b.spent)} of ${money(b.limit)}  `, { continued: true });
      doc.fillColor(colour).text(`${b.usedPercent}% ${b.status.toUpperCase()}`);
    });
    line();
  }

  doc.fillColor('#111827').fontSize(13).text('Transactions');
  doc.moveDown(0.3).fontSize(9).fillColor('#6b7280');
  doc.text('DATE        CATEGORY             DESCRIPTION                    METHOD      AMOUNT');
  doc.moveDown(0.2).fillColor('#374151');

  expenses.forEach((e) => {
    if (doc.y > 760) doc.addPage();
    const row = [
      new Date(e.date).toISOString().slice(0, 10).padEnd(12, ' '),
      String(e.category).slice(0, 20).padEnd(21, ' '),
      String(e.description || '-').slice(0, 29).padEnd(31, ' '),
      String(e.paymentMethod).slice(0, 11).padEnd(12, ' '),
      money(e.amount),
    ].join('');
    doc.text(row);
  });

  doc.moveDown(1).fontSize(9).fillColor('#9ca3af')
    .text('Generated by HostelWallet - your AI money coach for hostel life.', { align: 'center' });

  doc.end();
});

module.exports = { monthlyReport, exportReport };
