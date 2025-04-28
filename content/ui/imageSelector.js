/**
 * Image Selector Component
 * Handles selecting images from the current page
 */

window.TagSaver = window.TagSaver || {};
window.TagSaver.UI = window.TagSaver.UI || {};

window.TagSaver.UI.ImageSelector = (function() {
  // Create references to other UI components we need
  const Styles = window.TagSaver.UI.Styles;
  const Toast = window.TagSaver.UI.Toast;
  
  let styleElement = null;
  let isSelectionActive = false;
  let selectedImage = null;
  let onSelectCallback = null;
/**
 * Initialize the image selector
 */
  function initImageSelector() {
    if (!styleElement) {
      styleElement = Styles.injectStyles(Styles.imageSelectorStyles);
    }
  }

  /**
   * Handle image click during selection mode
   * @param {Event} e - Click event
   */
  function handleImageClick(e) {
    // Prevent default click behavior
    e.preventDefault();
    e.stopPropagation();
    
    // First, clear any previous selections
    const prevSelected = document.querySelector('.ts-selected-image');
    if (prevSelected) {
      prevSelected.classList.remove('ts-selected-image');
    }
    
    // Mark this image as selected
    this.classList.add('ts-selected-image');
    
    // Store the selected image
    selectedImage = this.src;
    
    // Show a brief confirmation
    Toast.showToast('Image selected! Click "Save with Tags" to continue.', false);
    
    // Update toolbar if it exists
    const toolbar = document.querySelector('.ts-selection-toolbar');
    if (toolbar) {
      const toolbarText = toolbar.querySelector('.ts-toolbar-text');
      const saveBtn = toolbar.querySelector('.save-btn');
      
      if (toolbarText && saveBtn) {
        let thumbnailHtml = `<img src="${this.src}" class="ts-thumbnail" alt="Selected image" />`;
        toolbarText.innerHTML = thumbnailHtml + 'Image selected';
        saveBtn.disabled = false;
      }
    }
  }

/**
 * Activate image selection mode
 */
function activateImageSelection() {
  // Ensure styles are injected
  initImageSelector();
  
  // Don't activate if already active
  if (isSelectionActive) return;
  
  isSelectionActive = true;
  
  const images = document.querySelectorAll('img');
  
  images.forEach(img => {
    // Skip tiny images, icons, etc. (likely UI elements)
    if (img.width < 60 || img.height < 60) return;
    
    // Add selection class
    img.classList.add('ts-selectable-image');
    
    // Add click handler for selection
    img.addEventListener('click', handleImageClick);
  });
}

/**
 * Deactivate image selection mode
 */
function deactivateImageSelection() {
  if (!isSelectionActive) return;
  
  isSelectionActive = false;
  
  const images = document.querySelectorAll('.ts-selectable-image');
  
  images.forEach(img => {
    img.classList.remove('ts-selectable-image', 'ts-selected-image');
    img.removeEventListener('click', handleImageClick);
  });
}

/**
 * Start image selection mode with toolbar
 * @param {Function} onSelect - Callback when image is selected and Save is clicked
 */
function startImageSelectionMode(onSelect) {
  // Set callback
  onSelectCallback = onSelect;
  
  // Check if selection mode is already active
  const existingToolbar = document.querySelector('.ts-selection-toolbar');
  if (existingToolbar) {
    // Selection mode is already active, don't create another instance
    return;
  }

  // Create toolbar and activate selection UI
  const toolbar = document.createElement('div');
  toolbar.className = 'ts-selection-toolbar';
  toolbar.innerHTML = `
    <div class="ts-toolbar-text">Click on any image to select it</div>
    <button class="ts-toolbar-button save-btn" disabled>Save with Tags</button>
    <button class="ts-toolbar-button cancel">Cancel</button>
  `;
  
  document.body.appendChild(toolbar);
  
  // Show the toolbar with animation
  setTimeout(() => {
    toolbar.classList.add('active');
  }, 10);
  
  // Activate image selection
  activateImageSelection();
  
  // Show toast notification
  Toast.showToast('Image selection mode active. Click on any image to select it.', false, 1000);
  
  // Handle save button
  toolbar.querySelector('.save-btn').addEventListener('click', () => {
    // Hide toolbar with animation
    toolbar.classList.remove('active');
    setTimeout(() => {
      toolbar.remove();
    }, 300);
    
    // Deactivate selection mode
    deactivateImageSelection();
    
    // Call the callback with the selected image
    if (onSelectCallback && selectedImage) {
      onSelectCallback(selectedImage);
    }
  });
  
  // Handle cancel button
  toolbar.querySelector('.cancel').addEventListener('click', () => {
    toolbar.classList.remove('active');
    setTimeout(() => {
      toolbar.remove();
    }, 300);
    
    deactivateImageSelection();
    selectedImage = null;
  });
}

/**
 * Get the current selected image
 * @returns {string|null} - URL of selected image or null
 */
function getSelectedImage() {
  return selectedImage;
}

/**
 * Set the current selected image directly
 * @param {string} imageUrl - Image URL to set
 */
function setSelectedImage(imageUrl) {
  selectedImage = imageUrl;
}

return {
  initImageSelector,
  activateImageSelection,
  deactivateImageSelection,
  startImageSelectionMode,
  getSelectedImage,
  setSelectedImage
};
})();