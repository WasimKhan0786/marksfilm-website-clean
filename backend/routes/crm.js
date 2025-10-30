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

// Get all leads
router.get('/leads', adminAuth, async (req, res) => {
    try {
        const leads = await dbHelpers.all(`
            SELECT * FROM leads 
            ORDER BY created_at DESC
        `);
        res.json({ leads });
    } catch (error) {
        console.error('Error fetching leads:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Add new lead
router.post('/leads', adminAuth, async (req, res) => {
    try {
        const { name, phone, email, service_interest, event_date, budget, source, notes, priority } = req.body;
        
        const result = await dbHelpers.run(`
            INSERT INTO leads (name, phone, email, service_interest, event_date, budget, source, notes, priority, status)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'new')
        `, [name, phone, email, service_interest, event_date, budget, source, notes, priority]);
        
        res.json({ success: true, id: result.lastInsertRowid });
    } catch (error) {
        console.error('Error adding lead:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Update lead status
router.put('/leads/:id', adminAuth, async (req, res) => {
    try {
        const { id } = req.params;
        const { status, notes, follow_up_date } = req.body;
        
        await dbHelpers.run(`
            UPDATE leads 
            SET status = ?, notes = ?, follow_up_date = ?, updated_at = datetime('now')
            WHERE id = ?
        `, [status, notes, follow_up_date, id]);
        
        res.json({ success: true });
    } catch (error) {
        console.error('Error updating lead:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Add follow-up activity
router.post('/leads/:id/activity', adminAuth, async (req, res) => {
    try {
        const { id } = req.params;
        const { activity_type, description, next_action, next_action_date } = req.body;
        
        const result = await dbHelpers.run(`
            INSERT INTO lead_activities (lead_id, activity_type, description, next_action, next_action_date)
            VALUES (?, ?, ?, ?, ?)
        `, [id, activity_type, description, next_action, next_action_date]);
        
        res.json({ success: true, id: result.lastInsertRowid });
    } catch (error) {
        console.error('Error adding activity:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Get lead activities
router.get('/leads/:id/activities', adminAuth, async (req, res) => {
    try {
        const { id } = req.params;
        const activities = await dbHelpers.all(`
            SELECT * FROM lead_activities 
            WHERE lead_id = ? 
            ORDER BY created_at DESC
        `, [id]);
        
        res.json({ activities });
    } catch (error) {
        console.error('Error fetching activities:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Lead conversion funnel
router.get('/funnel', adminAuth, async (req, res) => {
    try {
        const funnel = await dbHelpers.all(`
            SELECT 
                status,
                COUNT(*) as count,
                AVG(budget) as avg_budget
            FROM leads 
            GROUP BY status
            ORDER BY 
                CASE status 
                    WHEN 'new' THEN 1
                    WHEN 'contacted' THEN 2
                    WHEN 'qualified' THEN 3
                    WHEN 'proposal_sent' THEN 4
                    WHEN 'negotiating' THEN 5
                    WHEN 'won' THEN 6
                    WHEN 'lost' THEN 7
                    ELSE 8
                END
        `);
        
        res.json({ funnel });
    } catch (error) {
        console.error('Error fetching funnel:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Lead source analysis
router.get('/sources', adminAuth, async (req, res) => {
    try {
        const sources = await dbHelpers.all(`
            SELECT 
                source,
                COUNT(*) as total_leads,
                COUNT(CASE WHEN status = 'won' THEN 1 END) as converted_leads,
                (COUNT(CASE WHEN status = 'won' THEN 1 END) * 100.0 / COUNT(*)) as conversion_rate,
                AVG(budget) as avg_budget
            FROM leads 
            GROUP BY source
            ORDER BY conversion_rate DESC
        `);
        
        res.json({ sources });
    } catch (error) {
        console.error('Error fetching sources:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Today's follow-ups
router.get('/follow-ups/today', adminAuth, async (req, res) => {
    try {
        const today = new Date().toISOString().split('T')[0];
        const followUps = await dbHelpers.all(`
            SELECT l.*, la.next_action, la.next_action_date
            FROM leads l
            JOIN lead_activities la ON l.id = la.lead_id
            WHERE date(la.next_action_date) = ?
            AND l.status NOT IN ('won', 'lost')
            ORDER BY la.next_action_date
        `, [today]);
        
        res.json({ followUps });
    } catch (error) {
        console.error('Error fetching follow-ups:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Lead performance metrics
router.get('/metrics', adminAuth, async (req, res) => {
    try {
        const metrics = await dbHelpers.get(`
            SELECT 
                COUNT(*) as total_leads,
                COUNT(CASE WHEN status = 'won' THEN 1 END) as won_leads,
                COUNT(CASE WHEN status = 'lost' THEN 1 END) as lost_leads,
                (COUNT(CASE WHEN status = 'won' THEN 1 END) * 100.0 / COUNT(*)) as overall_conversion_rate,
                AVG(CASE WHEN status = 'won' THEN budget END) as avg_deal_size,
                SUM(CASE WHEN status = 'won' THEN budget ELSE 0 END) as total_pipeline_value
            FROM leads
        `);
        
        res.json({ metrics });
    } catch (error) {
        console.error('Error fetching metrics:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

module.exports = router;