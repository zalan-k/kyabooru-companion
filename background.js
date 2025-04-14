// Database setup
let db;
const DB_NAME = 'tagSaverDB';
const DB_VERSION = 1;
const TAG_STORE = 'tags';

// Initialize the database
function initDB() {
  const request = indexedDB.open(DB_NAME, DB_VERSION);
  
  request.onerror = (event) => {
    console.error("Database error:", event.target.error);
  };
  
  request.onupgradeneeded = (event) => {
    db = event.target.result;
    
    // Create object store for tags
    if (!db.objectStoreNames.contains(TAG_STORE)) {
      const store = db.createObjectStore(TAG_STORE, { keyPath: 'id', autoIncrement: true });
      store.createIndex('url', 'url', { unique: false });
      store.createIndex('tags', 'tags', { unique: false, multiEntry: true });
      store.createIndex('timestamp', 'timestamp', { unique: false });
    }
  };
  
  request.onsuccess = (event) => {
    db = event.target.result;
    console.log("Database initialized successfully");
  };
}

// Load settings or use defaults
let settings = {
  saveFolder: "TagSaver",
  autoDetect: true,
  notificationsEnabled: true
};

// Load settings from storage
async function loadSettings() {
  try {
    const result = await browser.storage.local.get('settings');
    if (result.settings) {
      settings = {...settings, ...result.settings};
    }
  } catch (error) {
    console.error("Error loading settings:", error);
  }
}

// Save data to IndexedDB
async function saveToDatabase(data) {
  return new Promise((resolve, reject) => {
    try {
      const transaction = db.transaction([TAG_STORE], 'readwrite');
      const store = transaction.objectStore(TAG_STORE);
      
      const request = store.add({
        url: data.url,
        tags: data.tags,
        imageUrl: data.imageUrl,
        timestamp: data.timestamp
      });
      
      request.onsuccess = () => resolve(true);
      request.onerror = (event) => reject(event.target.error);
    } catch (error) {
      reject(error);
    }
  });
}

// Download image
async function downloadImage(imageUrl, filename) {
  try {
    await browser.downloads.download({
      url: imageUrl,
      filename: `${settings.saveFolder}/${filename}`,
      saveAs: false
    });
    return true;
  } catch (error) {
    console.error("Error downloading image:", error);
    return false;
  }
}

// Save JSON data
async function saveJSON(data, filename) {
  const json = JSON.stringify(data, null, 2);
  const blob = new Blob([json], {type: 'application/json'});
  const url = URL.createObjectURL(blob);
  
  try {
    // The downloads API returns a download ID when successful
    const downloadId = await browser.downloads.download({
      url: url,
      filename: `${settings.saveFolder}/${filename}`,
      saveAs: false
    });
    
    // Wait a short time to ensure browser has processed the download
    // before revoking the URL
    setTimeout(() => {
      URL.revokeObjectURL(url);
    }, 1000);
    
    return true;
  } catch (error) {
    console.error("Error saving JSON:", error);
    setTimeout(() => {
      URL.revokeObjectURL(url);
    }, 1000);
    return false;
  }
}

// Handle data saving
async function handleSaveData(data) {
  try {
    // Generate filenames
    const timestamp = new Date().getTime();
    const urlParts = new URL(data.url);
    const domain = urlParts.hostname.replace(/^www\./, '');
    const baseFilename = `${domain}_${timestamp}`;
    
    // Process tags into categories
    const categorizedTags = {};
    
    data.tags.forEach(tag => {
      if (tag.includes(':')) {
        const [category, name] = tag.split(':', 2);
        
        // Initialize category array if it doesn't exist
        if (!categorizedTags[category]) {
          categorizedTags[category] = [];
        }
        
        // Add tag to its category
        categorizedTags[category].push(name);
      } else {
        // For tags without categories, put them in "general"
        if (!categorizedTags["general"]) {
          categorizedTags["general"] = [];
        }
        categorizedTags["general"].push(tag);
      }
    });
    
    // Prepare data for database with categorized tags
    const dbData = {
      url: data.url,
      tags: data.tags, // Keep original format for database storage
      imageUrl: data.imageUrl,
      timestamp: data.timestamp
    };
    
    // Save to database
    await saveToDatabase(dbData);
    
    // Save image if available
    let imageSuccess = true;
    if (data.imageUrl) {
      // Extract file extension or default to jpg
      const extension = data.imageUrl.split('.').pop().split('?')[0] || 'jpg';
      imageSuccess = await downloadImage(data.imageUrl, `${baseFilename}.${extension}`);
    }
    
    // Save JSON data with categorized tags
    const jsonData = {
      sourceUrl: data.url,
      tags: categorizedTags, // Use the categorized format for JSON export
      imageUrl: data.imageUrl,
      timestamp: data.timestamp
    };
    
    const jsonSuccess = await saveJSON(jsonData, `${baseFilename}.json`);
    
    return {
      success: true,
      imageSuccess,
      jsonSuccess
    };
  } catch (error) {
    console.error("Error in handleSaveData:", error);
    return { success: false, error: error.message };
  }
}

function setupContextMenu() {
  browser.contextMenus.create({
    id: "select-image-mode",
    title: "Select Images for Tag Saver",
    contexts: ["page"]
  });
  
  browser.contextMenus.create({
    id: "save-specific-image",
    title: "Save this Image with Tags",
    contexts: ["image"]
  });
}

// Handle context menu clicks
browser.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId === "select-image-mode") {
    // Send message to content script to activate selection mode
    browser.tabs.sendMessage(tab.id, {
      action: "start-selection-mode"
    });
  } 
  else if (info.menuItemId === "save-specific-image") {
    // Save this specific image with tags
    const imageUrl = info.srcUrl;
    
    // Send message to content script to show the overlay with this image
    browser.tabs.sendMessage(tab.id, {
      action: "show-overlay-with-image",
      imageUrl: imageUrl
    });
  }
});

// Open overlay via hotkey or icon click
browser.commands.onCommand.addListener((command) => {
  if (command === "open-overlay") showContentOverlay();
});

browser.action.onClicked.addListener(() => {
  showContentOverlay();
});

async function showContentOverlay() {
  try {
    // Get current tab
    const [tab] = await browser.tabs.query({ active: true, currentWindow: true });
    
    // Send message to content script
    const response = await browser.tabs.sendMessage(tab.id, {
      action: "show-overlay"
    });
    
    return response;
  } catch (error) {
    console.error("Error showing overlay:", error);
    return { success: false, error: error.message };
  }
}

// Listen for messages from content script
browser.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === "save-data") {
    handleSaveData(message.data)
      .then(result => sendResponse(result))
      .catch(error => sendResponse({ success: false, error: error.message }));
    return true; // Required for async sendResponse
  }
});

// Initialize
(async function() {
  initDB();
  await loadSettings();
  setupContextMenu(); // Add this line
})();