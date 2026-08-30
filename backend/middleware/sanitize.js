/**
 * Strips operator-shaped keys out of anything the client sends.
 *
 * This was written against MongoDB, where a body like `{"email": {"$ne": null}}`
 * reached the query as an operator and was a login bypass. On Postgres every
 * query is parameterised, so that exact attack is gone - but the middleware is
 * kept because it still rejects object-shaped values in fields the code reads
 * as strings, and no legitimate field in this app starts with `$` or contains
 * a `.`. It costs one pass over the body and closes a whole class of surprises
 * centrally rather than route by route.
 */

const isPlainObject = (value) =>
  value !== null && typeof value === 'object' && !Array.isArray(value) && !(value instanceof Date);

/** Recursively removes dangerous keys. Returns how many were dropped. */
const scrub = (value, removed, depth = 0) => {
  // Guard against a deeply nested payload built purely to burn CPU.
  if (depth > 12) return removed;

  if (Array.isArray(value)) {
    value.forEach((item) => scrub(item, removed, depth + 1));
    return removed;
  }

  if (!isPlainObject(value)) return removed;

  for (const key of Object.keys(value)) {
    if (key.startsWith('$') || key.includes('.')) {
      removed.push(key);
      delete value[key];
      continue;
    }
    scrub(value[key], removed, depth + 1);
  }

  return removed;
};

const sanitizeRequest = (req, _res, next) => {
  const removed = [];

  // req.query is a getter on newer Express versions, so mutate it in place
  // rather than reassigning it.
  [req.body, req.params, req.query].forEach((source) => {
    if (source) scrub(source, removed);
  });

  if (removed.length) {
    console.warn(
      `[security] stripped ${removed.length} operator key(s) from ${req.method} ${req.originalUrl}: ${removed.join(', ')}`
    );
  }

  next();
};

module.exports = sanitizeRequest;
