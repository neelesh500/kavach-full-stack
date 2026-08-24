const path = require('path');
const express = require('express');
const http = require('http');

// Configs and Utils
const env = require('./config/env');
const connectDB = require('./config/db');
const logger = require('./config/logger');
const { initSocket } = require('./utils/socket');

// Middlewares
const applySecurityMiddlewares = require('./middlewares/security.middleware');
const { apiLimiter, authLimiter } = require('./middlewares/rateLimit.middleware');

// Routes
const adminRoutes = require('./routes/adminRoutes');
const authRoutes = require('./routes/authRoutes');
const shareRoutes = require('./routes/shareRoutes');

function createServer() {
    const app = express();
    const server = http.createServer(app);

    // Database Connection
    connectDB();

    // Apply Extreme Security Pipeline
    applySecurityMiddlewares(app);

    // Body Parsing
    app.use(express.json({ limit: '15mb' }));

    // General API Rate limit
    app.use('/api', apiLimiter);

    // Apply Auth rate limit to highly sensitive routes
    app.use('/api/auth/login', authLimiter);
    app.use('/api/share', authLimiter);

    // V1 API Routes
    app.use('/api/admin', adminRoutes);
    app.use('/api/auth', authRoutes);
    app.use('/api/share', shareRoutes);

    // Serve Frontend
    const frontendDist = path.join(__dirname, '..', '..', 'frontend', 'dist');
    app.use(express.static(frontendDist));
    app.use((req, res, next) => {
        if (req.path.startsWith('/api')) return next();
        res.sendFile(path.join(frontendDist, 'index.html'), (err) => {
            if (err) next();
        });
    });

    // Global Error Handler
    app.use((err, req, res, next) => {
        logger.error(`Error: ${err.message}`, { stack: err.stack });
        res.status(500).json({ error: 'Internal Server Error' });
    });

    // Socket
    initSocket(server);

    return { app, server };
}

module.exports = { createServer };
