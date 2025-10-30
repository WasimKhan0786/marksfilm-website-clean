const express = require('express');
const router = express.Router();
const { dbHelpers } = require('../config/database');
const { sendEmail } = require('../utils/emailServiceResend');

// Get all approved reviews
router.get('/', async (req, res) => {
    try {
        const reviews = await dbHelpers.all(`
            SELECT * FROM reviews 
            WHERE is_approved = 1 
            ORDER BY created_at DESC
        `);
        
        res.json({ success: true, reviews });
    } catch (error) {
        console.error('Error fetching reviews:', error);
        res.status(500).json({ success: false, error: 'Internal server error' });
    }
});

// Get featured reviews for homepage
router.get('/featured', async (req, res) => {
    try {
        const reviews = await dbHelpers.all(`
            SELECT * FROM reviews 
            WHERE is_approved = 1 AND is_featured = 1 
            ORDER BY created_at DESC 
            LIMIT 6
        `);
        
        res.json({ success: true, reviews });
    } catch (error) {
        console.error('Error fetching featured reviews:', error);
        res.status(500).json({ success: false, error: 'Internal server error' });
    }
});

// Submit new review
router.post('/submit', async (req, res) => {
    try {
        const { customer_name, customer_email, rating, review_text, booking_id } = req.body;
        
        // Validate input
        if (!customer_name || !rating || !review_text) {
            return res.status(400).json({ 
                success: false, 
                error: 'Name, rating, and review text are required' 
            });
        }
        
        if (rating < 1 || rating > 5) {
            return res.status(400).json({ 
                success: false, 
                error: 'Rating must be between 1 and 5' 
            });
        }
        
        // Insert review
        const result = await dbHelpers.run(`
            INSERT INTO reviews (booking_id, customer_name, customer_email, rating, review_text, is_approved, is_featured)
            VALUES (?, ?, ?, ?, ?, 0, 0)
        `, [booking_id || null, customer_name, customer_email, rating, review_text]);
        
        // Send notification email to admin
        try {
            await sendEmail({
                to: process.env.ADMIN_EMAIL || 'admin@marksfilm.com',
                subject: '🌟 New Review Submitted - MarksFilm',
                html: `
                    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
                        <h2 style="color: #667eea;">New Review Submitted</h2>
                        <div style="background: #f8f9fa; padding: 20px; border-radius: 10px; margin: 20px 0;">
                            <p><strong>Customer:</strong> ${customer_name}</p>
                            <p><strong>Email:</strong> ${customer_email || 'Not provided'}</p>
                            <p><strong>Rating:</strong> ${'⭐'.repeat(rating)} (${rating}/5)</p>
                            <p><strong>Review:</strong></p>
                            <blockquote style="border-left: 4px solid #667eea; padding-left: 15px; margin: 10px 0; font-style: italic;">
                                ${review_text}
                            </blockquote>
                        </div>
                        <p>Please review and approve this testimonial in your admin dashboard.</p>
                        <a href="${process.env.FRONTEND_URL || 'http://localhost:3000'}/admin-dashboard.html" 
                           style="background: #667eea; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px; display: inline-block;">
                            Review in Admin Panel
                        </a>
                    </div>
                `
            });
        } catch (emailError) {
            console.error('Error sending notification email:', emailError);
            // Don't fail the request if email fails
        }
        
        res.json({ 
            success: true, 
            message: 'Review submitted successfully! It will be published after approval.',
            id: result.lastInsertRowid 
        });
    } catch (error) {
        console.error('Error submitting review:', error);
        res.status(500).json({ success: false, error: 'Internal server error' });
    }
});

// Get review statistics
router.get('/stats', async (req, res) => {
    try {
        const stats = await dbHelpers.get(`
            SELECT 
                COUNT(*) as total_reviews,
                AVG(rating) as average_rating,
                COUNT(CASE WHEN rating = 5 THEN 1 END) as five_star_count,
                COUNT(CASE WHEN rating = 4 THEN 1 END) as four_star_count,
                COUNT(CASE WHEN rating = 3 THEN 1 END) as three_star_count,
                COUNT(CASE WHEN rating = 2 THEN 1 END) as two_star_count,
                COUNT(CASE WHEN rating = 1 THEN 1 END) as one_star_count
            FROM reviews 
            WHERE is_approved = 1
        `);
        
        res.json({ success: true, stats });
    } catch (error) {
        console.error('Error fetching review stats:', error);
        res.status(500).json({ success: false, error: 'Internal server error' });
    }
});

// Admin routes (require authentication)
const adminAuth = (req, res, next) => {
    const adminKey = req.headers['admin-key'];
    if (adminKey !== 'marksfilm-admin-2024') {
        return res.status(401).json({ error: 'Unauthorized' });
    }
    next();
};

// Get all reviews (including unapproved)
router.get('/admin/all', adminAuth, async (req, res) => {
    try {
        const reviews = await dbHelpers.all(`
            SELECT * FROM reviews 
            ORDER BY created_at DESC
        `);
        
        res.json({ success: true, reviews });
    } catch (error) {
        console.error('Error fetching all reviews:', error);
        res.status(500).json({ success: false, error: 'Internal server error' });
    }
});

// Approve review
router.put('/admin/:id/approve', adminAuth, async (req, res) => {
    try {
        const { id } = req.params;
        const { is_featured } = req.body;
        
        await dbHelpers.run(`
            UPDATE reviews 
            SET is_approved = 1, is_featured = ? 
            WHERE id = ?
        `, [is_featured ? 1 : 0, id]);
        
        res.json({ success: true, message: 'Review approved successfully' });
    } catch (error) {
        console.error('Error approving review:', error);
        res.status(500).json({ success: false, error: 'Internal server error' });
    }
});

// Reject/Delete review
router.delete('/admin/:id', adminAuth, async (req, res) => {
    try {
        const { id } = req.params;
        
        await dbHelpers.run('DELETE FROM reviews WHERE id = ?', [id]);
        
        res.json({ success: true, message: 'Review deleted successfully' });
    } catch (error) {
        console.error('Error deleting review:', error);
        res.status(500).json({ success: false, error: 'Internal server error' });
    }
});

// Toggle featured status
router.put('/admin/:id/feature', adminAuth, async (req, res) => {
    try {
        const { id } = req.params;
        
        // Toggle featured status
        await dbHelpers.run(`
            UPDATE reviews 
            SET is_featured = CASE WHEN is_featured = 1 THEN 0 ELSE 1 END 
            WHERE id = ?
        `, [id]);
        
        res.json({ success: true, message: 'Featured status updated' });
    } catch (error) {
        console.error('Error updating featured status:', error);
        res.status(500).json({ success: false, error: 'Internal server error' });
    }
});

module.exports = router;