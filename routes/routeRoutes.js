const express = require('express');
const router = express.Router();
const { getAll, getOne, create, update, remove } = require('../controllers/routeController');
const { protect, authorize } = require('../middleware/authMiddleware');

router.get('/', protect, getAll);
router.get('/:id', protect, getOne);
router.post('/', protect, authorize('Admin'), create);
router.put('/:id', protect, authorize('Admin'), update);
router.delete('/:id', protect, authorize('Admin'), remove);

module.exports = router;
