/**
 * Rule34.paheal content extractor
 */
window.TagSaver = window.TagSaver || {};

window.TagSaver.Rule34PahealExtractor = (function() {
  // We'll use this to detect if we're being called from the save handler
  let lastCallTime = 0;
  const SAVE_THRESHOLD_MS = 50; // Time threshold to detect multiple calls close together
  
  return {
    /**
     * Check if this extractor can handle the given URL
     * @param {string} url - URL to check
     * @returns {boolean} - Whether this extractor can handle the URL
     */
    canHandle(url) {
      return url.includes('rule34.paheal.net') || url.includes('paheal.net');
    },
    
    /**
     * Extract tags from the current Rule34.paheal page
     * @returns {Array<string>} - Array of extracted tags with categories
     */
    extractTags() {
      const tags = [];
      
      try {
        // Post view page tag extraction
        const tagElements = document.querySelectorAll('.tag_list .tag_name_cell a.tag_name');
        if (tagElements && tagElements.length > 0) {
          tagElements.forEach(tagEl => {
            const tagName = tagEl.textContent.trim();
            if (tagName) {
              tags.push(`general:${tagName}`);
            }
          });
          return tags;
        }
        
        // Try to extract from the sidebar tag list if we're on that version of the site
        const sidebarTags = document.querySelectorAll('#Tagsleft .tag_name');
        if (sidebarTags && sidebarTags.length > 0) {
          sidebarTags.forEach(tagEl => {
            const tagName = tagEl.textContent.trim();
            if (tagName) {
              tags.push(`general:${tagName}`);
            }
          });
          return tags;
        }
        
        // Gallery page tag extraction (from selected or hovered thumbnail)
        const selectedThumb = document.querySelector('.shm-thumb.thumb.selected, .shm-thumb.thumb:hover');
        if (selectedThumb) {
          const tagString = selectedThumb.getAttribute('data-tags');
          if (tagString) {
            const tagNames = tagString.split(' ');
            tagNames.forEach(tagName => {
              if (tagName.trim()) {
                tags.push(`general:${tagName}`);
              }
            });
          }
        }
      } catch (error) {
        console.error('Error extracting Rule34.paheal tags:', error);
      }
      
      return tags;
    },
    
    /**
     * Extract the main image URL from the current Rule34.paheal page
     * @returns {string|null} - Image URL or null if not found
     */
    extractImageUrl() {
      try {
        let imageUrl = null;
        
        // Try to get the main image
        const mainImage = document.querySelector('#main_image, .shm-main-image');
        if (mainImage && mainImage.src) {
          imageUrl = mainImage.src;
        } else {
          // Try file-only link which is common in paheal
          const fileOnlyLink = document.querySelector('a[href*="r34i.paheal-cdn.net"]');
          if (fileOnlyLink && fileOnlyLink.href) {
            imageUrl = fileOnlyLink.href;
          } else {
            // If no main image, get the original link
            const originalLink = document.querySelector('a[style*="font-weight: bold"]');
            if (originalLink && originalLink.href) {
              imageUrl = originalLink.href;
            }
          }
        }
        
        const now = Date.now();
        
        // Check if we're likely being called from the save handler
        // This works because extractTags and extractImageUrl are called in quick succession
        // during the save process, but not during the preview
        let isSaveContext = false;
        
        if (now - lastCallTime < SAVE_THRESHOLD_MS) {
          // Second call within threshold - likely save context
          isSaveContext = true;
        }
        
        // Update last call time for future reference
        lastCallTime = now;
        
        // Only add extension in what appears to be a save context
        if (isSaveContext && imageUrl && !(/\.(jpg|jpeg|png|gif|webm|mp4)$/i.test(imageUrl))) {
          // Try to get extension from data-mime
          let extension = 'jpg'; // Default
          const mimeImage = document.querySelector('#main_image[data-mime], .shm-main-image[data-mime]');
          if (mimeImage && mimeImage.getAttribute('data-mime')) {
            const mime = mimeImage.getAttribute('data-mime');
            if (mime.includes('png')) extension = 'png';
            else if (mime.includes('gif')) extension = 'gif';
            else if (mime.includes('webm')) extension = 'webm';
            else if (mime.includes('mp4')) extension = 'mp4';
          }
          
          imageUrl = imageUrl + '.' + extension;
        }
        
        return imageUrl;
      } catch (error) {
        console.error('Error extracting Rule34.paheal image URL:', error);
        return null;
      }
    },

    /**
     * Get gallery images that should be checked for highlighting
     * @returns {NodeList|Array} - NodeList or Array of image elements to process for highlighting
     */
    getGalleryImages() {
      try {
        // Check for thumbnails on gallery pages
        const thumbnails = document.querySelectorAll('.shm-thumb.thumb img');
        if (thumbnails && thumbnails.length > 0) {
          return thumbnails;
        }
        
        // If no thumbnails found, check if we're on a post view page
        const postView = document.querySelector('.shm-main-image');
        if (postView) {
          return [postView];
        }
        
        // Default: return empty array
        return [];
      } catch (error) {
        console.error('Error getting Rule34.paheal gallery images:', error);
        return [];
      }
    }
  };
})();