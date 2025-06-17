/**
 * Toast Notification System
 * Displays non-intrusive notifications to the user
 */
window.TagSaver = window.TagSaver || {};
window.TagSaver.UI = window.TagSaver.UI || {};

window.TagSaver.UI.Toast = (function() {
  let styleElement = null;
  
  function initToast() {
    if (!styleElement) {
      // Reference Styles through the namespace
      styleElement = window.TagSaver.UI.Styles.injectStyles(
        window.TagSaver.UI.Styles.toastStyles
      );
    }
  }

/**
 * Show a toast notification
 * @param {string} message - Message to display
 * @param {boolean} isError - Whether this is an error message (changes style)
 * @param {number} duration - How long to show the toast (ms)
 */
function showToast(message, isError = false, duration = 3000) {
  // Ensure styles are injected
  initToast();
  
  // Create toast element
  const toast = document.createElement('div');
  toast.className = isError ? 'ts-toast error' : 'ts-toast';
  toast.textContent = message;
  document.body.appendChild(toast);
  
  // Automatically remove after duration
  setTimeout(() => {
    toast.style.opacity = '0'; // This will trigger the transition
    
    // Remove after transition completes
    setTimeout(() => {
      toast.remove();
    }, 200); // Match this with the transition time (0.1s = 100ms)
  }, duration);
  
  return toast;
}

/**
 * Show a success toast
 * @param {string} message - Success message
 * @param {number} duration - Duration in ms
 */
function showSuccess(message, duration = 3000) {
  return showToast(message, false, duration);
}

/**
 * Show an error toast
 * @param {string} message - Error message
 * @param {number} duration - Duration in ms
 */
function showError(message, duration = 3000) {
  return showToast(message, true, duration);
}

/**
 * Show a warning toast (orange color)
 * @param {string} message - Warning message
 * @param {number} duration - Duration in ms
 */
function showWarning(message, duration = 3000) {
  // Ensure styles are injected
  initToast();
  
  // Create toast element with warning class
  const toast = document.createElement('div');
  toast.className = 'ts-toast warning';
  toast.textContent = message;
  document.body.appendChild(toast);
  
  // Automatically remove after duration
  setTimeout(() => {
    toast.style.opacity = '0';
    
    // Remove after transition completes
    setTimeout(() => {
      toast.remove();
    }, 200); // Match transition time
  }, duration);
  
  return toast;
}

return {
  initToast,
  showToast,
  showSuccess,
  showError,
  showWarning
};
})();