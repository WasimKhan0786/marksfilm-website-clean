// Database initialization script for Marks Film
// Creates all necessary tables with sample data

const { dbHelpers } = require('../config/database');
const bcrypt = require('bcrypt');

async function initializeDatabase() {
    console.log('🎬 Initializing Marks Film Database...');
    
    try {
        // Temporarily disable foreign keys for initialization
        await dbHelpers.run('PRAGMA foreign_keys = OFF');
        console.log('🔧 Foreign keys temporarily disabled for initialization');
        // Create Users table
        await dbHelpers.run(`
            CREATE TABLE IF NOT EXISTS users (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL,
                email TEXT UNIQUE NOT NULL,
                phone TEXT,
                password_hash TEXT NOT NULL,
                role TEXT DEFAULT 'customer',
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )
        `);
        console.log('✅ Users table created');

        // Drop and recreate Services table with new schema
        await dbHelpers.run(`DROP TABLE IF EXISTS services`);
        await dbHelpers.run(`
            CREATE TABLE services (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL UNIQUE,
                display_name TEXT,
                description TEXT,
                price DECIMAL(10,2) NOT NULL,
                duration_hours INTEGER,
                features TEXT,
                is_active BOOLEAN DEFAULT 1,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )
        `);
        console.log('✅ Services table created');

        // Create Bookings table
        await dbHelpers.run(`
            CREATE TABLE IF NOT EXISTS bookings (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER,
                service_id INTEGER,
                customer_name TEXT NOT NULL,
                customer_email TEXT NOT NULL,
                customer_phone TEXT NOT NULL,
                alt_phone TEXT,
                event_date DATE NOT NULL,
                event_time TIME,
                event_location TEXT,
                venue_address TEXT,
                special_requirements TEXT,
                total_amount DECIMAL(10,2) NOT NULL,
                advance_amount DECIMAL(10,2) DEFAULT 0,
                payment_status TEXT DEFAULT 'pending',
                booking_status TEXT DEFAULT 'pending',
                razorpay_order_id TEXT,
                razorpay_payment_id TEXT,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (user_id) REFERENCES users(id),
                FOREIGN KEY (service_id) REFERENCES services(id)
            )
        `);
        console.log('✅ Bookings table created');

        // Create Payments table
        await dbHelpers.run(`
            CREATE TABLE IF NOT EXISTS payments (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                order_id TEXT UNIQUE NOT NULL,
                booking_id INTEGER,
                amount DECIMAL(10,2) NOT NULL,
                currency TEXT DEFAULT 'INR',
                status TEXT DEFAULT 'created',
                payment_id TEXT,
                signature TEXT,
                customer_name TEXT,
                customer_email TEXT,
                customer_phone TEXT,
                gateway TEXT DEFAULT 'razorpay',
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                completed_at DATETIME,
                FOREIGN KEY (booking_id) REFERENCES bookings(id)
            )
        `);
        console.log('✅ Payments table created');

        // Create Gallery table
        await dbHelpers.run(`
            CREATE TABLE IF NOT EXISTS gallery (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                booking_id INTEGER,
                customer_id INTEGER,
                file_name TEXT NOT NULL,
                file_path TEXT NOT NULL,
                file_type TEXT NOT NULL,
                file_size INTEGER,
                is_public BOOLEAN DEFAULT 0,
                upload_date DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (booking_id) REFERENCES bookings(id),
                FOREIGN KEY (customer_id) REFERENCES users(id)
            )
        `);
        console.log('✅ Gallery table created');

        // Create Reviews table
        await dbHelpers.run(`
            CREATE TABLE IF NOT EXISTS reviews (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                booking_id INTEGER,
                customer_name TEXT NOT NULL,
                customer_email TEXT,
                rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
                review_text TEXT,
                is_approved BOOLEAN DEFAULT 0,
                is_featured BOOLEAN DEFAULT 0,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (booking_id) REFERENCES bookings(id)
            )
        `);
        console.log('✅ Reviews table created');

        // Create Contact Messages table
        await dbHelpers.run(`
            CREATE TABLE IF NOT EXISTS contact_messages (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL,
                email TEXT NOT NULL,
                phone TEXT,
                subject TEXT NOT NULL,
                message TEXT NOT NULL,
                is_read BOOLEAN DEFAULT 0,
                replied BOOLEAN DEFAULT 0,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )
        `);
        console.log('✅ Contact Messages table created');

        // Insert sample services (matching frontend service names)
        const services = [
            {
                name: 'wedding-basic',
                display_name: 'Wedding Basic',
                description: 'Essential wedding coverage with professional editing',
                price: 25000,
                duration_hours: 6,
                features: JSON.stringify(['Professional Photography', 'HD Video Recording', '100 Edited Photos', 'Basic Editing', 'Online Gallery'])
            },
            {
                name: 'wedding-premium',
                display_name: 'Wedding Premium',
                description: 'Complete wedding package with drone shots',
                price: 45000,
                duration_hours: 8,
                features: JSON.stringify(['Professional Photography', 'Full HD Video', '200 Edited Photos', 'Drone Coverage', 'Advanced Editing', 'Premium Album'])
            },
            {
                name: 'wedding-luxury',
                display_name: 'Wedding Luxury',
                description: 'Premium wedding cinematography with multiple cameras',
                price: 75000,
                duration_hours: 10,
                features: JSON.stringify(['Cinematic Photography', '4K Video Recording', '300+ Photos', 'Multi-camera Setup', 'Drone Coverage', 'Same Day Editing', 'Luxury Album'])
            },
            {
                name: 'pre-wedding',
                display_name: 'Pre Wedding Shoot',
                description: 'Romantic pre-wedding photography & videography',
                price: 20000,
                duration_hours: 4,
                features: JSON.stringify(['Couple Photography', 'HD Video', '150 Edited Photos', 'Location Shoot', 'Creative Editing'])
            },
            {
                name: 'engagement',
                display_name: 'Engagement Ceremony',
                description: 'Beautiful engagement ceremony coverage',
                price: 30000,
                duration_hours: 5,
                features: JSON.stringify(['Event Photography', 'HD Video Recording', '200 Photos', 'Family Portraits', 'Highlight Reel'])
            },
            {
                name: 'birthday-party',
                display_name: 'Birthday Party',
                description: 'Fun and memorable birthday celebrations',
                price: 15000,
                duration_hours: 3,
                features: JSON.stringify(['Party Photography', 'Video Recording', '100 Photos', 'Fun Moments', 'Quick Editing'])
            }
        ];

        for (const service of services) {
            await dbHelpers.run(`
                INSERT OR REPLACE INTO services (name, display_name, description, price, duration_hours, features)
                VALUES (?, ?, ?, ?, ?, ?)
            `, [service.name, service.display_name, service.description, service.price, service.duration_hours, service.features]);
        }
        console.log('✅ Sample services inserted');

        // Create admin user
        const adminPassword = await bcrypt.hash('admin123', 10);
        await dbHelpers.run(`
            INSERT OR IGNORE INTO users (name, email, password_hash, role)
            VALUES (?, ?, ?, ?)
        `, ['Admin', 'admin@marksfilm.com', adminPassword, 'admin']);
        console.log('✅ Admin user created (email: admin@marksfilm.com, password: admin123)');

        // Create sample customer
        const customerPassword = await bcrypt.hash('customer123', 10);
        await dbHelpers.run(`
            INSERT OR IGNORE INTO users (name, email, phone, password_hash, role)
            VALUES (?, ?, ?, ?, ?)
        `, ['John Doe', 'customer@example.com', '+91 9876543210', customerPassword, 'customer']);
        console.log('✅ Sample customer created');

        // Insert sample reviews
        const sampleReviews = [
            {
                customer_name: 'Priya Sharma',
                customer_email: 'priya@example.com',
                rating: 5,
                review_text: 'Amazing work by Marks Film! The wedding photography was absolutely stunning. Highly recommended!',
                is_approved: 1,
                is_featured: 1
            },
            {
                customer_name: 'Rahul Kumar',
                customer_email: 'rahul@example.com',
                rating: 5,
                review_text: 'Professional service and beautiful cinematic videos. Made our special day even more memorable!',
                is_approved: 1,
                is_featured: 1
            },
            {
                customer_name: 'Anjali Singh',
                customer_email: 'anjali@example.com',
                rating: 4,
                review_text: 'Great photography skills and friendly team. The pre-wedding shoot was fantastic!',
                is_approved: 1,
                is_featured: 0
            }
        ];

        for (const review of sampleReviews) {
            await dbHelpers.run(`
                INSERT OR IGNORE INTO reviews (customer_name, customer_email, rating, review_text, is_approved, is_featured)
                VALUES (?, ?, ?, ?, ?, ?)
            `, [review.customer_name, review.customer_email, review.rating, review.review_text, review.is_approved, review.is_featured]);
        }
        console.log('✅ Sample reviews inserted');

        // Create expenses table for accounting
        await dbHelpers.run(`
            CREATE TABLE IF NOT EXISTS expenses (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                date TEXT NOT NULL,
                description TEXT NOT NULL,
                amount REAL NOT NULL,
                category TEXT NOT NULL,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )
        `);
        console.log('✅ Expenses table created');

        // Create notifications table
        await dbHelpers.run(`
            CREATE TABLE IF NOT EXISTS notifications (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                type TEXT NOT NULL,
                title TEXT NOT NULL,
                message TEXT NOT NULL,
                recipient_email TEXT,
                related_booking_id INTEGER,
                is_read BOOLEAN DEFAULT 0,
                read_at DATETIME,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (related_booking_id) REFERENCES bookings(id)
            )
        `);
        console.log('✅ Notifications table created');

        // Create leads table for CRM
        await dbHelpers.run(`
            CREATE TABLE IF NOT EXISTS leads (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL,
                phone TEXT NOT NULL,
                email TEXT,
                service_interest TEXT,
                event_date TEXT,
                budget REAL,
                source TEXT NOT NULL,
                notes TEXT,
                priority TEXT DEFAULT 'medium',
                status TEXT DEFAULT 'new',
                follow_up_date TEXT,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )
        `);
        console.log('✅ Leads table created');

        // Create lead activities table
        await dbHelpers.run(`
            CREATE TABLE IF NOT EXISTS lead_activities (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                lead_id INTEGER NOT NULL,
                activity_type TEXT NOT NULL,
                description TEXT NOT NULL,
                next_action TEXT,
                next_action_date TEXT,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (lead_id) REFERENCES leads(id)
            )
        `);
        console.log('✅ Lead activities table created');

        // Create equipment table for inventory
        await dbHelpers.run(`
            CREATE TABLE IF NOT EXISTS equipment (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL,
                category TEXT NOT NULL,
                brand TEXT,
                model TEXT,
                purchase_date TEXT,
                purchase_price REAL,
                current_value REAL,
                condition_status TEXT DEFAULT 'good',
                location TEXT,
                notes TEXT,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )
        `);
        console.log('✅ Equipment table created');

        // Create equipment maintenance table
        await dbHelpers.run(`
            CREATE TABLE IF NOT EXISTS equipment_maintenance (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                equipment_id INTEGER NOT NULL,
                maintenance_date TEXT NOT NULL,
                description TEXT NOT NULL,
                cost REAL,
                performed_by TEXT,
                next_due_date TEXT,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (equipment_id) REFERENCES equipment(id)
            )
        `);
        console.log('✅ Equipment maintenance table created');

        // Create equipment usage table
        await dbHelpers.run(`
            CREATE TABLE IF NOT EXISTS equipment_usage (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                equipment_id INTEGER NOT NULL,
                booking_id INTEGER,
                usage_date TEXT NOT NULL,
                hours_used REAL,
                condition_after TEXT,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (equipment_id) REFERENCES equipment(id),
                FOREIGN KEY (booking_id) REFERENCES bookings(id)
            )
        `);
        console.log('✅ Equipment usage table created');

        // Re-enable foreign keys
        await dbHelpers.run('PRAGMA foreign_keys = ON');
        console.log('🔧 Foreign keys re-enabled');

        console.log('🎉 Database initialization completed successfully!');
        console.log('📊 Database ready with all tables and sample data');
        
    } catch (error) {
        console.error('❌ Database initialization failed:', error.message);
        process.exit(1);
    }
}

// Run initialization if called directly
if (require.main === module) {
    initializeDatabase().then(() => {
        console.log('✅ Database setup complete!');
        process.exit(0);
    }).catch((error) => {
        console.error('❌ Setup failed:', error);
        process.exit(1);
    });
}

module.exports = { initializeDatabase };