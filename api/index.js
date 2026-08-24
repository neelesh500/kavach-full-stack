// Entry point for Vercel Serverless Functions
process.env.VERCEL = 'true';
const { createServer } = require('../backend/src/server');
const { app } = createServer();

module.exports = app;
