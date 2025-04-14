// Initialize global namespace
window.TagSaver = window.TagSaver || {};

// Initialize UI namespace
window.TagSaver.UI = (function() {
  /**
   * Initialize all UI components
   */
  function initUI() {
    // Initialize each component
    window.TagSaver.UI.Toast.initToast();
    window.TagSaver.UI.TagPills.initTagPills();
    window.TagSaver.UI.ImageSelector.initImageSelector();
    window.TagSaver.UI.Overlay.initOverlay();
  }

  // Public API
  return {
    initUI,
    // Include references to sub-components for easy access
    Styles: window.TagSaver.UI.Styles,
    Toast: window.TagSaver.UI.Toast,
    TagPills: window.TagSaver.UI.TagPills,
    ImageSelector: window.TagSaver.UI.ImageSelector,
    Overlay: window.TagSaver.UI.Overlay
  };
})();