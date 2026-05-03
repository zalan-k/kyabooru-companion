/**
 * Overlay Component
 * Manages the tag input overlay UI.
 *
 * Rewrite of createOverlay() against the redesigned spec:
 *
 *   - The image preview is now part of the overlay (left flex item),
 *     not a separate floating <div>.
 *     positionImagePreview() and the imagePreviewElement global are gone.
 *     hideImagePreview() is kept as a no-op since content.js calls it
 *     externally and removing it would break that contract.
 *
 *   - HTML structure:
 *
 *       .tag-saver-extension-overlay     (backdrop, scrim)
 *         .overlay-layout                (flex: image-card + overlay-content)
 *           .image-card                  (image preview)
 *           .overlay-content             (right panel, position: relative)
 *             .duplicate-warning.hidden  (absolute, floats above panel)
 *             .overlay-inner             (scrollable column)
 *               .pool-block
 *               .tag-input-block
 *                 .autocomplete-dropdown (sibling, absolute, in same block)
 *               .tag-display-wrapper
 *                 .tag-display
 *
 *   - New tags PREPEND (top of the list) — uses tagPills addTag's
 *     new options.prepend flag.
 *
 *   - URL display, shortcuts hint, "Save Anyway" / "Cancel" buttons in the
 *     duplicate warning, and the inline style.cssText on the backdrop are
 *     all gone — styles.js now owns positioning.
 *
 *   - showDuplicateWarning() accepts an optional hammingDistance third arg.
 *     When provided, the warning shows it; when not, it falls back to the
 *     "exact match" / "similar match" wording from before.
 */
const autocompleteCache = new Map();
const AUTOCOMPLETE_CACHE_TTL = 60000; // 1 minute
window.TagSaver = window.TagSaver || {};
window.TagSaver.UI = window.TagSaver.UI || {};

window.TagSaver.UI.Overlay = (function() {
  // Create references to other UI components we need
  const Styles = window.TagSaver.UI.Styles;
  const TagPills = window.TagSaver.UI.TagPills;
  const Toast = window.TagSaver.UI.Toast;

  let styleElement = null;
  let overlayElement = null;
  let keydownListener = null; // Track the event listener globally

  /* ---------------------------------------------------------------
   *  Inline SVG icons used in the overlay HTML
   * ------------------------------------------------------------- */

  const ICON_LOAD_TAGS_ID =
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' +
      '<rect width="14" height="14" x="8" y="8" rx="2" ry="2"/>' +
      '<path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/>' +
    '</svg>';

  const ICON_LOAD_TAGS =
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' +
      '<path d="M12 2H2v10l9.29 9.29c.94.94 2.48.94 3.42 0l6.58-6.58c.94-.94.94-2.48 0-3.42L12 2Z"/>' +
      '<path d="M7 7h.01"/>' +
    '</svg>';

  const ICON_LOAD_ID =
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' +
      '<rect width="18" height="14" x="3" y="5" rx="2" ry="2"/>' +
      '<path d="M7 15h4M15 15h2M7 11h2M13 11h4"/>' +
    '</svg>';

  const ICON_WARNING_TRIANGLE =
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' +
      '<path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/>' +
      '<line x1="12" x2="12" y1="9" y2="13"/>' +
      '<line x1="12" x2="12.01" y1="17" y2="17"/>' +
    '</svg>';

  /* ---------------------------------------------------------------
   *  Pool index lookup
   * ------------------------------------------------------------- */

  /**
   * Look up the highest index for a pool and write `highest + 1` into the
   * overlay's index input. Used by both the manual change handler and the
   * "load last pool ID" buttons. Returns the resolved next-index for callers
   * that want it.
   */
  async function populateNextPoolIndex(poolId) {
    if (!overlayElement) return null;
    const poolIndexInput = overlayElement.querySelector('#pool-index');
    if (!poolIndexInput) return null;

    const trimmed = (poolId || '').trim();
    if (!trimmed) return null;

    poolIndexInput.placeholder = 'Loading...';
    poolIndexInput.disabled = true;

    try {
      const result = await browser.runtime.sendMessage({
        action: 'get-pool-highest-index',
        poolId: trimmed,
      });

      let nextIndex;
      if (result && result.success && result.highestIndex !== null && result.highestIndex !== undefined) {
        nextIndex = result.highestIndex + 1;
      } else {
        nextIndex = 0; // pool not seen before -> start at 0
      }

      poolIndexInput.value = String(nextIndex);
      return nextIndex;
    } catch (error) {
      console.error('Error getting pool index:', error);
      poolIndexInput.value = '0';
      return null;
    } finally {
      poolIndexInput.placeholder = 'Position in pool';
      poolIndexInput.disabled = false;
    }
  }

  /* ---------------------------------------------------------------
   *  Init / styles
   * ------------------------------------------------------------- */

  /**
   * Initialize the overlay component
   */
  function initOverlay() {
    if (!styleElement) {
      // styles.js's getAllStyles() now bundles everything the overlay needs
      // (variables, reset, overlay, duplicate warning, pool, autocomplete,
      // tags, media placeholder).
      styleElement = Styles.injectStyles(Styles.getAllStyles());
      console.log('All overlay styles injected');
    }
  }

  /* ---------------------------------------------------------------
   *  Last-saved data (localStorage-backed memory)
   * ------------------------------------------------------------- */

  /**
   * Load last saved data from localStorage
   */
  function loadLastSavedData() {
    try {
      const stored = localStorage.getItem('tagSaverLastSaved');
      console.log('🔍 Loading stored data:', stored);

      return stored ? JSON.parse(stored) : null;
    } catch (error) {
      console.error('❌ Error loading data:', error);
      return null;
    }
  }

  /**
   * Load last saved tags and ID into the overlay
   */
  async function loadLastTagsAndId() {
    const lastData = loadLastSavedData();
    if (!lastData) {
      Toast.showError('No previously saved data found');
      return;
    }

    // Load tags if available
    if (lastData.tags && lastData.tags.length > 0) {
      const tagDisplay = overlayElement.querySelector('#tag-display');
      if (tagDisplay) {
        TagPills.renderTagPills(
          lastData.tags,
          tagDisplay,
          (deletedTag) => {
            console.log(`Tag deleted: ${deletedTag}`);
            updateTagCount();
          },
          (oldTag, newTag, newCategory) => {
            console.log(`Tag category changed: ${oldTag} -> ${newTag}`);
          }
        );
        updateTagCount();
        Toast.showSuccess(`Loaded ${lastData.tags.length} tags from memory`);
      }
    }

    // Load pool ID if available
    if (lastData.poolId) {
      const poolIdInput = overlayElement.querySelector('#pool-id');
      if (poolIdInput) {
        poolIdInput.value = lastData.poolId;
        const nextIndex = await populateNextPoolIndex(lastData.poolId);
        if (nextIndex !== null) {
          Toast.showSuccess(`Loaded pool ${lastData.poolId} (next index: ${nextIndex})`);
        } else {
          Toast.showSuccess(`Loaded pool ID: ${lastData.poolId}`);
        }
      }
    }

    if (!lastData.tags?.length && !lastData.poolId) {
      Toast.showError('No tags or pool ID found in memory');
    }
  }

  /**
   * Load only the last saved pool ID into the overlay
   */
  async function loadLastIdOnly() {
    const lastData = loadLastSavedData();
    if (!lastData || !lastData.poolId) {
      Toast.showError('No pool ID found in memory');
      return;
    }

    const poolIdInput = overlayElement.querySelector('#pool-id');
    if (!poolIdInput) return;

    poolIdInput.value = lastData.poolId;
    const nextIndex = await populateNextPoolIndex(lastData.poolId);

    if (nextIndex !== null) {
      Toast.showSuccess(`Loaded pool ${lastData.poolId} (next index: ${nextIndex})`);
    } else {
      Toast.showSuccess(`Loaded pool ID: ${lastData.poolId}`);
    }
  }

  /**
   * Load only the last saved tags into the overlay
   */
  function loadLastTagsOnly() {
    const lastData = loadLastSavedData();
    if (!lastData || !lastData.tags || lastData.tags.length === 0) {
      Toast.showError('No tags found in memory');
      return;
    }

    const tagDisplay = overlayElement.querySelector('#tag-display');
    if (tagDisplay) {
      TagPills.renderTagPills(
        lastData.tags,
        tagDisplay,
        (deletedTag) => {
          console.log(`Tag deleted: ${deletedTag}`);
          updateTagCount();
        },
        (oldTag, newTag, newCategory) => {
          console.log(`Tag category changed: ${oldTag} -> ${newTag}`);
        }
      );
      updateTagCount();
      Toast.showSuccess(`Loaded ${lastData.tags.length} tags from memory`);
    }
  }

  /* ---------------------------------------------------------------
   *  Tag count badge
   * ------------------------------------------------------------- */

  /**
   * Sync the count badge in the tag-display label with however many pills
   * are actually in the display right now. Cheap to call; safe to spam after
   * any tag-list mutation.
   */
  function updateTagCount() {
    if (!overlayElement) return;
    const tagDisplay = overlayElement.querySelector('#tag-display');
    const countEl = overlayElement.querySelector('#tag-count');
    if (!tagDisplay || !countEl) return;
    countEl.textContent = String(tagDisplay.querySelectorAll('.tag-pill').length);
  }

  /* ---------------------------------------------------------------
   *  Image card content (image / video / gif placeholder)
   * ------------------------------------------------------------- */

  /**
   * Build the initial markup for the image card based on media type.
   * For video/gif this returns a placeholder; the first-frame extraction
   * happens asynchronously after the overlay is mounted (see
   * mountAsyncMediaPreview below).
   */
  function buildImageCardMarkup(imageUrl, mediaType) {
    if (!imageUrl) return '';

    if (mediaType === 'video' || mediaType === 'gif') {
      const label = mediaType === 'video' ? 'Loading video preview…' : 'Loading GIF preview…';
      const icon = mediaType === 'video' ? '🎬' : 'GIF';
      return `
        <div class="media-placeholder ${mediaType}-placeholder">
          <div class="media-icon">${icon}</div>
          <div class="label">${label}</div>
        </div>
      `;
    }

    return `<img src="${imageUrl}" alt="Image to be saved" />`;
  }

  /**
   * For video/gif media, kick off the async first-frame extraction. When
   * it resolves, swap the placeholder for an actual <img>. If the overlay
   * has been closed in the meantime, do nothing.
   */
  function mountAsyncMediaPreview(imageCardEl, imageUrl, mediaType) {
    if (mediaType !== 'video' && mediaType !== 'gif') return;
    if (!window.TagSaver.Hash || !window.TagSaver.Hash.extractVideoFirstFrame) {
      console.warn('Hash.extractVideoFirstFrame unavailable; placeholder will remain');
      return;
    }

    window.TagSaver.Hash.extractVideoFirstFrame(imageUrl)
      .then((result) => {
        if (imageCardEl && document.body.contains(imageCardEl) && result && result.dataUrl) {
          imageCardEl.innerHTML = `<img src="${result.dataUrl}" alt="${mediaType} preview" />`;
        }
      })
      .catch((error) => {
        console.error(`Failed to extract ${mediaType} frame:`, error);
      });
  }

  /* ---------------------------------------------------------------
   *  createOverlay — main entrypoint
   * ------------------------------------------------------------- */

  /**
   * Create and show the tag input overlay
   * @param {Object} options - Overlay options
   * @param {string} options.imageUrl - URL of image to display
   * @param {string} options.mediaType - 'image' (default) | 'video' | 'gif'
   * @param {Array<string>} options.tags - Initial tags to display
   * @param {string} options.pageUrl - Current page URL (kept for save callback)
   * @param {Function} options.onSave - Callback when Save is clicked
   * @param {Function} options.onCancel - Callback when overlay is closed
   * @returns {HTMLElement} - The created overlay element
   */
  function createOverlay(options = {}) {
    // Ensure styles are injected
    initOverlay();

    // First, clean up any existing overlay
    if (overlayElement) {
      closeOverlay();
    }

    const {
      imageUrl = null,
      mediaType = 'image',
      tags = [],
      pageUrl = window.location.href,
      onSave = () => {},
      onCancel = () => {}
    } = options;

    // Backdrop / overlay root. styles.js owns the positioning — no inline
    // style.cssText anymore.
    const overlay = document.createElement('div');
    overlay.className = 'tag-saver-extension-overlay';

    overlay.innerHTML = `
      <div class="overlay-layout">

        <div class="image-card" id="ts-image-card">
          ${buildImageCardMarkup(imageUrl, mediaType)}
        </div>

        <div class="overlay-content">

          <div class="duplicate-warning hidden" id="duplicate-warning"></div>

          <div class="overlay-inner">

            <div class="pool-block">
              <div class="pool-header">
                <span class="pool-title">Image pool</span>
                <div class="pool-buttons">
                  <button id="load-last-tags-id" class="pool-action-btn" type="button">${ICON_LOAD_TAGS_ID}</button>
                  <button id="load-last-tags"    class="pool-action-btn" type="button">${ICON_LOAD_TAGS}</button>
                  <button id="load-last-id"      class="pool-action-btn" type="button">${ICON_LOAD_ID}</button>
                  <button id="generate-pool-id"  class="pool-action-btn pool-action-btn-text" type="button">Generate</button>
                </div>
              </div>
              <div class="pool-fields">
                <div class="pool-field">
                  <label for="pool-id">Pool ID</label>
                  <input id="pool-id" type="text" placeholder="Enter or generate pool ID" />
                </div>
                <div class="pool-field">
                  <label for="pool-index">Index</label>
                  <input id="pool-index" type="number" placeholder="Position in pool" min="0" value="0" />
                </div>
              </div>
            </div>

            <div class="tag-input-block">
              <input type="text" id="tag-input" placeholder="Type a tag and press Enter…" value=" " />
              <div class="autocomplete-dropdown"></div>
            </div>

            <div class="tag-display-wrapper">
              <div class="tag-display-label">
                <span>Tags</span>
                <span class="count" id="tag-count">${tags.length}</span>
              </div>
              <div id="tag-display" class="tag-display"></div>
            </div>

          </div>
        </div>
      </div>
    `;

    document.body.appendChild(overlay);
    overlayElement = overlay;

    // Kick off async frame extraction for video/gif (no-op for images)
    const imageCardEl = overlay.querySelector('#ts-image-card');
    if (imageUrl && imageCardEl) {
      mountAsyncMediaPreview(imageCardEl, imageUrl, mediaType);
    }

    // Reveal the image card with a slide-in from the left once content is ready.
    if (imageCardEl) {
      if (!imageUrl) {
        imageCardEl.classList.add('hidden');
      } else if (mediaType === 'video' || mediaType === 'gif') {
        requestAnimationFrame(() => imageCardEl.classList.add('ready'));
      } else {
        const img = imageCardEl.querySelector('img');
        if (img) {
          const reveal = () => imageCardEl.classList.add('ready');
          if (img.complete && img.naturalWidth > 0) {
            requestAnimationFrame(reveal);
          } else {
            img.addEventListener('load', reveal, { once: true });
            img.addEventListener('error', reveal, { once: true });
            setTimeout(reveal, 3000);
          }
        } else {
          imageCardEl.classList.add('ready');
        }
      }
    }

    // Wire up references
    const overlayLayout       = overlay.querySelector('.overlay-layout');
    const generatePoolIdButton = overlay.querySelector('#generate-pool-id');
    const poolIdInput         = overlay.querySelector('#pool-id');
    const poolIndexInput      = overlay.querySelector('#pool-index');
    const loadLastTagsIdButton = overlay.querySelector('#load-last-tags-id');
    const loadLastTagsButton  = overlay.querySelector('#load-last-tags');
    const loadLastIdButton    = overlay.querySelector('#load-last-id');
    const input               = overlay.querySelector('#tag-input');
    const tagDisplay          = overlay.querySelector('#tag-display');
    const autocompleteDropdown = overlay.querySelector('.autocomplete-dropdown');

    // Memory button event listeners
    loadLastTagsIdButton.addEventListener('click', loadLastTagsAndId);
    loadLastTagsButton.addEventListener('click', loadLastTagsOnly);
    loadLastIdButton.addEventListener('click', loadLastIdOnly);

    // Generate pool ID
    generatePoolIdButton.addEventListener('click', async () => {
      generatePoolIdButton.disabled = true;
      const originalLabel = generatePoolIdButton.textContent;
      generatePoolIdButton.textContent = '...';

      try {
        const response = await browser.runtime.sendMessage({ action: 'generate-pool-id' });
        if (response && response.success) {
          poolIdInput.value = response.poolId;
          poolIndexInput.value = '0';

          if (response.source === 'client-fallback') {
            console.warn('Pool ID generated client-side; server was unavailable.');
          }
        } else {
          console.error('Pool generation failed:', response && response.error);
        }
      } catch (err) {
        console.error('Pool generation error:', err);
        poolIdInput.value = Math.random().toString(36).substring(2, 10);
        poolIndexInput.value = '0';
      } finally {
        generatePoolIdButton.disabled = false;
        generatePoolIdButton.textContent = originalLabel;
      }
    });

    // Manual pool-ID change -> populate next index
    poolIdInput.addEventListener('change', () => {
      populateNextPoolIndex(poolIdInput.value);
    });

    // Focus tag input
    if (input) {
      setTimeout(() => input.focus(), 50);
    } else {
      console.error('Input field not found!');
    }

    // Render initial tags
    if (tagDisplay) {
      TagPills.renderTagPills(
        tags,
        tagDisplay,
        (deletedTag) => {
          console.log(`Tag deleted: ${deletedTag}`);
          updateTagCount();
        },
        (oldTag, newTag, newCategory) => {
          console.log(`Tag category changed: ${oldTag} -> ${newTag}`);
        }
      );
      updateTagCount();
    } else {
      console.error('Tag display not found!');
    }

    // Track selected item in dropdown
    let selectedIndex = -1;

    /* ----------- save ----------- */

    function saveData() {
      if (!tagDisplay) {
        console.error('Tag display not found when saving!');
        return;
      }

      const displayTags = TagPills.getCurrentTagsFromDisplay(tagDisplay);
      const poolData = poolIdInput.value.trim()
        ? {
            poolId: poolIdInput.value.trim(),
            poolIndex: parseInt(poolIndexInput.value, 10) || 0
          }
        : null;

      // No-op now (image preview is part of the overlay), but kept for the
      // contract — content.js may also call this elsewhere.
      hideImagePreview();
      closeOverlay();
      onSave(displayTags, poolData);
    }

    /* ----------- autocomplete ----------- */

    async function updateAutocompleteSuggestions() {
      const query = input.value.trim();

      if (query.length < 2) {
        autocompleteDropdown.classList.remove('show');
        selectedIndex = -1;
        return;
      }

      const cacheKey = query.toLowerCase();
      const cached = autocompleteCache.get(cacheKey);

      if (cached && (Date.now() - cached.timestamp) < AUTOCOMPLETE_CACHE_TTL) {
        console.log(`🚀 Local cache hit for: ${query}`);
        renderSuggestions(cached.data);
        return;
      }

      try {
        console.log(`🔍 Searching server for: ${query}`);
        const startTime = performance.now();

        const suggestions = await browser.runtime.sendMessage({
          action: 'search-tags',
          query: query
        });

        const duration = performance.now() - startTime;
        console.log(`📊 Search completed in ${duration.toFixed(1)}ms`);

        if (suggestions && suggestions.length > 0) {
          autocompleteCache.set(cacheKey, {
            data: suggestions,
            timestamp: Date.now()
          });
          renderSuggestions(suggestions);
        } else {
          autocompleteDropdown.classList.remove('show');
          selectedIndex = -1;
        }
      } catch (error) {
        console.error('Autocomplete error:', error);
        autocompleteDropdown.classList.remove('show');
      }
    }

    function renderSuggestions(suggestions) {
      autocompleteDropdown.innerHTML = '';

      suggestions.forEach((tag) => {
        const item = document.createElement('div');
        item.className = 'autocomplete-item';

        // Format tag display (category:name)
        let displayText = tag;
        let category = 'general';

        if (tag.includes(':')) {
          const [cat, name] = tag.split(':', 2);
          category = cat;
          displayText = name;
        }

        item.innerHTML = `
          <span class="name">${displayText}</span>
          <span class="autocomplete-category">${category}</span>
        `;

        item.addEventListener('click', () => {
          selectTag(tag);
        });

        autocompleteDropdown.appendChild(item);
      });

      autocompleteDropdown.classList.add('show');
      selectedIndex = -1;
    }

    function debounce(func, wait) {
      let timeout;
      return function() {
        const context = this;
        const args = arguments;
        clearTimeout(timeout);
        timeout = setTimeout(() => func.apply(context, args), wait);
      };
    }

    const debouncedUpdateSuggestions = debounce(updateAutocompleteSuggestions, 200);

    /* ----------- tag selection ----------- */

    function selectTag(tag) {
      const existingTags = TagPills.getCurrentTagsFromDisplay(tagDisplay);

      if (!existingTags.includes(tag)) {
        TagPills.addTag(
          tag,
          tagDisplay,
          (deletedTag) => {
            console.log(`Tag deleted: ${deletedTag}`);
            updateTagCount();
          },
          (oldTag, newTag, newCategory) => {
            console.log(`Tag category changed: ${oldTag} -> ${newTag}`);
          },
          { prepend: true }
        );
        updateTagCount();
      }

      input.value = '';
      autocompleteDropdown.classList.remove('show');
      selectedIndex = -1;
      input.focus();
    }

    input.addEventListener('input', debouncedUpdateSuggestions);

    /* ----------- keyboard ----------- */

    function handleKeydown(e) {
      // Autocomplete dropdown navigation
      if (autocompleteDropdown.classList.contains('show')) {
        const items = autocompleteDropdown.querySelectorAll('.autocomplete-item');

        if (e.key === 'ArrowDown') {
          e.preventDefault();
          selectedIndex = (selectedIndex + 1) % items.length;
          highlightSelectedItem(items, selectedIndex);
        } else if (e.key === 'ArrowUp') {
          e.preventDefault();
          selectedIndex = selectedIndex <= 0 ? items.length - 1 : selectedIndex - 1;
          highlightSelectedItem(items, selectedIndex);
        } else if ((e.key === 'Tab' || e.key === 'Enter') && selectedIndex >= 0) {
          e.preventDefault();

          const selectedItem = items[selectedIndex];
          const tagName = selectedItem.querySelector('.name').textContent;
          const category = selectedItem.querySelector('.autocomplete-category').textContent;

          const fullTag = category !== 'general' ? `${category}:${tagName}` : tagName;
          selectTag(fullTag);
          return;
        }
      }

      // Regular overlay keyboard shortcuts
      if (e.key === 'Escape') {
        hideImagePreview();
        closeOverlay();
        onCancel();
      } else if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();

        if (autocompleteDropdown.classList.contains('show') && selectedIndex === -1) {
          autocompleteDropdown.classList.remove('show');
        } else if (input.value.trim()) {
          // Add new tags from input — split by commas
          const newTags = input.value.trim().split(',').map((t) => t.trim()).filter(Boolean);
          const existingTags = TagPills.getCurrentTagsFromDisplay(tagDisplay);

          newTags.forEach((tag) => {
            if (!existingTags.includes(tag)) {
              TagPills.addTag(
                tag,
                tagDisplay,
                (deletedTag) => {
                  console.log(`Tag deleted: ${deletedTag}`);
                  updateTagCount();
                },
                (oldTag, newTag, newCategory) => {
                  console.log(`Tag category changed: ${oldTag} -> ${newTag}`);
                },
                { prepend: true }
              );
            }
          });
          updateTagCount();

          input.value = '';
          autocompleteDropdown.classList.remove('show');
        } else {
          // Empty input -> save
          saveData();
        }
      }
    }

    function highlightSelectedItem(items, index) {
      items.forEach((item, i) => {
        item.classList.toggle('selected', i === index);
      });

      if (index >= 0) {
        items[index].scrollIntoView({ block: 'nearest' });
      }
    }

    keydownListener = handleKeydown;
    document.addEventListener('keydown', keydownListener);

    // Close dropdown when clicking outside of it
    document.addEventListener('click', (e) => {
      if (!autocompleteDropdown.contains(e.target) && e.target !== input) {
        autocompleteDropdown.classList.remove('show');
        selectedIndex = -1;
      }
    });

    // Close overlay when clicking the dimmed area. The .overlay-layout now
    // fills the backdrop horizontally (width: 100% in styles.js), so clicks
    // on its empty padding land on overlay-layout, not overlay. Accept both.
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay || e.target === overlayLayout) {
        hideImagePreview();
        closeOverlay();
        onCancel();
      }
    });

    return overlay;
  }

  /* ---------------------------------------------------------------
   *  Lifecycle
   * ------------------------------------------------------------- */

  /**
   * Close the overlay if it's open
   */
  function closeOverlay() {
    console.log('closeOverlay called, overlayElement exists:', !!overlayElement);

    if (overlayElement) {
      if (keydownListener) {
        console.log('Removing keyboard event listener');
        document.removeEventListener('keydown', keydownListener);
        keydownListener = null;
      }

      // Animate out
      overlayElement.style.opacity = 0;
      overlayElement.style.transform = 'translateY(-10px)';

      // Capture in a local so the closure doesn't NPE if a new overlay opens
      // before the timeout fires.
      const el = overlayElement;
      overlayElement = null;
      setTimeout(() => {
        console.log('Removing overlay from DOM');
        if (el && el.parentNode) el.parentNode.removeChild(el);
      }, 200);
    }
  }

  /**
   * Hide and remove image preview if it exists.
   *
   * Kept as a no-op for backwards compatibility — the image preview is now
   * part of the overlay (inside .image-card), so it gets cleaned up when
   * closeOverlay() removes the overlay root. But content.js calls this
   * independently in a few places, so we keep the function exported.
   */
  function hideImagePreview() {
    // intentional no-op
  }

  /**
   * Check if overlay is currently open
   * @returns {boolean} - Whether overlay is open
   */
  function isOverlayOpen() {
    return overlayElement !== null;
  }

  /* ---------------------------------------------------------------
   *  Duplicate warning
   * ------------------------------------------------------------- */

  /**
   * Show a duplicate warning floating above the overlay panel.
   *
   * @param {Object} originalRecord - The original record that was found as a duplicate.
   *                                  Currently unused in the new design (date / tag
   *                                  list aren't shown), but kept on the signature
   *                                  for caller compat.
   * @param {boolean} exactMatch - Whether this is an exact match or just similar.
   * @param {number} [hammingDistance] - Optional hamming distance between the
   *                                     current image and the existing one. When
   *                                     provided, shown as the secondary line.
   *                                     When not, falls back to "exact match" /
   *                                     "similar match" wording.
   */
  function showDuplicateWarning(originalRecord, exactMatch, hammingDistance) {
    console.log('Showing duplicate warning', originalRecord, exactMatch, hammingDistance);

    if (!overlayElement) {
      console.error('Cannot show duplicate warning - overlay not active');
      return;
    }

    const warning = overlayElement.querySelector('#duplicate-warning');
    if (!warning) {
      console.error('Duplicate-warning slot not found in overlay');
      return;
    }

    const headline = exactMatch
      ? 'Exact duplicate already saved'
      : 'Similar image already saved';

    let metaHtml;
    if (typeof hammingDistance === 'number' && Number.isFinite(hammingDistance)) {
      metaHtml = `Hamming distance: <code>${hammingDistance}</code>`;
    } else {
      metaHtml = exactMatch ? 'Exact match' : 'Similar match';
    }

    warning.innerHTML = `
      <div class="icon">${ICON_WARNING_TRIANGLE}</div>
      <div class="body">
        <strong>${headline}</strong>
        <span class="meta">${metaHtml}</span>
      </div>
    `;
    warning.classList.remove('hidden');
  }

  return {
    initOverlay,
    createOverlay,
    closeOverlay,
    hideImagePreview,
    isOverlayOpen,
    showDuplicateWarning,
    loadLastSavedData,
    loadLastTagsAndId,
    loadLastIdOnly
  };
})();
