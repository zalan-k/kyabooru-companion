// Initialize global namespace
window.TagSaver = window.TagSaver || {};

// Initialize UI namespace
// Instead of replacing the namespace, we'll extend it
window.TagSaver.UI = window.TagSaver.UI || {};

// Add the initialization function to the existing namespace
(function() {
  /**
   * Initialize all UI components
   */
  function initUI() {
    // Initialize each component
    window.TagSaver.UI.Styles = window.TagSaver.UI.Styles || {};
    window.TagSaver.UI.Toast = window.TagSaver.UI.Toast || {};
    window.TagSaver.UI.TagPills = window.TagSaver.UI.TagPills || {};
    window.TagSaver.UI.ImageSelector = window.TagSaver.UI.ImageSelector || {};
    window.TagSaver.UI.Overlay = window.TagSaver.UI.Overlay || {};
    
    // Make sure all components are initialized
    if (window.TagSaver.UI.Toast.initToast) window.TagSaver.UI.Toast.initToast();
    if (window.TagSaver.UI.TagPills.initTagPills) window.TagSaver.UI.TagPills.initTagPills();
    if (window.TagSaver.UI.ImageSelector.initImageSelector) window.TagSaver.UI.ImageSelector.initImageSelector();
    if (window.TagSaver.UI.Overlay.initOverlay) window.TagSaver.UI.Overlay.initOverlay();
  }
  
  // Add the initUI function to the existing namespace
  window.TagSaver.UI.initUI = initUI;
})();