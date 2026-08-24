const axios = require('axios');
const CRYPTO_SERVICE_URL = process.env.CRYPTO_SERVICE_URL || 'http://localhost:8000';

class QuestionsService {
    constructor() {
        // In-memory properties for batch-processing and Redis hooks
        this.batchQueue = [];
        this.batchLimit = 100;
    }

    async submitQuestion(plaintextQuestion, metadata) {
        // Inter-Service Communication: Forward validated lightweight request to Crypto fastAPI
        const response = await axios.post(`${CRYPTO_SERVICE_URL}/internal/encrypt-and-store`, {
            question: plaintextQuestion,
            metadata: metadata || {}
        }, {
            headers: {
                'x-internal-auth': process.env.INTERNAL_SERVICE_TOKEN // Microservice bonding Auth
            }
        });

        return response.data;
    }
}

module.exports = new QuestionsService();
