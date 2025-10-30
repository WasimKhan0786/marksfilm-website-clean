// Bookings management routes for Marks Film
// Admin and customer booking management

const express = require('express');
const { dbHelpers } = require('../config/database');
const { requireAuth, requireAdmin } = require('./auth');

const router = express.Router();

// Get all bookings (Admin only)
router.get('/admin/all', requireAdmin, async (req, res) => {
    try {
        const { status, date_from, date_to, limit = 50, offset = 0 } = req.query;

        let query = `
            SELECT b.*, s.name as service_name, s.price as service_price,
                   u.name as user_name, u.email as user_email
            FROM bookings b
            JOIN services s ON b.service_id = s.id
            LEFT JOIN users u ON b.user_id = u.id
        `;
        
        const conditions = [];
        const params = [];

        if (status) {
            conditions.push('b.booking_status = ?');
            params.push(status);
        }

        if (date_from) {
            conditions.push('b.event_date >= ?');
            params.push(date_from);
        }

        if (date_to) {
            conditions.push('b.event_date <= ?');
            params.push(date_to);
        }

        if (conditions.length > 0) {
            query += ' WHERE ' + conditions.join(' AND ');
        }

        query += ' ORDER BY b.created_at DESC LIMIT ? OFFSET ?';
        params.push(parseInt(limit), parseInt(offset));

        const bookings = await dbHelpers.all(query, params);

        // Get total count
        let countQuery = 'SELECT COUNT(*) as total FROM bookings b';
        if (conditions.length > 0) {
            countQuery += ' WHERE ' + conditions.join(' AND ');
        }
        
        const countResult = await dbHelpers.get(countQuery, params.slice(0, -2));

        res.json({
            success: true,
            bookings: bookings,
            pagination: {
                total: countResult.total,
                limit: parseInt(limit),
                offset: parseInt(offset),
                hasMore: countResult.total > (parseInt(offset) + bookings.length)
            }
        });

    } catch (error) {
        console.error('Get all bookings error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch bookings',
            error: error.message
        });
    }
});

// Get user's bookings (Customer)
router.get('/my-bookings', requireAuth, async (req, res) => {
    try {
        const userId = req.session.user.id;
        const { status } = req.query;

        let query = `
            SELECT b.*, s.name as service_name, s.price as service_price, s.features
            FROM bookings b
            JOIN services s ON b.service_id = s.id
            WHERE b.user_id = ?
        `;
        
        const params = [userId];

        if (status) {
            query += ' AND b.booking_status = ?';
            params.push(status);
        }

        query += ' ORDER BY b.event_date DESC';

        const bookings = await dbHelpers.all(query, params);

        // Parse service features for each booking
        const bookingsWithFeatures = bookings.map(booking => ({
            ...booking,
            service_features: booking.features ? JSON.parse(booking.features) : []
        }));

        res.json({
            success: true,
            bookings: bookingsWithFeatures
        });

    } catch (error) {
        console.error('Get user bookings error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch your bookings',
            error: error.message
        });
    }
});

// Update booking status (Admin only)
router.put('/admin/:id/status', requireAdmin, async (req, res) => {
    try {
        const bookingId = req.params.id;
        const { booking_status, payment_status, notes } = req.body;

        // Validate status values
        const validBookingStatuses = ['pending', 'confirmed', 'in_progress', 'completed', 'cancelled'];
        const validPaymentStatuses = ['pending', 'paid', 'partial', 'refunded'];

        if (booking_status && !validBookingStatuses.includes(booking_status)) {
            return res.status(400).json({
                success: false,
                message: 'Invalid booking status'
            });
        }

        if (payment_status && !validPaymentStatuses.includes(payment_status)) {
            return res.status(400).json({
                success: false,
                message: 'Invalid payment status'
            });
        }

        // Check if booking exists
        const booking = await dbHelpers.get('SELECT * FROM bookings WHERE id = ?', [bookingId]);
        if (!booking) {
            return res.status(404).json({
                success: false,
                message: 'Booking not found'
            });
        }

        // Update booking
        const updates = [];
        const params = [];

        if (booking_status) {
            updates.push('booking_status = ?');
            params.push(booking_status);
        }

        if (payment_status) {
            updates.push('payment_status = ?');
            params.push(payment_status);
        }

        if (notes) {
            updates.push('special_requirements = ?');
            params.push(notes);
        }

        updates.push('updated_at = CURRENT_TIMESTAMP');
        params.push(bookingId);

        await dbHelpers.run(`
            UPDATE bookings SET ${updates.join(', ')} WHERE id = ?
        `, params);

        // Get updated booking
        const updatedBooking = await dbHelpers.get(`
            SELECT b.*, s.name as service_name, s.price as service_price
            FROM bookings b
            JOIN services s ON b.service_id = s.id
            WHERE b.id = ?
        `, [bookingId]);

        res.json({
            success: true,
            message: 'Booking updated successfully',
            booking: updatedBooking
        });

    } catch (error) {
        console.error('Update booking status error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to update booking',
            error: error.message
        });
    }
});

// Get booking analytics (Admin only)
router.get('/admin/analytics', requireAdmin, async (req, res) => {
    try {
        // Get booking statistics
        const totalBookings = await dbHelpers.get(`
            SELECT COUNT(*) as count FROM bookings
        `);

        const confirmedBookings = await dbHelpers.get(`
            SELECT COUNT(*) as count FROM bookings WHERE booking_status = 'confirmed'
        `);

        const pendingBookings = await dbHelpers.get(`
            SELECT COUNT(*) as count FROM bookings WHERE booking_status = 'pending'
        `);

        const completedBookings = await dbHelpers.get(`
            SELECT COUNT(*) as count FROM bookings WHERE booking_status = 'completed'
        `);

        // Get revenue statistics
        const totalRevenue = await dbHelpers.get(`
            SELECT COALESCE(SUM(total_amount), 0) as total FROM bookings 
            WHERE payment_status IN ('paid', 'partial')
        `);

        const monthlyRevenue = await dbHelpers.get(`
            SELECT COALESCE(SUM(total_amount), 0) as total FROM bookings 
            WHERE payment_status IN ('paid', 'partial') 
            AND strftime('%Y-%m', created_at) = strftime('%Y-%m', 'now')
        `);

        // Get popular services
        const popularServices = await dbHelpers.all(`
            SELECT s.name, COUNT(b.id) as booking_count, SUM(b.total_amount) as revenue
            FROM services s
            LEFT JOIN bookings b ON s.id = b.service_id
            GROUP BY s.id, s.name
            ORDER BY booking_count DESC
            LIMIT 5
        `);

        // Get recent bookings
        const recentBookings = await dbHelpers.all(`
            SELECT b.id, b.customer_name, b.event_date, b.booking_status, s.name as service_name
            FROM bookings b
            JOIN services s ON b.service_id = s.id
            ORDER BY b.created_at DESC
            LIMIT 10
        `);

        // Get monthly booking trends (last 6 months)
        const monthlyTrends = await dbHelpers.all(`
            SELECT 
                strftime('%Y-%m', created_at) as month,
                COUNT(*) as bookings,
                SUM(total_amount) as revenue
            FROM bookings
            WHERE created_at >= date('now', '-6 months')
            GROUP BY strftime('%Y-%m', created_at)
            ORDER BY month DESC
        `);

        res.json({
            success: true,
            analytics: {
                bookings: {
                    total: totalBookings.count,
                    confirmed: confirmedBookings.count,
                    pending: pendingBookings.count,
                    completed: completedBookings.count
                },
                revenue: {
                    total: totalRevenue.total,
                    monthly: monthlyRevenue.total
                },
                popularServices: popularServices,
                recentBookings: recentBookings,
                monthlyTrends: monthlyTrends
            }
        });

    } catch (error) {
        console.error('Get analytics error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch analytics',
            error: error.message
        });
    }
});

// Cancel booking (Customer or Admin)
router.put('/:id/cancel', requireAuth, async (req, res) => {
    try {
        const bookingId = req.params.id;
        const userId = req.session.user.id;
        const isAdmin = req.session.user.role === 'admin';
        const { reason } = req.body;

        // Check if booking exists and user has permission
        let booking;
        if (isAdmin) {
            booking = await dbHelpers.get('SELECT * FROM bookings WHERE id = ?', [bookingId]);
        } else {
            booking = await dbHelpers.get('SELECT * FROM bookings WHERE id = ? AND user_id = ?', [bookingId, userId]);
        }

        if (!booking) {
            return res.status(404).json({
                success: false,
                message: 'Booking not found or access denied'
            });
        }

        // Check if booking can be cancelled
        if (booking.booking_status === 'completed') {
            return res.status(400).json({
                success: false,
                message: 'Cannot cancel completed booking'
            });
        }

        if (booking.booking_status === 'cancelled') {
            return res.status(400).json({
                success: false,
                message: 'Booking is already cancelled'
            });
        }

        // Update booking status
        await dbHelpers.run(`
            UPDATE bookings 
            SET booking_status = 'cancelled',
                special_requirements = COALESCE(special_requirements || ' | Cancellation reason: ' || ?, 'Cancellation reason: ' || ?),
                updated_at = CURRENT_TIMESTAMP
            WHERE id = ?
        `, [reason || 'No reason provided', reason || 'No reason provided', bookingId]);

        res.json({
            success: true,
            message: 'Booking cancelled successfully'
        });

    } catch (error) {
        console.error('Cancel booking error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to cancel booking',
            error: error.message
        });
    }
});

module.exports = router;