// Vercel Serverless Function Entry Point for MarksFilm
const path = require('path');

// Set up environment for backend
process.env.NODE_ENV = process.env.NODE_ENV || 'production';

// Import the Express app
const app = require('../backend/server.js');

// Export the handler for Vercel
module.exports = app;