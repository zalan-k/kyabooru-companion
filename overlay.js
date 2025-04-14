// Receive URL from background script
browser.runtime.onMessage.addListener((message) => {
  if (message.type === "set-url") {
    const urlElement = document.getElementById("current-url");
    if (urlElement) {
      urlElement.textContent = message.url;
      // Add title attribute for hover tooltip on long URLs
      urlElement.title = message.url;
    }
  }
});

const tagInput = document.getElementById("tag-input");

// Close on Escape or save on Enter
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape") {
    window.close();
  } else if (e.key === "Enter" && tagInput && tagInput.value.trim() !== "") {
    // Here you would save the tags
    // For example, you could use browser.storage.local.set()
    console.log("Tags saved:", tagInput.value);
    
    // Show a brief success message (optional)
    showSaveConfirmation();
    
    // Close window after brief delay
    setTimeout(() => {
      window.close();
    }, 500);
  }
});

// Function to show save confirmation (flash effect)
function showSaveConfirmation() {
  const overlay = document.querySelector('.overlay');
  if (overlay) {
    overlay.style.backgroundColor = 'rgba(40, 167, 69, 0.85)';
    setTimeout(() => {
      overlay.style.backgroundColor = 'rgba(30, 30, 30, 0.75)';
    }, 200);
  }
}

// Add CSS for the keyboard shortcut hint
document.addEventListener('DOMContentLoaded', () => {
  const style = document.createElement('style');
  style.textContent = `
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
  document.head.appendChild(style);
});

// Always focus the input when window opens
window.addEventListener("load", () => {
  if (tagInput) {
    tagInput.focus();
  }
});