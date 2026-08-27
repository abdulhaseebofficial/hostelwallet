const express = require('express');
const ctrl = require('../controllers/budgetController');
const validate = require('../middleware/validate');
const { protect } = require('../middleware/authMiddleware');
const { budgetValidators } = require('../validators');

const router = express.Router();

router.use(protect);

router.get('/', ctrl.listBudgets);
router.post('/', budgetValidators.upsert, validate, ctrl.upsertBudget);
router.post('/bulk', budgetValidators.bulk, validate, ctrl.bulkUpsert);
router.put('/:id', budgetValidators.update, validate, ctrl.updateBudget);
router.delete('/:id', budgetValidators.byId, validate, ctrl.deleteBudget);

module.exports = router;
