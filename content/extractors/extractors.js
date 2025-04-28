// Initialize global namespace
window.TagSaver = window.TagSaver || {};

// Initialize Extractors namespace
window.TagSaver.Extractors = (function() {
  // List of all available extractors
  const extractors = [
    window.TagSaver.TwitterExtractor,
    window.TagSaver.DanbooruExtractor, 
    window.TagSaver.GelbooruExtractor,
    window.TagSaver.Rule34Extractor,
    window.TagSaver.Rule34PahealExtractor,
    window.TagSaver.HentaiFoundryExtractor,
    window.TagSaver.PixivExtractor
  ];

  /**
   * Find the appropriate extractor for the current URL
   * @param {string} url - The URL to check
   * @returns {object|null} - The matching extractor or null if none found
   */
  function getExtractorForUrl(url) {
    for (const extractor of extractors) {
      if (extractor.canHandle(url)) {
        return extractor;
      }
    }
    return null;
  }

  /**
   * Check if the current site is supported for automatic extraction
   * @param {string} url - The URL to check
   * @returns {boolean} - Whether the site is supported
   */
  function isSupportedSite(url) {
    return extractors.some(extractor => extractor.canHandle(url));
  }

  /**
   * Extract content from the current page using the appropriate extractor
   * @param {string} url - The current page URL
   * @returns {object} - The extracted content (tags, imageUrl, pageUrl)
   */
  function extractPageContent(url) {
    const extractor = getExtractorForUrl(url);
    
    if (!extractor) {
      return {
        tags: [],
        imageUrl: null,
        pageUrl: url
      };
    }
    
    const tags = extractor.extractTags();
    const imageUrl = extractor.extractImageUrl();
    
    return {
      tags,
      imageUrl,
      pageUrl: url
    };
  }

  function getGalleryImagesToHighlight(url) {
    const extractor = getExtractorForUrl(url);
    
    if (!extractor || !extractor.getGalleryImages) {
      return []; // Return empty array if no extractor or method not implemented
    }
    
    return extractor.getGalleryImages();
  }

  // Public API
  return {
    getExtractorForUrl,
    isSupportedSite,
    extractPageContent,
    getGalleryImagesToHighlight
  };
})();