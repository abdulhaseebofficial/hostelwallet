const express = require('express');
const ctrl = require('./debts.controller');
const validate = require('../../shared/middleware/validate');
const { protect } = require('../auth/auth.middleware');
const debtValidators = require('./debts.validator');

const router = express.Router();

router.use(protect);

// Before /:id, or "summary" would be read as an id.
router.get('/summary', ctrl.getSummary);

router.get('/', debtValidators.list, validate, ctrl.listDebts);
router.post('/', debtValidators.create, validate, ctrl.createDebt);

router.get('/:id', debtValidators.byId, validate, ctrl.getDebt);
router.put('/:id', debtValidators.update, validate, ctrl.updateDebt);
router.delete('/:id', debtValidators.byId, validate, ctrl.deleteDebt);

router.get('/:id/payments', debtValidators.byId, validate, ctrl.listPayments);
router.post('/:id/payments', debtValidators.addPayment, validate, ctrl.addPayment);
router.delete('/:id/payments/:paymentId', debtValidators.removePayment, validate, ctrl.deletePayment);

router.post('/:id/settle', debtValidators.settle, validate, ctrl.settleDebt);

module.exports = router;
