// Global variables
let currentTags = [];
let currentImageUrl = null;
let currentPageUrl = null;

// State tracking variables for smart overlay functionality
let overlayActivatedOnce = false;
let isOverlayOpen = false;

// Namespace shortcuts for better readability
const Extractors = window.TagSaver.Extractors;
const UI = window.TagSaver.UI;

// Extract tags and images based on the current website
function extractPageContent() {
  currentPageUrl = window.location.href;
  
  // Use the extractors to get content
  const extractedContent = Extractors.extractPageContent(currentPageUrl);
  
  // Update global variables
  currentTags = extractedContent.tags;
  currentImageUrl = extractedContent.imageUrl;
  
  console.log("Extracted tags:", currentTags);
  console.log("Extracted image URL:", currentImageUrl);
  
  return extractedContent;
}

// Check if the current site is supported for auto-extraction
function checkIfSupportedSite(url) {
  return Extractors.isSupportedSite(url);
}

// Initialize the extension
function init() {
  // Initialize UI components
  UI.initUI();
  
  // Add keyboard shortcut for Ctrl+Shift+U directly
  document.addEventListener('keydown', (e) => {
    if (e.ctrlKey && e.shiftKey && e.key === 'U') {
      handleSmartOverlay();
    }
  });
}

// Handle smart overlay logic
function handleSmartOverlay() {
  // Get current site info
  const url = window.location.href;
  const isSupportedSite = checkIfSupportedSite(url);
  
  // Case 1: Overlay is already open - close it
  if (isOverlayOpen) {
    UI.Overlay.closeOverlay();
    isOverlayOpen = false;
    return;
  }
  
  // Case 2: First activation on supported site - show overlay with tags
  if (isSupportedSite && !overlayActivatedOnce) {
    overlayActivatedOnce = true;
    isOverlayOpen = true;
    showContentOverlay();
    return;
  }
  
  // Case 3: Second activation on supported site OR any activation on unsupported site
  // - Show image selection mode
  overlayActivatedOnce = true;
  startImageSelection();
}

// Show content overlay with extracted content
function showContentOverlay() {
  // Get current page URL
  currentPageUrl = window.location.href;
  
  // Extract content from the page
  const extractedContent = extractPageContent();
  
  // If we have a selected image from the image selector, use that
  // Otherwise use the extracted image
  const imageToShow = currentImageUrl || extractedContent.imageUrl;
  
  // Create and show the overlay
  isOverlayOpen = true;
  UI.Overlay.createOverlay({
    imageUrl: imageToShow,
    tags: currentTags,
    pageUrl: currentPageUrl,
    onSave: handleSave,
    onCancel: () => {
      isOverlayOpen = false;
      overlayActivatedOnce = false;
    }
  });
}

// Start image selection
function startImageSelection() {
  UI.ImageSelector.startImageSelectionMode((selectedImageUrl) => {
    // Store the selected image
    currentImageUrl = selectedImageUrl;
    
    // Show the tag input overlay
    isOverlayOpen = true;
    showContentOverlay();
  });
}

// Handle saving data
function handleSave(tags) {
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
      UI.Toast.showSuccess("Content saved successfully!");
    } else {
      UI.Toast.showError("Error saving content");
    }
  }).catch(error => {
    console.error("Error saving:", error);
    UI.Toast.showError("Error saving content");
  });
  
  // Reset state
  isOverlayOpen = false;
  overlayActivatedOnce = false;
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
    showContentOverlay();
    return Promise.resolve({success: true});
  }
  else if (message.action === "start-selection-mode") {
    startImageSelection();
    return Promise.resolve({success: true});
  }
});

// Initialize when page loads
init();