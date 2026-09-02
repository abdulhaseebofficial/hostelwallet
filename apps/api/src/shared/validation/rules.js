/**
 * The validation pieces every module's validator builds on.
 *
 * The chains themselves live with their feature; only what all of them need
 * is here, so a new rule about ids or passwords is written once.
 */

const { body, param, query } = require('express-validator');
const { CURRENCIES } = require('../constants');

const CURRENCY_CODES = CURRENCIES.map((c) => c.code);

// Ids are Postgres uuids. Anything else is rejected here rather than reaching
// a query, where a malformed uuid would raise 22P02 and read as a 500.
const idParam = (name) => param(name).isUUID().withMessage('Invalid id');

const password = (field = 'password') =>
  body(field)
    .isString()
    .isLength({ min: 8, max: 72 })
    .withMessage('Password must be 8-72 characters')
    .matches(/[a-zA-Z]/)
    .withMessage('Password must contain a letter')
    .matches(/[0-9]/)
    .withMessage('Password must contain a number');

const amount = (field = 'amount') =>
  body(field)
    .exists({ checkFalsy: true })
    .withMessage('Amount is required')
    .bail()
    .isFloat({ gt: 0, max: 100000000 })
    .withMessage('Amount must be a positive number')
    .toFloat();

/* ------------------------------- auth -------------------------------- */

module.exports = { idParam, password, amount, CURRENCY_CODES };
