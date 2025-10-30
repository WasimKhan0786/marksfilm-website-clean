// Production Configuration
const config = {
    // Development URLs
    development: {
        BACKEND_URL: 'http://localhost:3001',
        FRONTEND_URL: 'http://localhost:3000'
    },
    
    // Production URLs (update these after deployment)
    production: {
        BACKEND_URL: 'https://your-project-name.vercel.app',
        FRONTEND_URL: 'https://your-project-name.vercel.app'
    }
};

// Auto-detect environment
const isProduction = window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1';
const currentConfig = isProduction ? config.production : config.development;

// Export for use in other files
window.APP_CONFIG = currentConfig;

console.log('🚀 Environment:', isProduction ? 'Production' : 'Development');
console.log('🔗 Backend URL:', currentConfig.BACKEND_URL);