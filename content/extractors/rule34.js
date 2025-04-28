/**
 * Rule34.xxx content extractor
 */
window.TagSaver = window.TagSaver || {};

window.TagSaver.Rule34Extractor = (function() {
  return {
    /**
     * Check if this extractor can handle the given URL
     * @param {string} url - URL to check
     * @returns {boolean} - Whether this extractor can handle the URL
     */
    canHandle(url) {
      return url.includes('rule34.xxx');
    },
    
    /**
     * Extract tags from the current Rule34 page
     * @returns {Array<string>} - Array of extracted tags with categories
     */
    extractTags() {
      const tags = [];
      
      try {
        // Select all tag elements directly
        const tagElements = document.querySelectorAll('#tag-sidebar li.tag');
        
        // Process each tag element
        tagElements.forEach(tagEl => {
          // Find the category by looking at previous h6 sibling or using class
          let category = 'general'; // Default category
          
          // Try to get category from class name first
          if (tagEl.classList.contains('tag-type-artist')) {
            category = 'artist';
          } else if (tagEl.classList.contains('tag-type-character')) {
            category = 'character';
          } else if (tagEl.classList.contains('tag-type-copyright')) {
            category = 'copyright';
          } else if (tagEl.classList.contains('tag-type-metadata')) {
            category = 'meta';
          }
          
          // If no specific class found, try to find the previous h6 header
          if (category === 'general' && !tagEl.classList.contains('tag-type-general')) {
            let prevEl = tagEl.previousElementSibling;
            while (prevEl) {
              if (prevEl.tagName === 'H6') {
                const headerText = prevEl.textContent.toLowerCase();
                if (headerText.includes('artist')) {
                  category = 'artist';
                } else if (headerText.includes('character')) {
                  category = 'character';
                } else if (headerText.includes('copyright')) {
                  category = 'copyright';
                } else if (headerText.includes('meta')) {
                  category = 'meta';
                }
                break;
              }
              prevEl = prevEl.previousElementSibling;
            }
          }
          
          // Get the tag name (second link in the tag element)
          const tagLinks = tagEl.querySelectorAll('a');
          if (tagLinks.length >= 2) {
            const tagName = tagLinks[1].textContent.trim();
            if (tagName) {
              tags.push(`${category}:${tagName}`);
              console.log(`Extracted Rule34 tag: ${category}:${tagName}`);
            }
          }
        });
      } catch (error) {
        console.error('Error extracting Rule34 tags:', error);
      }
      
      return tags;
    },
    
    /**
     * Extract the main image URL from the current Rule34 page
     * @returns {string|null} - Image URL or null if not found
     */
    extractImageUrl() {
      try {
        // Try to get the original image link first (bold link in the sidebar)
        const originalLink = document.querySelector('.link-list a[style*="font-weight: bold"]');
        if (originalLink) {
          return originalLink.href;
        }
        
        // If no direct link, get the main image
        const mainImage = document.querySelector('#image');
        return mainImage ? mainImage.src : null;
      } catch (error) {
        console.error('Error extracting Rule34 image URL:', error);
        return null;
      }
    },

    /**
     * Get gallery images that should be checked for highlighting
     * @returns {NodeList|Array} - NodeList or Array of image elements to process for highlighting
     */
    getGalleryImages() {
      try {
        // Check for thumbnails on search/index pages
        const thumbnails = document.querySelectorAll('span.thumb img.preview');
        if (thumbnails && thumbnails.length > 0) {
          console.log(`Found ${thumbnails.length} Rule34 thumbnails`);
          return thumbnails;
        }
        
        // For post view page, don't process (we're already saving that main image)
        const postView = document.querySelector('#image');
        if (postView) {
          return [postView];
        }
        
        // Default: return empty array
        console.log('No Rule34 gallery images found');
        return [];
      } catch (error) {
        console.error('Error getting Rule34 gallery images:', error);
        return [];
      }
    }
  };
})();