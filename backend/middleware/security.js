// Security middleware for Marks Film
// Comprehensive security implementation

const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const mongoSanitize = require('express-mongo-sanitize');
const hpp = require('hpp');
const compression = require('compression');
const morgan = require('morgan');

// Rate limiting configurations
const createRateLimit = (windowMs, max, message) => {
    return rateLimit({
        windowMs,
        max,
        message: {
            success: false,
            message,
            retryAfter: Math.ceil(windowMs / 1000)
        },
        standardHeaders: true,
        legacyHeaders: false,
        handler: (req, res) => {
            console.log(`🚨 Rate limit exceeded for IP: ${req.ip} on ${req.path}`);
            res.status(429).json({
                success: false,
                message: 'Too many requests, please try again later',
                retryAfter: Math.ceil(windowMs / 1000)
            });
        }
    });
};

// General rate limiting
const generalLimiter = createRateLimit(
    15 * 60 * 1000, // 15 minutes
    100, // limit each IP to 100 requests per windowMs
    'Too many requests from this IP, please try again later'
);

// Strict rate limiting for auth endpoints
const authLimiter = createRateLimit(
    15 * 60 * 1000, // 15 minutes
    5, // limit each IP to 5 requests per windowMs
    'Too many authentication attempts, please try again later'
);

// Payment rate limiting
const paymentLimiter = createRateLimit(
    60 * 60 * 1000, // 1 hour
    10, // limit each IP to 10 payment attempts per hour
    'Too many payment attempts, please try again later'
);

// Booking rate limiting
const bookingLimiter = createRateLimit(
    60 * 60 * 1000, // 1 hour
    20, // limit each IP to 20 booking attempts per hour
    'Too many booking attempts, please try again later'
);

// Contact form rate limiting
const contactLimiter = createRateLimit(
    60 * 60 * 1000, // 1 hour
    5, // limit each IP to 5 contact form submissions per hour
    'Too many contact form submissions, please try again later'
);

// Security headers configuration
const helmetConfig = helmet({
    contentSecurityPolicy: {
        directives: {
            defaultSrc: ["'self'"],
            styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com", "https://cdnjs.cloudflare.com"],
            fontSrc: ["'self'", "https://fonts.gstatic.com", "https://cdnjs.cloudflare.com"],
            scriptSrc: ["'self'", "'unsafe-inline'", "https://checkout.razorpay.com", "https://cdnjs.cloudflare.com"],
            imgSrc: ["'self'", "data:", "https:", "blob:"],
            connectSrc: ["'self'", "https://api.razorpay.com"],
            frameSrc: ["'self'", "https://api.razorpay.com"],
            objectSrc: ["'none'"],
            upgradeInsecureRequests: process.env.NODE_ENV === 'production' ? [] : null
        }
    },
    crossOriginEmbedderPolicy: false, // Disable for Razorpay compatibility
    hsts: {
        maxAge: 31536000,
        includeSubDomains: true,
        preload: true
    }
});

// Request logging configuration
const morganConfig = morgan('combined', {
    skip: (req, res) => {
        // Skip logging for health checks and static files
        return req.url.includes('/health') || req.url.includes('/favicon');
    },
    stream: {
        write: (message) => {
            // Log to console in development, file in production
            if (process.env.NODE_ENV === 'development') {
                console.log('📝 Request:', message.trim());
            }
            // In production, you would write to a log file
        }
    }
});

// Input sanitization middleware
const sanitizeInput = (req, res, next) => {
    // Remove any keys that contain prohibited characters
    const sanitizeObject = (obj) => {
        if (typeof obj !== 'object' || obj === null) return obj;
        
        const sanitized = {};
        for (const [key, value] of Object.entries(obj)) {
            // Skip dangerous keys
            if (key.includes('$') || key.includes('.') || key.includes('<') || key.includes('>')) {
                console.log(`🚨 Blocked dangerous key: ${key}`);
                continue;
            }
            
            if (typeof value === 'string') {
                // Basic XSS protection
                sanitized[key] = value
                    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
                    .replace(/javascript:/gi, '')
                    .replace(/on\w+\s*=/gi, '');
            } else if (typeof value === 'object') {
                sanitized[key] = sanitizeObject(value);
            } else {
                sanitized[key] = value;
            }
        }
        return sanitized;
    };

    if (req.body) req.body = sanitizeObject(req.body);
    if (req.query) req.query = sanitizeObject(req.query);
    if (req.params) req.params = sanitizeObject(req.params);
    
    next();
};

// Security logging middleware
const securityLogger = (req, res, next) => {
    // Log suspicious activities
    const suspiciousPatterns = [
        /\.\.\//g, // Directory traversal
        /<script/gi, // XSS attempts
        /union.*select/gi, // SQL injection
        /drop.*table/gi, // SQL injection
        /exec\(/gi, // Code injection
        /eval\(/gi // Code injection
    ];

    const checkSuspicious = (str) => {
        return suspiciousPatterns.some(pattern => pattern.test(str));
    };

    const checkRequest = (obj, source) => {
        if (typeof obj === 'object' && obj !== null) {
            for (const [key, value] of Object.entries(obj)) {
                if (typeof value === 'string' && checkSuspicious(value)) {
                    console.log(`🚨 SECURITY ALERT: Suspicious ${source} detected from IP ${req.ip}`);
                    console.log(`🚨 Key: ${key}, Value: ${value}`);
                    console.log(`🚨 User-Agent: ${req.get('User-Agent')}`);
                    console.log(`🚨 URL: ${req.originalUrl}`);
                }
            }
        }
    };

    checkRequest(req.body, 'body');
    checkRequest(req.query, 'query');
    checkRequest(req.params, 'params');

    next();
};

// File upload security
const fileUploadSecurity = (req, res, next) => {
    if (req.file) {
        const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
        const maxSize = 10 * 1024 * 1024; // 10MB

        if (!allowedTypes.includes(req.file.mimetype)) {
            return res.status(400).json({
                success: false,
                message: 'Invalid file type. Only JPEG, PNG, GIF, and WebP are allowed.'
            });
        }

        if (req.file.size > maxSize) {
            return res.status(400).json({
                success: false,
                message: 'File too large. Maximum size is 10MB.'
            });
        }

        // Check for malicious file names
        if (/[<>:"/\\|?*]/.test(req.file.originalname)) {
            return res.status(400).json({
                success: false,
                message: 'Invalid file name.'
            });
        }
    }
    next();
};

module.exports = {
    helmetConfig,
    generalLimiter,
    authLimiter,
    paymentLimiter,
    bookingLimiter,
    contactLimiter,
    morganConfig,
    mongoSanitize: mongoSanitize(),
    hpp: hpp(),
    compression: compression(),
    sanitizeInput,
    securityLogger,
    fileUploadSecurity
};