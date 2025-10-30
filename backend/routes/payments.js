// Payment routes for Marks Film
// Razorpay integration for secure payments

const express = require('express');
const Razorpay = require('razorpay');
const crypto = require('crypto');
const { dbHelpers } = require('../config/database');
const { requireAuth } = require('./auth');
const { sendPaymentNotification } = require('../utils/emailServiceResend');

const router = express.Router();

// Initialize Razorpay
const razorpay = new Razorpay({
    key_id: process.env.RAZORPAY_KEY_ID,
    key_secret: process.env.RAZORPAY_KEY_SECRET
});

// Create Razorpay order
router.post('/create-order', async (req, res) => {
    try {
        const { amount, bookingId, customerName, customerEmail, customerPhone } = req.body;

        // Validate amount
        if (!amount || amount < 100) {
            return res.status(400).json({
                success: false,
                message: 'Invalid amount. Minimum ₹1 required.'
            });
        }

        // Create Razorpay order
        const options = {
            amount: amount * 100, // Amount in paise
            currency: 'INR',
            receipt: `booking_${bookingId || Date.now()}`,
            notes: {
                booking_id: bookingId,
                customer_name: customerName,
                customer_email: customerEmail,
                customer_phone: customerPhone
            }
        };

        const order = await razorpay.orders.create(options);

        // Save order to database
        // For test orders, don't use booking_id to avoid foreign key constraint
        const finalBookingId = (bookingId && bookingId.toString().startsWith('test_')) ? null : bookingId;

        const result = await dbHelpers.run(`
            INSERT INTO payments (
                order_id, booking_id, amount, currency, status, 
                customer_name, customer_email, customer_phone, gateway
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        `, [
            order.id,
            finalBookingId,
            amount,
            'INR',
            'created',
            customerName || null,
            customerEmail || null,
            customerPhone || null,
            'razorpay'
        ]);

        res.json({
            success: true,
            order: order,
            paymentId: result.id
        });

    } catch (error) {
        console.error('Create order error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to create payment order',
            error: error.message
        });
    }
});

// Verify Razorpay payment
router.post('/verify', async (req, res) => {
    try {
        const {
            razorpay_order_id,
            razorpay_payment_id,
            razorpay_signature,
            booking_id
        } = req.body;

        // Verify signature
        const body = razorpay_order_id + "|" + razorpay_payment_id;
        const expectedSignature = crypto
            .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
            .update(body.toString())
            .digest('hex');

        if (expectedSignature !== razorpay_signature) {
            return res.status(400).json({
                success: false,
                message: 'Payment verification failed'
            });
        }

        // Update payment status in database
        await dbHelpers.run(`
            UPDATE payments 
            SET status = 'completed', 
                payment_id = ?, 
                signature = ?,
                completed_at = CURRENT_TIMESTAMP
            WHERE order_id = ?
        `, [razorpay_payment_id, razorpay_signature, razorpay_order_id]);

        // Update booking status if booking_id provided
        if (booking_id) {
            await dbHelpers.run(`
                UPDATE bookings 
                SET payment_status = 'paid',
                    booking_status = 'confirmed',
                    razorpay_payment_id = ?,
                    updated_at = CURRENT_TIMESTAMP
                WHERE id = ?
            `, [razorpay_payment_id, booking_id]);
        }

        // 🚀 REAL-TIME NOTIFICATION - Get complete booking details for email
        const bookingDetails = await dbHelpers.get(`
            SELECT b.*, s.name as service_name 
            FROM bookings b 
            LEFT JOIN services s ON b.service_id = s.id 
            WHERE b.id = ?
        `, [booking_id]);

        const paymentDetails = await dbHelpers.get(`
            SELECT * FROM payments WHERE order_id = ?
        `, [razorpay_order_id]);

        // Send instant email notification
        if (bookingDetails && paymentDetails) {
            console.log('🚀 Sending real-time payment notification...');

            const notificationData = {
                customer_name: bookingDetails.customer_name,
                customer_email: bookingDetails.customer_email,
                customer_phone: bookingDetails.customer_phone,
                service_name: bookingDetails.service_name || 'Custom Service',
                amount: paymentDetails.amount,
                payment_id: razorpay_payment_id,
                order_id: razorpay_order_id,
                booking_id: booking_id,
                event_date: bookingDetails.event_date,
                event_time: bookingDetails.event_time,
                event_location: bookingDetails.venue_address
            };

            // Send notification asynchronously (non-blocking)
            sendPaymentNotification(notificationData)
                .then(result => {
                    if (result.success) {
                        console.log('✅ Real-time payment notification sent successfully!');
                    } else {
                        console.error('❌ Payment notification failed:', result.error);
                    }
                })
                .catch(error => {
                    console.error('❌ Payment notification error:', error);
                });
        }

        res.json({
            success: true,
            message: 'Payment verified successfully',
            payment_id: razorpay_payment_id
        });

    } catch (error) {
        console.error('Payment verification error:', error);
        res.status(500).json({
            success: false,
            message: 'Payment verification failed',
            error: error.message
        });
    }
});

// Get payment details
router.get('/:paymentId', async (req, res) => {
    try {
        const paymentId = req.params.paymentId;

        const payment = await dbHelpers.get(`
            SELECT p.*, b.customer_name as booking_customer, b.event_date
            FROM payments p
            LEFT JOIN bookings b ON p.booking_id = b.id
            WHERE p.id = ? OR p.payment_id = ?
        `, [paymentId, paymentId]);

        if (!payment) {
            return res.status(404).json({
                success: false,
                message: 'Payment not found'
            });
        }

        res.json({
            success: true,
            payment: payment
        });

    } catch (error) {
        console.error('Get payment error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch payment details',
            error: error.message
        });
    }
});

// Get all payments (Admin only)
router.get('/admin/all', requireAuth, async (req, res) => {
    try {
        const { status, limit = 50, offset = 0 } = req.query;

        let query = `
            SELECT p.*, b.customer_name as booking_customer, b.event_date
            FROM payments p
            LEFT JOIN bookings b ON p.booking_id = b.id
        `;

        const params = [];

        if (status) {
            query += ' WHERE p.status = ?';
            params.push(status);
        }

        query += ' ORDER BY p.created_at DESC LIMIT ? OFFSET ?';
        params.push(parseInt(limit), parseInt(offset));

        const payments = await dbHelpers.all(query, params);

        // Get total count
        let countQuery = 'SELECT COUNT(*) as total FROM payments';
        if (status) {
            countQuery += ' WHERE status = ?';
        }

        const countParams = status ? [status] : [];
        const countResult = await dbHelpers.get(countQuery, countParams);

        res.json({
            success: true,
            payments: payments,
            pagination: {
                total: countResult.total,
                limit: parseInt(limit),
                offset: parseInt(offset),
                hasMore: countResult.total > (parseInt(offset) + payments.length)
            }
        });

    } catch (error) {
        console.error('Get all payments error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch payments',
            error: error.message
        });
    }
});

module.exports = router;