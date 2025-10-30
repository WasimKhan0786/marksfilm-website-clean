/**
 * Video Modal/Popup Functionality for Marks Film
 * Opens videos in full-screen modal when clicked
 */

class VideoModal {
    constructor() {
        this.currentVideo = null;
        this.modal = null;
        this.init();
    }

    init() {
        this.createModal();
        this.addClickListeners();
        this.setupKeyboardControls();
    }

    createModal() {
        // Create modal HTML structure
        const modalHTML = `
            <div id="videoModal" class="video-modal">
                <div class="video-modal-content">
                    <span class="video-modal-close">&times;</span>
                    <div class="video-modal-header">
                        <h3 id="modalVideoTitle">Video Title</h3>
                        <div class="video-modal-controls">
                            <button id="modalPlayPause" class="modal-btn">⏸️</button>
                            <button id="modalMute" class="modal-btn">🔊</button>
                            <button id="modalFullscreen" class="modal-btn">⛶</button>
                        </div>
                    </div>
                    <div class="video-modal-player">
                        <video id="modalVideo" controls>
                            <source id="modalVideoSource" src="" type="video/mp4">
                            Your browser does not support the video tag.
                        </video>
                    </div>
                    <div class="video-modal-info">
                        <p id="modalVideoDescription">Video Description</p>
                    </div>
                </div>
            </div>
        `;
        
        // Add modal to body
        document.body.insertAdjacentHTML('beforeend', modalHTML);
        this.modal = document.getElementById('videoModal');
        this.setupModalEvents();
    }

    setupModalEvents() {
        const closeBtn = document.querySelector('.video-modal-close');
        const modal = this.modal;
        const video = document.getElementById('modalVideo');

        // Close button
        closeBtn.addEventListener('click', () => this.closeModal());

        // Click outside to close
        modal.addEventListener('click', (e) => {
            if (e.target === modal) this.closeModal();
        });

        // Modal controls
        document.getElementById('modalPlayPause').addEventListener('click', () => {
            this.togglePlayPause();
        });

        document.getElementById('modalMute').addEventListener('click', () => {
            this.toggleMute();
        });

        document.getElementById('modalFullscreen').addEventListener('click', () => {
            this.toggleFullscreen();
        });
    }    
addClickListeners() {
        // Add click listeners to all video elements
        document.querySelectorAll('.video-carousel-item video, .featured-video-wrapper video').forEach(video => {
            const container = video.closest('.video-carousel-item, .featured-video-wrapper');
            
            // Add click cursor
            container.style.cursor = 'pointer';
            
            // Add click event
            container.addEventListener('click', (e) => {
                e.preventDefault();
                this.openVideoModal(video);
            });

            // Add hover effect
            container.addEventListener('mouseenter', () => {
                this.addHoverEffect(container);
            });

            container.addEventListener('mouseleave', () => {
                this.removeHoverEffect(container);
            });
        });
    }

    openVideoModal(videoElement) {
        const videoSrc = videoElement.getAttribute('data-src') || videoElement.src;
        const container = videoElement.closest('.video-carousel-item, .featured-video-wrapper');
        
        // Get video info
        const overlay = container.querySelector('.video-overlay, .featured-video-info');
        const title = overlay ? overlay.querySelector('h3')?.textContent || 'Marks Film Video' : 'Marks Film Video';
        const description = overlay ? overlay.querySelector('p')?.textContent || 'Professional videography showcase' : 'Professional videography showcase';

        // Set modal content
        document.getElementById('modalVideoTitle').textContent = title;
        document.getElementById('modalVideoDescription').textContent = description;
        document.getElementById('modalVideoSource').src = videoSrc;
        
        const modalVideo = document.getElementById('modalVideo');
        modalVideo.load();
        
        // Show modal
        this.modal.style.display = 'flex';
        document.body.style.overflow = 'hidden';
        
        // Auto play
        modalVideo.play().catch(() => {
            console.log('Autoplay prevented');
        });

        this.currentVideo = modalVideo;
    }

    closeModal() {
        if (this.currentVideo) {
            this.currentVideo.pause();
            this.currentVideo.currentTime = 0;
        }
        
        this.modal.style.display = 'none';
        document.body.style.overflow = 'auto';
        this.currentVideo = null;
    }

    togglePlayPause() {
        if (!this.currentVideo) return;
        
        const btn = document.getElementById('modalPlayPause');
        if (this.currentVideo.paused) {
            this.currentVideo.play();
            btn.textContent = '⏸️';
        } else {
            this.currentVideo.pause();
            btn.textContent = '▶️';
        }
    }

    toggleMute() {
        if (!this.currentVideo) return;
        
        const btn = document.getElementById('modalMute');
        this.currentVideo.muted = !this.currentVideo.muted;
        btn.textContent = this.currentVideo.muted ? '🔇' : '🔊';
    }

    toggleFullscreen() {
        if (!this.currentVideo) return;
        
        if (this.currentVideo.requestFullscreen) {
            this.currentVideo.requestFullscreen();
        } else if (this.currentVideo.webkitRequestFullscreen) {
            this.currentVideo.webkitRequestFullscreen();
        } else if (this.currentVideo.msRequestFullscreen) {
            this.currentVideo.msRequestFullscreen();
        }
    }

    addHoverEffect(container) {
        container.style.transform = 'scale(1.05)';
        container.style.transition = 'transform 0.3s ease';
        
        // Add play icon overlay
        if (!container.querySelector('.play-overlay')) {
            const playOverlay = document.createElement('div');
            playOverlay.className = 'play-overlay';
            playOverlay.innerHTML = '<div class="play-icon">▶️</div>';
            container.appendChild(playOverlay);
        }
    }

    removeHoverEffect(container) {
        container.style.transform = 'scale(1)';
        
        // Remove play icon overlay
        const playOverlay = container.querySelector('.play-overlay');
        if (playOverlay) {
            playOverlay.remove();
        }
    }

    setupKeyboardControls() {
        document.addEventListener('keydown', (e) => {
            if (this.modal.style.display === 'flex') {
                switch(e.key) {
                    case 'Escape':
                        this.closeModal();
                        break;
                    case ' ':
                        e.preventDefault();
                        this.togglePlayPause();
                        break;
                    case 'm':
                    case 'M':
                        this.toggleMute();
                        break;
                    case 'f':
                    case 'F':
                        this.toggleFullscreen();
                        break;
                }
            }
        });
    }
}

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    window.videoModal = new VideoModal();
});

// Export for module use
if (typeof module !== 'undefined' && module.exports) {
    module.exports = VideoModal;
}