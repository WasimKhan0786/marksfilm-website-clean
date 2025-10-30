// Database configuration for Marks Film
// SQLite database setup with proper error handling

const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');

// Database path
const DB_PATH = process.env.DB_PATH || path.join(__dirname, '../database/marks_film.db');

// Ensure database directory exists
const dbDir = path.dirname(DB_PATH);
if (!fs.existsSync(dbDir)) {
    fs.mkdirSync(dbDir, { recursive: true });
    console.log('📁 Database directory created:', dbDir);
}

// Create database connection
const db = new sqlite3.Database(DB_PATH, (err) => {
    if (err) {
        console.error('❌ Database connection error:', err.message);
        process.exit(1);
    } else {
        console.log('✅ Connected to SQLite database:', DB_PATH);
        
        // Enable foreign keys
        db.run('PRAGMA foreign_keys = ON', (err) => {
            if (err) {
                console.error('❌ Error enabling foreign keys:', err.message);
            } else {
                console.log('🔗 Foreign keys enabled');
            }
        });
    }
});

// Database helper functions
const dbHelpers = {
    // Run a query with parameters
    run: (sql, params = []) => {
        return new Promise((resolve, reject) => {
            db.run(sql, params, function(err) {
                if (err) {
                    console.error('❌ Database run error:', err.message);
                    reject(err);
                } else {
                    resolve({ id: this.lastID, changes: this.changes });
                }
            });
        });
    },

    // Get single row
    get: (sql, params = []) => {
        return new Promise((resolve, reject) => {
            db.get(sql, params, (err, row) => {
                if (err) {
                    console.error('❌ Database get error:', err.message);
                    reject(err);
                } else {
                    resolve(row);
                }
            });
        });
    },

    // Get all rows
    all: (sql, params = []) => {
        return new Promise((resolve, reject) => {
            db.all(sql, params, (err, rows) => {
                if (err) {
                    console.error('❌ Database all error:', err.message);
                    reject(err);
                } else {
                    resolve(rows);
                }
            });
        });
    },

    // Close database connection
    close: () => {
        return new Promise((resolve, reject) => {
            db.close((err) => {
                if (err) {
                    console.error('❌ Database close error:', err.message);
                    reject(err);
                } else {
                    console.log('✅ Database connection closed');
                    resolve();
                }
            });
        });
    }
};

// Export database instance and helpers
module.exports = {
    db,
    dbHelpers
};