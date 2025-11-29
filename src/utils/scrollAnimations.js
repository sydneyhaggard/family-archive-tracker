/**
 * Scroll Animation System using Intersection Observer API
 * 
 * Usage:
 * Add 'data-scroll-animation' attribute to any element you want to animate on scroll
 * 
 * Available attributes:
 * - data-scroll-animation="fade-up" (default) | "fade-down" | "fade-left" | "fade-right" | "fade" | "scale" | "slide-up" | "slide-down" | "slide-left" | "slide-right"
 * - data-scroll-delay="0" (in milliseconds, default 0)
 * - data-scroll-duration="600" (in milliseconds, default 600)
 * - data-scroll-once="true" (animate only once, default true)
 * - data-scroll-threshold="0.1" (0-1, how much of element must be visible, default 0.1)
 * - data-scroll-progress="50" (animate when page is scrolled X%, 0-100)
 * 
 * Example:
 * <div data-scroll-animation="fade-up" data-scroll-delay="200" data-scroll-duration="800">
 *   Content here
 * </div>
 * 
 * <div data-scroll-animation="fade-up" data-scroll-progress="75">
 *   Animates when page is 75% scrolled
 * </div>
 */

class ScrollAnimationObserver {
  constructor(options = {}) {
    this.options = {
      threshold: 0.1,
      rootMargin: '0px',
      ...options
    };
    
    this.observer = null;
    this.animatedElements = new Set();
    this.progressElements = new Map(); // Track elements that use scroll progress
    this.currentScrollProgress = 0;
    this.init();
  }

  init() {
    // Create intersection observer
    this.observer = new IntersectionObserver(
      this.handleIntersection.bind(this),
      {
        threshold: this.options.threshold,
        rootMargin: this.options.rootMargin
      }
    );

    // Observe all elements with data-scroll-animation attribute
    this.observeElements();
    
    // Re-observe on DOM changes (for dynamically added content)
    this.observeDOMChanges();
    
    // Set up scroll progress tracking
    this.initScrollProgressTracking();
  }

  observeElements() {
    const elements = document.querySelectorAll('[data-scroll-animation]');
    
    elements.forEach(element => {
      // Check if element uses scroll progress
      const scrollProgress = element.dataset.scrollProgress;
      
      if (scrollProgress !== undefined) {
        // This element animates based on scroll progress
        const progressPercent = parseFloat(scrollProgress);
        this.progressElements.set(element, {
          progressPercent,
          animated: false
        });
        element.classList.add('scroll-animate-hidden');
      } else {
        // Normal intersection observer animation
        element.classList.add('scroll-animate-hidden');
        
        // Get threshold for this specific element if specified
        const elementThreshold = parseFloat(element.dataset.scrollThreshold) || this.options.threshold;
        
        // If element has custom threshold, create new observer for it
        if (elementThreshold !== this.options.threshold) {
          const customObserver = new IntersectionObserver(
            this.handleIntersection.bind(this),
            {
              threshold: elementThreshold,
              rootMargin: this.options.rootMargin
            }
          );
          customObserver.observe(element);
        } else {
          this.observer.observe(element);
        }
      }
    });
  }

  initScrollProgressTracking() {
    let ticking = false;
    
    const updateScrollProgress = () => {
      const windowHeight = window.innerHeight;
      const documentHeight = document.documentElement.scrollHeight;
      const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
      const scrollableHeight = documentHeight - windowHeight;
      
      // Calculate scroll progress as percentage
      this.currentScrollProgress = scrollableHeight > 0 
        ? (scrollTop / scrollableHeight) * 100 
        : 0;
      
      // Check all progress-based elements
      this.progressElements.forEach((data, element) => {
        if (!data.animated && this.currentScrollProgress >= data.progressPercent) {
          this.animateProgressElement(element);
        } else if (data.animated && this.currentScrollProgress < data.progressPercent) {
          // Reset if scrolling back up and animate-once is false
          const animateOnce = element.dataset.scrollOnce !== 'false';
          if (!animateOnce) {
            this.resetProgressElement(element);
          }
        }
      });
      
      ticking = false;
    };
    
    const onScroll = () => {
      if (!ticking) {
        window.requestAnimationFrame(updateScrollProgress);
        ticking = true;
      }
    };
    
    window.addEventListener('scroll', onScroll, { passive: true });
    
    // Initial check
    updateScrollProgress();
  }

  animateProgressElement(element) {
    const animationType = element.dataset.scrollAnimation || 'fade-up';
    const delay = parseInt(element.dataset.scrollDelay) || 0;
    const duration = parseInt(element.dataset.scrollDuration) || 600;
    
    setTimeout(() => {
      this.animateElement(element, animationType, duration);
      const data = this.progressElements.get(element);
      if (data) {
        data.animated = true;
      }
    }, delay);
  }

  resetProgressElement(element) {
    element.classList.remove('scroll-animate-visible');
    element.classList.add('scroll-animate-hidden');
    element.removeAttribute('data-scroll-state');
    const data = this.progressElements.get(element);
    if (data) {
      data.animated = false;
    }
  }

  handleIntersection(entries, observer) {
    entries.forEach(entry => {
      const element = entry.target;
      const animationType = element.dataset.scrollAnimation || 'fade-up';
      const delay = parseInt(element.dataset.scrollDelay) || 0;
      const duration = parseInt(element.dataset.scrollDuration) || 600;
      const animateOnce = element.dataset.scrollOnce !== 'false';

      if (entry.isIntersecting) {
        // Element is visible
        if (!this.animatedElements.has(element)) {
          setTimeout(() => {
            this.animateElement(element, animationType, duration);
            this.animatedElements.add(element);
            
            // Unobserve if animate only once
            if (animateOnce) {
              observer.unobserve(element);
            }
          }, delay);
        }
      } else {
        // Element is not visible
        if (!animateOnce && this.animatedElements.has(element)) {
          // Reset animation if it should repeat
          element.classList.remove('scroll-animate-visible');
          element.classList.add('scroll-animate-hidden');
          this.animatedElements.delete(element);
        }
      }
    });
  }

  animateElement(element, animationType, duration) {
    element.style.transitionDuration = `${duration}ms`;
    element.classList.remove('scroll-animate-hidden');
    element.classList.add('scroll-animate-visible');
    element.setAttribute('data-scroll-state', 'animated');
  }

  observeDOMChanges() {
    // Watch for new elements added to DOM
    const mutationObserver = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        mutation.addedNodes.forEach((node) => {
          if (node.nodeType === 1) { // Element node
            // Check if the node itself has the attribute
            if (node.hasAttribute('data-scroll-animation')) {
              const scrollProgress = node.dataset.scrollProgress;
              node.classList.add('scroll-animate-hidden');
              
              if (scrollProgress !== undefined) {
                const progressPercent = parseFloat(scrollProgress);
                this.progressElements.set(node, {
                  progressPercent,
                  animated: false
                });
              } else {
                this.observer.observe(node);
              }
            }
            // Check children
            const children = node.querySelectorAll?.('[data-scroll-animation]');
            children?.forEach(child => {
              const scrollProgress = child.dataset.scrollProgress;
              child.classList.add('scroll-animate-hidden');
              
              if (scrollProgress !== undefined) {
                const progressPercent = parseFloat(scrollProgress);
                this.progressElements.set(child, {
                  progressPercent,
                  animated: false
                });
              } else {
                this.observer.observe(child);
              }
            });
          }
        });
      });
    });

    mutationObserver.observe(document.body, {
      childList: true,
      subtree: true
    });
  }

  // Public method to manually trigger animation
  trigger(element) {
    if (element && element.hasAttribute('data-scroll-animation')) {
      const animationType = element.dataset.scrollAnimation || 'fade-up';
      const duration = parseInt(element.dataset.scrollDuration) || 600;
      this.animateElement(element, animationType, duration);
      this.animatedElements.add(element);
    }
  }

  // Public method to reset an element
  reset(element) {
    if (element && this.animatedElements.has(element)) {
      element.classList.remove('scroll-animate-visible');
      element.classList.add('scroll-animate-hidden');
      this.animatedElements.delete(element);
      element.removeAttribute('data-scroll-state');
    }
  }

  // Public method to destroy observer
  destroy() {
    if (this.observer) {
      this.observer.disconnect();
    }
    this.animatedElements.clear();
  }
}

// CSS Styles for animations
const scrollAnimationStyles = `
  /* Base hidden state */
  .scroll-animate-hidden {
    opacity: 0;
  }

  /* Base visible state */
  .scroll-animate-visible {
    opacity: 1;
    transition-property: opacity, transform;
    transition-timing-function: cubic-bezier(0.4, 0, 0.2, 1);
  }

  /* Fade animations */
  [data-scroll-animation="fade"].scroll-animate-hidden {
    opacity: 0;
  }

  [data-scroll-animation="fade"].scroll-animate-visible {
    opacity: 1;
  }

  /* Fade Up */
  [data-scroll-animation="fade-up"].scroll-animate-hidden {
    opacity: 0;
    transform: translateY(30px);
  }

  [data-scroll-animation="fade-up"].scroll-animate-visible {
    opacity: 1;
    transform: translateY(0);
  }

  /* Fade Down */
  [data-scroll-animation="fade-down"].scroll-animate-hidden {
    opacity: 0;
    transform: translateY(-30px);
  }

  [data-scroll-animation="fade-down"].scroll-animate-visible {
    opacity: 1;
    transform: translateY(0);
  }

  /* Fade Left */
  [data-scroll-animation="fade-left"].scroll-animate-hidden {
    opacity: 0;
    transform: translateX(30px);
  }

  [data-scroll-animation="fade-left"].scroll-animate-visible {
    opacity: 1;
    transform: translateX(0);
  }

  /* Fade Right */
  [data-scroll-animation="fade-right"].scroll-animate-hidden {
    opacity: 0;
    transform: translateX(-30px);
  }

  [data-scroll-animation="fade-right"].scroll-animate-visible {
    opacity: 1;
    transform: translateX(0);
  }

  /* Scale */
  [data-scroll-animation="scale"].scroll-animate-hidden {
    opacity: 0;
    transform: scale(0.9);
  }

  [data-scroll-animation="scale"].scroll-animate-visible {
    opacity: 1;
    transform: scale(1);
  }

  /* Slide Up */
  [data-scroll-animation="slide-up"].scroll-animate-hidden {
    transform: translateY(60px);
  }

  [data-scroll-animation="slide-up"].scroll-animate-visible {
    transform: translateY(0);
  }

  /* Slide Down */
  [data-scroll-animation="slide-down"].scroll-animate-hidden {
    transform: translateY(-60px);
  }

  [data-scroll-animation="slide-down"].scroll-animate-visible {
    transform: translateY(0);
  }

  /* Slide Left */
  [data-scroll-animation="slide-left"].scroll-animate-hidden {
    transform: translateX(60px);
  }

  [data-scroll-animation="slide-left"].scroll-animate-visible {
    transform: translateX(0);
  }

  /* Slide Right */
  [data-scroll-animation="slide-right"].scroll-animate-hidden {
    transform: translateX(-60px);
  }

  [data-scroll-animation="slide-right"].scroll-animate-visible {
    transform: translateX(0);
  }

  /* Rotate In */
  [data-scroll-animation="rotate-in"].scroll-animate-hidden {
    opacity: 0;
    transform: rotate(-10deg) scale(0.9);
  }

  [data-scroll-animation="rotate-in"].scroll-animate-visible {
    opacity: 1;
    transform: rotate(0) scale(1);
  }

  /* Zoom In */
  [data-scroll-animation="zoom-in"].scroll-animate-hidden {
    opacity: 0;
    transform: scale(0.5);
  }

  [data-scroll-animation="zoom-in"].scroll-animate-visible {
    opacity: 1;
    transform: scale(1);
  }

  /* Zoom Out */
  [data-scroll-animation="zoom-out"].scroll-animate-hidden {
    opacity: 0;
    transform: scale(1.5);
  }

  [data-scroll-animation="zoom-out"].scroll-animate-visible {
    opacity: 1;
    transform: scale(1);
  }

  /* Flip In X */
  [data-scroll-animation="flip-x"].scroll-animate-hidden {
    opacity: 0;
    transform: perspective(1000px) rotateX(90deg);
  }

  [data-scroll-animation="flip-x"].scroll-animate-visible {
    opacity: 1;
    transform: perspective(1000px) rotateX(0);
  }

  /* Flip In Y */
  [data-scroll-animation="flip-y"].scroll-animate-hidden {
    opacity: 0;
    transform: perspective(1000px) rotateY(90deg);
  }

  [data-scroll-animation="flip-y"].scroll-animate-visible {
    opacity: 1;
    transform: perspective(1000px) rotateY(0);
  }
`;

// Inject styles into document
function injectScrollAnimationStyles() {
  if (!document.getElementById('scroll-animation-styles')) {
    const styleSheet = document.createElement('style');
    styleSheet.id = 'scroll-animation-styles';
    styleSheet.textContent = scrollAnimationStyles;
    document.head.appendChild(styleSheet);
  }
}

// Auto-initialize when DOM is ready
let scrollAnimationInstance = null;

function initScrollAnimations(options = {}) {
  // Inject styles
  injectScrollAnimationStyles();
  
  // Create observer instance
  if (!scrollAnimationInstance) {
    scrollAnimationInstance = new ScrollAnimationObserver(options);
  }
  
  return scrollAnimationInstance;
}

// Auto-init if DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initScrollAnimations);
} else {
  initScrollAnimations();
}

// Export for manual initialization or access
export { ScrollAnimationObserver, initScrollAnimations, injectScrollAnimationStyles };
export default initScrollAnimations;
