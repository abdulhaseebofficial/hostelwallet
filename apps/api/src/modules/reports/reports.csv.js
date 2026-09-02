/**
 * CSV serialisation for the export.
 *
 * Pure string work, kept apart from the handler so the escaping rule below can
 * be tested directly - it is the part that would quietly matter.
 */

/**
 * Cells that a spreadsheet would execute rather than display.
 *
 * Quoting alone is not enough: Excel and Sheets treat a leading =, +, - or @ as
 * a FORMULA, so an expense described as `=HYPERLINK("http://evil","hi")` would
 * run when the student opens their own export. A tab or carriage return can
 * start the same thing.
 */
const FORMULA_TRIGGERS = ['=', '+', '-', '@', String.fromCharCode(9), String.fromCharCode(13)];

/** Escapes one CSV cell, neutralising anything formula-shaped. */
const csvCell = (value) => {
  if (value === null || value === undefined) return '';
  let text = String(value);

  // Prefixing a single quote stops the evaluation while still displaying the
  // original text.
  if (FORMULA_TRIGGERS.includes(text.charAt(0))) text = `'${text}`;

  if (/[",\r\n]/.test(text)) text = `"${text.replace(/"/g, '""')}"`;
  return text;
};

/** Rows of cells to a CSV document. */
const toCsv = (rows) => rows.map((row) => row.map(csvCell).join(',')).join('\r\n');

module.exports = {
  csvCell,
  toCsv,
};
