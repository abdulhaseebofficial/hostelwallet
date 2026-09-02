/**
 * CSV escaping.
 *
 * This is the one piece of the export that would matter quietly. A student
 * types an expense description; the export ends up in Excel; Excel decides a
 * cell starting with `=` is a formula and runs it. The end-to-end test only
 * checks the export is non-empty, so this is where that rule is actually held.
 */

const test = require('node:test');
const assert = require('node:assert');
const path = require('path');

const { csvCell, toCsv } = require(path.join(
  __dirname, '..', '..', 'apps', 'api', 'src', 'modules', 'reports', 'reports.csv'
));

/**
 * A cell may also be CSV-quoted, and that happens after the defusing. Strip
 * the wrapper so the assertion is about the value a spreadsheet will see.
 */
const contentOf = (cell) =>
  cell.startsWith('"') && cell.endsWith('"') ? cell.slice(1, -1).replace(/""/g, '"') : cell;

const TAB = String.fromCharCode(9);
const CR = String.fromCharCode(13);

test('ordinary values pass through untouched', () => {
  assert.strictEqual(csvCell('Dhaba lunch'), 'Dhaba lunch');
  assert.strictEqual(csvCell(250), '250');
  assert.strictEqual(csvCell(0), '0', 'zero is a value, not an absence');
});

test('missing values become an empty cell, not the word undefined', () => {
  assert.strictEqual(csvCell(null), '');
  assert.strictEqual(csvCell(undefined), '');
});

test('formula-shaped cells are neutralised', () => {
  // The attack: a description that a spreadsheet executes on open.
  const value = contentOf(csvCell('=HYPERLINK("http://evil","click")'));

  assert.ok(value.startsWith("'"), 'a leading = must be defused');
  assert.ok(!value.startsWith('='), 'the value must not begin with =');
  assert.ok(value.includes('HYPERLINK'), 'the text itself is still readable');
});

test('every formula trigger is covered, not just =', () => {
  for (const trigger of ['=', '+', '-', '@', TAB, CR]) {
    const value = contentOf(csvCell(trigger + 'cmd'));
    assert.ok(
      value.startsWith("'"),
      JSON.stringify(trigger) + ' was not defused: ' + JSON.stringify(value)
    );
  }
});

test('a negative amount survives as a readable number', () => {
  // Defused, because a leading - is a formula trigger, but still legible.
  assert.strictEqual(csvCell('-500'), "'-500");
});

test('quotes and separators are quoted the way CSV expects', () => {
  assert.strictEqual(csvCell('a,b'), '"a,b"');
  assert.strictEqual(csvCell('say "hi"'), '"say ""hi"""');
  assert.strictEqual(csvCell('line1\nline2'), '"line1\nline2"');
});

test('toCsv joins rows with CRLF, which is what spreadsheets expect', () => {
  const out = toCsv([
    ['Date', 'Category', 'Amount'],
    ['2026-09-01', 'Mess/Food', 250],
  ]);

  assert.strictEqual(out, 'Date,Category,Amount\r\n2026-09-01,Mess/Food,250');
});

test('an empty row becomes a blank line rather than disappearing', () => {
  assert.strictEqual(toCsv([['a'], [], ['b']]), 'a\r\n\r\nb');
});
