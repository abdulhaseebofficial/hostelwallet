/**
 * A request URL with the secrets taken out, for logging.
 *
 * Access logs are kept, shipped and read by people who are not the account
 * holder. Anything in a URL ends up in them, which is fine for /expenses?page=2
 * and not fine for a password-reset token: that token is a live
 * account-takeover credential for thirty minutes, and a log line outlives it.
 *
 * The token stays in the path rather than moving to the request body, because
 * moving it would invalidate every reset link already sitting in somebody's
 * inbox. Redacting at the log boundary costs nothing and breaks nothing.
 *
 * Add a pattern here whenever a route puts something sensitive in a path or a
 * query string.
 */

const REDACTIONS = [
  // POST /api/auth/reset-password/:token
  [/(\/auth\/reset-password\/)[^/?#]+/gi, '$1<redacted>'],
  // Anything that ever arrives as ?token=... or ?access_token=...
  [/([?&](?:access_)?token=)[^&#]+/gi, '$1<redacted>'],
];

const safeUrl = (url) =>
  REDACTIONS.reduce((current, [pattern, replacement]) => current.replace(pattern, replacement),
    String(url == null ? '' : url));

module.exports = { safeUrl };
