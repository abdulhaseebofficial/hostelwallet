const express = require('express');
const ctrl = require('./budgets.controller');
const validate = require('../../shared/middleware/validate');
const { protect } = require('../../shared/middleware/authenticate');
const { budgetValidators } = require('../../shared/validators');

const router = express.Router();

router.use(protect);

router.get('/', ctrl.listBudgets);
router.post('/', budgetValidators.upsert, validate, ctrl.upsertBudget);
router.post('/bulk', budgetValidators.bulk, validate, ctrl.bulkUpsert);
router.put('/:id', budgetValidators.update, validate, ctrl.updateBudget);
router.delete('/:id', budgetValidators.byId, validate, ctrl.deleteBudget);

module.exports = router;
