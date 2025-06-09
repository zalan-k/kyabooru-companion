/**
 * Simple Generic Image Extractor
 * Just grabs standalone images, no fancy tag extraction
 */
window.TagSaver = window.TagSaver || {};

window.TagSaver.GenericImageExtractor = (function() {
  
  function canHandle(url) {
    // Check if there's a single image in the body
    const images = document.querySelectorAll('img');
    return images.length === 1;
  }
  
  function extractTags() {
    return [];
  }
  
  function extractImageUrl() {
    return [];
  }

  function getGalleryImages() {
    const img = document.querySelector('img');
    return img ? [img] : [];
  }
  
  return {
    canHandle,
    extractTags,
    extractImageUrl,
    getGalleryImages
  };
})();