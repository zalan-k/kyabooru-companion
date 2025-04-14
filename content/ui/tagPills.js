/**
 * Tag Pills Component
 * Renders and manages tag pills in the tag display
 */
window.TagSaver = window.TagSaver || {};
window.TagSaver.UI = window.TagSaver.UI || {};

window.TagSaver.UI.TagPills = (function() {
  let styleElement = null;
  
  /**
   * Initialize the tag pills component
   */
  function initTagPills() {
    if (!styleElement) {
      // Reference Styles through the namespace
      styleElement = window.TagSaver.UI.Styles.injectStyles(
        window.TagSaver.UI.Styles.tagStyles
      );
    }
  }

  /**
   * Render tag pills into the specified container
   * @param {Array<string>} tags - Array of tags to render
   * @param {HTMLElement} container - Container element to render tags into
   * @param {Function} onDeleteTag - Callback when a tag is deleted
   */
  function renderTagPills(tags, container, onDeleteTag) {
    // Ensure styles are injected
    initTagPills();
    
    // Clear existing content
    container.innerHTML = '';
    
    // Create tag pills
    tags.forEach(tag => {
      // Parse the tag: if it has a category prefix like "artist:name", extract it
      const [category, name] = tag.includes(':') ? tag.split(':', 2) : ['default', tag];
      
      const pill = document.createElement('span');
      pill.className = `tag-pill tag-${category}`;
      pill.setAttribute('data-tag', tag); // Store the full tag with category for saving
      
      // Display only the name part, not the category
      pill.innerHTML = `${name} <span class="tag-delete">×</span>`;
      
      // Add delete handler
      pill.querySelector('.tag-delete').addEventListener('click', () => {
        pill.remove();
        if (onDeleteTag) {
          onDeleteTag(tag);
        }
      });
      
      container.appendChild(pill);
    });
  }

  /**
   * Get all current tags from the display
   * @param {HTMLElement} container - The tag display container
   * @returns {Array<string>} - Array of tag strings
   */
  function getCurrentTagsFromDisplay(container) {
    const tagPills = container.querySelectorAll('.tag-pill');
    return Array.from(tagPills).map(pill => pill.getAttribute('data-tag'));
  }

  /**
   * Add a new tag to the display
   * @param {string} tag - Tag to add
   * @param {HTMLElement} container - The tag display container
   * @param {Function} onDeleteTag - Callback when a tag is deleted
   */
  function addTag(tag, container, onDeleteTag) {
    // Get current tags
    const currentTags = getCurrentTagsFromDisplay(container);
    
    // Only add if not already present
    if (!currentTags.includes(tag)) {
      // Parse the tag: if it has a category prefix like "artist:name", extract it
      const [category, name] = tag.includes(':') ? tag.split(':', 2) : ['default', tag];
      
      const pill = document.createElement('span');
      pill.className = `tag-pill tag-${category}`;
      pill.setAttribute('data-tag', tag);
      
      // Display only the name part, not the category
      pill.innerHTML = `${name} <span class="tag-delete">×</span>`;
      
      // Add delete handler
      pill.querySelector('.tag-delete').addEventListener('click', () => {
        pill.remove();
        if (onDeleteTag) {
          onDeleteTag(tag);
        }
      });
      
      container.appendChild(pill);
    }
  }

  /**
   * Remove a tag from the display
   * @param {string} tag - Tag to remove
   * @param {HTMLElement} container - The tag display container
   */
  function removeTag(tag, container) {
    const pills = container.querySelectorAll('.tag-pill');
    pills.forEach(pill => {
      if (pill.getAttribute('data-tag') === tag) {
        pill.remove();
      }
    });
  }

  return {
    initTagPills,
    renderTagPills,
    getCurrentTagsFromDisplay,
    addTag,
    removeTag
  };
})();