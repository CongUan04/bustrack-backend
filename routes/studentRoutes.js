const express = require('express');
const router = express.Router();
const { getAll, getOne, create, update, remove, getMyChildren } = require('../controllers/studentController');
const { protect, authorize } = require('../middleware/authMiddleware');

router.get('/my-children', protect, authorize('Parent'), getMyChildren);

router.route('/')
    .get(protect, getAll)
    .post(protect, authorize('Admin'), create);

router.route('/:id')
    .get(protect, getOne)
    .put(protect, authorize('Admin'), update)
    .delete(protect, authorize('Admin'), remove);

module.exports = router;
