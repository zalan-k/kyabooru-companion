/**
 * UI Styles for Tag Saver Extension
 * Centralizes all CSS styles used in the UI components
 */
window.TagSaver = window.TagSaver || {};
window.TagSaver.UI = window.TagSaver.UI || {};

window.TagSaver.UI.Styles = (function() {
/**
 * Injects styles into the document head
 * @param {string} css - CSS string to inject
 * @returns {HTMLStyleElement} - The created style element
 */
function injectStyles(css) {
    const style = document.createElement('style');
    style.textContent = css;
    document.head.appendChild(style);
    return style;
  }
  
  /**
   * Removes injected styles
   * @param {HTMLStyleElement} styleElement - The style element to remove
   */
function removeStyles(styleElement) {
    if (styleElement && styleElement.parentNode) {
      styleElement.parentNode.removeChild(styleElement);
    }
  }
  
  /**
   * Common overlay styles
   */
  const overlayStyles = `
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
  `;
  
  /**
   * Tag input and display styles
   */
  const tagStyles = `
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
  `;
  
  /**
   * Image preview styles
   */
  const imagePreviewStyles = `
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
  `;
  
  /**
   * Image selection styles
   */
  const imageSelectorStyles = `
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
  
  /**
   * Toast notification styles
   */
  const toastStyles = `
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
  
  /**
   * Tag autocomplete styles
   */
  const autocompleteStyles = `
    .tag-autocomplete-dropdown {
      position: absolute;
      width: 100%;
      max-height: 200px;
      overflow-y: auto;
      background: rgba(45, 45, 45, 0.95);
      border: 1px solid rgba(255, 255, 255, 0.2);
      border-radius: 8px;
      margin-top: 5px;
      z-index: 999999995;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
    }
    
    .autocomplete-item {
      padding: 8px 12px;
      cursor: pointer;
      color: rgba(255, 255, 255, 0.9);
      transition: background 0.1s ease;
      display: flex;
      align-items: center;
      justify-content: space-between;
    }
    
    .autocomplete-item:hover,
    .autocomplete-item.selected {
      background: rgba(255, 255, 255, 0.1);
    }
    
    .autocomplete-category {
      color: rgba(255, 255, 255, 0.5);
      font-size: 11px;
      padding: 2px 5px;
      background: rgba(255, 255, 255, 0.1);
      border-radius: 3px;
      margin-left: 8px;
    }
  `;
  
  /**
   * Get all combined styles for the extension
   * @returns {string} - Combined CSS string
   */
  function getAllStyles() {
    return `
      ${overlayStyles}
      ${tagStyles}
      ${imagePreviewStyles}
      ${imageSelectorStyles}
      ${toastStyles}
      ${autocompleteStyles}
    `;
  }
  
  // Public API
  return {
    injectStyles,
    removeStyles,
    overlayStyles,
    tagStyles,
    imagePreviewStyles,
    imageSelectorStyles,
    toastStyles,
    autocompleteStyles,
    getAllStyles
  };
})();