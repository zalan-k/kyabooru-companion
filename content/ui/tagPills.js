/**
 * Tag Pills Component
 * Renders and manages tag pills in the tag display.
 *
 * Updated: addTag() accepts an options.prepend flag so the overlay can
 * insert newly-added tags at the top of the display rather than the
 * bottom (matches the redesigned overlay UX).
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
      styleElement = window.TagSaver.UI.Styles.injectStyles(
        window.TagSaver.UI.Styles.tagStyles
      );
    }
  }

  /**
   * Get current category from pill element
   */
  function getCurrentCategory(pillElement) {
    const tag = pillElement.getAttribute('data-tag');
    const [category] = tag.includes(':') ? tag.split(':', 2) : ['general', tag];
    return category;
  }

  /**
   * Get tag name from pill element
   */
  function getTagName(pillElement) {
    const tag = pillElement.getAttribute('data-tag');
    const [, name] = tag.includes(':') ? tag.split(':', 2) : ['general', tag];
    return name || tag;
  }

  /**
   * Show category dropdown for a tag
   */
  function showCategoryDropdown(pillElement, onCategoryChange) {
    const existing = document.querySelector('.tag-category-dropdown');
    if (existing) existing.remove();

    const currentCategory = getCurrentCategory(pillElement);
    const tagName = getTagName(pillElement);

    const categories = [
      { value: 'general',   label: 'General',   color: 'rgba(153, 153, 153, 0.7)' },
      { value: 'artist',    label: 'Artist',    color: 'rgba(255, 117, 117, 0.7)' },
      { value: 'character', label: 'Character', color: 'rgba(121, 187, 255, 0.7)' },
      { value: 'copyright', label: 'Copyright', color: 'rgba(179, 136, 255, 0.7)' },
      { value: 'meta',      label: 'Meta',      color: 'rgba(251, 192, 45, 0.7)' }
    ];

    const dropdown = document.createElement('div');
    dropdown.className = 'tag-category-dropdown';

    const rect = pillElement.getBoundingClientRect();
    dropdown.style.cssText =
      `position: fixed; top: ${rect.bottom + 5}px; left: ${rect.left}px; z-index: 999999999;`;

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
   * Build a single pill DOM element. Internal helper used by both
   * renderTagPills (initial render) and addTag (incremental insert).
   */
  function buildPill(tag, onDeleteTag, onCategoryChange) {
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

    pill.querySelector('.tag-content').addEventListener('click', (e) => {
      e.stopPropagation();
      showCategoryDropdown(pill, onCategoryChange);
    });

    return pill;
  }

  /**
   * Render all tag pills into the specified container (replaces existing children).
   * Order is preserved as given.
   */
  function renderTagPills(tags, container, onDeleteTag, onCategoryChange) {
    initTagPills();
    container.innerHTML = '';
    tags.forEach(tag => {
      container.appendChild(buildPill(tag, onDeleteTag, onCategoryChange));
    });
  }

  /**
   * Get all current tags from the display.
   */
  function getCurrentTagsFromDisplay(container) {
    const tagPills = container.querySelectorAll('.tag-pill');
    return Array.from(tagPills).map(pill => pill.getAttribute('data-tag'));
  }

  /**
   * Add a new tag pill to the display.
   *
   * @param {string} tag - tag string (with optional category prefix)
   * @param {HTMLElement} container - the .tag-display element
   * @param {Function} onDeleteTag - callback when pill is deleted
   * @param {Function} onCategoryChange - callback when category is changed
   * @param {Object} [options]
   * @param {boolean} [options.prepend=false] - insert at top of container
   *        instead of bottom. Used by the redesigned overlay so new
   *        tags appear at the top of the scrollable tag list.
   */
  function addTag(tag, container, onDeleteTag, onCategoryChange, options = {}) {
    const currentTags = getCurrentTagsFromDisplay(container);
    if (currentTags.includes(tag)) return;

    const pill = buildPill(tag, onDeleteTag, onCategoryChange);

    if (options.prepend) {
      container.insertBefore(pill, container.firstChild);
    } else {
      container.appendChild(pill);
    }
  }

  /**
   * Remove a tag from the display.
   */
  function removeTag(tag, container) {
    const pills = container.querySelectorAll('.tag-pill');
    pills.forEach(pill => {
      if (pill.getAttribute('data-tag') === tag) pill.remove();
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
