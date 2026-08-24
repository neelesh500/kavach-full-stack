const router = require('express').Router();
const adminAuthController = require('../controllers/adminAuthController');
const adminController = require('../controllers/adminController');
const statusController = require('../controllers/statusController');
const shareController = require('../controllers/shareController');
const documentController = require('../controllers/documentController');
const adminAuthMiddleware = require('../utils/adminAuthMiddleware');

router.post('/login', adminAuthController.login);
router.post('/setup', adminAuthMiddleware, adminController.setup);
router.get('/status', adminAuthMiddleware, statusController.status);
router.post('/reset-session', adminAuthMiddleware, statusController.resetSession);
router.post('/reconstruct', adminAuthMiddleware, shareController.reconstruct);
router.post('/document/upload', adminAuthMiddleware, documentController.upload);
router.get('/documents', adminAuthMiddleware, documentController.list);
router.post('/document/:id/decrypt', adminAuthMiddleware, documentController.decrypt);

module.exports = router;
