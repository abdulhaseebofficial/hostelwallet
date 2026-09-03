/**
 * The name, email and password rules.
 *
 * These matter more than most unit tests because of where the rules run: the
 * sign-up form applies them to tell a student what is wrong, and the API
 * applies them to decide. If the two ever disagreed, the form would accept
 * something the server rejects - and nothing on screen would explain why.
 *
 * They cannot disagree, because there is only one implementation and this is
 * it. `assertOneImplementation` below is the assertion that keeps that true:
 * it checks the API's validator chain is built from these exact functions
 * rather than from a second copy of the regex.
 */

const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');

const CONTRACTS = path.join(__dirname, '..', '..', 'packages', 'contracts', 'validation');
const {
  checkName,
  normalizeName,
  checkEmail,
  normalizeEmail,
  checkPassword,
  passwordRequirements,
  passwordsMatch,
  rules,
} = require(CONTRACTS);

/* -------------------------------- name -------------------------------- */

test('accepts an ordinary name', () => {
  assert.strictEqual(checkName('Ali').ok, true);
  assert.strictEqual(checkName('Abdul Haseeb').ok, true);
});

test('accepts names with several parts', () => {
  assert.strictEqual(checkName('Muhammad Abdul Haseeb Khan').ok, true);
});

test('accepts hyphens and apostrophes, which are parts of real names', () => {
  for (const name of ['Anne-Marie', "O'Brien", "D'Souza", 'Jean-Luc', 'Al-Rashid', 'O’Neill']) {
    assert.strictEqual(checkName(name).ok, true, `rejected ${name}`);
  }
});

test('accepts names in other scripts', () => {
  // The rule is \p{L}, not [A-Za-z]. An ASCII-only pattern would tell most of
  // the world their own name is invalid.
  for (const name of ['José', 'Müller', 'محمد علی', 'Владимир', 'নাসরিন', '李小龍', 'Nguyễn']) {
    assert.strictEqual(checkName(name).ok, true, `rejected ${name}`);
  }
});

test('rejects digits', () => {
  const result = checkName('Ali123');
  assert.strictEqual(result.ok, false);
  assert.strictEqual(result.message, 'Name can only contain letters, spaces, hyphens, and apostrophes.');
});

test('rejects an email address in the name field', () => {
  assert.strictEqual(checkName('ali@example.com').ok, false);
});

test('rejects markup and script content', () => {
  for (const name of ['<script>alert(1)</script>', 'Ali <b>', 'Ali & Sons', 'Ali/Khan', 'Ali_Khan']) {
    assert.strictEqual(checkName(name).ok, false, `accepted ${name}`);
  }
});

test('rejects emoji', () => {
  assert.strictEqual(checkName('Ali 😀').ok, false);
  assert.strictEqual(checkName('😀').ok, false);
});

test('rejects an empty or whitespace-only name', () => {
  for (const name of ['', '   ', '\t\n', null, undefined]) {
    const result = checkName(name);
    assert.strictEqual(result.ok, false, `accepted ${JSON.stringify(name)}`);
    assert.strictEqual(result.message, rules.name.messages.required);
  }
});

test('rejects a name that is only punctuation', () => {
  for (const name of ['-', "'", '- -', "''"]) {
    assert.strictEqual(checkName(name).ok, false, `accepted ${name}`);
  }
});

test('trims and collapses spaces rather than rejecting them', () => {
  assert.strictEqual(normalizeName('  Abdul   Haseeb  '), 'Abdul Haseeb');
  assert.strictEqual(checkName('  Abdul   Haseeb  ').value, 'Abdul Haseeb');
});

test('never repairs an invalid name into a different one', () => {
  // The dangerous alternative is stripping the digits and saving "Ali", which
  // stores a name the student never typed.
  const result = checkName('Ali123');
  assert.strictEqual(result.ok, false);
  assert.strictEqual(result.value, 'Ali123', 'the original was altered');
});

test('rejects a name longer than the limit', () => {
  assert.strictEqual(checkName('a'.repeat(rules.name.maxLength + 1)).ok, false);
  assert.strictEqual(checkName('a'.repeat(rules.name.maxLength)).ok, true);
});

/* -------------------------------- email ------------------------------- */

test('accepts ordinary addresses', () => {
  for (const email of [
    'a@b.co',
    'student@university.edu',
    'abdul.haseeb@gmail.com',
    'first+tag@example.co.uk',
    "o'brien@example.com",
    'user_name@sub.domain.example',
  ]) {
    assert.strictEqual(checkEmail(email).ok, true, `rejected ${email}`);
  }
});

test('rejects malformed addresses', () => {
  for (const email of [
    '', 'notanemail', 'a@@b.com', '@b.com', 'a@', 'a@b', 'a b@c.com',
    'a@b .com', 'a@.com', 'a@b..com', 'a@b.', '.@.',
  ]) {
    assert.strictEqual(checkEmail(email).ok, false, `accepted ${JSON.stringify(email)}`);
  }
});

test('trims surrounding whitespace', () => {
  assert.strictEqual(checkEmail('  a@b.co  ').value, 'a@b.co');
  assert.strictEqual(normalizeEmail('\ta@b.co\n'), 'a@b.co');
});

test('does not rewrite the address the student typed', () => {
  // express-validator's normalizeEmail() stripped Gmail dots and +tags, so
  // first.last@gmail.com was stored as firstlast@gmail.com.
  assert.strictEqual(checkEmail('first.last+box@gmail.com').value, 'first.last+box@gmail.com');
  assert.strictEqual(checkEmail('MixedCase@Example.com').value, 'MixedCase@Example.com');
});

test('rejects an address past the length limits', () => {
  assert.strictEqual(checkEmail(`${'a'.repeat(65)}@b.co`).ok, false, 'local part too long');
  assert.strictEqual(checkEmail(`${'a'.repeat(250)}@b.co`).ok, false, 'whole address too long');
});

/* ------------------------------ password ------------------------------ */

const STRONG = 'Hostel1!';

test('accepts a password meeting every requirement', () => {
  assert.strictEqual(checkPassword(STRONG).ok, true);
});

test('each requirement is enforced on its own', () => {
  const cases = {
    length: 'Ab1!',
    uppercase: 'hostel1!',
    lowercase: 'HOSTEL1!',
    number: 'HostelAa!',
    special: 'Hostel123',
  };
  for (const [key, password] of Object.entries(cases)) {
    const result = checkPassword(password);
    assert.strictEqual(result.ok, false, `${key}: accepted ${password}`);
    const failed = result.requirements.find((r) => r.key === key);
    assert.strictEqual(failed.met, false, `${key} was reported as met for ${password}`);
  }
});

test('rejects leading or trailing spaces', () => {
  assert.strictEqual(checkPassword(' Hostel1!').ok, false);
  assert.strictEqual(checkPassword('Hostel1! ').ok, false);
  // A space in the middle is fine - a passphrase is a good password.
  assert.strictEqual(checkPassword('Hostel my 1!').ok, true);
});

test('rejects a password past the bcrypt limit', () => {
  assert.strictEqual(checkPassword(`${'Aa1!'.repeat(18)}x`).ok, false);
});

test('the live checklist reports progress requirement by requirement', () => {
  const met = (value, key) => passwordRequirements(value).find((r) => r.key === key).met;

  assert.strictEqual(met('', 'lowercase'), false);
  assert.strictEqual(met('a', 'lowercase'), true);
  assert.strictEqual(met('a', 'uppercase'), false);
  assert.strictEqual(met('aA', 'uppercase'), true);
  assert.strictEqual(met('aA', 'number'), false);
  assert.strictEqual(met('aA1', 'number'), true);
  assert.strictEqual(met('aA1', 'special'), false);
  assert.strictEqual(met('aA1!', 'special'), true);
  assert.strictEqual(met('aA1!', 'length'), false);
  assert.strictEqual(met('aA1!aA1!', 'length'), true);
});

test('every requirement has wording the checklist can show', () => {
  for (const requirement of passwordRequirements('')) {
    assert.ok(requirement.label && requirement.label.length > 3, `${requirement.key} has no label`);
  }
});

test('confirmation must match and must not be empty', () => {
  assert.strictEqual(passwordsMatch(STRONG, STRONG), true);
  assert.strictEqual(passwordsMatch(STRONG, 'Hostel1?'), false);
  assert.strictEqual(passwordsMatch('', ''), false);
});

/* ------------------- one implementation, not two ---------------------- */

test('the API validator is built from these functions, not a second copy', () => {
  // Grep-level, deliberately: the point is that apps/api does not carry its own
  // regex for any of this. If someone adds one, this fails and says so.
  const rulesFile = path.join(__dirname, '..', '..', 'apps', 'api', 'src', 'shared', 'validation', 'rules.js');
  const source = fs.readFileSync(rulesFile, 'utf8');

  assert.ok(
    source.includes("require('@hostelwallet/contracts/validation')"),
    'the API validator no longer imports the shared rules'
  );
  for (const fn of ['checkName', 'checkEmail', 'checkPassword']) {
    assert.ok(source.includes(fn), `the API validator does not use ${fn}`);
  }
});

test('the web form is built from these functions too', () => {
  const webRules = path.join(__dirname, '..', '..', 'apps', 'web', 'src', 'shared', 'validation', 'rules.js');
  const source = fs.readFileSync(webRules, 'utf8');
  assert.ok(source.includes('@hostelwallet/contracts/validation'), 'the web rules no longer import the shared module');
});
