/**
 * Danbooru content extractor
 */
window.TagSaver = window.TagSaver || {};
window.TagSaver.DanbooruExtractor = (function() {
  return {
    /**
     * Check if this extractor can handle the given URL
     * @param {string} url - URL to check
     * @returns {boolean} - Whether this extractor can handle the URL
     */
    canHandle(url) {
      return url.includes('danbooru.donmai.us');
    },
    
    /**
     * Get the tag category based on Danbooru class
     * @param {Element} container - DOM element containing the tag
     * @returns {string} - Category name
     */
    getTagCategory(container) {
      if (container.classList.contains('tag-type-1')) return 'artist';
      if (container.classList.contains('tag-type-3')) return 'copyright';
      if (container.classList.contains('tag-type-4')) return 'character';
      if (container.classList.contains('tag-type-0')) return 'general';
      if (container.classList.contains('tag-type-5')) return 'meta';
      return 'general'; // Default category
    },
    
    /**
     * Extract tags from the current Danbooru page
     * @returns {Array<string>} - Array of extracted tags with categories
     */
    extractTags() {
      const tags = [];
      
      // Extract tags with their categories from tag-list
      const tagContainers = document.querySelectorAll(
        '#tag-list .tag-type-1, #tag-list .tag-type-3, ' +
        '#tag-list .tag-type-4, #tag-list .tag-type-0, #tag-list .tag-type-5'
      );
      
      tagContainers.forEach(container => {
        // Get category based on class
        const category = this.getTagCategory(container);
        
        // Get the tag name
        const tagElement = container.querySelector('.search-tag');
        if (tagElement) {
          const tagName = tagElement.textContent.trim();
          // Format as category:tag
          tags.push(`${category}:${tagName}`);
        }
      });
      
      return tags;
    },
    
    /**
     * Extract the main image URL from the current Danbooru page
     * @returns {string|null} - Image URL or null if not found
     */
    extractImageUrl() {
      // Get main image
      const mainImage = document.querySelector('#image');
      return mainImage ? mainImage.src : null;
    },

    /**
     * Get gallery images that should be checked for highlighting
     * @returns {NodeList} - NodeList of image elements to process for highlighting
     */
    getGalleryImages() {
      // For Danbooru, get thumbnail images from post-preview elements in gallery view
      const thumbnails = document.querySelectorAll('.post-preview img.post-preview-image');
      if (thumbnails && thumbnails.length > 0) {
        return thumbnails;
      }
      
      // For Danbooru post view, don't process (we're already saving that main image)
      const postView = document.querySelector('#image');
      if (postView) {
        return [postView];
      }

      // Fallback: if no images found, return an empty array
      console.log('No Danbooru gallery images found');
      return [];
    }
  };
})();