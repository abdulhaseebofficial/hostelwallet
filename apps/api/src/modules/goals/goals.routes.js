const express = require('express');
const ctrl = require('./goals.controller');
const validate = require('../../shared/middleware/validate');
const { protect } = require('../../shared/middleware/authenticate');
const { goalValidators } = require('../../shared/validators');

const router = express.Router();

router.use(protect);

router.get('/', ctrl.listGoals);
router.post('/', goalValidators.create, validate, ctrl.createGoal);
router.get('/:id', goalValidators.byId, validate, ctrl.getGoal);
router.put('/:id', goalValidators.update, validate, ctrl.updateGoal);
// One endpoint handles both directions: a negative amount is a withdrawal.
router.patch('/:id/add', goalValidators.contribute, validate, ctrl.contribute);
router.delete('/:id', goalValidators.byId, validate, ctrl.deleteGoal);

module.exports = router;
