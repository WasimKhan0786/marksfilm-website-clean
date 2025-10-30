// Gallery and file management routes for Marks Film
// Handle customer photo/video galleries and file access

const express = require('express');
const { dbHelpers } = require('../config/database');
const { requireAuth, requireAdmin } = require('./auth');

const router = express.Router();

// Get customer's gallery files (Authenticated users only)
router.get('/my-files', requireAuth, async (req, res) => {
    try {
        const userId = req.session.user.id;
        const { file_type, booking_id } = req.query;

        let query = `
            SELECT g.*, b.customer_name, b.event_date, s.name as service_name
            FROM gallery g
            LEFT JOIN bookings b ON g.booking_id = b.id
            LEFT JOIN services s ON b.service_id = s.id
            WHERE g.customer_id = ?
        `;
        
        const params = [userId];

        if (file_type) {
            query += ' AND g.file_type LIKE ?';
            params.push(`${file_type}%`);
        }

        if (booking_id) {
            query += ' AND g.booking_id = ?';
            params.push(booking_id);
        }

        query += ' ORDER BY g.upload_date DESC';

        const files = await dbHelpers.all(query, params);

        // Group files by booking
        const filesByBooking = {};
        files.forEach(file => {
            const bookingKey = file.booking_id || 'general';
            if (!filesByBooking[bookingKey]) {
                filesByBooking[bookingKey] = {
                    booking_id: file.booking_id,
                    customer_name: file.customer_name,
                    event_date: file.event_date,
                    service_name: file.service_name,
                    files: []
                };
            }
            filesByBooking[bookingKey].files.push({
                id: file.id,
                file_name: file.file_name,
                file_path: file.file_path,
                file_type: file.file_type,
                file_size: file.file_size,
                upload_date: file.upload_date
            });
        });

        res.json({
            success: true,
            galleries: Object.values(filesByBooking),
            totalFiles: files.length
        });

    } catch (error) {
        console.error('Get customer gallery error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch your gallery',
            error: error.message
        });
    }
});

// Get public gallery files (for website display)
router.get('/public', async (req, res) => {
    try {
        const { file_type = 'image', limit = 20, offset = 0 } = req.query;

        const files = await dbHelpers.all(`
            SELECT g.id, g.file_name, g.file_path, g.file_type, g.upload_date,
                   b.customer_name, b.event_date
            FROM gallery g
            LEFT JOIN bookings b ON g.booking_id = b.id
            WHERE g.is_public = 1 AND g.file_type LIKE ?
            ORDER BY g.upload_date DESC
            LIMIT ? OFFSET ?
        `, [`${file_type}%`, parseInt(limit), parseInt(offset)]);

        // Get total count
        const countResult = await dbHelpers.get(`
            SELECT COUNT(*) as total FROM gallery 
            WHERE is_public = 1 AND file_type LIKE ?
        `, [`${file_type}%`]);

        res.json({
            success: true,
            files: files,
            pagination: {
                total: countResult.total,
                limit: parseInt(limit),
                offset: parseInt(offset),
                hasMore: countResult.total > (parseInt(offset) + files.length)
            }
        });

    } catch (error) {
        console.error('Get public gallery error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch gallery',
            error: error.message
        });
    }
});

// Get all gallery files (Admin only)
router.get('/admin/all', requireAdmin, async (req, res) => {
    try {
        const { customer_id, booking_id, file_type, is_public, limit = 50, offset = 0 } = req.query;

        let query = `
            SELECT g.*, b.customer_name, b.event_date, s.name as service_name,
                   u.name as customer_user_name, u.email as customer_email
            FROM gallery g
            LEFT JOIN bookings b ON g.booking_id = b.id
            LEFT JOIN services s ON b.service_id = s.id
            LEFT JOIN users u ON g.customer_id = u.id
        `;
        
        const conditions = [];
        const params = [];

        if (customer_id) {
            conditions.push('g.customer_id = ?');
            params.push(customer_id);
        }

        if (booking_id) {
            conditions.push('g.booking_id = ?');
            params.push(booking_id);
        }

        if (file_type) {
            conditions.push('g.file_type LIKE ?');
            params.push(`${file_type}%`);
        }

        if (is_public !== undefined) {
            conditions.push('g.is_public = ?');
            params.push(is_public === 'true' ? 1 : 0);
        }

        if (conditions.length > 0) {
            query += ' WHERE ' + conditions.join(' AND ');
        }

        query += ' ORDER BY g.upload_date DESC LIMIT ? OFFSET ?';
        params.push(parseInt(limit), parseInt(offset));

        const files = await dbHelpers.all(query, params);

        // Get total count
        let countQuery = 'SELECT COUNT(*) as total FROM gallery g';
        if (conditions.length > 0) {
            countQuery += ' WHERE ' + conditions.join(' AND ');
        }
        
        const countResult = await dbHelpers.get(countQuery, params.slice(0, -2));

        res.json({
            success: true,
            files: files,
            pagination: {
                total: countResult.total,
                limit: parseInt(limit),
                offset: parseInt(offset),
                hasMore: countResult.total > (parseInt(offset) + files.length)
            }
        });

    } catch (error) {
        console.error('Get all gallery files error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch gallery files',
            error: error.message
        });
    }
});

// Update file visibility (Admin only)
router.put('/admin/:id/visibility', requireAdmin, async (req, res) => {
    try {
        const fileId = req.params.id;
        const { is_public } = req.body;

        // Check if file exists
        const file = await dbHelpers.get('SELECT * FROM gallery WHERE id = ?', [fileId]);
        if (!file) {
            return res.status(404).json({
                success: false,
                message: 'File not found'
            });
        }

        // Update visibility
        await dbHelpers.run(`
            UPDATE gallery SET is_public = ? WHERE id = ?
        `, [is_public ? 1 : 0, fileId]);

        res.json({
            success: true,
            message: `File ${is_public ? 'made public' : 'made private'} successfully`
        });

    } catch (error) {
        console.error('Update file visibility error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to update file visibility',
            error: error.message
        });
    }
});

// Delete file (Admin only)
router.delete('/admin/:id', requireAdmin, async (req, res) => {
    try {
        const fileId = req.params.id;

        // Check if file exists
        const file = await dbHelpers.get('SELECT * FROM gallery WHERE id = ?', [fileId]);
        if (!file) {
            return res.status(404).json({
                success: false,
                message: 'File not found'
            });
        }

        // TODO: Delete actual file from filesystem
        // This will be implemented in the file upload task

        // Delete from database
        await dbHelpers.run('DELETE FROM gallery WHERE id = ?', [fileId]);

        res.json({
            success: true,
            message: 'File deleted successfully'
        });

    } catch (error) {
        console.error('Delete file error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to delete file',
            error: error.message
        });
    }
});

// Get gallery statistics (Admin only)
router.get('/admin/stats', requireAdmin, async (req, res) => {
    try {
        // Get file statistics
        const totalFiles = await dbHelpers.get(`
            SELECT COUNT(*) as count FROM gallery
        `);

        const publicFiles = await dbHelpers.get(`
            SELECT COUNT(*) as count FROM gallery WHERE is_public = 1
        `);

        const privateFiles = await dbHelpers.get(`
            SELECT COUNT(*) as count FROM gallery WHERE is_public = 0
        `);

        // Get file type distribution
        const fileTypes = await dbHelpers.all(`
            SELECT 
                CASE 
                    WHEN file_type LIKE 'image%' THEN 'Images'
                    WHEN file_type LIKE 'video%' THEN 'Videos'
                    ELSE 'Other'
                END as type,
                COUNT(*) as count
            FROM gallery
            GROUP BY type
        `);

        // Get storage usage (approximate)
        const storageUsage = await dbHelpers.get(`
            SELECT COALESCE(SUM(file_size), 0) as total_size FROM gallery
        `);

        // Get recent uploads
        const recentUploads = await dbHelpers.all(`
            SELECT g.id, g.file_name, g.file_type, g.upload_date, g.is_public,
                   b.customer_name, b.event_date
            FROM gallery g
            LEFT JOIN bookings b ON g.booking_id = b.id
            ORDER BY g.upload_date DESC
            LIMIT 10
        `);

        // Get files by customer
        const filesByCustomer = await dbHelpers.all(`
            SELECT u.name as customer_name, COUNT(g.id) as file_count
            FROM users u
            LEFT JOIN gallery g ON u.id = g.customer_id
            WHERE u.role = 'customer'
            GROUP BY u.id, u.name
            HAVING file_count > 0
            ORDER BY file_count DESC
            LIMIT 10
        `);

        res.json({
            success: true,
            stats: {
                totalFiles: totalFiles.count,
                publicFiles: publicFiles.count,
                privateFiles: privateFiles.count,
                fileTypes: fileTypes,
                storageUsage: {
                    totalBytes: storageUsage.total_size || 0,
                    totalMB: Math.round((storageUsage.total_size || 0) / (1024 * 1024) * 100) / 100
                },
                recentUploads: recentUploads,
                filesByCustomer: filesByCustomer
            }
        });

    } catch (error) {
        console.error('Get gallery stats error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch gallery statistics',
            error: error.message
        });
    }
});

module.exports = router;