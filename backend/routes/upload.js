// File upload routes for Marks Film
// Handle file uploads for customer galleries

const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { dbHelpers } = require('../config/database');
const { requireAuth, requireAdmin } = require('./auth');

const router = express.Router();

// Ensure upload directories exist
const uploadDir = path.join(__dirname, '../uploads');
const customerDir = path.join(uploadDir, 'customers');
const publicDir = path.join(uploadDir, 'public');

[uploadDir, customerDir, publicDir].forEach(dir => {
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
        console.log(`📁 Created directory: ${dir}`);
    }
});

// Configure multer for file uploads
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        // Determine upload path based on file purpose
        const isPublic = req.body.is_public === 'true';
        const uploadPath = isPublic ? publicDir : customerDir;
        
        // Create customer-specific folder if needed
        if (!isPublic && req.body.customer_id) {
            const customerPath = path.join(uploadPath, `customer_${req.body.customer_id}`);
            if (!fs.existsSync(customerPath)) {
                fs.mkdirSync(customerPath, { recursive: true });
            }
            cb(null, customerPath);
        } else {
            cb(null, uploadPath);
        }
    },
    filename: (req, file, cb) => {
        // Generate unique filename
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        const ext = path.extname(file.originalname);
        const name = path.basename(file.originalname, ext);
        cb(null, `${name}-${uniqueSuffix}${ext}`);
    }
});

// File filter
const fileFilter = (req, file, cb) => {
    // Allow images and videos
    const allowedTypes = /jpeg|jpg|png|gif|webp|mp4|mov|avi|mkv|webm/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype);

    if (mimetype && extname) {
        return cb(null, true);
    } else {
        cb(new Error('Only image and video files are allowed!'));
    }
};

// Configure multer
const upload = multer({
    storage: storage,
    limits: {
        fileSize: 50 * 1024 * 1024, // 50MB limit
        files: 10 // Maximum 10 files at once
    },
    fileFilter: fileFilter
});

// Upload files (Admin only)
router.post('/files', requireAdmin, upload.array('files', 10), async (req, res) => {
    try {
        if (!req.files || req.files.length === 0) {
            return res.status(400).json({
                success: false,
                message: 'No files uploaded'
            });
        }

        const { customer_id, booking_id, is_public = false } = req.body;

        // Validate customer_id if provided
        if (customer_id) {
            const customer = await dbHelpers.get('SELECT id FROM users WHERE id = ? AND role = "customer"', [customer_id]);
            if (!customer) {
                return res.status(400).json({
                    success: false,
                    message: 'Invalid customer ID'
                });
            }
        }

        // Validate booking_id if provided
        if (booking_id) {
            const booking = await dbHelpers.get('SELECT id FROM bookings WHERE id = ?', [booking_id]);
            if (!booking) {
                return res.status(400).json({
                    success: false,
                    message: 'Invalid booking ID'
                });
            }
        }

        const uploadedFiles = [];

        // Process each uploaded file
        for (const file of req.files) {
            try {
                // Get relative path for database storage
                const relativePath = path.relative(path.join(__dirname, '../'), file.path);

                // Insert file record into database
                const result = await dbHelpers.run(`
                    INSERT INTO gallery (
                        booking_id, customer_id, file_name, file_path, 
                        file_type, file_size, is_public
                    ) VALUES (?, ?, ?, ?, ?, ?, ?)
                `, [
                    booking_id || null,
                    customer_id || null,
                    file.originalname,
                    relativePath,
                    file.mimetype,
                    file.size,
                    is_public ? 1 : 0
                ]);

                uploadedFiles.push({
                    id: result.id,
                    originalName: file.originalname,
                    fileName: file.filename,
                    filePath: relativePath,
                    fileType: file.mimetype,
                    fileSize: file.size,
                    isPublic: is_public
                });

            } catch (dbError) {
                console.error('Database error for file:', file.originalname, dbError);
                // Delete the uploaded file if database insert fails
                try {
                    fs.unlinkSync(file.path);
                } catch (unlinkError) {
                    console.error('Failed to delete file after DB error:', unlinkError);
                }
            }
        }

        if (uploadedFiles.length === 0) {
            return res.status(500).json({
                success: false,
                message: 'Failed to save any files to database'
            });
        }

        res.status(201).json({
            success: true,
            message: `Successfully uploaded ${uploadedFiles.length} file(s)`,
            files: uploadedFiles
        });

    } catch (error) {
        console.error('File upload error:', error);
        
        // Clean up uploaded files on error
        if (req.files) {
            req.files.forEach(file => {
                try {
                    fs.unlinkSync(file.path);
                } catch (unlinkError) {
                    console.error('Failed to delete file after error:', unlinkError);
                }
            });
        }

        res.status(500).json({
            success: false,
            message: 'File upload failed',
            error: error.message
        });
    }
});

// Upload customer files (for specific booking)
router.post('/customer-files/:bookingId', requireAuth, upload.array('files', 5), async (req, res) => {
    try {
        const bookingId = req.params.bookingId;
        const userId = req.session.user.id;

        if (!req.files || req.files.length === 0) {
            return res.status(400).json({
                success: false,
                message: 'No files uploaded'
            });
        }

        // Verify booking belongs to user
        const booking = await dbHelpers.get(`
            SELECT * FROM bookings WHERE id = ? AND user_id = ?
        `, [bookingId, userId]);

        if (!booking) {
            return res.status(403).json({
                success: false,
                message: 'Access denied or booking not found'
            });
        }

        const uploadedFiles = [];

        // Process each uploaded file
        for (const file of req.files) {
            try {
                const relativePath = path.relative(path.join(__dirname, '../'), file.path);

                const result = await dbHelpers.run(`
                    INSERT INTO gallery (
                        booking_id, customer_id, file_name, file_path, 
                        file_type, file_size, is_public
                    ) VALUES (?, ?, ?, ?, ?, ?, 0)
                `, [
                    bookingId,
                    userId,
                    file.originalname,
                    relativePath,
                    file.mimetype,
                    file.size
                ]);

                uploadedFiles.push({
                    id: result.id,
                    originalName: file.originalname,
                    fileName: file.filename,
                    filePath: relativePath,
                    fileType: file.mimetype,
                    fileSize: file.size
                });

            } catch (dbError) {
                console.error('Database error for customer file:', file.originalname, dbError);
                try {
                    fs.unlinkSync(file.path);
                } catch (unlinkError) {
                    console.error('Failed to delete file after DB error:', unlinkError);
                }
            }
        }

        res.status(201).json({
            success: true,
            message: `Successfully uploaded ${uploadedFiles.length} file(s) to your booking`,
            files: uploadedFiles
        });

    } catch (error) {
        console.error('Customer file upload error:', error);
        
        if (req.files) {
            req.files.forEach(file => {
                try {
                    fs.unlinkSync(file.path);
                } catch (unlinkError) {
                    console.error('Failed to delete file after error:', unlinkError);
                }
            });
        }

        res.status(500).json({
            success: false,
            message: 'File upload failed',
            error: error.message
        });
    }
});

// Get upload statistics (Admin only)
router.get('/admin/stats', requireAdmin, async (req, res) => {
    try {
        // Get upload statistics
        const totalUploads = await dbHelpers.get(`
            SELECT COUNT(*) as count FROM gallery
        `);

        const todayUploads = await dbHelpers.get(`
            SELECT COUNT(*) as count FROM gallery 
            WHERE date(upload_date) = date('now')
        `);

        const thisMonthUploads = await dbHelpers.get(`
            SELECT COUNT(*) as count FROM gallery 
            WHERE strftime('%Y-%m', upload_date) = strftime('%Y-%m', 'now')
        `);

        // Get storage usage
        const storageUsage = await dbHelpers.get(`
            SELECT COALESCE(SUM(file_size), 0) as total_size FROM gallery
        `);

        // Get file type distribution
        const fileTypes = await dbHelpers.all(`
            SELECT 
                CASE 
                    WHEN file_type LIKE 'image%' THEN 'Images'
                    WHEN file_type LIKE 'video%' THEN 'Videos'
                    ELSE 'Other'
                END as type,
                COUNT(*) as count,
                COALESCE(SUM(file_size), 0) as total_size
            FROM gallery
            GROUP BY type
        `);

        // Get recent uploads
        const recentUploads = await dbHelpers.all(`
            SELECT g.file_name, g.file_type, g.file_size, g.upload_date,
                   b.customer_name, u.name as uploaded_by
            FROM gallery g
            LEFT JOIN bookings b ON g.booking_id = b.id
            LEFT JOIN users u ON g.customer_id = u.id
            ORDER BY g.upload_date DESC
            LIMIT 10
        `);

        res.json({
            success: true,
            stats: {
                uploads: {
                    total: totalUploads.count,
                    today: todayUploads.count,
                    thisMonth: thisMonthUploads.count
                },
                storage: {
                    totalBytes: storageUsage.total_size,
                    totalMB: Math.round((storageUsage.total_size || 0) / (1024 * 1024) * 100) / 100,
                    totalGB: Math.round((storageUsage.total_size || 0) / (1024 * 1024 * 1024) * 100) / 100
                },
                fileTypes: fileTypes,
                recentUploads: recentUploads
            }
        });

    } catch (error) {
        console.error('Get upload stats error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch upload statistics',
            error: error.message
        });
    }
});

// Error handling middleware for multer
router.use((error, req, res, next) => {
    if (error instanceof multer.MulterError) {
        if (error.code === 'LIMIT_FILE_SIZE') {
            return res.status(400).json({
                success: false,
                message: 'File too large. Maximum size is 50MB.'
            });
        }
        if (error.code === 'LIMIT_FILE_COUNT') {
            return res.status(400).json({
                success: false,
                message: 'Too many files. Maximum 10 files allowed.'
            });
        }
    }
    
    if (error.message === 'Only image and video files are allowed!') {
        return res.status(400).json({
            success: false,
            message: 'Invalid file type. Only images and videos are allowed.'
        });
    }

    next(error);
});

module.exports = router;