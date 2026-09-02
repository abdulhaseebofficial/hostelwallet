/**
 * Strips operator-shaped keys out of anything the client sends.
 *
 * Every query in this app is parameterised, so a crafted body cannot reach the
 * database as anything but a value. This runs anyway because parameterisation
 * only protects the database: code that reads `req.body.email` expecting a
 * string and gets `{"$ne": null}` still compares, concatenates or logs an
 * object, and those bugs are easy to write and hard to spot. No legitimate
 * field here starts with `$` or contains a `.`, so rejecting them costs one
 * pass over the body and closes the whole class centrally rather than route by
 * route.
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
