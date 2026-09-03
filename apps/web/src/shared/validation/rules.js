/**
 * The web app's side of the shared validation rules.
 *
 * The rules themselves are not here. They live in @hostelwallet/contracts and
 * the API applies the identical functions, so the sign-up form and the server
 * cannot disagree about whether a name, an email or a password is acceptable.
 * What this file adds is the two things only a browser needs: zod refinements
 * so react-hook-form can drive the messages, and a live view of which password
 * requirements are met so far.
 *
 * Nothing here decides anything. The server is still the authority; this only
 * lets a student find out before they press the button.
 */

import { z } from 'zod';
/*
 * Imported as a default and unpacked here, not as named imports.
 *
 * contracts/validation.js is CommonJS, because the API requires it directly.
 * Rollup can follow a CJS module's default export through a production build
 * but cannot statically prove its named exports exist, so `import { checkName }`
 * builds under vitest and then fails `vite build`. One line of unpacking buys
 * a single shared implementation instead of a second copy of the rules.
 */
import validation from '@hostelwallet/contracts/validation';

const {
  checkName,
  normalizeName,
  checkEmail,
  normalizeEmail,
  checkPassword,
  passwordRequirements,
  rules,
} = validation;

export { passwordRequirements, normalizeName, normalizeEmail, rules };

/**
 * Turns one of the shared checkers into a zod string schema.
 *
 * The value is normalised first, exactly as the server normalises it, so what
 * the form validates is what the server will receive - and the trimmed,
 * space-collapsed version is what gets submitted.
 */
const fromChecker = (normalize, check) =>
  z
    .string()
    .transform(normalize)
    .superRefine((value, ctx) => {
      const result = check(value);
      if (!result.ok) ctx.addIssue({ code: z.ZodIssueCode.custom, message: result.message });
    });

export const nameSchema = fromChecker(normalizeName, checkName);
export const emailSchema = fromChecker(normalizeEmail, checkEmail);

/** Passwords are never trimmed: a leading space is a character the student chose. */
export const passwordSchema = z.string().superRefine((value, ctx) => {
  const result = checkPassword(value);
  if (!result.ok) ctx.addIssue({ code: z.ZodIssueCode.custom, message: result.message });
});

export const PASSWORD_MISMATCH = rules.password.messages.mismatch;
export const TERMS_MESSAGE = rules.terms.message;
