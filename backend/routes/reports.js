const express = require('express');
const router = express.Router();
const { dbHelpers } = require('../config/database');

// Admin authentication middleware
const adminAuth = (req, res, next) => {
    const adminKey = req.headers['admin-key'];
    if (adminKey !== 'marksfilm-admin-2024') {
        return res.status(401).json({ error: 'Unauthorized' });
    }
    next();
};

// Generate GST Report
router.get('/gst', adminAuth, async (req, res) => {
    try {
        const { startDate, endDate } = req.query;
        
        const bookings = await dbHelpers.all(`
            SELECT 
                id,
                customer_name,
                customer_email,
                total_amount,
                created_at,
                payment_status,
                (total_amount * 0.18) as gst_amount,
                (total_amount - (total_amount * 0.18)) as base_amount
            FROM bookings 
            WHERE payment_status = 'paid'
            AND date(created_at) BETWEEN ? AND ?
            ORDER BY created_at DESC
        `, [startDate, endDate]);
        
        const totalRevenue = bookings.reduce((sum, b) => sum + b.total_amount, 0);
        const totalGST = totalRevenue * 0.18;
        const baseAmount = totalRevenue - totalGST;
        
        res.json({
            period: { startDate, endDate },
            summary: {
                totalRevenue,
                baseAmount,
                totalGST,
                transactionCount: bookings.length
            },
            transactions: bookings
        });
    } catch (error) {
        console.error('Error generating GST report:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Generate Income Tax Report
router.get('/income-tax', adminAuth, async (req, res) => {
    try {
        const { financialYear } = req.query; // e.g., "2024-25"
        
        const [startYear, endYear] = financialYear.split('-');
        const startDate = `${startYear}-04-01`;
        const endDate = `20${endYear}-03-31`;
        
        const income = await dbHelpers.get(`
            SELECT SUM(total_amount) as total_income
            FROM bookings 
            WHERE payment_status = 'paid'
            AND date(created_at) BETWEEN ? AND ?
        `, [startDate, endDate]);
        
        const expenses = await dbHelpers.get(`
            SELECT SUM(amount) as total_expenses
            FROM expenses 
            WHERE date(date) BETWEEN ? AND ?
        `, [startDate, endDate]);
        
        const totalIncome = income.total_income || 0;
        const totalExpenses = expenses.total_expenses || 0;
        const netIncome = totalIncome - totalExpenses;
        const taxableIncome = Math.max(0, netIncome - 250000); // Basic exemption
        const incomeTax = calculateIncomeTax(taxableIncome);
        
        res.json({
            financialYear,
            period: { startDate, endDate },
            summary: {
                totalIncome,
                totalExpenses,
                netIncome,
                basicExemption: 250000,
                taxableIncome,
                incomeTax
            }
        });
    } catch (error) {
        console.error('Error generating income tax report:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Customer Report
router.get('/customers', adminAuth, async (req, res) => {
    try {
        const customers = await dbHelpers.all(`
            SELECT 
                customer_name,
                customer_phone,
                customer_email,
                COUNT(*) as total_bookings,
                SUM(CASE WHEN payment_status = 'paid' THEN total_amount ELSE 0 END) as total_spent,
                AVG(CASE WHEN payment_status = 'paid' THEN total_amount ELSE NULL END) as avg_booking_value,
                MAX(created_at) as last_booking_date,
                MIN(created_at) as first_booking_date
            FROM bookings 
            GROUP BY customer_name, customer_phone
            ORDER BY total_spent DESC
        `);
        
        res.json({ customers });
    } catch (error) {
        console.error('Error generating customer report:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Service Performance Report
router.get('/services', adminAuth, async (req, res) => {
    try {
        const services = await dbHelpers.all(`
            SELECT 
                s.display_name as service_name,
                COUNT(b.id) as bookings_count,
                SUM(CASE WHEN b.payment_status = 'paid' THEN b.total_amount ELSE 0 END) as total_revenue,
                AVG(CASE WHEN b.payment_status = 'paid' THEN b.total_amount ELSE NULL END) as avg_price,
                (COUNT(CASE WHEN b.payment_status = 'paid' THEN 1 END) * 100.0 / COUNT(b.id)) as conversion_rate
            FROM services s
            LEFT JOIN bookings b ON s.id = b.service_id
            GROUP BY s.id, s.display_name
            ORDER BY total_revenue DESC
        `);
        
        res.json({ services });
    } catch (error) {
        console.error('Error generating service report:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Monthly Business Report
router.get('/monthly', adminAuth, async (req, res) => {
    try {
        const monthlyData = await dbHelpers.all(`
            SELECT 
                strftime('%Y-%m', created_at) as month,
                COUNT(*) as total_bookings,
                COUNT(CASE WHEN payment_status = 'paid' THEN 1 END) as paid_bookings,
                SUM(CASE WHEN payment_status = 'paid' THEN total_amount ELSE 0 END) as revenue,
                AVG(CASE WHEN payment_status = 'paid' THEN total_amount ELSE NULL END) as avg_booking_value
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
        
        // Combine data
        const result = monthlyData.map(month => {
            const expense = monthlyExpenses.find(e => e.month === month.month);
            const expenses = expense ? expense.expenses : 0;
            const profit = month.revenue - expenses;
            
            return {
                ...month,
                expenses,
                profit,
                profit_margin: month.revenue > 0 ? (profit / month.revenue * 100) : 0
            };
        });
        
        res.json({ monthlyData: result });
    } catch (error) {
        console.error('Error generating monthly report:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Helper function to calculate income tax
function calculateIncomeTax(taxableIncome) {
    let tax = 0;
    
    if (taxableIncome <= 250000) {
        tax = 0;
    } else if (taxableIncome <= 500000) {
        tax = (taxableIncome - 250000) * 0.05;
    } else if (taxableIncome <= 1000000) {
        tax = 12500 + (taxableIncome - 500000) * 0.20;
    } else {
        tax = 112500 + (taxableIncome - 1000000) * 0.30;
    }
    
    return Math.round(tax);
}

module.exports = router;