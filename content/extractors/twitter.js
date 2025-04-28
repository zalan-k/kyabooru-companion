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
      if (!tweetImage) return null;
      
      const formattedUrl = this.formatTwitterMediaUrl(tweetImage.src);
      console.log("[DEBUG] Twitter image URL extracted:", formattedUrl);
      return formattedUrl;
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
      
      // Format each image URL before processing
      mediaElements.forEach(element => {
        if (element.tagName === 'IMG') {
          const originalSrc = element.src;
          element.src = this.formatTwitterMediaUrl(originalSrc);
          console.log("[DEBUG] Gallery image formatted:", originalSrc, "→", element.src);
        }
      });
      
      return mediaElements;
    },

    /**
     * Format Twitter media URL to include proper extension
     * @param {string} originalUrl - Original URL from Twitter
     * @returns {string} - Properly formatted URL with extension
     */
    formatTwitterMediaUrl(originalUrl) {
      try {
        const url = new URL(originalUrl);
        const pathParts = url.pathname.split('/');
        let mediaId = pathParts[pathParts.length - 1]; // e.g., "GpjzPS-bEAAJ9LW" or "GpjzPS-bEAAJ9LW.jpg"
        
        // First, clean up the mediaId by removing any query parameters
        mediaId = mediaId.split('?')[0];
        
        const knownExtensions = ['jpg', 'png', 'webp', 'gif'];
        
        // Check if mediaId already ends with a known extension
        const hasExtension = knownExtensions.some(ext => mediaId.toLowerCase().endsWith(`.${ext}`));
        
        // Get format from URL parameters or default to jpg
        const format = url.searchParams.get('format') || 'jpg';
        
        let finalUrl;
        if (hasExtension) {
          finalUrl = `https://${url.host}/media/${mediaId}`;
        } else {
          finalUrl = `https://${url.host}/media/${mediaId}.${format}`;
        }
        
        return finalUrl;
      } catch (error) {
        console.error("Error formatting Twitter URL:", error, originalUrl);
        return originalUrl; // Return original on error
      }
    }
  };
})();