// Global variables
let currentTags = [];
let currentImageUrl = null;
let currentPageUrl = null;

// State tracking variables for smart overlay functionality
let overlayActivatedOnce = false;
let isOverlayOpen = false;

// Initialize the extension
function init() {
  // Ensure all namespaces exist
  window.TagSaver = window.TagSaver || {};
  window.TagSaver.UI = window.TagSaver.UI || {};
  window.TagSaver.Extractors = window.TagSaver.Extractors || {};
  
  // Initialize UI components in correct order
  if (window.TagSaver.UI.Styles)                                                              window.TagSaver.UI.Styles.injectStyles(window.TagSaver.UI.Styles.getAllStyles());
  if (window.TagSaver.UI.Toast && window.TagSaver.UI.Toast.initToast)                         window.TagSaver.UI.Toast.initToast();
  if (window.TagSaver.UI.TagPills && window.TagSaver.UI.TagPills.initTagPills)                window.TagSaver.UI.TagPills.initTagPills();
  if (window.TagSaver.UI.ImageSelector && window.TagSaver.UI.ImageSelector.initImageSelector) window.TagSaver.UI.ImageSelector.initImageSelector();
  if (window.TagSaver.UI.Overlay && window.TagSaver.UI.Overlay.initOverlay)                   window.TagSaver.UI.Overlay.initOverlay();
  
  // Add keyboard shortcut after all components are ready
  document.addEventListener('keydown', (e) => {
    if (e.ctrlKey && e.shiftKey && e.key === 'U') handleSmartOverlay();
  });    
  
  // Console log
  console.log("Extension initialization complete.");
}

// Namespace shortcuts for better readability
function getNamespaces() {
  return {
    Extractors: window.TagSaver.Extractors,
    UI: window.TagSaver.UI
  };
}

// Extract tags and images based on the current website
function extractPageContent() {
  const { Extractors } = getNamespaces();
  currentPageUrl = window.location.href;
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
  const { Extractors } = getNamespaces();
  return Extractors.isSupportedSite(url);
}

// Handle smart overlay logic
function handleSmartOverlay() {
  const { UI } = getNamespaces();
  
  // Get current site info
  const url = window.location.href;
  const isSupportedSite = checkIfSupportedSite(url);
  let wasOverlayOpen = false;
  
  // Case 1: Overlay is already open - close it
  if (isOverlayOpen) {
    UI.Overlay.closeOverlay();
    isOverlayOpen = false;
    wasOverlayOpen = true; // Track that we just closed an overlay
    UI.Overlay.hideImagePreview();
  }
  
  // Case 2: First activation on supported site - show overlay with tags
  if (isSupportedSite && !overlayActivatedOnce && !wasOverlayOpen) {
    overlayActivatedOnce = true;
    showContentOverlay();
    return;
  }
  
  // Case 3: Second activation on supported site OR any activation on unsupported site
  // - Show image selection mode
  overlayActivatedOnce = true;
  currentImageUrl = null;
  startImageSelection();
}

function showContentOverlay() {
  const { UI } = getNamespaces();
  
  // Get current page URL
  currentPageUrl = window.location.href;
  
  // Extract content from the page
  let extractedContent = { tags: [], imageUrl: null };
  if (checkIfSupportedSite(currentPageUrl)) {
    extractedContent = extractPageContent();
  }
  
  // If we have a selected image from the image selector, use that
  // Otherwise use the extracted image
  const imageToShow = currentImageUrl || extractedContent.imageUrl;
  currentTags = extractedContent.tags; // Only populated for supported sites
  
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
  const { UI } = getNamespaces();
  
  UI.ImageSelector.startImageSelectionMode((selectedImageUrl) => {
    currentImageUrl = selectedImageUrl;
    // Explicitly avoid extracting content for unsupported sites
    if (!checkIfSupportedSite(window.location.href)) {
      currentTags = []; // Reset tags for manual input
    }
    isOverlayOpen = true;
    showContentOverlay();
  });
}

function handleSave(tags, poolData = null) {
  const { UI } = getNamespaces();
  
  // Send data to background script for saving
  browser.runtime.sendMessage({
    action: "save-data",
    data: {
      url: currentPageUrl,
      tags: tags,
      imageUrl: currentImageUrl,
      timestamp: new Date().toISOString(),
      // Add pool data if provided
      ...(poolData && { 
        poolId: poolData.poolId,
        poolIndex: poolData.poolIndex
      })
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

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}