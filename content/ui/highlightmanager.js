/**
 * Highlight Manager Component
 * Manages highlighting of already-saved images on pages
 */
window.TagSaver = window.TagSaver || {};
window.TagSaver.UI = window.TagSaver.UI || {};

window.TagSaver.UI.HighlightManager = (function() {
  let styleElement = null;
  let observerInstance = null;
  let hashCache = {}; // Cache hashes to avoid recalculation
  
  // Maintain reference to all highlighted images
  let highlightedImages = new Set();
  
  // Throttle control
  let isProcessing = false;
  
  /**
   * Initialize the highlight manager
   */
  function initHighlightManager() {
    if (!styleElement) {
      const styles = `
        .ts-saved-image-highlight {
          position: relative;
          outline: 3px solid #ff5722 !important;
          outline-offset: -1px;
        }
        
        .ts-saved-image-highlight::after {
          content: "★";
          position: absolute;
          top: 5px;
          right: 5px;
          background: #ff5722;
          color: white;
          width: 20px;
          height: 20px;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 14px;
          z-index: 99999;
        }
      `;
      
      styleElement = window.TagSaver.UI.Styles.injectStyles(styles);
    }
  }
  
  /**
   * Process visible images in viewport to check for saved duplicates
   */
  async function processVisibleImages() {
    if (isProcessing) return;
    isProcessing = true;
    
    try {
      // Get all images that are in the viewport and haven't been processed yet
      const images = Array.from(document.querySelectorAll('img'))
        .filter(img => {
          // Skip already processed images
          if (highlightedImages.has(img)) return false;
          
          // Skip tiny images (likely icons)
          if (img.width < 60 || img.height < 60) return false;
          
          // Check if in viewport
          const rect = img.getBoundingClientRect();
          return (
            rect.top >= 0 &&
            rect.left >= 0 &&
            rect.bottom <= (window.innerHeight || document.documentElement.clientHeight) &&
            rect.right <= (window.innerWidth || document.documentElement.clientWidth)
          );
        });
      
      // Process in batches of 5 to avoid UI freezing
      const batchSize = 5;
      for (let i = 0; i < images.length; i += batchSize) {
        const batch = images.slice(i, i + batchSize);
        
        // Process batch
        await Promise.all(batch.map(async (img) => {
          try {
            // Skip images without src
            if (!img.src) return;
            
            // Check cache first
            if (hashCache[img.src]) {
              const isDuplicate = await checkImageAgainstDatabase(hashCache[img.src]);
              if (isDuplicate) {
                highlightImage(img);
              }
              highlightedImages.add(img);
              return;
            }
            
            // Calculate hash
            const hash = await window.TagSaver.Hash.computeAverageHash(img.src);
            
            // Cache the hash
            hashCache[img.src] = hash;
            
            // Check against database
            const isDuplicate = await checkImageAgainstDatabase(hash);
            if (isDuplicate) {
              highlightImage(img);
            }
            
            // Mark as processed
            highlightedImages.add(img);
          } catch (error) {
            console.error(`Error processing image: ${img.src}`, error);
          }
        }));
        
        // Short delay between batches to let UI breathe
        await new Promise(resolve => setTimeout(resolve, 50));
      }
    } finally {
      isProcessing = false;
    }
  }
  
  /**
   * Check if image hash exists in database
   * @param {string} hash - Image hash to check
   * @returns {Promise<boolean>} - Whether image exists in database
   */
  async function checkImageAgainstDatabase(hash) {
    try {
      const response = await browser.runtime.sendMessage({
        action: "check-image-hash",
        hash: hash
      });
      
      return response && response.exists;
    } catch (error) {
      console.error("Error checking image hash:", error);
      return false;
    }
  }
  
  /**
   * Apply highlight styling to an image
   * @param {HTMLImageElement} img - Image to highlight
   */
  function highlightImage(img) {
    img.classList.add('ts-saved-image-highlight');
  }
  
  /**
   * Start monitoring for images to highlight
   */
  function startMonitoring() {
    initHighlightManager();
    
    // Process visible images immediately
    processVisibleImages();
    
    // Set up scroll listener (throttled)
    let scrollTimeout;
    window.addEventListener('scroll', () => {
      if (scrollTimeout) clearTimeout(scrollTimeout);
      scrollTimeout = setTimeout(processVisibleImages, 200);
    });
    
    // Set up mutation observer to detect new images
    if (!observerInstance) {
      observerInstance = new MutationObserver((mutations) => {
        let hasNewImages = false;
        
        mutations.forEach(mutation => {
          // Check if new nodes were added
          if (mutation.addedNodes.length) {
            // Look for images in added nodes
            mutation.addedNodes.forEach(node => {
              if (node.nodeName === 'IMG') {
                hasNewImages = true;
              } else if (node.querySelectorAll) {
                const images = node.querySelectorAll('img');
                if (images.length > 0) hasNewImages = true;
              }
            });
          }
        });
        
        if (hasNewImages) {
          processVisibleImages();
        }
      });
      
      observerInstance.observe(document.body, {
        childList: true,
        subtree: true
      });
    }
  }
  
  /**
   * Stop monitoring for images
   */
  function stopMonitoring() {
    if (observerInstance) {
      observerInstance.disconnect();
      observerInstance = null;
    }
    
    // Clean up event listeners
    window.removeEventListener('scroll', processVisibleImages);
    
    // Clear highlights
    document.querySelectorAll('.ts-saved-image-highlight').forEach(img => {
      img.classList.remove('ts-saved-image-highlight');
    });
    
    highlightedImages.clear();
    hashCache = {};
  }
  
  // Public API
  return {
    initHighlightManager,
    startMonitoring,
    stopMonitoring,
    processVisibleImages
  };
})();