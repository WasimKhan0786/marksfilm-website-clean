const express = require('express');
const router = express.Router();
const { dbHelpers } = require('../config/database');
const { sendEmail } = require('../utils/emailServiceResend');

// Admin authentication middleware
const adminAuth = (req, res, next) => {
    const adminKey = req.headers['admin-key'];
    if (adminKey !== 'marksfilm-admin-2024') {
        return res.status(401).json({ error: 'Unauthorized' });
    }
    next();
};

// Get all notifications
router.get('/', adminAuth, async (req, res) => {
    try {
        const notifications = await dbHelpers.all(`
            SELECT * FROM notifications 
            ORDER BY created_at DESC 
            LIMIT 50
        `);
        res.json({ notifications });
    } catch (error) {
        console.error('Error fetching notifications:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Mark notification as read
router.put('/:id/read', adminAuth, async (req, res) => {
    try {
        const { id } = req.params;
        await dbHelpers.run(`
            UPDATE notifications 
            SET is_read = 1, read_at = datetime('now')
            WHERE id = ?
        `, [id]);
        
        res.json({ success: true });
    } catch (error) {
        console.error('Error marking notification as read:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Send custom notification
router.post('/send', adminAuth, async (req, res) => {
    try {
        const { type, title, message, recipient_email, send_email } = req.body;
        
        // Save notification to database
        const result = await dbHelpers.run(`
            INSERT INTO notifications (type, title, message, recipient_email)
            VALUES (?, ?, ?, ?)
        `, [type, title, message, recipient_email]);
        
        // Send email if requested
        if (send_email && recipient_email) {
            await sendEmail({
                to: recipient_email,
                subject: title,
                html: `
                    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                        <h2 style="color: #667eea;">${title}</h2>
                        <p>${message}</p>
                        <hr>
                        <p style="color: #666; font-size: 12px;">
                            This is an automated message from MarksFilm.
                        </p>
                    </div>
                `
            });
        }
        
        res.json({ success: true, id: result.lastInsertRowid });
    } catch (error) {
        console.error('Error sending notification:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Get unread count
router.get('/unread-count', adminAuth, async (req, res) => {
    try {
        const result = await dbHelpers.get(`
            SELECT COUNT(*) as count 
            FROM notifications 
            WHERE is_read = 0
        `);
        
        res.json({ count: result.count });
    } catch (error) {
        console.error('Error fetching unread count:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Auto-generate notifications for important events
router.post('/auto-generate', adminAuth, async (req, res) => {
    try {
        const notifications = [];
        
        // Check for upcoming events (next 7 days)
        const upcomingEvents = await dbHelpers.all(`
            SELECT * FROM bookings 
            WHERE date(event_date) BETWEEN date('now') AND date('now', '+7 days')
            AND payment_status = 'paid'
            ORDER BY event_date
        `);
        
        for (const event of upcomingEvents) {
            const daysUntil = Math.ceil((new Date(event.event_date) - new Date()) / (1000 * 60 * 60 * 24));
            
            await dbHelpers.run(`
                INSERT OR IGNORE INTO notifications (type, title, message, related_booking_id)
                VALUES (?, ?, ?, ?)
            `, [
                'upcoming_event',
                `Upcoming Event: ${event.customer_name}`,
                `Event scheduled in ${daysUntil} days on ${event.event_date}. Service: ${event.service_type}`,
                event.id
            ]);
            
            notifications.push({
                type: 'upcoming_event',
                title: `Upcoming Event: ${event.customer_name}`,
                message: `Event scheduled in ${daysUntil} days`
            });
        }
        
        // Check for pending payments
        const pendingPayments = await dbHelpers.all(`
            SELECT * FROM bookings 
            WHERE payment_status = 'pending'
            AND created_at < datetime('now', '-24 hours')
        `);
        
        for (const payment of pendingPayments) {
            await dbHelpers.run(`
                INSERT OR IGNORE INTO notifications (type, title, message, related_booking_id)
                VALUES (?, ?, ?, ?)
            `, [
                'pending_payment',
                `Pending Payment: ${payment.customer_name}`,
                `Payment pending for booking #${payment.id}. Amount: ₹${payment.total_amount}`,
                payment.id
            ]);
            
            notifications.push({
                type: 'pending_payment',
                title: `Pending Payment: ${payment.customer_name}`,
                message: `Payment pending for ₹${payment.total_amount}`
            });
        }
        
        // Check for equipment maintenance due
        const maintenanceDue = await dbHelpers.all(`
            SELECT e.name, em.next_due_date 
            FROM equipment e
            JOIN equipment_maintenance em ON e.id = em.equipment_id
            WHERE date(em.next_due_date) <= date('now', '+7 days')
            AND em.next_due_date IS NOT NULL
        `);
        
        for (const maintenance of maintenanceDue) {
            await dbHelpers.run(`
                INSERT OR IGNORE INTO notifications (type, title, message)
                VALUES (?, ?, ?)
            `, [
                'maintenance_due',
                `Maintenance Due: ${maintenance.name}`,
                `Equipment maintenance is due on ${maintenance.next_due_date}`
            ]);
            
            notifications.push({
                type: 'maintenance_due',
                title: `Maintenance Due: ${maintenance.name}`,
                message: `Maintenance due on ${maintenance.next_due_date}`
            });
        }
        
        res.json({ 
            success: true, 
            generated: notifications.length,
            notifications 
        });
    } catch (error) {
        console.error('Error auto-generating notifications:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Send reminder emails
router.post('/send-reminders', adminAuth, async (req, res) => {
    try {
        const { type } = req.body;
        let sent = 0;
        
        if (type === 'event_reminder') {
            // Send reminders for events in next 2 days
            const upcomingEvents = await dbHelpers.all(`
                SELECT * FROM bookings 
                WHERE date(event_date) BETWEEN date('now', '+1 day') AND date('now', '+2 days')
                AND payment_status = 'paid'
                AND customer_email IS NOT NULL
            `);
            
            for (const event of upcomingEvents) {
                await sendEmail({
                    to: event.customer_email,
                    subject: `Reminder: Your ${event.service_type} event is tomorrow!`,
                    html: `
                        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                            <h2 style="color: #667eea;">Event Reminder</h2>
                            <p>Dear ${event.customer_name},</p>
                            <p>This is a friendly reminder that your <strong>${event.service_type}</strong> event is scheduled for tomorrow:</p>
                            <div style="background: #f8f9fa; padding: 15px; border-radius: 5px; margin: 20px 0;">
                                <p><strong>Date:</strong> ${event.event_date}</p>
                                <p><strong>Time:</strong> ${event.event_time || 'As discussed'}</p>
                                <p><strong>Location:</strong> ${event.venue_address || event.event_location}</p>
                            </div>
                            <p>We're excited to capture your special moments!</p>
                            <p>Best regards,<br>MarksFilm Team</p>
                        </div>
                    `
                });
                sent++;
            }
        }
        
        res.json({ success: true, sent });
    } catch (error) {
        console.error('Error sending reminders:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

module.exports = router;