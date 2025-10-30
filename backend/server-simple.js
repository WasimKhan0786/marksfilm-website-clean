// Simplified Marks Film Backend Server
const express = require('express');
const cors = require('cors');
const path = require('path');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3001;

// Basic middleware
app.use(cors({
    origin: ['http://localhost:3000', 'http://localhost:3001', 'http://localhost:3002', 'http://127.0.0.1:5500'],
    credentials: true
}));

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Serve static files
app.use(express.static(path.join(__dirname, '..')));

// Basic route
app.get('/', (req, res) => {
    res.json({
        message: '🎬 Marks Film Backend API is running!',
        version: '2.0.0',
        status: 'active',
        timestamp: new Date().toISOString()
    });
});

// Health check
app.get('/api/health', (req, res) => {
    res.json({
        success: true,
        message: '🎬 Marks Film API is healthy',
        timestamp: new Date().toISOString()
    });
});

// Import routes
try {
    app.use('/api/payments', require('./routes/payments'));
    console.log('✅ Payment routes loaded');
} catch (error) {
    console.log('⚠️ Payment routes not loaded:', error.message);
}

try {
    app.use('/api/booking', require('./routes/booking'));
    console.log('✅ Booking routes loaded');
} catch (error) {
    console.log('⚠️ Booking routes not loaded:', error.message);
}

try {
    app.use('/api/bookings', require('./routes/bookings'));
    console.log('✅ Bookings routes loaded');
} catch (error) {
    console.log('⚠️ Bookings routes not loaded:', error.message);
}

// Error handling
app.use((err, req, res, next) => {
    console.error('Server Error:', err.message);
    res.status(500).json({
        success: false,
        message: 'Internal server error'
    });
});

// 404 handler
app.use('*', (req, res) => {
    res.status(404).json({
        success: false,
        message: 'API endpoint not found'
    });
});

// Start server
app.listen(PORT, () => {
    console.log('\n🎬 ===============================================');
    console.log('🎬 MARKS FILM BACKEND - SIMPLIFIED VERSION');
    console.log('🎬 ===============================================');
    console.log(`🚀 Server running on port: ${PORT}`);
    console.log(`📱 API Base URL: http://localhost:${PORT}`);
    console.log('✅ Ready for bookings and payments!');
    console.log('🎬 ===============================================\n');
});

module.exports = app;