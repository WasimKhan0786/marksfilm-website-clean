// Contact form routes for Marks Film
// Handle contact form submissions and inquiries

const express = require('express');
const { body, validationResult } = require('express-validator');
const { dbHelpers } = require('../config/database');
const { requireAdmin } = require('./auth');

const router = express.Router();

// Submit contact form
router.post('/submit', [
    body('name').trim().isLength({ min: 2 }).withMessage('Name must be at least 2 characters'),
    body('email').isEmail().normalizeEmail().withMessage('Valid email required'),
    body('phone').optional().isMobilePhone('en-IN').withMessage('Valid Indian phone number required'),
    body('subject').trim().isLength({ min: 5 }).withMessage('Subject must be at least 5 characters'),
    body('message').trim().isLength({ min: 10 }).withMessage('Message must be at least 10 characters')
], async (req, res) => {
    try {
        // Check validation errors
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({
                success: false,
                message: 'Validation failed',
                errors: errors.array()
            });
        }

        const { name, email, phone, subject, message } = req.body;

        // Save contact message to database
        const result = await dbHelpers.run(`
            INSERT INTO contact_messages (name, email, phone, subject, message)
            VALUES (?, ?, ?, ?, ?)
        `, [name, email, phone || null, subject, message]);

        // Send email notification to admin
        const { sendContactNotification } = require('../utils/emailService');
        try {
            await sendContactNotification({ name, email, subject, message });
            console.log('✅ Contact notification email sent');
        } catch (emailError) {
            console.error('❌ Failed to send contact notification email:', emailError);
            // Don't fail the request if email fails
        }

        res.status(201).json({
            success: true,
            message: 'Thank you for your message! We will get back to you soon.',
            messageId: result.id
        });

    } catch (error) {
        console.error('Contact form submission error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to submit contact form. Please try again.',
            error: error.message
        });
    }
});

// Get all contact messages (Admin only)
router.get('/admin/messages', requireAdmin, async (req, res) => {
    try {
        const { is_read, limit = 50, offset = 0 } = req.query;

        let query = 'SELECT * FROM contact_messages';
        const params = [];

        if (is_read !== undefined) {
            query += ' WHERE is_read = ?';
            params.push(is_read === 'true' ? 1 : 0);
        }

        query += ' ORDER BY created_at DESC LIMIT ? OFFSET ?';
        params.push(parseInt(limit), parseInt(offset));

        const messages = await dbHelpers.all(query, params);

        // Get total count
        let countQuery = 'SELECT COUNT(*) as total FROM contact_messages';
        if (is_read !== undefined) {
            countQuery += ' WHERE is_read = ?';
        }
        
        const countParams = is_read !== undefined ? [is_read === 'true' ? 1 : 0] : [];
        const countResult = await dbHelpers.get(countQuery, countParams);

        res.json({
            success: true,
            messages: messages,
            pagination: {
                total: countResult.total,
                limit: parseInt(limit),
                offset: parseInt(offset),
                hasMore: countResult.total > (parseInt(offset) + messages.length)
            }
        });

    } catch (error) {
        console.error('Get contact messages error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch contact messages',
            error: error.message
        });
    }
});

// Mark message as read (Admin only)
router.put('/admin/messages/:id/read', requireAdmin, async (req, res) => {
    try {
        const messageId = req.params.id;

        // Check if message exists
        const message = await dbHelpers.get('SELECT * FROM contact_messages WHERE id = ?', [messageId]);
        if (!message) {
            return res.status(404).json({
                success: false,
                message: 'Message not found'
            });
        }

        // Mark as read
        await dbHelpers.run(`
            UPDATE contact_messages SET is_read = 1 WHERE id = ?
        `, [messageId]);

        res.json({
            success: true,
            message: 'Message marked as read'
        });

    } catch (error) {
        console.error('Mark message as read error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to mark message as read',
            error: error.message
        });
    }
});

// Mark message as replied (Admin only)
router.put('/admin/messages/:id/replied', requireAdmin, async (req, res) => {
    try {
        const messageId = req.params.id;

        // Check if message exists
        const message = await dbHelpers.get('SELECT * FROM contact_messages WHERE id = ?', [messageId]);
        if (!message) {
            return res.status(404).json({
                success: false,
                message: 'Message not found'
            });
        }

        // Mark as replied and read
        await dbHelpers.run(`
            UPDATE contact_messages SET replied = 1, is_read = 1 WHERE id = ?
        `, [messageId]);

        res.json({
            success: true,
            message: 'Message marked as replied'
        });

    } catch (error) {
        console.error('Mark message as replied error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to mark message as replied',
            error: error.message
        });
    }
});

// Delete contact message (Admin only)
router.delete('/admin/messages/:id', requireAdmin, async (req, res) => {
    try {
        const messageId = req.params.id;

        // Check if message exists
        const message = await dbHelpers.get('SELECT * FROM contact_messages WHERE id = ?', [messageId]);
        if (!message) {
            return res.status(404).json({
                success: false,
                message: 'Message not found'
            });
        }

        // Delete message
        await dbHelpers.run('DELETE FROM contact_messages WHERE id = ?', [messageId]);

        res.json({
            success: true,
            message: 'Message deleted successfully'
        });

    } catch (error) {
        console.error('Delete contact message error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to delete message',
            error: error.message
        });
    }
});

// Get contact statistics (Admin only)
router.get('/admin/stats', requireAdmin, async (req, res) => {
    try {
        // Get message statistics
        const totalMessages = await dbHelpers.get(`
            SELECT COUNT(*) as count FROM contact_messages
        `);

        const unreadMessages = await dbHelpers.get(`
            SELECT COUNT(*) as count FROM contact_messages WHERE is_read = 0
        `);

        const repliedMessages = await dbHelpers.get(`
            SELECT COUNT(*) as count FROM contact_messages WHERE replied = 1
        `);

        const todayMessages = await dbHelpers.get(`
            SELECT COUNT(*) as count FROM contact_messages 
            WHERE date(created_at) = date('now')
        `);

        // Get recent messages
        const recentMessages = await dbHelpers.all(`
            SELECT id, name, email, subject, created_at, is_read, replied
            FROM contact_messages
            ORDER BY created_at DESC
            LIMIT 10
        `);

        res.json({
            success: true,
            stats: {
                total: totalMessages.count,
                unread: unreadMessages.count,
                replied: repliedMessages.count,
                today: todayMessages.count,
                recentMessages: recentMessages
            }
        });

    } catch (error) {
        console.error('Get contact stats error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch contact statistics',
            error: error.message
        });
    }
});

module.exports = router;