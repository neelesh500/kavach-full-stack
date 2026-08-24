const express = require('express');
const router = express.Router();
const questionsController = require('../controllers/questionsController');
const { verifyTokenAndRole, timeWindowGate } = require('../middleware/authMiddleware');

/**
 * Route mapping for submitting questions
 * Protected by Time-Window Gate and RBAC (Only ADMIN or EXAMINER can interact).
 */
router.post('/submit',
    verifyTokenAndRole(['ADMIN', 'EXAMINER']),
    timeWindowGate,
    questionsController.submitQuestion
);

module.exports = router;
