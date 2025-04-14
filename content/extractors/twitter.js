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
      const tweetImage = document.querySelector('article img[src*="https"]');
      return tweetImage ? tweetImage.src : null;
    }
  };
})();