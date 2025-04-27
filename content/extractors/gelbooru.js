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
      
      // Extract tags with their categories
      const tagElements = document.querySelectorAll('#tag-list li');
      
      tagElements.forEach(el => {
        const category = this.getTagCategory(el);
        const tagName = el.textContent.trim();
        tags.push(`${category}:${tagName}`);
      });
      
      return tags;
    },
    
    /**
     * Extract the main image URL from the current Gelbooru page
     * @returns {string|null} - Image URL or null if not found
     */
    extractImageUrl() {
      // Get main image
      const mainImage = document.querySelector('#image');
      return mainImage ? mainImage.src : null;
    },

    /**
     * Get gallery images that should be checked for highlighting
     * @returns {NodeList|Array} - NodeList or Array of image elements to process for highlighting
     */
    getGalleryImages() {
      // For Gelbooru, the post thumbnails on index/search pages
      const thumbnailsView = document.querySelector('#thumbnails');
      if (thumbnailsView) {
        return document.querySelectorAll('#thumbnails img');
      }
      
      // For Gelbooru post view, don't process (we're already saving that main image)
      const postView = document.querySelector('#image');
      if (postView) {
        return []; // Empty array
      }
      
      // Default: return empty array
      return [];
    }
  };
})();