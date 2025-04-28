// Initialize global namespace
window.TagSaver = window.TagSaver || {};

/**
 * Twitter/X content extractor
 */
window.TagSaver.TwitterExtractor = (function() {
  return {
    /**
     * Check if this extractor can handle the given URL
     * @param {string} url - URL to check
     * @returns {boolean} - Whether this extractor can handle the URL
     */
    canHandle: function(url) {
      return url.includes('twitter.com') || url.includes('x.com');
    },
    
    /**
     * Extract tags from the current Twitter/X page
     * @returns {Array<string>} - Array of extracted tags
     */
    extractTags: function() {
      // Extract hashtags from tweets
      const tweetText = document.querySelector('article')?.textContent || '';
      const hashtags = tweetText.match(/#\w+/g) || [];
      
      // Remove # symbol and add 'general:' prefix to tags
      return hashtags.map(tag => `general:${tag.substring(1)}`);
    },
    
    /**
     * Extract the main image URL from the current Twitter/X page
     * @returns {string|null} - Image URL or null if not found
     */
    extractImageUrl: function() {
      // Get the main image if present
      const tweetImage = document.querySelector('article[data-testid="tweet"] img[src*="/media/"]');
      tweetImage.src = this.formatTwitterMediaUrl(tweetImage.src);
      console.log("[DEBUG] ",tweetImage.src);
      return tweetImage ? tweetImage.src : null;
    },

    /**
     * Get gallery images that should be checked for highlighting
     * @returns {NodeList|Array} - NodeList or Array of image elements to process for highlighting
     */
    getGalleryImages() {
      // For Twitter/X, look for images in the timeline
      const mediaElements = document.querySelectorAll(`
        article[data-testid="tweet"] img[src*="/media/"], 
        article[data-testid="tweet"] video[poster*="twimg.com/"]
      `);
      mediaElements.forEach(element => {
        if (element.tagName === 'IMG') element.src = this.formatTwitterMediaUrl(element.src);
      });
      return mediaElements;
    },

    formatTwitterMediaUrl(originalUrl) {
      const url = new URL(originalUrl);
      const pathParts = url.pathname.split('/');
      let mediaId = pathParts[pathParts.length - 1]; // e.g., "GpjzPS-bEAAJ9LW" or "GpjzPS-bEAAJ9LW.jpg"
    
      const knownExtensions = ['jpg', 'png', 'webp', 'gif'];
    
      // Check if mediaId already ends with a known extension
      const hasExtension = knownExtensions.some(ext => mediaId.toLowerCase().endsWith(`.${ext}`));
    
      let finalUrl;
      if (hasExtension) {
        finalUrl = `https://${url.host}/media/${mediaId}`;
      } else {
        const format = url.searchParams.get('format') || 'jpg'; // default to jpg
        finalUrl = `https://${url.host}/media/${mediaId}.${format}`;
      }
    
      console.log("[DEBUG] ", finalUrl);
      return finalUrl;
    }
  };
})();