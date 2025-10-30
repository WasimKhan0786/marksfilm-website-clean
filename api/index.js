// Vercel Serverless Function Entry Point
const app = require('../backend/server.js');

// Export the Express app for Vercel
module.exports = app;