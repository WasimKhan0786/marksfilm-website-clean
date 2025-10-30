// Email service for Marks Film using Resend
// Better alternative to Gmail SMTP - more reliable and professional

const { Resend } = require('resend');

// Initialize Resend
const resend = new Resend(process.env.RESEND_API_KEY);

// Test Resend configuration
const testResendConfig = async () => {
    try {
        console.log('🚀 Resend email service initialized');
        console.log('✅ API Key configured:', process.env.RESEND_API_KEY ? 'Yes' : 'No');
    } catch (error) {
        console.error('❌ Resend configuration error:', error);
    }
};

// Initialize test
testResendConfig();

// Send contact form notification
const sendContactNotification = async (contactData) => {
    try {
        const { name, email, subject, message } = contactData;

        const emailData = await resend.emails.send({
            from: process.env.RESEND_FROM_EMAIL,
            to: 'wasimkham7861@gmail.com', // Your email
            subject: `🎬 New Contact Form: ${subject}`,
            html: `
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #ddd; border-radius: 10px;">
                    <h2 style="color: #ffb400; text-align: center;">🎬 New Contact Form Submission</h2>
                    
                    <div style="background: #f8f9fa; padding: 20px; border-radius: 8px; margin: 20px 0;">
                        <h3 style="color: #333; margin-top: 0;">Contact Details:</h3>
                        <p><strong>Name:</strong> ${name}</p>
                        <p><strong>Email:</strong> ${email}</p>
                        <p><strong>Subject:</strong> ${subject}</p>
                    </div>
                    
                    <div style="background: #fff; padding: 20px; border: 1px solid #eee; border-radius: 8px;">
                        <h3 style="color: #333; margin-top: 0;">Message:</h3>
                        <p style="line-height: 1.6;">${message}</p>
                    </div>
                    
                    <div style="text-align: center; margin-top: 20px; padding: 15px; background: #e8f5e8; border-radius: 8px;">
                        <p style="margin: 0; color: #00897b;">
                            <strong>📞 Reply via WhatsApp:</strong> 
                            <a href="https://wa.me/7004636112?text=Hi ${name}, Thank you for contacting Marks Film regarding '${subject}'. " 
                               style="color: #25D366; text-decoration: none;">
                                Click here to respond
                            </a>
                        </p>
                    </div>
                    
                    <div style="text-align: center; margin-top: 20px; color: #666; font-size: 12px;">
                        <p>Received at: ${new Date().toLocaleString('en-IN')}</p>
                        <p>Marks Film - Professional Videography & Photography</p>
                    </div>
                </div>
            `
        });

        console.log('✅ Contact notification sent via Resend:', emailData.id);
        return { success: true, messageId: emailData.id };

    } catch (error) {
        console.error('❌ Contact notification error:', error);
        return { success: false, error: error.message };
    }
};

// Send booking confirmation email
const sendBookingConfirmation = async (bookingData) => {
    try {
        const { 
            customer_name, 
            customer_email, 
            service_name, 
            event_date, 
            event_time, 
            event_location, 
            total_amount,
            booking_id 
        } = bookingData;

        // Email to customer
        const customerEmail = await resend.emails.send({
            from: process.env.RESEND_FROM_EMAIL,
            to: customer_email,
            subject: `🎉 Booking Confirmed - ${service_name}`,
            html: `
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #ddd; border-radius: 10px;">
                    <h2 style="color: #ffb400; text-align: center;">🎬 Booking Confirmation</h2>
                    
                    <div style="text-align: center; margin: 20px 0;">
                        <h3 style="color: #00897b;">Thank you ${customer_name}!</h3>
                        <p>Your booking has been confirmed. We're excited to capture your special moments!</p>
                    </div>
                    
                    <div style="background: #f8f9fa; padding: 20px; border-radius: 8px; margin: 20px 0;">
                        <h3 style="color: #333; margin-top: 0;">📋 Booking Details:</h3>
                        <p><strong>Booking ID:</strong> #${booking_id}</p>
                        <p><strong>Service:</strong> ${service_name}</p>
                        <p><strong>Date:</strong> ${event_date}</p>
                        <p><strong>Time:</strong> ${event_time}</p>
                        <p><strong>Location:</strong> ${event_location}</p>
                        <p><strong>Amount:</strong> ₹${parseInt(total_amount).toLocaleString()}</p>
                    </div>
                    
                    <div style="background: #e8f5e8; padding: 15px; border-radius: 8px; margin: 20px 0;">
                        <h3 style="color: #00897b; margin-top: 0;">📞 Contact Information:</h3>
                        <p><strong>Phone:</strong> +91 7004636112</p>
                        <p><strong>WhatsApp:</strong> 
                            <a href="https://wa.me/7004636112" style="color: #25D366;">Click to chat</a>
                        </p>
                        <p><strong>Email:</strong> wasimkham7861@gmail.com</p>
                    </div>
                    
                    <div style="text-align: center; margin-top: 20px;">
                        <p style="color: #666;">We'll contact you 24-48 hours before your event to confirm all details.</p>
                        <p style="color: #ffb400; font-weight: bold;">Thank you for choosing Marks Film!</p>
                    </div>
                </div>
            `
        });

        // Email to admin (you)
        const adminEmail = await resend.emails.send({
            from: process.env.RESEND_FROM_EMAIL,
            to: 'wasimkham7861@gmail.com',
            subject: `🎬 New Booking: ${service_name} - ${customer_name}`,
            html: `
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #ddd; border-radius: 10px;">
                    <h2 style="color: #ffb400; text-align: center;">🎬 New Booking Received!</h2>
                    
                    <div style="background: #f8f9fa; padding: 20px; border-radius: 8px; margin: 20px 0;">
                        <h3 style="color: #333; margin-top: 0;">Customer Details:</h3>
                        <p><strong>Name:</strong> ${customer_name}</p>
                        <p><strong>Email:</strong> ${customer_email}</p>
                        <p><strong>Booking ID:</strong> #${booking_id}</p>
                    </div>
                    
                    <div style="background: #fff; padding: 20px; border: 1px solid #eee; border-radius: 8px;">
                        <h3 style="color: #333; margin-top: 0;">Event Details:</h3>
                        <p><strong>Service:</strong> ${service_name}</p>
                        <p><strong>Date:</strong> ${event_date}</p>
                        <p><strong>Time:</strong> ${event_time}</p>
                        <p><strong>Location:</strong> ${event_location}</p>
                        <p><strong>Amount:</strong> ₹${parseInt(total_amount).toLocaleString()}</p>
                    </div>
                    
                    <div style="text-align: center; margin-top: 20px; padding: 15px; background: #e8f5e8; border-radius: 8px;">
                        <p style="margin: 0; color: #00897b;">
                            <strong>📞 Contact Customer:</strong> 
                            <a href="https://wa.me/7004636112?text=Hi ${customer_name}, Thank you for booking ${service_name} with Marks Film. " 
                               style="color: #25D366; text-decoration: none;">
                                WhatsApp Customer
                            </a>
                        </p>
                    </div>
                </div>
            `
        });

        console.log('✅ Booking confirmation sent to customer via Resend:', customerEmail.id);
        console.log('✅ Booking notification sent to admin via Resend:', adminEmail.id);

        return { 
            success: true, 
            customerMessageId: customerEmail.id,
            adminMessageId: adminEmail.id 
        };

    } catch (error) {
        console.error('❌ Booking confirmation error:', error);
        return { success: false, error: error.message };
    }
};

// Send real-time payment notification (INSTANT EMAIL)
const sendPaymentNotification = async (paymentData) => {
    try {
        const { 
            customer_name, 
            customer_email, 
            customer_phone,
            service_name,
            amount, 
            payment_id, 
            order_id,
            booking_id,
            event_date,
            event_time,
            event_location
        } = paymentData;

        // Instant notification to admin (aapko turant milega)
        const adminEmail = await resend.emails.send({
            from: process.env.RESEND_FROM_EMAIL,
            to: 'wasimkham7861@gmail.com',
            subject: `💰 PAYMENT RECEIVED! ₹${parseInt(amount).toLocaleString()} - ${customer_name}`,
            html: `
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 2px solid #28a745; border-radius: 10px; background: linear-gradient(135deg, #f8fff8 0%, #e8f5e8 100%);">
                    <div style="text-align: center; margin-bottom: 20px;">
                        <h1 style="color: #28a745; margin: 0; font-size: 2.2em;">💰 PAYMENT SUCCESSFUL!</h1>
                        <div style="background: #28a745; color: white; padding: 10px 20px; border-radius: 25px; display: inline-block; margin: 10px 0; font-size: 1.2em; font-weight: bold;">
                            ₹${parseInt(amount).toLocaleString()} RECEIVED
                        </div>
                    </div>
                    
                    <div style="background: #fff; padding: 20px; border-radius: 10px; margin: 20px 0; border-left: 5px solid #28a745;">
                        <h3 style="color: #333; margin-top: 0; display: flex; align-items: center;">
                            👤 Customer Details:
                        </h3>
                        <p><strong>Name:</strong> ${customer_name}</p>
                        <p><strong>Email:</strong> <a href="mailto:${customer_email}" style="color: #007bff;">${customer_email}</a></p>
                        <p><strong>Phone:</strong> <a href="tel:${customer_phone}" style="color: #28a745;">${customer_phone}</a></p>
                        <p><strong>WhatsApp:</strong> 
                            <a href="https://wa.me/${customer_phone.replace(/[^0-9]/g, '')}?text=Hi ${customer_name}, Your payment of ₹${parseInt(amount).toLocaleString()} has been received successfully! Thank you for choosing Marks Film." 
                               style="background: #25D366; color: white; padding: 5px 10px; border-radius: 5px; text-decoration: none; font-weight: bold;">
                                📱 Message Customer
                            </a>
                        </p>
                    </div>
                    
                    <div style="background: #fff; padding: 20px; border-radius: 10px; margin: 20px 0; border-left: 5px solid #ffc107;">
                        <h3 style="color: #333; margin-top: 0;">🎬 Booking Details:</h3>
                        <p><strong>Service:</strong> ${service_name}</p>
                        <p><strong>Event Date:</strong> ${event_date}</p>
                        <p><strong>Event Time:</strong> ${event_time}</p>
                        <p><strong>Location:</strong> ${event_location}</p>
                        <p><strong>Booking ID:</strong> #${booking_id}</p>
                    </div>
                    
                    <div style="background: #fff; padding: 20px; border-radius: 10px; margin: 20px 0; border-left: 5px solid #17a2b8;">
                        <h3 style="color: #333; margin-top: 0;">💳 Payment Details:</h3>
                        <p><strong>Amount:</strong> <span style="color: #28a745; font-size: 1.2em; font-weight: bold;">₹${parseInt(amount).toLocaleString()}</span></p>
                        <p><strong>Payment ID:</strong> <code style="background: #f8f9fa; padding: 2px 5px; border-radius: 3px;">${payment_id}</code></p>
                        <p><strong>Order ID:</strong> <code style="background: #f8f9fa; padding: 2px 5px; border-radius: 3px;">${order_id}</code></p>
                        <p><strong>Status:</strong> <span style="background: #28a745; color: white; padding: 3px 8px; border-radius: 12px; font-size: 0.9em;">✅ PAID</span></p>
                        <p><strong>Time:</strong> ${new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })}</p>
                    </div>
                    
                    <div style="background: linear-gradient(135deg, #28a745, #20c997); color: white; padding: 20px; border-radius: 10px; text-align: center; margin: 20px 0;">
                        <h3 style="margin: 0 0 10px 0;">🚀 Next Steps:</h3>
                        <p style="margin: 5px 0;">✅ Payment confirmed and recorded</p>
                        <p style="margin: 5px 0;">📞 Contact customer within 24 hours</p>
                        <p style="margin: 5px 0;">📅 Schedule pre-event meeting</p>
                        <p style="margin: 5px 0;">🎬 Prepare equipment for ${event_date}</p>
                    </div>
                    
                    <div style="text-align: center; margin-top: 20px; padding: 15px; background: #f8f9fa; border-radius: 8px;">
                        <p style="margin: 0; color: #666; font-size: 0.9em;">
                            🎬 <strong>Marks Film</strong> - Professional Videography & Photography<br>
                            📧 This is an automated notification from your booking system
                        </p>
                    </div>
                </div>
            `
        });

        // Success confirmation to customer
        const customerEmail = await resend.emails.send({
            from: process.env.RESEND_FROM_EMAIL,
            to: customer_email,
            subject: `✅ Payment Successful - Booking Confirmed! ₹${parseInt(amount).toLocaleString()}`,
            html: `
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 2px solid #28a745; border-radius: 10px;">
                    <div style="text-align: center; margin-bottom: 20px;">
                        <h1 style="color: #28a745; margin: 0;">✅ Payment Successful!</h1>
                        <p style="color: #666; font-size: 1.1em;">Your booking is now confirmed</p>
                    </div>
                    
                    <div style="background: #e8f5e8; padding: 20px; border-radius: 10px; margin: 20px 0; text-align: center;">
                        <h2 style="color: #28a745; margin: 0;">Thank you ${customer_name}!</h2>
                        <p style="margin: 10px 0; font-size: 1.1em;">We've received your payment of <strong>₹${parseInt(amount).toLocaleString()}</strong></p>
                    </div>
                    
                    <div style="background: #fff; padding: 20px; border: 1px solid #ddd; border-radius: 8px; margin: 20px 0;">
                        <h3 style="color: #333; margin-top: 0;">📋 Your Booking Details:</h3>
                        <p><strong>Service:</strong> ${service_name}</p>
                        <p><strong>Date:</strong> ${event_date}</p>
                        <p><strong>Time:</strong> ${event_time}</p>
                        <p><strong>Location:</strong> ${event_location}</p>
                        <p><strong>Booking ID:</strong> #${booking_id}</p>
                        <p><strong>Payment ID:</strong> ${payment_id}</p>
                    </div>
                    
                    <div style="background: #f8f9fa; padding: 20px; border-radius: 8px; margin: 20px 0;">
                        <h3 style="color: #333; margin-top: 0;">📞 Contact Information:</h3>
                        <p><strong>Phone:</strong> +91 7004636112</p>
                        <p><strong>WhatsApp:</strong> 
                            <a href="https://wa.me/7004636112" style="background: #25D366; color: white; padding: 5px 10px; border-radius: 5px; text-decoration: none;">
                                📱 Chat with us
                            </a>
                        </p>
                        <p><strong>Email:</strong> wasimkham7861@gmail.com</p>
                    </div>
                    
                    <div style="background: linear-gradient(135deg, #ffb400, #ffd700); color: #333; padding: 20px; border-radius: 10px; text-align: center; margin: 20px 0;">
                        <h3 style="margin: 0 0 10px 0;">🎬 What's Next?</h3>
                        <p style="margin: 5px 0;">📞 We'll call you within 24 hours</p>
                        <p style="margin: 5px 0;">📅 Schedule a pre-event meeting</p>
                        <p style="margin: 5px 0;">🎥 Discuss your vision and requirements</p>
                        <p style="margin: 5px 0;">✨ Create magical memories together!</p>
                    </div>
                    
                    <div style="text-align: center; margin-top: 20px; color: #666;">
                        <p>Thank you for choosing <strong style="color: #ffb400;">Marks Film</strong></p>
                        <p style="font-size: 0.9em;">Professional Videography & Photography Services</p>
                    </div>
                </div>
            `
        });

        console.log('🚀 REAL-TIME PAYMENT NOTIFICATION SENT VIA RESEND!');
        console.log('✅ Admin notification sent:', adminEmail.id);
        console.log('✅ Customer confirmation sent:', customerEmail.id);

        return { 
            success: true, 
            adminMessageId: adminEmail.id,
            customerMessageId: customerEmail.id,
            timestamp: new Date().toISOString()
        };

    } catch (error) {
        console.error('❌ Payment notification error:', error);
        return { success: false, error: error.message };
    }
};

// Send review notification
const sendReviewNotification = async (reviewData) => {
    try {
        const { customer_name, review_text, rating } = reviewData;

        const emailData = await resend.emails.send({
            from: process.env.RESEND_FROM_EMAIL,
            to: 'wasimkham7861@gmail.com',
            subject: `⭐ New Review: ${rating}/5 stars from ${customer_name}`,
            html: `
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #ddd; border-radius: 10px;">
                    <h2 style="color: #ffb400; text-align: center;">⭐ New Review Received!</h2>
                    
                    <div style="background: #f8f9fa; padding: 20px; border-radius: 8px; margin: 20px 0;">
                        <h3 style="color: #333; margin-top: 0;">Review Details:</h3>
                        <p><strong>Customer:</strong> ${customer_name}</p>
                        <p><strong>Rating:</strong> ${'⭐'.repeat(rating)} (${rating}/5)</p>
                    </div>
                    
                    <div style="background: #fff; padding: 20px; border: 1px solid #eee; border-radius: 8px;">
                        <h3 style="color: #333; margin-top: 0;">Review:</h3>
                        <p style="line-height: 1.6; font-style: italic;">"${review_text}"</p>
                    </div>
                    
                    <div style="text-align: center; margin-top: 20px; color: #666; font-size: 12px;">
                        <p>Received at: ${new Date().toLocaleString('en-IN')}</p>
                        <p>Login to admin panel to approve/reject this review</p>
                    </div>
                </div>
            `
        });

        console.log('✅ Review notification sent via Resend:', emailData.id);
        return { success: true, messageId: emailData.id };

    } catch (error) {
        console.error('❌ Review notification error:', error);
        return { success: false, error: error.message };
    }
};

module.exports = {
    sendContactNotification,
    sendBookingConfirmation,
    sendReviewNotification,
    sendPaymentNotification
};