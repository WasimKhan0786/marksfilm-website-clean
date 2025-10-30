// Single booking creation route for Marks Film
// Handle new booking submissions with payment integration

const express = require('express');
const { body, validationResult } = require('express-validator');
const { dbHelpers } = require('../config/database');

const router = express.Router();

// Create new booking
router.post('/', [
    body('name').trim().isLength({ min: 2 }).withMessage('Name must be at least 2 characters'),
    body('email').isEmail().normalizeEmail().withMessage('Valid email required'),
    body('phone').isMobilePhone('en-IN').withMessage('Valid Indian phone number required'),
    body('service').notEmpty().withMessage('Service selection required'),
    body('price').isNumeric().withMessage('Valid price required'),
    body('date').isISO8601().withMessage('Valid date required'),
    body('time').matches(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/).withMessage('Valid time required'),
    body('location').trim().isLength({ min: 5 }).withMessage('Location must be at least 5 characters')
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

        const {
            name,
            email,
            phone,
            altPhone,
            service,
            price,
            date,
            time,
            location,
            specialRequirements
        } = req.body;

        // Check if service exists (by name or display_name)
        const serviceExists = await dbHelpers.get(
            'SELECT id, name, display_name, price FROM services WHERE name = ? OR display_name = ? OR id = ?',
            [service, service, service]
        );

        if (!serviceExists) {
            console.log(`❌ Service not found: ${service}`);
            return res.status(400).json({
                success: false,
                message: `Invalid service selected: ${service}. Available services need to be checked.`
            });
        }

        console.log(`✅ Service found: ${serviceExists.name} (${serviceExists.display_name})`);

        // Check for date conflicts (optional - you can enable this)
        const conflictCheck = await dbHelpers.get(`
            SELECT id FROM bookings 
            WHERE event_date = ? AND event_time = ? 
            AND booking_status IN ('confirmed', 'in_progress')
        `, [date, time]);

        if (conflictCheck) {
            return res.status(409).json({
                success: false,
                message: 'This time slot is already booked. Please choose a different time.'
            });
        }

        // Create booking
        const result = await dbHelpers.run(`
            INSERT INTO bookings (
                customer_name, customer_email, customer_phone, alt_phone,
                service_id, event_date, event_time, event_location,
                special_requirements, total_amount, booking_status, payment_status
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', 'pending')
        `, [
            name,
            email, 
            phone,
            altPhone || null,
            serviceExists.id,
            date,
            time,
            location,
            specialRequirements || null,
            parseInt(price)
        ]);

        // Get created booking with service details
        const booking = await dbHelpers.get(`
            SELECT b.*, s.name as service_name, s.price as service_price
            FROM bookings b
            JOIN services s ON b.service_id = s.id
            WHERE b.id = ?
        `, [result.id]);

        // Send booking confirmation email via Resend
        const { sendBookingConfirmation } = require('../utils/emailServiceResend');
        try {
            await sendBookingConfirmation({
                customer_name: name,
                customer_email: email,
                service_name: booking.service_name,
                event_date: date,
                event_time: time,
                event_location: location,
                total_amount: price,
                booking_id: result.id
            });
            console.log('✅ Booking confirmation email sent');
        } catch (emailError) {
            console.error('❌ Failed to send booking confirmation email:', emailError);
            // Don't fail the request if email fails
        }

        res.status(201).json({
            success: true,
            message: 'Booking created successfully',
            booking: booking
        });

    } catch (error) {
        console.error('Booking creation error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to create booking',
            error: error.message
        });
    }
});

module.exports = router;