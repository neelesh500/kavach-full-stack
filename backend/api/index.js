// Entry point for Vercel Serverless Functions
process.env.VERCEL = 'true';
const { createServer } = require('../src/server');
const { app } = createServer();

module.exports = app;
