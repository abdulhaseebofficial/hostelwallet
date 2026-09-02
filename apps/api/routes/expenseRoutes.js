const express = require('express');
const ctrl = require('../controllers/expenseController');
const validate = require('../middleware/validate');
const { protect } = require('../middleware/authMiddleware');
const { expenseValidators } = require('../validators');

const router = express.Router();

router.use(protect);

router.get('/', expenseValidators.list, validate, ctrl.listExpenses);
router.post('/', expenseValidators.create, validate, ctrl.createExpense);
router.get('/:id', expenseValidators.byId, validate, ctrl.getExpense);
router.put('/:id', expenseValidators.update, validate, ctrl.updateExpense);
router.delete('/:id', expenseValidators.byId, validate, ctrl.deleteExpense);

module.exports = router;
