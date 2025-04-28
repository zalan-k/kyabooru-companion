/**
 * Pixiv content extractor
 */
window.TagSaver = window.TagSaver || {};

window.TagSaver.PixivExtractor = (function() {
  // Helper function to ensure full-size images for pixiv
  function getFullSizeImageUrl(url) {
    if (!url) return null;
    
    // Check if this is already an original-size image
    if (url.includes('img-original')) {
      return url;
    }
    
    // For master images, try to convert to original
    if (url.includes('img-master')) {
      // Replace img-master with img-original and _master1200 with appropriate extension
      let originalUrl = url.replace('img-master', 'img-original')
                .replace(/_master1200|_square1200|_custom1200/g, '');
      
      // Handle file extension - pixiv originals are usually jpg or png
      if (originalUrl.match(/\.(jpg|jpeg)(\?|$)/i)) {
        originalUrl = originalUrl.replace(/\.(jpg|jpeg)(\?|$)/i, '_p0.jpg$2');
      } else if (originalUrl.match(/\.png(\?|$)/i)) {
        originalUrl = originalUrl.replace(/\.png(\?|$)/i, '_p0.png$2');
      } else {
        // Default to jpg if we can't determine
        originalUrl = originalUrl.replace(/\.[^.]+$/, '_p0.jpg');
      }
      
      return originalUrl;
    }
    
    return url;
  }
  
  // Helper function to find the original image URL from an img element
  function findOriginalImage(imgElement) {
    // First check if there's a parent anchor with the original URL
    const parentAnchor = imgElement.closest('a[href*="img-original"]');
    if (parentAnchor) {
      return parentAnchor.href;
    }
    
    // For expand links, find the href from parent anchor
    const expandAnchor = imgElement.closest('a.gtm-expand-full-size-illust');
    if (expandAnchor && expandAnchor.href) {
      return expandAnchor.href;
    }
    
    // Try to find the illustration ID for direct linking
    let artworkId = null;
    
    // Try to get it from the URL
    const urlMatch = window.location.href.match(/artworks\/(\d+)/);
    if (urlMatch && urlMatch[1]) {
      artworkId = urlMatch[1];
    } else {
      // Try to find it from meta tags
      const metaContent = document.querySelector('meta[name="preload-data"]');
      if (metaContent && metaContent.content) {
        try {
          const preloadData = JSON.parse(metaContent.content);
          const firstIllustId = Object.keys(preloadData.illust)[0];
          if (firstIllustId) {
            artworkId = firstIllustId;
          }
        } catch (e) {
          console.error("Failed to extract artwork ID from meta", e);
        }
      }
    }
    
    // If we have an artwork ID, we can use our best guess at the URL structure
    if (artworkId) {
      // Try to extract date and filename components from existing URLs
      const imgSrc = imgElement.src;
      if (imgSrc && imgSrc.includes('pximg.net')) {
        // Extract the date path from the URL if possible
        const dateMatch = imgSrc.match(/(20\d\d\/\d\d\/\d\d\/\d\d\/\d\d\/\d\d)/);
        if (dateMatch && dateMatch[1]) {
          const datePath = dateMatch[1];
          return `https://i.pximg.net/img-original/img/${datePath}/${artworkId}_p0.jpg`;
        }
      }
    }
    
    // Otherwise try to convert from the image src
    return getFullSizeImageUrl(imgElement.src);
  }
  
  return {
    /**
     * Check if this extractor can handle the given URL
     * @param {string} url - URL to check
     * @returns {boolean} - Whether this extractor can handle the URL
     */
    canHandle(url) {
      return url.includes('pixiv.net');
    },
    
    /**
     * Extract tags from the current Pixiv page
     * @returns {Array<string>} - Array of extracted tags with categories
     */
    extractTags() {
      const tags = [];
      
      // Find tag elements - there are various possible layouts in Pixiv
      // Current layout as of 2024
      const tagElementsNew = document.querySelectorAll('ul.sc-2e3035f1-0 li a.gtm-new-work-tag-event-click');
      // Older layout
      const tagElementsOld = document.querySelectorAll('.tags-container .tag a');
      // Alternative layout
      const tagElementsAlt = document.querySelectorAll('a[href*="/tags/"][class*="gtm-"]');
      
      // Find which set of tag elements exists and has content
      let tagElements = tagElementsNew.length > 0 ? tagElementsNew : 
                         tagElementsOld.length > 0 ? tagElementsOld : tagElementsAlt;
      
      // Extract tag names from elements
      tagElements.forEach(tagElement => {
        if (tagElement) {
          const tagName = tagElement.textContent.trim();
          if (tagName && !tagName.includes('+')) { // Filter out "+" buttons
            tags.push(`general:${tagName}`);
          }
        }
      });
      
      return tags;
    },
    
    /**
     * Extract the main image URL from the current Pixiv page
     * @returns {string|null} - Image URL or null if not found
     */
    extractImageUrl() {
      // Try to find the main image in different Pixiv layouts
      
      // First try new layout (as of 2024)
      const mainImageNew = document.querySelector('img.sc-e1dc2ae6-1');
      if (mainImageNew) {
        return findOriginalImage(mainImageNew);
      }
      
      // Try older layout
      const mainImageOld = document.querySelector('img[src*="pximg.net/img-master"]');
      if (mainImageOld) {
        return findOriginalImage(mainImageOld);
      }
      
      // Try generic large images
      const largeImages = document.querySelectorAll('img[width][height]');
      for (const img of largeImages) {
        // If it's a large image (likely the main content)
        if (img.width > 500 && img.height > 500 && img.src.includes('pximg.net')) {
          return findOriginalImage(img);
        }
      }
      
      return null;
    },

    /**
     * Get gallery images that should be checked for highlighting
     * @returns {NodeList|Array} - NodeList or Array of image elements to process for highlighting
     */
    getGalleryImages() {
      // First check if we're in single image view
      const singleImage = document.querySelector('img.sc-e1dc2ae6-1, img[src*="pximg.net/img-master"][width][height]');
      if (singleImage && (singleImage.width > 500 || singleImage.height > 500)) {
        return [singleImage];
      }
      
      // For gallery view - find all thumbnail images 
      // Current layout thumbnail container
      const galleryImagesNew = document.querySelectorAll('img.sc-1bcae9a6-2, a[href*="/artworks/"] img[src*="pximg.net"]');
      
      // Older layout thumbnails
      const galleryImagesOld = document.querySelectorAll('.SC-QgYYB img, .image-item img');
      
      // Return whichever set has images
      return galleryImagesNew.length > 0 ? galleryImagesNew : galleryImagesOld;
    },
    
    /**
     * Modify the URL request for Pixiv images to include necessary headers
     * @param {string} url - Original image URL
     * @returns {Object} - Modified URL or request options
     */
    prepareImageDownload(url) {
      return {
        originalUrl: url,
        // Signal that this URL needs special handling
        needsSpecialHandling: true,
        // For Pixiv, we need to include the Referer header
        headers: {
          'Referer': 'https://www.pixiv.net/'
        }
      };
    }
  };
})();