const router = require('express').Router();
const shareController = require('../controllers/shareController');
const authMiddleware = require('../utils/authMiddleware');

router.post('/submit', authMiddleware, shareController.submitShare);

module.exports = router;
