/**
 * Dark Mode Enforcer for Marks Film Website
 * Ensures the website always opens in dark mode for the best cinematic experience
 */

class DarkModeEnforcer {
    constructor() {
        this.init();
    }

    init() {
        // Force dark mode immediately when script loads
        this.enforceDarkMode();
        
        // Set up observers and listeners
        this.setupDOMObserver();
        this.setupStorageListener();
        this.preventSystemOverride();
        
        console.log('🌙 Dark Mode Enforcer: Initialized successfully');
    }

    enforceDarkMode() {
        // Remove any light mode classes
        document.body.classList.remove('light-mode');
        document.documentElement.classList.remove('light-mode');
        
        // Set dark mode in localStorage
        localStorage.setItem('theme', 'dark');
        
        // Apply dark mode styles immediately
        this.applyDarkModeStyles();
        
        // Update theme toggle button if it exists
        this.updateThemeToggle();
    }

    applyDarkModeStyles() {
        // Ensure body has dark background
        document.body.style.backgroundColor = '#0a0a0a';
        document.body.style.color = '#ffffff';
        
        // Add dark mode class if not present
        if (!document.body.classList.contains('dark-mode')) {
            document.body.classList.add('dark-mode');
        }
    }

    updateThemeToggle() {
        const themeToggle = document.getElementById('themeToggle');
        if (themeToggle) {
            themeToggle.textContent = '🌙';
            themeToggle.title = 'Switch to Light Mode';
        }
    }

    setupDOMObserver() {
        // Watch for any attempts to add light-mode class
        const observer = new MutationObserver((mutations) => {
            mutations.forEach((mutation) => {
                if (mutation.type === 'attributes' && mutation.attributeName === 'class') {
                    const target = mutation.target;
                    if (target.classList.contains('light-mode')) {
                        console.log('🌙 Dark Mode Enforcer: Prevented light mode activation');
                        target.classList.remove('light-mode');
                        this.enforceDarkMode();
                    }
                }
            });
        });

        // Observe body and html elements
        observer.observe(document.body, { 
            attributes: true, 
            attributeFilter: ['class'] 
        });
        
        observer.observe(document.documentElement, { 
            attributes: true, 
            attributeFilter: ['class'] 
        });
    }

    setupStorageListener() {
        // Listen for localStorage changes
        window.addEventListener('storage', (e) => {
            if (e.key === 'theme' && e.newValue === 'light') {
                console.log('🌙 Dark Mode Enforcer: Prevented light mode storage');
                localStorage.setItem('theme', 'dark');
                this.enforceDarkMode();
            }
        });
    }

    preventSystemOverride() {
        // Override system preference detection
        if (window.matchMedia) {
            const mediaQuery = window.matchMedia('(prefers-color-scheme: light)');
            
            // Remove any existing listeners that might switch to light mode
            const originalAddEventListener = mediaQuery.addEventListener;
            mediaQuery.addEventListener = function(type, listener, options) {
                if (type === 'change') {
                    console.log('🌙 Dark Mode Enforcer: Blocked system theme listener');
                    return; // Block the listener
                }
                return originalAddEventListener.call(this, type, listener, options);
            };
        }
    }

    // Method to temporarily allow light mode (if needed for testing)
    allowLightMode() {
        console.log('🌞 Dark Mode Enforcer: Temporarily allowing light mode');
        // This method can be called from console for testing
        // It will be overridden on next page load
    }

    // Method to show dark mode benefits
    showDarkModeBenefits() {
        const benefits = [
            '🎬 Better cinematic experience',
            '👁️ Reduced eye strain',
            '🔋 Battery saving on OLED screens',
            '🌙 Professional photography/videography standard',
            '✨ Enhanced video and image contrast'
        ];

        console.log('🌙 Dark Mode Benefits:');
        benefits.forEach(benefit => console.log(`  ${benefit}`));
    }
}

// Initialize Dark Mode Enforcer
document.addEventListener('DOMContentLoaded', () => {
    window.darkModeEnforcer = new DarkModeEnforcer();
    
    // Show welcome message
    setTimeout(() => {
        if (typeof showNotification === 'function') {
            showNotification('🌙 Welcome to Marks Film! Optimized for dark mode viewing experience.', 'success');
        }
    }, 2000);
});

// Also initialize immediately if DOM is already loaded
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        if (!window.darkModeEnforcer) {
            window.darkModeEnforcer = new DarkModeEnforcer();
        }
    });
} else {
    window.darkModeEnforcer = new DarkModeEnforcer();
}

// Export for module use
if (typeof module !== 'undefined' && module.exports) {
    module.exports = DarkModeEnforcer;
}