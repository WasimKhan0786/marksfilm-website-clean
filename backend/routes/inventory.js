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

// Get all equipment
router.get('/equipment', adminAuth, async (req, res) => {
    try {
        const equipment = await dbHelpers.all(`
            SELECT * FROM equipment 
            ORDER BY category, name
        `);
        res.json({ equipment });
    } catch (error) {
        console.error('Error fetching equipment:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Add new equipment
router.post('/equipment', adminAuth, async (req, res) => {
    try {
        const { name, category, brand, model, purchase_date, purchase_price, current_value, condition_status, location, notes } = req.body;
        
        const result = await dbHelpers.run(`
            INSERT INTO equipment (name, category, brand, model, purchase_date, purchase_price, current_value, condition_status, location, notes)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `, [name, category, brand, model, purchase_date, purchase_price, current_value, condition_status, location, notes]);
        
        res.json({ success: true, id: result.lastInsertRowid });
    } catch (error) {
        console.error('Error adding equipment:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Update equipment
router.put('/equipment/:id', adminAuth, async (req, res) => {
    try {
        const { id } = req.params;
        const { name, category, brand, model, current_value, condition_status, location, notes } = req.body;
        
        await dbHelpers.run(`
            UPDATE equipment 
            SET name = ?, category = ?, brand = ?, model = ?, current_value = ?, condition_status = ?, location = ?, notes = ?, updated_at = datetime('now')
            WHERE id = ?
        `, [name, category, brand, model, current_value, condition_status, location, notes, id]);
        
        res.json({ success: true });
    } catch (error) {
        console.error('Error updating equipment:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Equipment maintenance log
router.get('/equipment/:id/maintenance', adminAuth, async (req, res) => {
    try {
        const { id } = req.params;
        const maintenance = await dbHelpers.all(`
            SELECT * FROM equipment_maintenance 
            WHERE equipment_id = ? 
            ORDER BY maintenance_date DESC
        `, [id]);
        
        res.json({ maintenance });
    } catch (error) {
        console.error('Error fetching maintenance:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Add maintenance record
router.post('/equipment/:id/maintenance', adminAuth, async (req, res) => {
    try {
        const { id } = req.params;
        const { maintenance_date, description, cost, performed_by, next_due_date } = req.body;
        
        const result = await dbHelpers.run(`
            INSERT INTO equipment_maintenance (equipment_id, maintenance_date, description, cost, performed_by, next_due_date)
            VALUES (?, ?, ?, ?, ?, ?)
        `, [id, maintenance_date, description, cost, performed_by, next_due_date]);
        
        res.json({ success: true, id: result.lastInsertRowid });
    } catch (error) {
        console.error('Error adding maintenance:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Equipment usage tracking
router.post('/equipment/:id/usage', adminAuth, async (req, res) => {
    try {
        const { id } = req.params;
        const { booking_id, usage_date, hours_used, condition_after } = req.body;
        
        const result = await dbHelpers.run(`
            INSERT INTO equipment_usage (equipment_id, booking_id, usage_date, hours_used, condition_after)
            VALUES (?, ?, ?, ?, ?)
        `, [id, booking_id, usage_date, hours_used, condition_after]);
        
        res.json({ success: true, id: result.lastInsertRowid });
    } catch (error) {
        console.error('Error tracking usage:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Equipment depreciation report
router.get('/depreciation', adminAuth, async (req, res) => {
    try {
        const equipment = await dbHelpers.all(`
            SELECT 
                id, name, category, purchase_date, purchase_price, current_value,
                (purchase_price - current_value) as depreciated_amount,
                ((purchase_price - current_value) / purchase_price * 100) as depreciation_percentage,
                (julianday('now') - julianday(purchase_date)) / 365.25 as age_years
            FROM equipment 
            WHERE purchase_price > 0
            ORDER BY depreciation_percentage DESC
        `);
        
        res.json({ equipment });
    } catch (error) {
        console.error('Error generating depreciation report:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

module.exports = router;