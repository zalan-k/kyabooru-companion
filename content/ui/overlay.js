/**
 * Overlay Component
 * Manages the tag input overlay UI
 */
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
    console.log("Creating overlay with options:", options);
    
    // Ensure styles are injected
    initOverlay();
    
    // First, clean up any existing overlay
    if (overlayElement) {
      closeOverlay();
    }
    
    // Extract options
    const {
      imageUrl = null,
      tags = [],
      pageUrl = window.location.href,
      onSave = () => {},
      onCancel = () => {}
    } = options;
    
    console.log("Creating overlay container");
    // Create the overlay container 
    const overlay = document.createElement('div');
    overlay.className = 'tag-saver-extension-overlay';
    
    // Force some basic styling to ensure visibility
    overlay.style.cssText = "position: fixed; top: 0; left: 0; right: 0; bottom: 0; z-index: 999999990; display: flex; align-items: center; justify-content: center; background: rgba(0, 0, 0, 0.5);";
    
    // Create floating image preview if we have an image
    if (imageUrl) {
      const imagePreview = document.createElement('div');
      imagePreview.className = 'ts-floating-image-preview';
      imagePreview.innerHTML = `<img src="${imageUrl}" alt="Image to be saved">`;
      imagePreview.style.opacity = '0'; // Start hidden
      document.body.appendChild(imagePreview);
      imagePreviewElement = imagePreview;
      const img = imagePreview.querySelector('img');
      img.onload = () => {
        requestAnimationFrame(() => {
          const overlayContent = document.querySelector('.overlay-content');
          if (overlayContent) {
            const overlayRect = overlayContent.getBoundingClientRect();
            imagePreviewElement.style.bottom = `${window.innerHeight - overlayRect.top + 10}px`;
            imagePreviewElement.style.left = `${overlayRect.left + (overlayRect.width/2) - (imagePreview.offsetWidth/2)}px`;
            imagePreviewElement.style.opacity = '1'; // Fade in after positioning
          }
        });
      };
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
        
        <div class="shortcuts-hint">Press <kbd>Enter</kbd> to save or <kbd>Esc</kbd> to cancel</div>
      </div>
    `;
    
    console.log("Appending overlay to DOM");
    document.body.appendChild(overlay);
    overlayElement = overlay;
    
    // Focus the input - ensures cursor is after the space that's preloaded
    const input = overlay.querySelector('#tag-input');
    if (input) {
      console.log("Focusing input field");
      setTimeout(() => input.focus(), 50);
    } else {
      console.error("Input field not found!");
    }
    
    // Set up the tag display
    const tagDisplay = overlay.querySelector('#tag-display');
    if (tagDisplay) {
      console.log("Rendering tag pills:", tags);
      TagPills.renderTagPills(tags, tagDisplay);
    } else {
      console.error("Tag display not found!");
    }
    
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
      console.log("Save function called");
      // Get tags from the display pills
      if (!tagDisplay) {
        console.error("Tag display not found when saving!");
        return;
      }
      
      const displayTags = TagPills.getCurrentTagsFromDisplay(tagDisplay);
      console.log("Saving tags:", displayTags);
      
      // Remove the floating image preview if it exists
      hideImagePreview();
      
      // Close overlay with animation
      closeOverlay();
      
      // Call the save callback
      onSave(displayTags);
    }
    
    // Handle keyboard events
    function handleKeydown(e) {
      console.log("Keyboard event:", e.key);
      
      if (e.key === 'Escape') {
        console.log("Escape key pressed");
        // Remove the floating image preview if it exists
        hideImagePreview();
        
        // Close overlay
        closeOverlay();
        
        // Call the cancel callback
        onCancel();
      } else if (e.key === 'Enter' && !e.shiftKey) {
        console.log("Enter key pressed");
        e.preventDefault();
        
        // Check if this is to add a tag
        if (input.value.trim()) {
          // Get current raw input - split by commas if multiple tags entered at once
          const newTags = input.value.trim().split(',').map(tag => tag.trim()).filter(tag => tag);
          
          // Get existing tags
          const existingTags = TagPills.getCurrentTagsFromDisplay(tagDisplay);
          
          // Combine existing and new tags
          const allTags = [...existingTags, ...newTags];
          
          // Render the tag pills
          TagPills.renderTagPills(allTags, tagDisplay);
          
          // Clear input field and add a space for next entry
          input.value = ' ';
        } else {
          // If input is empty, save the data
          saveData();
        }
      }
    }
    
    // Store the listener reference so we can remove it later
    keydownListener = handleKeydown;
    
    // Add keyboard event listener
    console.log("Adding keyboard event listener");
    document.addEventListener('keydown', keydownListener);
    
    // Close when clicking outside
    overlay.addEventListener('click', (e) => {
      console.log("Click on overlay", e.target === overlay);
      if (e.target === overlay) {
        console.log("Click outside content detected");
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

  return {
    initOverlay,
    createOverlay,
    closeOverlay,
    hideImagePreview,
    isOverlayOpen
  };
})();