/**
 * The name, email and password rules, implemented once.
 *
 * vocabulary.json is shared as data because each side only needs to read a
 * list. These rules are different: the two sides must reach the *same verdict*
 * on the same input, and a rule expressed twice is a rule that will eventually
 * disagree with itself. The failure is quiet and lands on the student - the
 * form says the password is fine, the server says it is not, and nothing on
 * screen explains which one to believe.
 *
 * So the logic lives here and both sides call it. It is plain CommonJS with no
 * dependencies: the API requires it directly, and Vite converts it for the
 * browser. Nothing in here touches a database, a request or the DOM, which is
 * what makes that possible.
 *
 * The web app uses it for two things the API cannot do - telling the student
 * which requirement is still unmet, live, as they type - and the API uses it as
 * the authority. Passing here is necessary on the client and decisive on the
 * server.
 */

const rules = require('./validation.json');

/* ------------------------------- name -------------------------------- */

const NAME_RE = new RegExp(rules.name.pattern, 'u');

/**
 * Trims, and collapses any run of whitespace into a single space.
 *
 * This is the only tidying done to a name. It never strips a character the
 * student typed: a name with a digit in it is REJECTED, not silently repaired
 * into a different name and saved.
 */
const normalizeName = (value) =>
  String(value == null ? '' : value)
    .replace(/\s+/gu, ' ')
    .trim();

/** `{ ok, value, message }` - `value` is what should be stored when ok. */
const checkName = (value) => {
  const normalized = normalizeName(value);

  if (!normalized) return { ok: false, value: normalized, message: rules.name.messages.required };
  if (normalized.length > rules.name.maxLength) {
    return { ok: false, value: normalized, message: rules.name.messages.tooLong };
  }
  if (!NAME_RE.test(normalized)) {
    return { ok: false, value: normalized, message: rules.name.messages.pattern };
  }
  return { ok: true, value: normalized, message: null };
};

/* ------------------------------- email ------------------------------- */

const EMAIL_RE = new RegExp(rules.email.pattern, 'u');

/**
 * Trims surrounding whitespace, and nothing else.
 *
 * Notably it does NOT do what express-validator's normalizeEmail() did: strip
 * the dots and +tags out of a Gmail address. That rewrote the address the
 * student typed into a different string and stored that, so their own profile
 * showed an email they had never entered. Case is not touched either, because
 * the database's unique index is on lower(email) and every lookup already
 * compares that way - so matching is case-insensitive without the stored value
 * having to be altered.
 */
const normalizeEmail = (value) => String(value == null ? '' : value).trim();

const checkEmail = (value) => {
  const normalized = normalizeEmail(value);

  if (!normalized) return { ok: false, value: normalized, message: rules.email.messages.required };
  if (normalized.length > rules.email.maxLength) {
    return { ok: false, value: normalized, message: rules.email.messages.tooLong };
  }
  if (!EMAIL_RE.test(normalized)) {
    return { ok: false, value: normalized, message: rules.email.messages.pattern };
  }
  if (normalized.slice(0, normalized.lastIndexOf('@')).length > rules.email.maxLocalLength) {
    return { ok: false, value: normalized, message: rules.email.messages.pattern };
  }
  return { ok: true, value: normalized, message: null };
};

/* ----------------------------- password ------------------------------ */

const REQUIREMENTS = rules.password.requirements.map((requirement) => ({
  key: requirement.key,
  label: requirement.label,
  test: new RegExp(requirement.pattern, 'u'),
}));

/**
 * Every requirement, each marked met or not.
 *
 * Returned whole rather than as a pass/fail so the sign-up form can show the
 * student exactly what is still missing while they type, instead of one
 * message that changes as they fix things one at a time.
 */
const passwordRequirements = (value) => {
  const password = String(value == null ? '' : value);
  return REQUIREMENTS.map(({ key, label, test }) => ({ key, label, met: test.test(password) }));
};

const checkPassword = (value) => {
  const password = String(value == null ? '' : value);
  const requirements = passwordRequirements(password);

  if (!password) {
    return { ok: false, requirements, message: rules.password.messages.required };
  }
  if (password.length > rules.password.maxLength) {
    return { ok: false, requirements, message: rules.password.messages.tooLong };
  }

  const unmet = requirements.find((requirement) => !requirement.met);
  return unmet
    ? { ok: false, requirements, message: unmet.label }
    : { ok: true, requirements, message: null };
};

/** True only when both are non-empty and identical. */
const passwordsMatch = (password, confirmation) =>
  Boolean(password) && password === confirmation;

module.exports = {
  rules,
  normalizeName,
  checkName,
  normalizeEmail,
  checkEmail,
  passwordRequirements,
  checkPassword,
  passwordsMatch,
  PASSWORD_MESSAGES: rules.password.messages,
  TERMS_MESSAGE: rules.terms.message,
};
