// Global variables
let currentTags = [];
let currentImageUrl = null;
let currentPageUrl = null;

// State tracking variables for smart overlay functionality
let overlayActivatedOnce = false;
let isOverlayOpen = false;

// Extract tags and images based on the current website
function extractPageContent() {
  currentPageUrl = window.location.href;
  currentTags = [];
  currentImageUrl = null;
  
  // Twitter detection
  if (currentPageUrl.includes('twitter.com') || currentPageUrl.includes('x.com')) {
    // Extract hashtags from tweets
    const tweetText = document.querySelector('article')?.textContent || '';
    const hashtags = tweetText.match(/#\w+/g) || [];
    currentTags = hashtags.map(tag => tag.substring(1)); // Remove # symbol
    
    // Get the main image if present
    const tweetImage = document.querySelector('article img[src*="https"]');
    if (tweetImage) {
      currentImageUrl = tweetImage.src;
    }
  } 
  // Danbooru detection
  else if (currentPageUrl.includes('danbooru.donmai.us')) {
    // Extract tags with their categories from tag-list
    const tagContainers = document.querySelectorAll('#tag-list .tag-type-1, #tag-list .tag-type-3, #tag-list .tag-type-4, #tag-list .tag-type-0, #tag-list .tag-type-5');
    
    tagContainers.forEach(container => {
      // Get category based on class
      let category = '';
      if (container.classList.contains('tag-type-1')) category = 'artist';
      else if (container.classList.contains('tag-type-3')) category = 'copyright';
      else if (container.classList.contains('tag-type-4')) category = 'character';
      else if (container.classList.contains('tag-type-0')) category = 'general';
      else if (container.classList.contains('tag-type-5')) category = 'meta';
      
      // Get the tag name
      const tagElement = container.querySelector('.search-tag');
      if (tagElement) {
        const tagName = tagElement.textContent.trim();
        // Format as category:tag
        currentTags.push(`${category}:${tagName}`);
      }
    });
    
    // Get main image
    const mainImage = document.querySelector('#image');
    if (mainImage) {
      currentImageUrl = mainImage.src;
    }
  }
  // Gelbooru detection
  else if (currentPageUrl.includes('gelbooru.com')) {
    // Extract tags with their categories
    const tagElements = document.querySelectorAll('#tag-list li');
    tagElements.forEach(el => {
      let category = '';
      if (el.classList.contains('tag-type-artist')) category = 'artist';
      else if (el.classList.contains('tag-type-copyright')) category = 'copyright';
      else if (el.classList.contains('tag-type-character')) category = 'character';
      else if (el.classList.contains('tag-type-general')) category = 'general';
      else if (el.classList.contains('tag-type-metadata')) category = 'meta';
      
      const tagName = el.textContent.trim();
      currentTags.push(`${category}:${tagName}`);
    });
    
    // Get main image
    const mainImage = document.querySelector('#image');
    if (mainImage) {
      currentImageUrl = mainImage.src;
    }
  }
  // Add more website-specific extraction logic here
  
  console.log("Extracted tags:", currentTags);
  console.log("Extracted image URL:", currentImageUrl);
  
  return {
    tags: currentTags,
    imageUrl: currentImageUrl,
    pageUrl: currentPageUrl
  };
}

// Check if the current site is supported for auto-extraction
function checkIfSupportedSite(url) {
  return (
    url.includes('twitter.com') || 
    url.includes('x.com') || 
    url.includes('danbooru.donmai.us') ||
    url.includes('gelbooru.com')
    // Add other supported sites here
  );
}

function handleSmartOverlay() {
  // Get current site info
  const url = window.location.href;
  const isSupportedSite = checkIfSupportedSite(url);
  
  // Case 1: Overlay is already open - close it
  if (isOverlayOpen) {
    // This will be handled by the Escape key event in the overlay
    return;
  }
  
  // Case 2: First activation on supported site - show overlay with tags
  if (isSupportedSite && !overlayActivatedOnce) {
    overlayActivatedOnce = true;
    isOverlayOpen = true;
    createOverlay();
    return;
  }
  
  // Case 3: Second activation on supported site OR any activation on unsupported site
  // - Show image selection mode
  overlayActivatedOnce = true;
  startImageSelectionMode();
}

// Create and show the overlay
function createOverlay() {
  // Track that overlay is now open
  isOverlayOpen = true;
  
  // Extract content first
  const selectedImageUrl = currentImageUrl;
  const extractedContent = extractPageContent();
  if (selectedImageUrl) {
    currentImageUrl = selectedImageUrl;
  }
  // Create the overlay container
  const overlay = document.createElement('div');
  overlay.className = 'tag-saver-extension-overlay';
  
  // We'll use the tag pills instead of prefilling the input
  
  // Create floating image preview if we have an image (either from supported site or user selection)
  if (extractedContent.imageUrl || currentImageUrl) {
    // Use the user-selected image if available, otherwise use the extracted one
    const imageToShow = currentImageUrl || extractedContent.imageUrl;
    
    const imagePreview = document.createElement('div');
    imagePreview.className = 'ts-floating-image-preview';
    imagePreview.innerHTML = `<img src="${imageToShow}" alt="Image to be saved">`;
    document.body.appendChild(imagePreview);
    
    // Position the image preview above where the overlay will appear
    setTimeout(() => {
      const overlayContent = document.querySelector('.overlay-content');
      if (overlayContent && imagePreview) {
        const overlayRect = overlayContent.getBoundingClientRect();
        imagePreview.style.bottom = (window.innerHeight - overlayRect.top + 10) + 'px';
        imagePreview.style.left = (overlayRect.left + (overlayRect.width / 2) - (imagePreview.offsetWidth / 2)) + 'px';
      }
    }, 10);
  }

  overlay.innerHTML = `
    <div class="overlay-content">
      <div class="header">
        <div class="url-display">URL: <span id="current-url">${extractedContent.pageUrl}</span></div>
      </div>
      
      <div class="tag-input-container">
        <div id="tag-display" class="tag-display"></div>
        <input type="text" placeholder="Type a tag and press Enter to add..." id="tag-input" value=" " />
      </div>
      
      <div class="shortcuts-hint">Press <kbd>Enter</kbd> to save or <kbd>Esc</kbd> to cancel</div>
    </div>
  `;
  
  // Add styles
  const style = document.createElement('style');
  style.textContent = `
    .tag-saver-extension-overlay {
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      z-index: 999999990;
      display: flex;
      align-items: center;
      justify-content: center;
      background: rgba(0, 0, 0, 0.5);
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    }
    
    .overlay-content {
      width: 1000px;
      max-width: 90vw;
      background: rgba(30, 30, 30, 0.85);
      backdrop-filter: blur(12px);
      -webkit-backdrop-filter: blur(12px);
      padding: 20px;
      border-radius: 16px;
      color: white;
      box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3);
      border: 1px solid rgba(255, 255, 255, 0.1);
      animation: ts-fadeIn 0.2s ease-out;
    }
    
    @keyframes ts-fadeIn {
      from { opacity: 0; transform: translateY(-10px); }
      to { opacity: 1; transform: translateY(0); }
    }
    
    .url-display {
      font-size: 13px;
      color: rgba(255, 255, 255, 0.7);
      margin-bottom: 12px;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    
    /* Floating image preview that appears above the overlay */
    .ts-floating-image-preview {
      position: fixed;
      z-index: 999999995;
      max-width: 300px;
      max-height: 300px;
      overflow: hidden;
      border-radius: 8px;
      background: rgba(0, 0, 0, 0.7);
      box-shadow: 0 8px 24px rgba(0, 0, 0, 0.4);
      padding: 4px;
      transition: all 0.3s ease;
      animation: ts-fadeIn 0.3s ease-out;
      pointer-events: none; /* Allow clicks to pass through */
    }
    
    .ts-floating-image-preview img {
      max-width: 100%;
      max-height: 280px;
      object-fit: contain;
      border-radius: 6px;
    }
    
    .tag-input-container {
      position: relative;
    }
    
    .tag-display {
      padding: 10px;
      min-height: 30px;
      max-height: 200px;
      overflow-y: auto;
      margin-bottom: 15px;
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
      background: rgba(0, 0, 0, 0.2);
      border-radius: 8px;
    }
    
    .tag-pill {
      display: inline-flex;
      align-items: center;
      padding: 5px 10px;
      border-radius: 4px;
      font-size: 13px;
      white-space: nowrap;
      box-shadow: 0 1px 3px rgba(0, 0, 0, 0.2);
      transition: transform 0.1s ease;
    }
    
    .tag-pill:hover {
      transform: translateY(-1px);
    }
    
    .tag-artist {
      background-color: rgba(255, 117, 117, 0.7);  /* Red for artists */
    }
    
    .tag-character {
      background-color: rgba(121, 187, 255, 0.7);  /* Blue for characters */
    }
    
    .tag-copyright {
      background-color: rgba(179, 136, 255, 0.7);  /* Purple for copyrights */
    }
    
    .tag-general {
      background-color: rgba(153, 153, 153, 0.7);  /* Gray for general tags */
    }
    
    .tag-meta {
      background-color: rgba(251, 192, 45, 0.7);  /* Yellow for meta tags */
    }
    
    .tag-default {
      background-color: rgba(153, 153, 153, 0.7);  /* Default gray */
    }
    
    .tag-delete {
      cursor: pointer;
      margin-left: 5px;
      color: rgba(255, 255, 255, 0.7);
    }
    
    .tag-delete:hover {
      color: white;
    }
    
    #tag-input {
      width: 100%;
      padding: 12px 16px;
      background: rgba(255, 255, 255, 0.1);
      border: 1px solid rgba(255, 255, 255, 0.15);
      color: white;
      border-radius: 10px;
      outline: none;
      font-size: 15px;
      transition: all 0.2s ease;
      box-sizing: border-box;
    }
    
    #tag-input:focus {
      background: rgba(255, 255, 255, 0.15);
      border-color: rgba(255, 255, 255, 0.3);
    }
    
    .shortcuts-hint {
      font-size: 11px;
      color: rgba(255, 255, 255, 0.5);
      margin-top: 12px;
      text-align: center;
    }
    
    kbd {
      background: rgba(255, 255, 255, 0.15);
      border-radius: 4px;
      padding: 2px 5px;
      font-family: monospace;
      font-size: 10px;
    }
    
    /* Toast notification */
    .ts-toast {
      position: fixed;
      bottom: 20px;
      right: 20px;
      background: rgba(40, 167, 69, 0.9);
      color: white;
      padding: 12px 20px;
      border-radius: 8px;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
      z-index: 9999999999;
      font-size: 14px;
      animation: ts-slideIn 0.3s ease-out;
    }
    
    .ts-toast.error {
      background: rgba(220, 53, 69, 0.9);
    }
    
    @keyframes ts-slideIn {
      from { transform: translateX(100%); opacity: 0; }
      to { transform: translateX(0); opacity: 1; }
    }
  `;
  
  document.body.appendChild(style);
  document.body.appendChild(overlay);
  
  // Focus the input - ensures cursor is after the space that's preloaded
  const input = overlay.querySelector('#tag-input');
  input.focus();
  
  // Set up the tag display
  renderTagPills(extractedContent.tags);
  
  // Save function
  function saveData() {
    // Get tags from the display pills
    const displayTags = getCurrentTagsFromDisplay();
    const tags = displayTags;
    
    // Send data to background script for saving
    browser.runtime.sendMessage({
      action: "save-data",
      data: {
        url: currentPageUrl,
        tags: tags,
        imageUrl: currentImageUrl,
        timestamp: new Date().toISOString()
      }
    }).then(response => {
      if (response && response.success) {
        showToast("Content saved successfully!");
      } else {
        showToast("Error saving content", true);
      }
    }).catch(error => {
      console.error("Error saving:", error);
      showToast("Error saving content", true);
    });
    
    // Remove the floating image preview if it exists
    const imagePreview = document.querySelector('.ts-floating-image-preview');
    if (imagePreview) {
      imagePreview.style.opacity = 0;
      setTimeout(() => {
        imagePreview.remove();
      }, 200);
    }
    
    // Close overlay with animation
    overlay.style.opacity = 0;
    overlay.style.transform = 'translateY(-10px)';
    setTimeout(() => {
      overlay.remove();
      style.remove();
    }, 200);
  }
  
  // Get all tags from the display
  function getCurrentTagsFromDisplay() {
    const tagPills = document.querySelectorAll('.tag-pill');
    return Array.from(tagPills).map(pill => pill.getAttribute('data-tag'));
  }
  
  // Render tag pills
  function renderTagPills(tags) {
    const tagDisplay = document.getElementById('tag-display');
    tagDisplay.innerHTML = ''; // Clear existing tags
    
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
      });
      
      tagDisplay.appendChild(pill);
    });
  }
  
  // Handle keyboard events
  document.addEventListener('keydown', function handleKeydown(e) {
    if (e.key === 'Escape') {
      // Remove the floating image preview if it exists
      const imagePreview = document.querySelector('.ts-floating-image-preview');
      if (imagePreview) {
        imagePreview.remove();
      }
      
      overlay.remove();
      style.remove();
      document.removeEventListener('keydown', handleKeydown);
      
      // Reset state
      isOverlayOpen = false;
      overlayActivatedOnce = false;
    } else if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      
      // Check if this is to add a tag
      if (input.value.trim()) {
        // Get current raw input - split by commas if multiple tags entered at once
        const newTags = input.value.trim().split(',').map(tag => tag.trim()).filter(tag => tag);
        
        // Get existing tags
        const existingTags = getCurrentTagsFromDisplay();
        
        // Combine existing and new tags
        const allTags = [...existingTags, ...newTags];
        
        // Render the tag pills
        renderTagPills(allTags);
        
        // Clear input field and add a space for next entry
        input.value = ' ';
      } else {
        // If input is empty, save the data
        saveData();
        document.removeEventListener('keydown', handleKeydown);
        
        // Reset state
        isOverlayOpen = false;
        overlayActivatedOnce = false;
      }
    }
  });
  
  // Close when clicking outside
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) {
      // Remove the floating image preview if it exists
      const imagePreview = document.querySelector('.ts-floating-image-preview');
      if (imagePreview) {
        imagePreview.remove();
      }
      
      overlay.remove();
      style.remove();
      
      // Reset state
      isOverlayOpen = false;
      overlayActivatedOnce = false;
    }
  });
}

// Start image selection mode
function startImageSelectionMode() {
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
  showToast('Image selection mode active. Click on any image to select it.', false);
  
  // Handle save button
  toolbar.querySelector('.save-btn').addEventListener('click', () => {
    // We already have the currentImageUrl set from handleImageClick
    
    // Hide toolbar with animation
    toolbar.classList.remove('active');
    setTimeout(() => {
      toolbar.remove();
    }, 300);
    
    // Deactivate selection mode
    deactivateImageSelection();
    
    // Show the tag input overlay
    isOverlayOpen = true;
    createOverlay();
  });
  
  // Handle cancel button
  toolbar.querySelector('.cancel').addEventListener('click', () => {
    toolbar.classList.remove('active');
    setTimeout(() => {
      toolbar.remove();
    }, 300);
    
    deactivateImageSelection();
    overlayActivatedOnce = false; // Reset state
  });
}

// Function to show toast notifications
function showToast(message, isError = false) {
  const toast = document.createElement('div');
  toast.className = isError ? 'ts-toast error' : 'ts-toast';
  toast.textContent = message;
  document.body.appendChild(toast);
  
  setTimeout(() => {
    toast.style.opacity = 0;
    setTimeout(() => toast.remove(), 300);
  }, 3000);
}

function setupImageSelection() {
  // Add styles for selectable images
  const style = document.createElement('style');
  style.textContent = `
    .ts-selectable-image {
      position: relative;
      cursor: pointer;
    }
    
    .ts-selectable-image:hover::after {
      content: "";
      position: absolute;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      border: 3px solid #4285f4;
      background-color: rgba(66, 133, 244, 0.2);
      z-index: 9999;
      pointer-events: none;
    }
    
    .ts-selectable-image:hover::before {
      content: "Click to select";
      position: absolute;
      top: 10px;
      left: 10px;
      background-color: rgba(0, 0, 0, 0.7);
      color: white;
      padding: 5px 10px;
      border-radius: 4px;
      font-size: 12px;
      z-index: 10000;
      pointer-events: none;
    }
    
    .ts-selected-image {
      border: 3px solid #0f9d58 !important;
    }
    
    .ts-selected-image::after {
      border-color: #0f9d58 !important;
      background-color: rgba(15, 157, 88, 0.2) !important;
    }
    
    .ts-selected-image::before {
      content: "✓ Selected" !important;
      background-color: rgba(15, 157, 88, 0.8) !important;
    }
    
    .ts-selection-toolbar {
      position: fixed;
      bottom: 20px;
      right: 20px;
      background-color: rgba(33, 33, 33, 0.9);
      color: white;
      border-radius: 8px;
      padding: 10px 15px;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
      z-index: 999999;
      display: flex;
      align-items: center;
      gap: 10px;
      transition: opacity 0.3s ease;
      opacity: 0;
    }
    
    .ts-selection-toolbar.active {
      opacity: 1;
    }
    
    .ts-toolbar-button {
      background-color: #4285f4;
      color: white;
      border: none;
      border-radius: 4px;
      padding: 5px 10px;
      font-size: 12px;
      cursor: pointer;
      transition: background-color 0.2s ease;
    }
    
    .ts-toolbar-button:hover {
      background-color: #5c9aff;
    }
    
    .ts-toolbar-button.cancel {
      background-color: transparent;
      border: 1px solid rgba(255, 255, 255, 0.3);
    }
    
    .ts-toolbar-button.cancel:hover {
      background-color: rgba(255, 255, 255, 0.1);
    }
    
    .ts-thumbnail {
      width: 40px;
      height: 40px;
      border-radius: 4px;
      object-fit: cover;
      border: 1px solid rgba(255, 255, 255, 0.2);
    }
  `;
  document.head.appendChild(style);
}

// Add selection capabilities to all images on the page
function activateImageSelection() {
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

// Remove selection capabilities
function deactivateImageSelection() {
  const images = document.querySelectorAll('.ts-selectable-image');
  
  images.forEach(img => {
    img.classList.remove('ts-selectable-image', 'ts-selected-image');
    img.removeEventListener('click', handleImageClick);
  });
}

// Handle image click during selection mode
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
  
  // Store the selected image globally
  currentImageUrl = this.src;
  
  // Show a brief confirmation
  showToast('Image selected! Click "Save with Tags" to continue.', false);
  
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

// Initialize extension
function init() {
  setupImageSelection();
  
  // Add keyboard shortcut for Ctrl+Shift+U directly
  document.addEventListener('keydown', (e) => {
    if (e.ctrlKey && e.shiftKey && e.key === 'U') {
      handleSmartOverlay();
    }
  });
}

// Listen for messages from background script
browser.runtime.onMessage.addListener((message) => {
  if (message.action === "show-overlay") {
    // Use our smart function instead of direct overlay creation
    handleSmartOverlay();
    return Promise.resolve({success: true});
  }
  else if (message.action === "show-overlay-with-image") {
    // Direct image selection from context menu
    currentImageUrl = message.imageUrl;
    isOverlayOpen = true;
    createOverlay();
    return Promise.resolve({success: true});
  }
  else if (message.action === "start-selection-mode") {
    startImageSelectionMode();
    return Promise.resolve({success: true});
  }
});


// Initialize when page loads
init();