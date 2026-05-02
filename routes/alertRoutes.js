const express = require('express');
const router = express.Router();
const { getAll, acknowledge, acknowledgeAll, create } = require('../controllers/alertController');
const { protect, authorize } = require('../middleware/authMiddleware');

router.get('/', protect, getAll);
router.post('/', protect, authorize('Admin'), create);
router.patch('/acknowledge-all', protect, authorize('Admin'), acknowledgeAll);
router.patch('/:id/acknowledge', protect, authorize('Admin'), acknowledge);

module.exports = router;
