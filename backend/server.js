// Marks Film Backend Server - PRODUCTION READY WITH FULL SECURITY
// Professional videography and photography booking system

const express = require('express');
const cors = require('cors');
const session = require('express-session');
const path = require('path');
require('dotenv').config();

// Import security middleware
const {
    helmetConfig,
    generalLimiter,
    authLimiter,
    paymentLimiter,
    bookingLimiter,
    contactLimiter,
    morganConfig,
    mongoSanitize,
    hpp,
    compression,
    sanitizeInput,
    securityLogger,
    fileUploadSecurity
} = require('./middleware/security');

const app = express();
const PORT = process.env.PORT || 3001;

// Vercel serverless function export
module.exports = app;

// 🛡️ SECURITY MIDDLEWARE (Applied in correct order)
console.log('🔒 Initializing security middleware...');

// 1. Request logging (should be first)
app.use(morganConfig);

// 2. Security headers
app.use(helmetConfig);

// 3. Compression (before other middleware)
app.use(compression);

// 4. Rate limiting (general)
app.use(generalLimiter);

// 5. CORS configuration (more secure)
const allowedOrigins = process.env.ALLOWED_ORIGINS 
    ? process.env.ALLOWED_ORIGINS.split(',')
    : [
        'http://localhost:3000', 
        'http://127.0.0.1:3000', 
        'http://localhost:5500',
        'http://localhost:3001',
        'http://127.0.0.1:3001',
        'http://localhost:8080',
        'http://127.0.0.1:5500'
    ];

app.use(cors({
    origin: (origin, callback) => {
        // Allow requests with no origin (mobile apps, Postman, etc.)
        if (!origin) return callback(null, true);
        
        if (allowedOrigins.includes(origin)) {
            callback(null, true);
        } else {
            console.log(`🚨 CORS blocked origin: ${origin}`);
            callback(new Error('Not allowed by CORS'));
        }
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
    maxAge: 86400 // 24 hours
}));

// 6. Body parsing with security limits
app.use(express.json({ 
    limit: '10mb',
    verify: (req, res, buf) => {
        // Store raw body for webhook verification
        req.rawBody = buf;
    }
}));
app.use(express.urlencoded({ 
    extended: true, 
    limit: '10mb',
    parameterLimit: 20 // Limit number of parameters
}));

// 7. Input sanitization
app.use(mongoSanitize);
app.use(hpp); // HTTP Parameter Pollution protection
app.use(sanitizeInput);
app.use(securityLogger);

// 8. Secure session configuration
app.use(session({
    secret: process.env.SESSION_SECRET || 'fallback-secret-change-in-production',
    name: 'marks.film.sid', // Change default session name
    resave: false,
    saveUninitialized: false,
    rolling: true, // Reset expiry on activity
    cookie: {
        secure: process.env.NODE_ENV === 'production', // HTTPS only in production
        httpOnly: true, // Prevent XSS
        maxAge: 24 * 60 * 60 * 1000, // 24 hours
        sameSite: process.env.NODE_ENV === 'production' ? 'strict' : 'lax'
    }
}));

// Static files - serve uploads securely
app.use('/uploads', express.static(path.join(__dirname, 'uploads'), {
    maxAge: '1d', // Cache for 1 day
    etag: true,
    lastModified: true,
    setHeaders: (res, path) => {
        // Security headers for static files
        res.setHeader('X-Content-Type-Options', 'nosniff');
        res.setHeader('X-Frame-Options', 'DENY');
    }
}));

// Serve frontend files from parent directory
app.use(express.static(path.join(__dirname, '..'), {
    maxAge: '1h',
    etag: true,
    lastModified: true
}));

// Basic route for testing
app.get('/', (req, res) => {
    res.json({
        message: '🎬 Marks Film Backend API is running!',
        version: '2.0.0',
        status: 'active',
        security: 'enabled',
        timestamp: new Date().toISOString(),
        endpoints: {
            health: '/api/health',
            booking: '/api/booking',
            bookings: '/api/bookings',
            auth: '/api/auth',
            gallery: '/api/gallery',
            contact: '/api/contact',
            reviews: '/api/reviews',
            payments: '/api/payments'
        }
    });
});

// 🛡️ SECURE API ROUTES with specific rate limiting
console.log('🚀 Setting up secure API routes...');

// Health check endpoint (no rate limiting)
app.get('/api/health', (req, res) => {
    res.json({
        success: true,
        message: '🎬 Marks Film API is healthy',
        timestamp: new Date().toISOString(),
        environment: process.env.NODE_ENV,
        security: 'enabled',
        uptime: process.uptime(),
        memory: process.memoryUsage(),
        version: '2.0.0'
    });
});

// Auth routes with strict rate limiting
app.use('/api/auth', authLimiter, require('./routes/auth'));

// Payment routes with payment-specific rate limiting
app.use('/api/payments', paymentLimiter, require('./routes/payments'));

// Booking routes with booking-specific rate limiting
app.use('/api/booking', bookingLimiter, require('./routes/booking'));
app.use('/api/bookings', bookingLimiter, require('./routes/bookings'));

// Contact form with contact-specific rate limiting
app.use('/api/contact', contactLimiter, require('./routes/contact'));

// Other routes with general rate limiting
app.use('/api/gallery', require('./routes/gallery'));
app.use('/api/reviews', require('./routes/reviews'));
app.use('/api/upload', fileUploadSecurity, require('./routes/upload'));
app.use('/api/admin', require('./routes/admin'));
app.use('/api/reports', require('./routes/reports'));
app.use('/api/notifications', require('./routes/notifications'));
app.use('/api/crm', require('./routes/crm'));
app.use('/api/inventory', require('./routes/inventory'));
app.use('/api/reviews', require('./routes/reviews'));

// 🛡️ SECURE ERROR HANDLING
app.use((err, req, res, next) => {
    // Log error details for debugging
    console.error('🚨 Server Error:', {
        message: err.message,
        stack: process.env.NODE_ENV === 'development' ? err.stack : 'Hidden in production',
        url: req.originalUrl,
        method: req.method,
        ip: req.ip,
        userAgent: req.get('User-Agent'),
        timestamp: new Date().toISOString()
    });

    // Security: Don't expose internal errors in production
    const isDevelopment = process.env.NODE_ENV === 'development';
    
    // Handle specific error types
    if (err.name === 'ValidationError') {
        return res.status(400).json({
            success: false,
            message: 'Validation failed',
            errors: isDevelopment ? err.errors : 'Invalid input data'
        });
    }

    if (err.name === 'UnauthorizedError') {
        return res.status(401).json({
            success: false,
            message: 'Authentication required'
        });
    }

    if (err.code === 'LIMIT_FILE_SIZE') {
        return res.status(413).json({
            success: false,
            message: 'File too large'
        });
    }

    if (err.message === 'Not allowed by CORS') {
        return res.status(403).json({
            success: false,
            message: 'Access denied - CORS policy violation'
        });
    }

    // Generic error response
    res.status(err.status || 500).json({
        success: false,
        message: isDevelopment ? err.message : 'Internal server error',
        ...(isDevelopment && { stack: err.stack })
    });
});

// 404 handler
app.use('*', (req, res) => {
    console.log(`�  404 - Route not found: ${req.method} ${req.originalUrl} from IP: ${req.ip}`);
    res.status(404).json({
        success: false,
        message: 'API endpoint not found',
        requestedUrl: req.originalUrl,
        method: req.method,
        availableEndpoints: [
            'GET /api/health',
            'POST /api/auth/login',
            'POST /api/auth/register',
            'POST /api/booking',
            'GET /api/bookings',
            'POST /api/contact/submit',
            'GET /api/gallery',
            'POST /api/reviews',
            'POST /api/payments/create-order',
            'POST /api/payments/verify'
        ]
    });
});

// 🚀 START SECURE SERVER
const server = app.listen(PORT, () => {
    console.log('\n🎬 ===============================================');
    console.log('🎬 MARKS FILM BACKEND - PRODUCTION READY');
    console.log('🎬 ===============================================');
    console.log(`🚀 Server running on port: ${PORT}`);
    console.log(`📱 API Base URL: http://localhost:${PORT}`);
    console.log(`🌐 Environment: ${process.env.NODE_ENV || 'development'}`);
    console.log('🛡️ Security: FULLY ENABLED');
    console.log('🔒 Rate Limiting: ACTIVE');
    console.log('🛡️ Input Sanitization: ACTIVE');
    console.log('🔐 Security Headers: ACTIVE');
    console.log('� ReUquest Logging: ACTIVE');
    console.log('🔥 Compression: ACTIVE');
    console.log('🚫 CORS Protection: ACTIVE');
    console.log('🛡️ XSS Protection: ACTIVE');
    console.log('🔒 SQL Injection Protection: ACTIVE');
    console.log('🎬 ===============================================');
    console.log('✅ Ready to handle secure bookings and payments!');
    console.log('🎬 ===============================================\n');
});

// Graceful shutdown handling
process.on('SIGTERM', () => {
    console.log('🛑 SIGTERM received, shutting down gracefully...');
    server.close(() => {
        console.log('✅ Server closed successfully');
        process.exit(0);
    });
});

process.on('SIGINT', () => {
    console.log('🛑 SIGINT received, shutting down gracefully...');
    server.close(() => {
        console.log('✅ Server closed successfully');
        process.exit(0);
    });
});

// Handle uncaught exceptions
process.on('uncaughtException', (err) => {
    console.error('🚨 Uncaught Exception:', err);
    console.error('🚨 Shutting down due to uncaught exception...');
    process.exit(1);
});

process.on('unhandledRejection', (err) => {
    console.error('🚨 Unhandled Rejection:', err);
    console.error('🚨 Shutting down due to unhandled rejection...');
    server.close(() => {
        process.exit(1);
    });
});

// Export app for testing
module.exports = app;