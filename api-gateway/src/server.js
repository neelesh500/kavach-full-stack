require('dotenv').config();
const express = require('express');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
const os = require('os');
const cluster = require('cluster');
const questionRoutes = require('./routes/questions');
const errorHandler = require('./middleware/errorMiddleware');

// Primary Node orchestrates Workers for extreme concurrency (300k+ load)
if (cluster.isPrimary) {
    const numCPUs = os.cpus().length;
    console.log(`[API Gateway] Master clustered. Forking ${numCPUs} workers for extreme scale...`);

    for (let i = 0; i < numCPUs; i++) {
        cluster.fork();
    }

    cluster.on('exit', (worker, code, signal) => {
        console.log(`[API Gateway] Worker ${worker.process.pid} died. Spinning up a new one.`);
        cluster.fork();
    });
} else {
    const app = express();

    // 1. High-Concurrency Rate Limiting
    const limiter = rateLimit({
        windowMs: 1 * 60 * 1000,
        max: 1000,
        message: 'Too many requests from this IP, please try again after a minute',
        standardHeaders: true,
        legacyHeaders: false,
    });

    app.use(limiter);
    app.use(cors());

    // 2. Payload size cap (max 50kb) to block memory exhaustion attacks
    app.use(express.json({ limit: '50kb' }));
    app.use(express.urlencoded({ extended: true, limit: '50kb' }));

    // Health Check
    app.get('/', (req, res) => res.json({ status: 'API Gateway Active', worker: process.pid }));

    // Mount Routing layer
    app.use('/api/v1/questions', questionRoutes);

    // Generic Error Handler (Non-blocking, Secure)
    app.use(errorHandler);

    const PORT = process.env.PORT || 3000;
    app.listen(PORT, () => {
        console.log(`[Worker ${process.pid}] Listening on port ${PORT}`);
    });
}
