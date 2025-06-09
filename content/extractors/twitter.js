// Initialize global namespace
window.TagSaver = window.TagSaver || {};

/**
 * Twitter/X content extractor
 * Enhanced to handle timeline, post view, and image view layers
 */
window.TagSaver.TwitterExtractor = (function() {
  /**
   * Detect which Twitter view we're currently in
   * @returns {string} - 'timeline', 'post', or 'image'
   */
  function detectTwitterView() {
    const url = window.location.href;
    
    // Check if we're in image view (looking at a specific image in lightbox)
    if (document.querySelector('.css-175oi2r[role="group"][aria-roledescription="carousel"]') || 
        document.querySelector('div[data-testid="swipe-to-dismiss"]')) {
      return 'image';
    }
    
    // Check if we're in post view
    if (url.includes('/status/') && document.querySelector('article[data-testid="tweet"]')) {
      return 'post';
    }
    
    // Default to timeline view
    return 'timeline';
  }

  /**
   * Get the appropriate image element based on current view
   * @returns {HTMLElement|null} - The image element or null
   */
  function getViewImage() {
    const viewType = detectTwitterView();
    
    switch(viewType) {
      case 'image':
        // For image view, find the visible carousel image
        const carouselImgs = document.querySelectorAll('div[role="group"][aria-roledescription="carousel"] img, div[data-testid="swipe-to-dismiss"] img');
        for (const img of carouselImgs) {
          // Check if image is in viewport and fully loaded
          const rect = img.getBoundingClientRect();
          if (rect.width > 100 && rect.height > 100 && 
              rect.top < window.innerHeight && rect.bottom > 0 &&
              rect.left < window.innerWidth && rect.right > 0) {
            return img;
          }
        }
        break;
        
      case 'post':
        // For post view, find main image in the tweet
        const tweetImages = document.querySelectorAll('div[data-testid="tweetPhoto"] img, a[href*="/photo/"] img');
        if (tweetImages.length > 0) {
          return tweetImages[0]; // Return first image
        }
        break;
        
      case 'timeline':
        // For timeline, try to find images in the visible area
        const visibleTweets = Array.from(document.querySelectorAll('article[data-testid="tweet"]'))
          .filter(el => {
            const rect = el.getBoundingClientRect();
            return rect.top < window.innerHeight && rect.bottom > 0;
          });
          
        // Find first tweet with an image
        for (const tweet of visibleTweets) {
          const img = tweet.querySelector('div[data-testid="tweetPhoto"] img, a[href*="/photo/"] img');
          if (img) return img;
        }
        break;
    }
    
    return null;
  }
  
  /**
   * Format Twitter media URL to include proper extension and best quality
   * @param {string} originalUrl - Original URL from Twitter
   * @returns {string} - Properly formatted URL with extension
   */
  function formatTwitterMediaUrl(originalUrl) {
    if (!originalUrl) return null;
    
    try {
      // If URL already has name=orig parameter, just return it
      if (originalUrl.includes('name=orig')) {
        return originalUrl;
      }
      
      // Extract the media format and ID from the URL
      let formattedUrl = originalUrl;
      
      // Convert URLs with format= parameter
      if (originalUrl.includes('format=')) {
        const url = new URL(originalUrl);
        const format = url.searchParams.get('format') || 'jpg';
        
        // Extract the media ID
        const pathParts = url.pathname.split('/');
        const mediaId = pathParts[pathParts.length - 1].split('.')[0];
        
        // Build the high-resolution URL
        formattedUrl = `https://${url.hostname}/media/${mediaId}.${format}?name=orig`;
      } 
      // Handle direct image URLs
      else if (originalUrl.includes('/media/')) {
        const url = new URL(originalUrl);
        
        // Extract existing parameters to preserve
        const params = new URLSearchParams();
        params.set('name', 'orig');  // Always set to original quality
        
        // Extract path components
        const pathParts = url.pathname.split('/');
        const lastPart = pathParts[pathParts.length - 1];
        
        // Check if it has a valid extension
        if (lastPart.includes('.')) {
          // Keep the existing extension
          formattedUrl = `https://${url.hostname}${url.pathname}?name=orig`;
        } else {
          // Add .jpg extension as default
          formattedUrl = `https://${url.hostname}${url.pathname}.jpg?name=orig`;
        }
      }
      
      console.log(`Formatted Twitter URL: ${originalUrl} → ${formattedUrl}`);
      return formattedUrl;
    } catch (error) {
      console.error("Error formatting Twitter URL:", error, originalUrl);
      return originalUrl;  // Return original on error
    }
  }
  
  /**
   * Find hashtags in a tweet element
   * @param {HTMLElement} tweetElement - The tweet element
   * @returns {Array<string>} - Extracted hashtags with 'general:' prefix
   */
  function extractHashtagsFromTweet(tweetElement) {
    if (!tweetElement) return [];
    
    // Try to find spans with hashtag content
    const hashtagElements = tweetElement.querySelectorAll('a[href*="/hashtag/"]');
    let hashtags = [];
    
    // Extract hashtags from elements
    if (hashtagElements.length > 0) {
      hashtagElements.forEach(el => {
        const tag = el.textContent.trim();
        if (tag.startsWith('#')) {
          hashtags.push(`meta:${tag.substring(1)}`);
        } else {
          hashtags.push(`meta:${tag}`);
        }
      });
    }
    
    // Fallback: Try to extract from text if no hashtag elements found
    if (hashtags.length === 0) {
      const tweetText = tweetElement.textContent || '';
      const extractedTags = tweetText.match(/#\w+/g) || [];
      
      // Remove # symbol and add 'meta:' prefix
      hashtags = extractedTags.map(tag => `meta:${tag.substring(1)}`);
    }
    
    return hashtags;
  }
  
  /**
   * Get the main tweet element based on current view
   * @returns {HTMLElement|null} - The tweet element or null
   */
  function getMainTweetElement() {
    const viewType = detectTwitterView();
    
    switch(viewType) {
      case 'image':
      case 'post':
        // For image view and post view, try to find the main tweet
        return document.querySelector('article[data-testid="tweet"]');
        
      case 'timeline':
        // For timeline, find the tweet in focus (center of viewport)
        const viewportCenter = window.innerHeight / 2;
        
        // Get all tweets and find the one closest to viewport center
        const tweets = Array.from(document.querySelectorAll('article[data-testid="tweet"]'));
        let closestTweet = null;
        let closestDistance = Infinity;
        
        tweets.forEach(tweet => {
          const rect = tweet.getBoundingClientRect();
          const tweetCenter = rect.top + rect.height / 2;
          const distance = Math.abs(tweetCenter - viewportCenter);
          
          if (distance < closestDistance) {
            closestDistance = distance;
            closestTweet = tweet;
          }
        });
        
        return closestTweet;
    }
    
    return null;
  }

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
      // Get the main tweet element
      const tweetElement = getMainTweetElement();
      
      // Extract hashtags from the tweet
      const hashtags = extractHashtagsFromTweet(tweetElement);
      
      console.log(`[Twitter] Extracted ${hashtags.length} hashtags:`, hashtags);
      return hashtags;
    },
    
    /**
     * Extract the main image URL from the current Twitter/X page
     * @returns {string|null} - Image URL or null if not found
     */
    extractImageUrl: function() {
      // Get the appropriate image element
      const imageElement = getViewImage();
      
      if (imageElement && imageElement.src) {
        // Format the URL to get original quality
        const formattedUrl = formatTwitterMediaUrl(imageElement.src);
        console.log(`[Twitter] Extracted image URL:`, formattedUrl);
        return formattedUrl;
      }
      
      console.log('[Twitter] No image found to extract');
      return null;
    },

    /**
     * Get gallery images that should be checked for highlighting
     * @returns {NodeList|Array} - NodeList or Array of image elements to process for highlighting
     */
    getGalleryImagesToHighlight() {
      // For Twitter/X, look for images in the timeline
      const mediaElements = document.querySelectorAll(`
        article[data-testid="tweet"] img[src*="/media/"], 
        div[data-testid="tweetPhoto"] img,
        a[href*="/photo/"] img
      `);
      
      // Format each image URL before processing
      mediaElements.forEach(element => {
        if (element.tagName === 'IMG') {
          const originalSrc = element.src;
          element._originalSrc = originalSrc; // Store original URL
          element.src = formatTwitterMediaUrl(originalSrc);
        }
      });
      
      return mediaElements;
    },
    
    // Expose these functions for potential use by other components
    detectTwitterView,
    formatTwitterMediaUrl
  };
})();