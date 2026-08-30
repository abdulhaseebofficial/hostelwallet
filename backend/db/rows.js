/**
 * Row shaping.
 *
 * Postgres columns are snake_case; the API has always spoken camelCase with a
 * Mongo-style `_id`, and the frontend and the QA suites both depend on that.
 * Rather than spell the mapping out per column in every repository, translate
 * it in one place - so a new column is exposed correctly by default and the
 * wire format cannot drift table by table.
 */

/** snake_case -> camelCase, with `id` becoming `_id`. */
const camel = (key) => {
  if (key === 'id') return '_id';
  return key.replace(/_([a-z0-9])/g, (_m, c) => c.toUpperCase());
};

/**
 * One row, ready to serialise. Returns null for a missing row so callers can
 * pass a "not found" straight through.
 *
 * `omit` drops columns that must never leave the server - the password hash,
 * the reset token, the token version.
 */
const toApi = (row, omit = []) => {
  if (!row) return null;
  const out = {};
  for (const [key, value] of Object.entries(row)) {
    if (omit.includes(key)) continue;
    out[camel(key)] = value;
  }
  return out;
};

/** The same, for a list. */
const toApiList = (rows, omit = []) => rows.map((row) => toApi(row, omit));

/**
 * Builds `SET a = $1, b = $2` from an object of column -> value, skipping
 * undefined so a partial update only touches what was actually sent. Returns
 * the fragment, the values, and the next free placeholder number.
 */
const buildSet = (patch, startAt = 1) => {
  const fragments = [];
  const values = [];
  let n = startAt;
  for (const [column, value] of Object.entries(patch)) {
    if (value === undefined) continue;
    fragments.push(`${column} = $${n}`);
    values.push(value);
    n += 1;
  }
  return { fragment: fragments.join(', '), values, next: n };
};

/**
 * True when the string is a syntactically valid UUID.
 *
 * Postgres raises 22P02 for a malformed uuid, which would surface as a 500.
 * Every lookup by id checks this first and reports "not found" instead, which
 * is what the old ObjectId CastError path did.
 */
const isUuid = (value) =>
  typeof value === 'string' &&
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);

module.exports = { toApi, toApiList, buildSet, isUuid, camel };
