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
  let isEnabled = false;
  
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
   * Check if we're on a supported site and get the appropriate images to process
   * @returns {Array} Array of image elements to process
   */
  function getImagesToProcess() {
    // Check if we're on a supported site
    const currentUrl = window.location.href;
    const Extractors = window.TagSaver.Extractors;
    
    if (!Extractors || !Extractors.isSupportedSite(currentUrl)) {
      console.log("Not on a supported site, skipping highlight processing");
      return [];
    }
    
    // Get gallery images from the appropriate extractor
    const galleryImages = Extractors.getGalleryImagesToHighlight(currentUrl);
    
    if (!galleryImages || galleryImages.length === 0) {
      console.log("No gallery images found by the extractor");
      return [];
    }
    
    // Convert to array if NodeList
    const imagesArray = Array.from(galleryImages);
    
    // Filter out already processed images
    const filteredImages = imagesArray.filter(img => {
      // Skip already processed images
      if (highlightedImages.has(img)) return false;
      
      // Skip tiny images (likely icons)
      if (img.width < 60 || img.height < 60) return false;
      
      // Skip images without valid src
      if (!img.src || img.src.startsWith('data:')) return false;
      
      return true;
    });
    
    console.log(`Found ${filteredImages.length} gallery images to process`);
    return filteredImages;
  }
  
  /**
   * Process site-specific gallery images to check for saved duplicates
   */
  async function processGalleryImages() {
    if (isProcessing || !isEnabled) return;
    isProcessing = true;
    
    try {
      console.log("Processing gallery images for highlighting");
      
      // Get relevant images from the site-specific extractor
      const images = getImagesToProcess();
      
      // Process in batches of 5 to avoid UI freezing
      const batchSize = 5;
      for (let i = 0; i < images.length; i += batchSize) {
        const batch = images.slice(i, i + batchSize);
        
        // Process batch
        await Promise.all(batch.map(async (img) => {
          try {
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
            try {
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
            } catch (hashError) {
              console.error(`Error computing hash for image: ${img.src}`, hashError);
              // Still mark as processed to avoid retrying repeatedly
              highlightedImages.add(img);
            }
          } catch (error) {
            console.error(`Error processing image: ${img.src}`, error);
            // Mark as processed to avoid infinite retries
            highlightedImages.add(img);
          }
        }));
        
        // Short delay between batches to let UI breathe
        await new Promise(resolve => setTimeout(resolve, 50));
      }
    } catch (error) {
      console.error("Error in processGalleryImages:", error);
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
      // Make sure hash is defined and valid
      if (!hash) {
        console.error("Attempted to check undefined hash");
        return false;
      }
      
      console.log(`Checking hash against database: ${hash}`);
      const response = await browser.runtime.sendMessage({
        action: "check-image-hash",
        hash: hash
      });
      
      // Log the response for debugging
      console.log(`Database response for hash ${hash}:`, response);
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
    console.log(`Highlighting image: ${img.src.substring(0, 50)}...`);
    img.classList.add('ts-saved-image-highlight');
  }
  
  /**
   * Start monitoring for images to highlight
   */
  function startMonitoring() {
    // Check if we're on a supported site
    const Extractors = window.TagSaver.Extractors;
    const currentUrl = window.location.href;
    
    if (!Extractors || !Extractors.isSupportedSite(currentUrl)) {
      console.log("Not on a supported site, highlight manager not started");
      return;
    }
    
    console.log("Starting image monitoring for duplicates on supported site");
    isEnabled = true;
    initHighlightManager();
    
    // Process gallery images immediately
    setTimeout(processGalleryImages, 500);
    
    // Set up scroll listener (throttled)
    let scrollTimeout;
    const scrollHandler = () => {
      if (scrollTimeout) clearTimeout(scrollTimeout);
      scrollTimeout = setTimeout(processGalleryImages, 200);
    };
    
    window.addEventListener('scroll', scrollHandler);
    
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
        
        if (hasNewImages && isEnabled) {
          setTimeout(processGalleryImages, 200);
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
    console.log("Stopping image monitoring");
    isEnabled = false;
    
    if (observerInstance) {
      observerInstance.disconnect();
      observerInstance = null;
    }
    
    // Clean up event listeners
    window.removeEventListener('scroll', processGalleryImages);
    
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
    processGalleryImages
  };
})();