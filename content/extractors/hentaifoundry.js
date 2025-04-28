/**
 * HentaiFoundry content extractor
 */
window.TagSaver = window.TagSaver || {};

window.TagSaver.HentaiFoundryExtractor = (function() {
  // Helper function to create and return proxy image elements for background images
  function createProxyImageForThumb(thumbElement) {
    // Get the background image URL
    const style = thumbElement.getAttribute('style');
    if (!style) return null;
    
    const match = style.match(/background-image: url\(([^)]+)\)/);
    if (!match || !match[1]) return null;
    
    // Extract the URL, removing any quotes
    const imageUrl = match[1].replace(/['"]/g, '');
    
    // Create a real img element that the HighlightManager can work with
    const imgProxy = document.createElement('img');
    imgProxy.src = imageUrl;
    
    // Set reasonable dimensions to pass the size check
    imgProxy.width = 100;
    imgProxy.height = 100;
    
    // Store a reference to the original thumb element
    imgProxy._thumbElement = thumbElement;
    
    // Override the classList to affect the original thumb element
    const originalAddMethod = imgProxy.classList.add.bind(imgProxy.classList);
    imgProxy.classList.add = function(className) {
      // Add to both the proxy and the original thumbnail
      originalAddMethod(className);
      
      if (className === 'ts-saved-image-highlight') {
        // Add highlight class to the actual thumbnail element
        thumbElement.classList.add(className);
      }
    };
    
    return imgProxy;
  }
  
  return {
    /**
     * Check if this extractor can handle the given URL
     * @param {string} url - URL to check
     * @returns {boolean} - Whether this extractor can handle the URL
     */
    canHandle(url) {
      return url.includes('hentai-foundry.com');
    },
    
    /**
     * Extract tags from the current HentaiFoundry page
     * @returns {Array<string>} - Array of extracted tags with categories
     */
    extractTags() {
      const tags = [];
      
      // Find all tag elements in the tag container
      const tagElements = document.querySelectorAll('.tagsContainer .tag a.tagLink');
      
      tagElements.forEach(tagElement => {
        if (tagElement) {
          // Get the tag name and format it as general:tag
          const tagName = tagElement.textContent.trim();
          tags.push(`general:${tagName}`);
        }
      });
      
      return tags;
    },
    
    /**
     * Extract the main image URL from the current HentaiFoundry page
     * @returns {string|null} - Image URL or null if not found
     */
    extractImageUrl() {
      // First try to get the main image in single image view
      const mainImage = document.querySelector('img.center[onclick]');
      
      if (mainImage) {
        // The actual image URL is in the onclick attribute
        // It typically looks like: this.src='//pictures.hentai-foundry.com/n/Nyuunzi/1150300/Nyuunzi-1150300-Livia_Veliya_and_Nina.jpg'
        const onclickAttr = mainImage.getAttribute('onclick');
        if (onclickAttr) {
          const match = onclickAttr.match(/this\.src='([^']+)'/);
          if (match && match[1]) {
            const imageUrl = match[1].startsWith('//') ? 'https:' + match[1] : match[1];
            return imageUrl;
          }
        }
        
        // If we couldn't extract from onclick, use the current src as fallback
        return mainImage.src;
      }
      
      return null;
    },

    /**
     * Get gallery images that should be checked for highlighting
     * @returns {NodeList|Array} - NodeList or Array of image elements to process for highlighting
     */
    getGalleryImages() {
      // For single image view, use the main image
      const singleImage = document.querySelector('img.center[onclick]');
      if (singleImage) {
        return [singleImage];
      }
      
      // For gallery view - find all thumbnail spans with background images
      const thumbElements = document.querySelectorAll('.thumb');
      if (thumbElements && thumbElements.length > 0) {
        console.log(`Found ${thumbElements.length} HentaiFoundry thumbnails`);
        
        // Create proxy img elements for each thumb
        const proxyImages = [];
        
        thumbElements.forEach(thumbElement => {
          const proxyImg = createProxyImageForThumb(thumbElement);
          if (proxyImg) {
            proxyImages.push(proxyImg);
          }
        });
        
        console.log(`Created ${proxyImages.length} proxy images for HentaiFoundry thumbnails`);
        return proxyImages;
      }
      
      return [];
    }
  };
})();