// Test Razorpay Connection
const Razorpay = require('razorpay');
require('dotenv').config();

console.log('🔍 Testing Razorpay Connection...');
console.log('Key ID:', process.env.RAZORPAY_KEY_ID);
console.log('Key Secret:', process.env.RAZORPAY_KEY_SECRET ? 'Present' : 'Missing');

// Initialize Razorpay
const razorpay = new Razorpay({
    key_id: process.env.RAZORPAY_KEY_ID,
    key_secret: process.env.RAZORPAY_KEY_SECRET
});

// Test order creation
async function testRazorpay() {
    try {
        console.log('\n🚀 Creating test order...');
        
        const options = {
            amount: 100, // ₹1 in paise
            currency: 'INR',
            receipt: `test_${Date.now()}`,
            notes: {
                test: 'true'
            }
        };

        const order = await razorpay.orders.create(options);
        
        console.log('✅ Razorpay connection successful!');
        console.log('Order ID:', order.id);
        console.log('Amount:', order.amount);
        console.log('Currency:', order.currency);
        console.log('Status:', order.status);
        
    } catch (error) {
        console.error('❌ Razorpay connection failed:');
        console.error('Error:', error.message);
        console.error('Code:', error.error?.code);
        console.error('Description:', error.error?.description);
    }
}

testRazorpay();