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
   * Get current category from pill element
   * @param {HTMLElement} pillElement - The pill element
   * @returns {string} - Current category of the tag
   */
  function getCurrentCategory(pillElement) {
    const tag = pillElement.getAttribute('data-tag');
    const [category] = tag.includes(':') ? tag.split(':', 2) : ['general', tag];
    return category;
  }

  /**
   * Get tag name from pill element
   * @param {HTMLElement} pillElement - The pill element
   * @returns {string} - Tag name without category prefix
   */
  function getTagName(pillElement) {
    const tag = pillElement.getAttribute('data-tag');
    const [, name] = tag.includes(':') ? tag.split(':', 2) : ['general', tag];
    return name || tag; // fallback to full tag if no category
  }

  /**
   * Show category dropdown for a tag
   */
  function showCategoryDropdown(pillElement, onCategoryChange) {
    // Remove existing dropdown
    const existing = document.querySelector('.tag-category-dropdown');
    if (existing) existing.remove();
    
    // Get current category and name dynamically
    const currentCategory = getCurrentCategory(pillElement);
    const tagName = getTagName(pillElement);
    
    const categories = [
      { value: 'general', label: 'General', color: 'rgba(153, 153, 153, 0.7)' },
      { value: 'artist', label: 'Artist', color: 'rgba(255, 117, 117, 0.7)' },
      { value: 'character', label: 'Character', color: 'rgba(121, 187, 255, 0.7)' },
      { value: 'copyright', label: 'Copyright', color: 'rgba(179, 136, 255, 0.7)' },
      { value: 'meta', label: 'Meta', color: 'rgba(251, 192, 45, 0.7)' }
    ];
    
    const dropdown = document.createElement('div');
    dropdown.className = 'tag-category-dropdown';
    
    const rect = pillElement.getBoundingClientRect();
    dropdown.style.cssText = `position: fixed; top: ${rect.bottom + 5}px; left: ${rect.left}px; z-index: 999999999;`;
    
    categories.forEach(cat => {
      const option = document.createElement('div');
      option.className = 'tag-category-option';
      option.innerHTML = `
        <div class="category-color" style="background: ${cat.color};"></div>
        <span>${cat.label}</span>
        ${cat.value === currentCategory ? '<span class="selected-mark">✓</span>' : ''}
      `;
      if (cat.value === currentCategory) option.classList.add('selected');
      
      option.addEventListener('click', (e) => {
        e.stopPropagation();
        if (cat.value !== currentCategory) {
          const oldTag = pillElement.getAttribute('data-tag');
          const newTag = cat.value === 'general' ? tagName : `${cat.value}:${tagName}`;
          
          pillElement.setAttribute('data-tag', newTag);
          pillElement.className = `tag-pill tag-${cat.value}`;
          
          if (onCategoryChange) onCategoryChange(oldTag, newTag, cat.value);
        }
        dropdown.remove();
      });
      
      dropdown.appendChild(option);
    });
    
    document.body.appendChild(dropdown);
    
    // Close on outside click
    setTimeout(() => {
      const close = (e) => {
        if (!dropdown.contains(e.target) && !pillElement.contains(e.target)) {
          dropdown.remove();
          document.removeEventListener('click', close);
        }
      };
      document.addEventListener('click', close);
    }, 10);
  }

  /**
   * Render tag pills into the specified container
   * @param {Array<string>} tags - Array of tags to render
   * @param {HTMLElement} container - Container element to render tags into
   * @param {Function} onDeleteTag - Callback when a tag is deleted
   * @param {Function} onCategoryChange - Callback when a tag category is changed
   */
  function renderTagPills(tags, container, onDeleteTag, onCategoryChange) {
    initTagPills();
    container.innerHTML = '';
    
    tags.forEach(tag => {
      const [category, name] = tag.includes(':') ? tag.split(':', 2) : ['general', tag];
      
      const pill = document.createElement('span');
      pill.className = `tag-pill tag-${category}`;
      pill.setAttribute('data-tag', tag);
      pill.innerHTML = `<span class="tag-content">${name}</span> <span class="tag-delete">×</span>`;
      
      // Delete handler
      pill.querySelector('.tag-delete').addEventListener('click', (e) => {
        e.stopPropagation();
        pill.remove();
        if (onDeleteTag) onDeleteTag(tag);
      });
      
      // Category change handler - now gets current category dynamically
      pill.querySelector('.tag-content').addEventListener('click', (e) => {
        e.stopPropagation();
        showCategoryDropdown(pill, onCategoryChange);
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
   * @param {Function} onCategoryChange - Callback when a tag category is changed
   */
  function addTag(tag, container, onDeleteTag, onCategoryChange) {
    const currentTags = getCurrentTagsFromDisplay(container);
    
    if (!currentTags.includes(tag)) {
      const [category, name] = tag.includes(':') ? tag.split(':', 2) : ['general', tag];
      
      const pill = document.createElement('span');
      pill.className = `tag-pill tag-${category}`;
      pill.setAttribute('data-tag', tag);
      pill.innerHTML = `<span class="tag-content">${name}</span> <span class="tag-delete">×</span>`;
      
      pill.querySelector('.tag-delete').addEventListener('click', (e) => {
        e.stopPropagation();
        pill.remove();
        if (onDeleteTag) onDeleteTag(tag);
      });
      
      // Category change handler - now gets current category dynamically
      pill.querySelector('.tag-content').addEventListener('click', (e) => {
        e.stopPropagation();
        showCategoryDropdown(pill, onCategoryChange);
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
    removeTag,
    showCategoryDropdown,
    getCurrentCategory,
    getTagName
  };
})();