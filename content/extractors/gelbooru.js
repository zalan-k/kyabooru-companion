/**
 * Gelbooru content extractor
 */
window.TagSaver = window.TagSaver || {};

window.TagSaver.GelbooruExtractor = (function() {
  return {
    /**
     * Check if this extractor can handle the given URL
     * @param {string} url - URL to check
     * @returns {boolean} - Whether this extractor can handle the URL
     */
    canHandle(url) {
      return url.includes('gelbooru.com');
    },
    
    /**
     * Get the tag category based on Gelbooru class
     * @param {Element} element - DOM element containing the tag
     * @returns {string} - Category name
     */
    getTagCategory(element) {
      if (element.classList.contains('tag-type-artist')) return 'artist';
      if (element.classList.contains('tag-type-copyright')) return 'copyright';
      if (element.classList.contains('tag-type-character')) return 'character';
      if (element.classList.contains('tag-type-general')) return 'general';
      if (element.classList.contains('tag-type-metadata')) return 'meta';
      return 'general'; // Default category
    },
    
    /**
     * Extract tags from the current Gelbooru page
     * @returns {Array<string>} - Array of extracted tags with categories
     */
    extractTags() {
      const tags = [];
      
      // Select only tag elements (not headers) by their specific classes
      const tagElements = document.querySelectorAll(
        '#tag-list li.tag-type-artist, ' +
        '#tag-list li.tag-type-character, ' +
        '#tag-list li.tag-type-copyright, ' +
        '#tag-list li.tag-type-general, ' +
        '#tag-list li.tag-type-metadata'
      );
      
      tagElements.forEach(el => {
        // Get the category
        const category = this.getTagCategory(el);
        
        // Get just the tag name (the second link in the element)
        const tagLink = el.querySelectorAll('a')[1]; // Skip the "?" wiki link
        
        if (tagLink) {
          // Extract just the text of the tag link
          const tagName = tagLink.textContent.trim();
          
          // Format as category:tag
          tags.push(`${category}:${tagName}`);
          
          console.log(`Extracted Gelbooru tag: ${category}:${tagName}`);
        }
      });
      
      return tags;
    },
    
    /**
     * Extract the main image URL from the current Gelbooru page
     * @returns {string|null} - Image URL or null if not found
     */
    extractImageUrl() {
      // Try to get the full-size image first
      const originalLink = document.querySelector('li a[href^="https://img"][rel="noopener"]');
      if (originalLink) {
        return originalLink.href;
      }
      
      // If no direct link, get the main image
      const mainImage = document.querySelector('#image');
      return mainImage ? mainImage.src : null;
    },

    /**
     * Get gallery images that should be checked for highlighting
     * @returns {NodeList|Array} - NodeList or Array of image elements to process for highlighting
     */
    getGalleryImages() {
      // First check if we're on a search results page
      const thumbnails = document.querySelectorAll('article.thumbnail-preview img');
      if (thumbnails && thumbnails.length > 0) {
        console.log(`Found ${thumbnails.length} thumbnail previews`);
        return thumbnails;
      }
      
      // For Gelbooru post view, don't process (we're already saving that main image)
      const postView = document.querySelector('#image');
      if (postView) {
        return [postView];
      }
      
      // Default: return empty array
      console.log('No gallery images found');
      return [];
    }
  };
})();