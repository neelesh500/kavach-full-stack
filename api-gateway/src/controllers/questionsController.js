const questionsService = require('../services/questionsService');

exports.submitQuestion = async (req, res, next) => {
    try {
        const { plaintextQuestion, metadata } = req.body;

        // Request Validation
        if (!plaintextQuestion) {
            return res.status(400).json({ error: 'plaintextQuestion payload is missing.' });
        }

        // Delegate to service for operations
        const data = await questionsService.submitQuestion(plaintextQuestion, metadata);
        return res.status(201).json(data);
    } catch (error) {
        next(error); // Push to centralized secure error middleware
    }
};
