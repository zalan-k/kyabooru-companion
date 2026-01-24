/**
 * Overlay Component
 * Manages the tag input overlay UI
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
  let imagePreviewElement = null;
  let keydownListener = null; // Track the event listener globally

  /**
   * Initialize the overlay component
   */
  function initOverlay() {
    if (!styleElement) {
      // Include ALL necessary styles for the overlay
      const combinedStyles = `
        ${Styles.overlayStyles}
        ${Styles.imagePreviewStyles}
        ${Styles.tagStyles}
      `;
      styleElement = Styles.injectStyles(combinedStyles);
      console.log("All overlay styles injected");
    }
  }

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
  function loadLastTagsAndId() {
    const lastData = loadLastSavedData();
    if (!lastData) {
      Toast.showError("No previously saved data found");
      return;
    }

    // Load tags if available
    if (lastData.tags && lastData.tags.length > 0) {
      const tagDisplay = overlayElement.querySelector('#tag-display');
      if (tagDisplay) {
        // 🔥 FIXED: Provide proper callbacks for tag functionality
        TagPills.renderTagPills(
          lastData.tags, 
          tagDisplay,
          // onDeleteTag callback
          (deletedTag) => {
            console.log(`Tag deleted: ${deletedTag}`);
          },
          // onCategoryChange callback
          (oldTag, newTag, newCategory) => {
            console.log(`Tag category changed: ${oldTag} -> ${newTag}`);
          }
        );
        Toast.showSuccess(`Loaded ${lastData.tags.length} tags from memory`);
      }
    }

    // Load pool ID if available
    if (lastData.poolId) {
      const poolIdInput = overlayElement.querySelector('#pool-id');
      if (poolIdInput) {
        poolIdInput.value = lastData.poolId;
        // Trigger the change event to auto-populate the index
        poolIdInput.dispatchEvent(new Event('change'));
        Toast.showSuccess(`Loaded pool ID: ${lastData.poolId}`);
      }
    }

    if (!lastData.tags?.length && !lastData.poolId) {
      Toast.showError("No tags or pool ID found in memory");
    }
  }

  /**
   * Load only the last saved pool ID into the overlay
   */
  function loadLastIdOnly() {
    const lastData = loadLastSavedData();
    if (!lastData || !lastData.poolId) {
      Toast.showError("No pool ID found in memory");
      return;
    }

    const poolIdInput = overlayElement.querySelector('#pool-id');
    if (poolIdInput) {
      poolIdInput.value = lastData.poolId;
      // Trigger the change event to auto-populate the index
      poolIdInput.dispatchEvent(new Event('change'));
      Toast.showSuccess(`Loaded pool ID: ${lastData.poolId}`);
    }
  }

function positionImagePreview(previewElement, overlayContent) {
  if (!previewElement || !overlayContent) return;
  
  const overlayRect = overlayContent.getBoundingClientRect();
  previewElement.style.bottom = `${window.innerHeight - overlayRect.top + 10}px`;
  previewElement.style.left = `${overlayRect.left + (overlayRect.width/2) - (previewElement.offsetWidth/2)}px`;
}

/**
 * Create and show the tag input overlay
 * @param {Object} options - Overlay options
 * @param {string} options.imageUrl - URL of image to display
 * @param {Array<string>} options.tags - Initial tags to display
 * @param {string} options.pageUrl - Current page URL
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
  
  // Extract options
  const {
    imageUrl = null,
    mediaType = 'image',
    tags = [],
    pageUrl = window.location.href,
    onSave = () => {},
    onCancel = () => {}
  } = options;
  
  // Create the overlay container 
  const overlay = document.createElement('div');
  overlay.className = 'tag-saver-extension-overlay';
  
  // Force some basic styling to ensure visibility
  overlay.style.cssText = "position: fixed; top: 0; left: 0; right: 0; bottom: 0; z-index: 999999990; display: flex; align-items: center; justify-content: center; background: rgba(0, 0, 0, 0.5);";
  
  // Create floating image preview if we have an image
  if (imageUrl) {
    const imagePreview = document.createElement('div');
    imagePreview.className = 'ts-floating-image-preview';
    
    if (mediaType === 'video' || mediaType === 'gif') {
      // First show placeholder while loading
      imagePreview.innerHTML = `
        <div class="media-placeholder ${mediaType}-placeholder">
          <div class="media-icon">${mediaType === 'video' ? '🎬' : 'GIF'}</div>
          <div class="media-text">${mediaType === 'video' ? 'Loading Video Preview...' : 'Loading GIF Preview...'}</div>
        </div>
      `;
      
      // Position placeholder immediately
      requestAnimationFrame(() => {
        positionImagePreview(imagePreview, overlayContent);
        imagePreviewElement.style.opacity = '1';
      });
      
      // Try to extract first frame
      try {
        window.TagSaver.Hash.extractVideoFirstFrame(imageUrl)
          .then(result => {
            // Only proceed if preview still exists
            if (imagePreviewElement && document.body.contains(imagePreviewElement)) {
              imagePreview.innerHTML = `<img src="${result.dataUrl}" alt="${mediaType} preview">`;
              // No need to reposition - already positioned with placeholder
            }
          })
          .catch(error => {
            console.error(`Failed to extract ${mediaType} frame:`, error);
            // Placeholder already showing, no need to update
          });
      } catch (error) {
        console.error(`Error setting up ${mediaType} preview:`, error);
        // Placeholder already showing, no need to update
      }
    } else {
      // Regular image
      imagePreview.innerHTML = `<img src="${imageUrl}" alt="Image to be saved">`;
      
      // Position after load or after timeout
      const img = imagePreview.querySelector('img');
      let positioned = false;
      
      if (img) {
        // Set up load event
        img.onload = () => {
          if (!positioned) {
            positioned = true;
            positionImagePreview(imagePreview, overlayContent);
            imagePreviewElement.style.opacity = '1';
          }
        };
        
        // Set up error handler
        img.onerror = () => {
          if (!positioned) {
            positioned = true;
            console.error("Failed to load image preview");
            positionImagePreview(imagePreview, overlayContent);
            imagePreviewElement.style.opacity = '1';
          }
        };
        
        // Fallback timeout in case neither event fires
        setTimeout(() => {
          if (!positioned) {
            positioned = true;
            positionImagePreview(imagePreview, overlayContent);
            imagePreviewElement.style.opacity = '1';
          }
        }, 3000);
      } else {
        // Fallback if img element not found
        positionImagePreview(imagePreview, overlayContent);
        imagePreviewElement.style.opacity = '1';
      }
    }
    
    document.body.appendChild(imagePreview);
    imagePreviewElement = imagePreview;
  }

  overlay.innerHTML = `
    <div class="overlay-content" style="width: 80%; max-width: 1000px; background: rgba(30, 30, 30, 0.85); padding: 20px; border-radius: 16px; color: white;">
      <div class="header">
        <div class="url-display">URL: <span id="current-url">${pageUrl}</span></div>
      </div>
    
      <div class="tag-input-container">
        <div id="tag-display" class="tag-display"></div>
        <input type="text" placeholder="Type a tag and press Enter to add..." id="tag-input" value=" " />
      </div>
    
      <!-- Pool Management UI -->
      <div class="pool-container">
        <div class="pool-header">
          <span class="pool-title">Image Pool</span>
          <div class="header-buttons">
            <button id="load-last-tags-id" class="memory-button" title="Load last saved tags and pool ID">🏷️</button>
            <button id="load-last-id" class="memory-button" title="Load last saved pool ID only">🆔</button>
            <button id="generate-pool-id" class="pool-button">Generate ID</button>
          </div>
        </div>
        <div class="pool-fields">
          <div class="pool-field-row">
            <label for="pool-id">Pool ID:</label>
            <input type="text" id="pool-id" placeholder="Enter or generate pool ID" />
          </div>
          <div class="pool-field-row">
            <label for="pool-index">Index:</label>
            <input type="number" id="pool-index" placeholder="Position in pool" min="0" value="0" />
          </div>
        </div>
      </div>
    
      <div class="shortcuts-hint">Press <kbd>Enter</kbd> to save or <kbd>Esc</kbd> to cancel</div>
    </div>
  `;
  
  document.body.appendChild(overlay);
  overlayElement = overlay;
  const overlayContent = overlay.querySelector('.overlay-content');
  
  const generatePoolIdButton = overlay.querySelector('#generate-pool-id');
  const poolIdInput = overlay.querySelector('#pool-id');
  const poolIndexInput = overlay.querySelector('#pool-index');
  const loadLastTagsIdButton = overlay.querySelector('#load-last-tags-id');
  const loadLastIdButton = overlay.querySelector('#load-last-id');

  // Focus the input - ensures cursor is after the space that's preloaded
  const input = overlay.querySelector('#tag-input');
  const tagDisplay = overlay.querySelector('#tag-display');

  // Memory button event listeners
  loadLastTagsIdButton.addEventListener('click', loadLastTagsAndId);
  loadLastIdButton.addEventListener('click', loadLastIdOnly);
  
  generatePoolIdButton.addEventListener('click', () => {
    // Generate a random string ID
    const randomId = Math.random().toString(36).substring(2, 10);
    poolIdInput.value = randomId;
    
    // When a new pool is created, default to index 0
    poolIndexInput.value = '0';
  });

  poolIdInput.addEventListener('change', async () => {
    if (!poolIdInput.value.trim()) return;
    
    // Show loading state
    poolIndexInput.placeholder = 'Loading...';
    poolIndexInput.disabled = true;
    
    try {
      console.log('🔄 Fetching pool index...');
      const startTime = performance.now();
      
      // Get the highest index in this pool
      const result = await browser.runtime.sendMessage({
        action: 'get-pool-highest-index',
        poolId: poolIdInput.value.trim()
      });
      
      const duration = performance.now() - startTime;
      console.log(`📊 Pool index fetched in ${duration.toFixed(1)}ms`);
      
      // Set next available index
      if (result.success && result.highestIndex !== null) {
        poolIndexInput.value = result.highestIndex + 1;
      } else {
        // Default to 0 for a new pool
        poolIndexInput.value = '0';
      }
    } catch (error) {
      console.error('Error getting pool index:', error);
      poolIndexInput.value = '0';
    } finally {
      poolIndexInput.placeholder = 'Position in pool';
      poolIndexInput.disabled = false;
    }
  });

  if (input) {
    setTimeout(() => input.focus(), 50);
  } else {
    console.error("Input field not found!");
  }
  
  // Set up the tag display (UPDATED SECTION)
  if (tagDisplay) {
    // 🔥 FIXED: Provide proper callbacks for tag functionality
    TagPills.renderTagPills(
      tags, 
      tagDisplay,
      // onDeleteTag callback
      (deletedTag) => {
        console.log(`Tag deleted: ${deletedTag}`);
      },
      // onCategoryChange callback  
      (oldTag, newTag, newCategory) => {
        console.log(`Tag category changed: ${oldTag} -> ${newTag}`);
      }
    );
  } else {
    console.error("Tag display not found!");
  }
  
  // Create autocomplete dropdown
  const autocompleteDropdown = document.createElement('div');
  autocompleteDropdown.className = 'tag-autocomplete-dropdown';
  autocompleteDropdown.style.display = 'none';
  
  // Add it after the input field in the container
  input.parentNode.appendChild(autocompleteDropdown);
  
  // Track selected item in dropdown
  let selectedIndex = -1;
  
  // Position the image preview above the overlay
  if (imagePreviewElement) {
    setTimeout(() => {
      const overlayContent = document.querySelector('.overlay-content');
      if (overlayContent && imagePreviewElement) {
        const overlayRect = overlayContent.getBoundingClientRect();
        imagePreviewElement.style.bottom = (window.innerHeight - overlayRect.top + 10) + 'px';
        imagePreviewElement.style.left = (overlayRect.left + (overlayRect.width / 2) - (imagePreviewElement.offsetWidth / 2)) + 'px';
      }
    }, 50);
  }
  
  // Save function
  function saveData() {
    // Get tags from the display pills
    if (!tagDisplay) {
      console.error("Tag display not found when saving!");
      return;
    }
    
    const displayTags = TagPills.getCurrentTagsFromDisplay(tagDisplay);
    
    // Get pool data only if pool ID is provided
    const poolData = poolIdInput.value.trim() ? {
      poolId: poolIdInput.value.trim(),
      poolIndex: parseInt(poolIndexInput.value, 10) || 0
    } : null;
    
    // Remove the floating image preview if it exists
    hideImagePreview();
    
    // Close overlay with animation
    closeOverlay();
    
    // Call the save callback with pool data
    onSave(displayTags, poolData);
  }

  // Handle autocomplete suggestions
  async function updateAutocompleteSuggestions() {
    const query = input.value.trim();
    
    if (query.length < 2) {
      autocompleteDropdown.style.display = 'none';
      selectedIndex = -1;
      return;
    }
    
    // Check local cache first
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
      
      // Request tag suggestions from background script
      const suggestions = await browser.runtime.sendMessage({
        action: 'search-tags',
        query: query
      });
      
      const duration = performance.now() - startTime;
      console.log(`📊 Search completed in ${duration.toFixed(1)}ms`);
      
      if (suggestions && suggestions.length > 0) {
        // Cache the result locally
        autocompleteCache.set(cacheKey, {
          data: suggestions,
          timestamp: Date.now()
        });
        
        renderSuggestions(suggestions);
      } else {
        autocompleteDropdown.style.display = 'none';
        selectedIndex = -1;
      }
    } catch (error) {
      console.error('Autocomplete error:', error);
      autocompleteDropdown.style.display = 'none';
    }
  }
  
  // Add this helper function to overlay.js:
  function renderSuggestions(suggestions) {
    autocompleteDropdown.innerHTML = '';
    
    suggestions.forEach(tag => {
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
        <span class="tag-name">${displayText}</span>
        <span class="autocomplete-category">${category}</span>
      `;
      
      // Add click handler to select tag
      item.addEventListener('click', () => {
        selectTag(tag);
      });
      
      autocompleteDropdown.appendChild(item);
    });
    
    autocompleteDropdown.style.display = 'block';
    selectedIndex = -1;
  }

  // Debounce function to limit API calls
  function debounce(func, wait) {
    let timeout;
    return function() {
      const context = this;
      const args = arguments;
      clearTimeout(timeout);
      timeout = setTimeout(() => func.apply(context, args), wait);
    };
  }
  
  // Create debounced version of updateAutocompleteSuggestions
  const debouncedUpdateSuggestions = debounce(updateAutocompleteSuggestions, 200);
  
  // Select a tag from autocomplete
  function selectTag(tag) {
    // Get existing tags
    const existingTags = TagPills.getCurrentTagsFromDisplay(tagDisplay);
    
    // Only add if not already there
    if (!existingTags.includes(tag)) {
      // 🔥 FIXED: Use addTag with proper callbacks instead of re-rendering all
      TagPills.addTag(
        tag, 
        tagDisplay,
        // onDeleteTag callback
        (deletedTag) => {
          console.log(`Tag deleted: ${deletedTag}`);
        },
        // onCategoryChange callback
        (oldTag, newTag, newCategory) => {
          console.log(`Tag category changed: ${oldTag} -> ${newTag}`);
        }
      );
    }
    
    // Reset input and dropdown
    input.value = '';
    autocompleteDropdown.style.display = 'none';
    selectedIndex = -1;
    input.focus();
  }
  
  // Listen for input changes to trigger autocomplete
  input.addEventListener('input', debouncedUpdateSuggestions);
  
  // Handle keyboard events
  function handleKeydown(e) {
    // Autocomplete dropdown navigation
    if (autocompleteDropdown.style.display === 'block') {
      const items = autocompleteDropdown.querySelectorAll('.autocomplete-item');
      
      // Down arrow - move selection down
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        selectedIndex = (selectedIndex + 1) % items.length;
        highlightSelectedItem(items, selectedIndex);
      }
      
      // Up arrow - move selection up
      else if (e.key === 'ArrowUp') {
        e.preventDefault();
        selectedIndex = selectedIndex <= 0 ? items.length - 1 : selectedIndex - 1;
        highlightSelectedItem(items, selectedIndex);
      }
      
      // Tab or Enter with selection - select current item
      else if ((e.key === 'Tab' || e.key === 'Enter') && selectedIndex >= 0) {
        e.preventDefault();
        
        const selectedItem = items[selectedIndex];
        const tagName = selectedItem.querySelector('.tag-name').textContent;
        const category = selectedItem.querySelector('.autocomplete-category').textContent;
        
        const fullTag = category !== 'general' ? `${category}:${tagName}` : tagName;
        selectTag(fullTag);
        return;
      }
    }
    
    // Regular overlay keyboard shortcuts
    if (e.key === 'Escape') {
      // Remove the floating image preview if it exists
      hideImagePreview();
      
      // Close overlay
      closeOverlay();
      
      // Call the cancel callback
      onCancel();
    } else if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      
      // If dropdown is visible but no selection, hide it
      if (autocompleteDropdown.style.display === 'block' && selectedIndex === -1) {
        autocompleteDropdown.style.display = 'none';
      }
      // Check if this is to add a tag
      else if (input.value.trim()) {
        // Get current raw input - split by commas if multiple tags entered at once
        const newTags = input.value.trim().split(',').map(tag => tag.trim()).filter(tag => tag);
        
        // Get existing tags
        const existingTags = TagPills.getCurrentTagsFromDisplay(tagDisplay);
        
        // Add each new tag that doesn't already exist
        newTags.forEach(tag => {
          if (!existingTags.includes(tag)) {
            TagPills.addTag(
              tag, 
              tagDisplay,
              // onDeleteTag callback
              (deletedTag) => {
                console.log(`Tag deleted: ${deletedTag}`);
              },
              // onCategoryChange callback
              (oldTag, newTag, newCategory) => {
                console.log(`Tag category changed: ${oldTag} -> ${newTag}`);
              }
            );
          }
        });
        
        // Clear input field and add a space for next entry
        input.value = '';
        autocompleteDropdown.style.display = 'none';
      } else {
        // If input is empty, save the data
        saveData();
      }
    }
  }
  
  // Highlight selected autocomplete item
  function highlightSelectedItem(items, index) {
    items.forEach((item, i) => {
      item.classList.toggle('selected', i === index);
    });
    
    if (index >= 0) {
      items[index].scrollIntoView({ block: 'nearest' });
    }
  }
  
  // Store the listener reference so we can remove it later
  keydownListener = handleKeydown;
  
  // Add keyboard event listener
  document.addEventListener('keydown', keydownListener);
  
  // Close dropdown when clicking outside of it
  document.addEventListener('click', (e) => {
    if (!autocompleteDropdown.contains(e.target) && e.target !== input) {
      autocompleteDropdown.style.display = 'none';
      selectedIndex = -1;
    }
  });
  
  // Close overlay when clicking outside
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) {
      // Remove the floating image preview if it exists
      hideImagePreview();
      
      // Close overlay
      closeOverlay();
      
      // Call the cancel callback
      onCancel();
    }
  });
  
  return overlay;
}

  /**
   * Close the overlay if it's open
   */
  function closeOverlay() {
    console.log("closeOverlay called, overlayElement exists:", !!overlayElement);
    
    if (overlayElement) {
      // Remove event listener
      if (keydownListener) {
        console.log("Removing keyboard event listener");
        document.removeEventListener('keydown', keydownListener);
        keydownListener = null;
      }
      
      // Animate out
      overlayElement.style.opacity = 0;
      overlayElement.style.transform = 'translateY(-10px)';
      
      // Remove after animation
      setTimeout(() => {
        console.log("Removing overlay from DOM");
        overlayElement.remove();
        overlayElement = null;
      }, 200);
    }
  }

  /**
   * Hide and remove image preview if it exists
   */
  function hideImagePreview() {
    console.log("hideImagePreview called, imagePreviewElement exists:", !!imagePreviewElement);
    
    if (imagePreviewElement) {
      imagePreviewElement.style.opacity = 0;
      setTimeout(() => {
        console.log("Removing image preview from DOM");
        imagePreviewElement.remove();
        imagePreviewElement = null;
      }, 200);
    }
  }

  /**
   * Check if overlay is currently open
   * @returns {boolean} - Whether overlay is open
   */
  function isOverlayOpen() {
    return overlayElement !== null;
  }

    /**
   * Show a duplicate warning in the overlay
   * @param {Object} originalRecord - The original record that was found as a duplicate
   * @param {boolean} exactMatch - Whether this is an exact match or just similar
   */
    function showDuplicateWarning(originalRecord, exactMatch) {
      console.log("Showing duplicate warning", originalRecord, exactMatch);
      
      if (!overlayElement) {
        console.error("Cannot show duplicate warning - overlay not active");
        return;
      }
      
      // Check if warning already exists and remove it
      const existingWarning = overlayElement.querySelector('.duplicate-warning');
      if (existingWarning) {
        existingWarning.remove();
      }
      
      const warningContainer = document.createElement('div');
      warningContainer.className = 'duplicate-warning';
      
      const warningMessage = exactMatch ? 
        'This image appears to be an exact duplicate of one you already saved!' :
        'This image appears to be very similar to one you already saved!';
      
      const warningDate = new Date(originalRecord.timestamp).toLocaleString();
      
      warningContainer.innerHTML = `
        <div class="warning-icon">⚠️</div>
        <div class="warning-message">
          <strong>${warningMessage}</strong>
          <p>Previously saved on ${warningDate}</p>
          <div class="warning-tags">
            Tags: ${originalRecord.tags.slice(0, 5).join(', ')}${originalRecord.tags.length > 5 ? '...' : ''}
          </div>
        </div>
        <div class="warning-actions">
          <button class="warning-action save-anyway">Save Anyway</button>
          <button class="warning-action cancel">Cancel</button>
        </div>
      `;
      
      overlayElement.querySelector('.overlay-content').prepend(warningContainer);
      
      // Add event listeners
      warningContainer.querySelector('.save-anyway').addEventListener('click', () => {
        warningContainer.remove();
      });
      
      warningContainer.querySelector('.cancel').addEventListener('click', () => {
        closeOverlay();
      });
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