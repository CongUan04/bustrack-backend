const express = require('express');
const router = express.Router();
const { getAll, getOne, create, update, remove, getMyChildren, markAbsent, updateStudyDays } = require('../controllers/studentController');
const { protect, authorize } = require('../middleware/authMiddleware');

router.get('/my-children', protect, authorize('Parent'), getMyChildren);

router.route('/')
    .get(protect, getAll)
    .post(protect, authorize('Admin'), create);

router.put('/:id/absent', protect, authorize('Parent'), markAbsent);
router.put('/:id/study-days', protect, authorize('Parent', 'Admin'), updateStudyDays);

router.route('/:id')
    .get(protect, getOne)
    .put(protect, authorize('Admin'), update)
    .delete(protect, authorize('Admin'), remove);

module.exports = router;
