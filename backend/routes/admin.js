const express = require('express');
const router = express.Router();
const { dbHelpers } = require('../config/database');

// Admin authentication middleware (simple for now)
const adminAuth = (req, res, next) => {
    // For now, just check for admin header
    // In production, implement proper JWT authentication
    const adminKey = req.headers['admin-key'];
    if (adminKey !== 'marksfilm-admin-2024') {
        return res.status(401).json({ error: 'Unauthorized' });
    }
    next();
};

// Dashboard stats
router.get('/stats', adminAuth, async (req, res) => {
    try {
        const totalBookingsResult = await dbHelpers.get('SELECT COUNT(*) as count FROM bookings');
        const totalBookings = totalBookingsResult.count;
        
        const totalRevenueResult = await dbHelpers.get('SELECT SUM(total_amount) as total FROM bookings WHERE payment_status = "paid"');
        const totalRevenue = totalRevenueResult.total || 0;
        
        const currentMonth = new Date().toISOString().slice(0, 7);
        const monthlyRevenueResult = await dbHelpers.get('SELECT SUM(total_amount) as total FROM bookings WHERE payment_status = "paid" AND created_at LIKE ?', [`${currentMonth}%`]);
        const monthlyRevenue = monthlyRevenueResult.total || 0;
        
        const pendingBookingsResult = await dbHelpers.get('SELECT COUNT(*) as count FROM bookings WHERE payment_status = "pending"');
        const pendingBookings = pendingBookingsResult.count;
        
        res.json({
            totalBookings,
            totalRevenue,
            monthlyRevenue,
            pendingBookings
        });
    } catch (error) {
        console.error('Error getting stats:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Recent bookings
router.get('/recent-bookings', adminAuth, async (req, res) => {
    try {
        const bookings = await dbHelpers.all(`
            SELECT * FROM bookings 
            ORDER BY created_at DESC 
            LIMIT 10
        `);
        
        res.json(bookings);
    } catch (error) {
        console.error('Error getting recent bookings:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// All bookings
router.get('/bookings', adminAuth, async (req, res) => {
    try {
        const bookings = await dbHelpers.all(`
            SELECT * FROM bookings 
            ORDER BY created_at DESC
        `);
        
        res.json(bookings);
    } catch (error) {
        console.error('Error getting bookings:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Update booking status
router.put('/bookings/:id/status', adminAuth, async (req, res) => {
    try {
        const { id } = req.params;
        const { status } = req.body;
        
        await dbHelpers.run('UPDATE bookings SET payment_status = ? WHERE id = ?', [status, id]);
        
        res.json({ success: true });
    } catch (error) {
        console.error('Error updating booking status:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Income data
router.get('/income', adminAuth, async (req, res) => {
    try {
        const result = await dbHelpers.get('SELECT SUM(total_amount) as total FROM bookings WHERE payment_status = "paid"');
        const total = result.total || 0;
        
        res.json({ total });
    } catch (error) {
        console.error('Error getting income:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Expenses data
router.get('/expenses', adminAuth, async (req, res) => {
    try {
        const expenses = await dbHelpers.all('SELECT * FROM expenses ORDER BY date DESC');
        const total = expenses.reduce((sum, expense) => sum + expense.amount, 0);
        
        res.json({ expenses, total });
    } catch (error) {
        console.error('Error getting expenses:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Add expense
router.post('/expenses', adminAuth, async (req, res) => {
    try {
        const { date, description, amount, category } = req.body;
        
        const result = await dbHelpers.run(`
            INSERT INTO expenses (date, description, amount, category, created_at)
            VALUES (?, ?, ?, ?, datetime('now'))
        `, [date, description, amount, category]);
        
        res.json({ success: true, id: result.lastInsertRowid });
    } catch (error) {
        console.error('Error adding expense:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Monthly P&L
router.get('/monthly-pl', adminAuth, async (req, res) => {
    try {
        const monthlyData = await dbHelpers.all(`
            SELECT 
                strftime('%Y-%m', created_at) as month,
                SUM(CASE WHEN payment_status = 'paid' THEN total_amount ELSE 0 END) as revenue
            FROM bookings 
            GROUP BY strftime('%Y-%m', created_at)
            ORDER BY month DESC
            LIMIT 12
        `);
        
        const monthlyExpenses = await dbHelpers.all(`
            SELECT 
                strftime('%Y-%m', date) as month,
                SUM(amount) as expenses
            FROM expenses 
            GROUP BY strftime('%Y-%m', date)
        `);
        
        // Combine revenue and expenses
        const result = monthlyData.map(month => {
            const expense = monthlyExpenses.find(e => e.month === month.month);
            const expenses = expense ? expense.expenses : 0;
            const profit = month.revenue - expenses;
            
            return {
                month: month.month,
                revenue: month.revenue,
                expenses,
                profit
            };
        });
        
        res.json(result);
    } catch (error) {
        console.error('Error getting monthly P&L:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Customer analytics
router.get('/customers', adminAuth, async (req, res) => {
    try {
        const customers = await dbHelpers.all(`
            SELECT 
                customer_name,
                customer_phone,
                customer_email,
                COUNT(*) as total_bookings,
                SUM(CASE WHEN payment_status = 'paid' THEN total_amount ELSE 0 END) as total_spent,
                MAX(created_at) as last_booking
            FROM bookings 
            GROUP BY customer_name, customer_phone
            ORDER BY total_spent DESC
        `);
        
        res.json(customers);
    } catch (error) {
        console.error('Error getting customers:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Service analytics
router.get('/services', adminAuth, async (req, res) => {
    try {
        const services = await dbHelpers.all(`
            SELECT 
                s.display_name as service_name,
                COUNT(b.id) as bookings_count,
                SUM(CASE WHEN b.payment_status = 'paid' THEN b.total_amount ELSE 0 END) as total_revenue,
                AVG(CASE WHEN b.payment_status = 'paid' THEN b.total_amount ELSE NULL END) as avg_price
            FROM services s
            LEFT JOIN bookings b ON s.name = b.service_id
            GROUP BY s.id, s.display_name
            ORDER BY total_revenue DESC
        `);
        
        res.json(services);
    } catch (error) {
        console.error('Error getting services:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

module.exports = router;