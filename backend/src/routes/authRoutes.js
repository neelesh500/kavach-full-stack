const router = require('express').Router();
const authController = require('../controllers/authController');

router.post('/login', authController.login);
router.post('/verify-totp', authController.verifyTotp);

module.exports = router;
