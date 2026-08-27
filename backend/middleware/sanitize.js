/**
 * Strips MongoDB query operators out of anything the client sends.
 *
 * Without this, a JSON body like `{"email": {"$ne": null}}` reaches a Mongoose
 * query as an operator rather than a value. Individual routes here happen to
 * validate their inputs, but that is a property of each route rather than of
 * the app - one new endpoint that forwards req.body into a query would be a
 * login bypass. This closes the whole class centrally.
 *
 * Keys starting with `$` are operators; keys containing `.` reach into nested
 * paths. Both are removed and the removal is logged.
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
