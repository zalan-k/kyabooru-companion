// Database setup
let db;
const DB_NAME = 'tagSaverDB';
const DB_VERSION = 1;
const TAG_STORE = 'tags';
const SERVER_URL = 'http://localhost:3737';

// Initialize the database
function initDB() {
  const request = indexedDB.open(DB_NAME, DB_VERSION + 1); // Bump version
  
  request.onerror = (event) => {
    console.error("Database error:", event.target.error);
  };
  
  request.onupgradeneeded = (event) => {
    db = event.target.result;
    
    // Create object store for tags if it doesn't exist
    if (!db.objectStoreNames.contains(TAG_STORE)) {
      const store = db.createObjectStore(TAG_STORE, { keyPath: 'id', autoIncrement: true });
      store.createIndex('url', 'url', { unique: false });
      store.createIndex('tags', 'tags', { unique: false, multiEntry: true });
      store.createIndex('tagText', 'tagText', { unique: false, multiEntry: true });
      store.createIndex('timestamp', 'timestamp', { unique: false });
      store.createIndex('poolId', 'poolId', { unique: false });
      store.createIndex('poolIndex', ['poolId', 'poolIndex'], { unique: false });
      store.createIndex('imageHash', 'imageHash', { unique: false }); // Add hash index
    } else {
      // Add hash index to existing store if needed
      const store = event.currentTarget.transaction.objectStore(TAG_STORE);
      if (!store.indexNames.contains('imageHash')) {
        store.createIndex('imageHash', 'imageHash', { unique: false });
      }
    }
  };
  
  request.onsuccess = (event) => {
    db = event.target.result;
    console.log("Database initialized successfully");
  };
}

// Export database
async function exportDatabase() {
  if (settings.useLocalServer) {
    try {
      const serverAvailable = await checkServerConnection();
      if (serverAvailable) {
        const data = await apiRequest('/api/export');
        const json = JSON.stringify(data, null, 2);
        const blob = new Blob([json], {type: 'application/json'});
        const url = URL.createObjectURL(blob);
        
        await browser.downloads.download({
          url: url,
          filename: `${settings.saveFolder}/tag_database_export_${Date.now()}.json`,
          saveAs: true
        });
        
        setTimeout(() => URL.revokeObjectURL(url), 1000);
        return true;
      }
    } catch (error) {
      console.error("Server export failed:", error);
    }
  }
  
  // Fallback to original implementation
  return await exportDatabaseIndexedDB();
}

async function exportDatabaseIndexedDB() {
  return new Promise((resolve, reject) => {
    try {
      const transaction = db.transaction([TAG_STORE], 'readonly');
      const store = transaction.objectStore(TAG_STORE);
      const request = store.getAll();
      
      request.onsuccess = () => {
        const data = request.result;
        const json = JSON.stringify(data, null, 2);
        const blob = new Blob([json], {type: 'application/json'});
        const url = URL.createObjectURL(blob);
        
        browser.downloads.download({
          url: url,
          filename: `${settings.saveFolder}/tag_database_export_${Date.now()}.json`,
          saveAs: true
        }).then(() => {
          setTimeout(() => URL.revokeObjectURL(url), 1000);
          resolve(true);
        }).catch(error => {
          reject(error);
        });
      };
      
      request.onerror = (event) => reject(event.target.error);
    } catch (error) {
      reject(error);
    }
  });
}

async function importDatabase(jsonData) {
  return new Promise((resolve, reject) => {
    try {
      const transaction = db.transaction([TAG_STORE], 'readwrite');
      const store = transaction.objectStore(TAG_STORE);
      let importCount = 0;
      
      // Process each record
      jsonData.forEach(record => {
        // Process tags for better search if importing from older version
        if (record.tags && !record.tagText) {
          const tagTexts = record.tags.map(tag => {
            if (tag.includes(':')) {
              const [category, name] = tag.split(':', 2);
              return [tag.toLowerCase(), name.toLowerCase()];
            }
            return [tag.toLowerCase()];
          }).flat();
          record.tagText = tagTexts;
        }
        
        const request = store.add({
          url: record.url,
          tags: record.tags,
          tagText: record.tagText || [],
          imageUrl: record.imageUrl,
          timestamp: record.timestamp,
          poolId: record.poolId || null,
          poolIndex: record.poolIndex !== undefined ? record.poolIndex : null,
          imageHash: record.imageHash || null
        });
        
        request.onsuccess = () => importCount++;
      });
      
      transaction.oncomplete = () => resolve(importCount);
      transaction.onerror = (event) => reject(event.target.error);
    } catch (error) {
      reject(error);
    }
  });
}

// Load settings or use defaults
let settings = {
  saveFolder: "TagSaver",
  autoDetect: true,
  notificationsEnabled: true,
  useLocalServer: true,
  serverUrl: SERVER_URL
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

// Check if server is available
async function checkServerConnection() {
  try {
    const response = await fetch(`${settings.serverUrl}/api/status`);
    if (response.ok) {
      const status = await response.json();
      console.log('Connected to Tag Saver Server:', status);
      return true;
    }
  } catch (error) {
    console.log('Tag Saver Server not available, using browser storage');
  }
  return false;
}

// Updated apiRequest to handle 409 errors specially
async function apiRequest(endpoint, options = {}) {
  const url = `${settings.serverUrl}${endpoint}`;
  const defaultOptions = {
    headers: {
      'Content-Type': 'application/json',
    },
  };
  
  try {
    const response = await fetch(url, { ...defaultOptions, ...options });
    
    // Handle 409 (duplicate) specially - don't throw, return the error data
    if (response.status === 409) {
      const errorData = await response.json();
      return { 
        error: true, 
        status: 409, 
        data: errorData 
      };
    }
    
    if (!response.ok) {
      throw new Error(`API request failed: ${response.status} ${response.statusText}`);
    }
    
    return await response.json();
  } catch (error) {
    console.error(`API Error (${endpoint}):`, error);
    throw error;
  }
}

// Updated saveToServer function
async function saveToServer(data) {
  const startTime = performance.now();
  
  try {
    const payload = {
      url: data.url,
      tags: data.tags,
      imageUrl: data.imageUrl,
      imageHash: data.imageHash,
      poolId: data.poolId,
      poolIndex: data.poolIndex,
      mediaType: detectMediaType(data.imageUrl)
    };
    
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 3000);

    const response = await fetch(`${settings.serverUrl}/api/images`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
      signal: controller.signal
    });
    
    clearTimeout(timeoutId);
    
    // Handle duplicate error
    if (response.status === 409) {
      const errorData = await response.json();
      return {
        success: false,
        duplicateFound: true,
        originalRecord: errorData.duplicate
      };
    }
    
    if (!response.ok) {
      throw new Error(`Server error: ${response.status}`);
    }
    
    const result = await response.json();
    const duration = performance.now() - startTime;
    console.log(`✅ Server save: ${duration.toFixed(2)}ms`);
    
    return { success: true, serverId: result.imageId };
  } catch (error) {
    console.error("❌ Server save failed:", error);
    throw error; // This will trigger the fallback to IndexedDB
  }
}

// Save data to server or fallback to IndexedDB
async function saveToDatabase(data) {
  if (settings.useLocalServer) {
    try {
      console.log("📤 Attempting server save...");
      return await saveToServer(data);
    } catch (error) {
      console.error("Server failed, using browser storage:", error);
    }
  }
  
  console.log("📦 Using browser storage...");
  return await saveToIndexedDB(data);
}

// Utility function to detect media type
function detectMediaType(url) {
  if (!url) return 'image';
  
  const extension = url.split('.').pop().toLowerCase().split('?')[0];
  if (['gif'].includes(extension)) return 'gif';
  if (['mp4', 'webm', 'mov'].includes(extension)) return 'video';
  return 'image';
}

// Save data to IndexedDB
async function saveToIndexedDB(data) {
  // Process tags for better search
  const tagTexts = data.tags.map(tag => {
    // Store both the full tag and the name part for better searching
    if (tag.includes(':')) {
      const [category, name] = tag.split(':', 2);
      return [tag.toLowerCase(), name.toLowerCase()]; // Store both forms
    }
    return [tag.toLowerCase()];
  }).flat();
  
  return new Promise((resolve, reject) => {
    try {
      const transaction = db.transaction([TAG_STORE], 'readwrite');
      const store = transaction.objectStore(TAG_STORE);
      
      const request = store.add({
        url: data.url,
        tags: data.tags,
        tagText: tagTexts, // Add this new field for searching
        imageUrl: data.imageUrl,
        timestamp: data.timestamp,
        imageHash: data.imageHash || null
      });
      
      request.onsuccess = () => resolve(true);
      request.onerror = (event) => reject(event.target.error);
    } catch (error) {
      reject(error);
    }
  });
}

async function detectContentType(url) {
  try {
    const response = await fetch(url, { method: 'HEAD' });
    const contentType = response.headers.get('Content-Type');
    
    if (contentType) {
      if (contentType.includes('image/gif')) return 'gif';
      if (contentType.includes('video/')) return 'video';
      if (contentType.includes('image/')) return 'image';
    }
    
    // Fallback to extension detection
    const extension = url.split('.').pop().toLowerCase().split('?')[0];
    if (['gif'].includes(extension)) return 'gif';
    if (['mp4', 'webm', 'mov'].includes(extension)) return 'video';
    
    return 'image'; // Default
  } catch (error) {
    console.error("Error detecting content type:", error);
    return 'image'; // Default on error
  }
}

// Check for duplicate by hash
async function checkForDuplicateImage(imageHash, similarityThreshold = 10) {
  if (settings.useLocalServer && imageHash) {
    try {
      const serverAvailable = await checkServerConnection();
      if (serverAvailable) {
        const result = await apiRequest(`/api/images/check-duplicate/${imageHash}`);
        return {
          isDuplicate: result.exists,
          exactMatch: result.exists,
          originalRecord: result.duplicate
        };
      }
    } catch (error) {
      console.error("Server duplicate check failed:", error);
    }
  }
  
  // Fallback to original implementation
  return await checkForDuplicateImageIndexedDB(imageHash, similarityThreshold);
}


// Add function to check for duplicates based on hash
async function checkForDuplicateImageIndexedDB(imageHash, similarityThreshold = 10) {
  return new Promise((resolve, reject) => {
    try {
      if (!imageHash) {
        resolve({ isDuplicate: false });
        return;
      }
      
      const transaction = db.transaction([TAG_STORE], 'readonly');
      const store = transaction.objectStore(TAG_STORE);
      const request = store.getAll();
      
      request.onsuccess = () => {
        const records = request.result.filter(record => record.imageHash);
        
        // Check each record for similar hash
        for (const record of records) {
          if (record.imageHash === imageHash) {
            // Exact match
            resolve({
              isDuplicate: true,
              exactMatch: true,
              originalRecord: record
            });
            return;
          }
          
          try {
            // Hamming distance calculation for similarity
            const distance = calculateHammingDistance(imageHash, record.imageHash);
            if (distance <= similarityThreshold) {
              resolve({
                isDuplicate: true,
                exactMatch: false,
                originalRecord: record
              });
              return;
            }
          } catch (error) {
            console.error("Error comparing hashes:", error);
            // Continue with next record
          }
        }
        
        resolve({ isDuplicate: false });
      };
      
      request.onerror = (event) => reject(event.target.error);
    } catch (error) {
      reject(error);
    }
  });
}

// Helper function for fallback hash comparison
function calculateHammingDistance(hash1, hash2) {
  const bin1 = parseInt(hash1, 16).toString(2).padStart(64, '0');
  const bin2 = parseInt(hash2, 16).toString(2).padStart(64, '0');
  
  let distance = 0;
  for (let i = 0; i < bin1.length; i++) {
    if (bin1[i] !== bin2[i]) {
      distance++;
    }
  }
  
  return distance;
}

// Download image
async function downloadMedia(mediaUrl, filename) {
  try {
    // For videos, we might need to use fetch to download properly
    const contentType = await detectContentType(mediaUrl);
    const isPixivUrl = mediaUrl.includes('pximg.net'); // Special Pixiv handling
    
    if (contentType === 'video') {
      let fetchOptions = {};
      
      if (isPixivUrl) {
        fetchOptions = {
          headers: {
            'Referer': 'https://www.pixiv.net/'
          }
        };
      }
      const response = await fetch(mediaUrl, { 
        method: 'GET',
        ...fetchOptions
      });
      
      if (!response.ok) {
        throw new Error(`Failed to fetch video: ${response.status} ${response.statusText}`);
      }
      
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      
      await browser.downloads.download({
        url: url,
        filename: `${settings.saveFolder}/${filename}`,
        saveAs: false
      });
      
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      return contentType;
    } else if (isPixivUrl) {
      // For Pixiv images, we need to use fetch with the Referer header
      console.log("Downloading Pixiv image with special handling:", mediaUrl);
      
      try {
        const response = await fetch(mediaUrl, {
          headers: {
            'Referer': 'https://www.pixiv.net/'
          }
        });
        
        if (!response.ok) {
          console.error(`Pixiv fetch failed: ${response.status} ${response.statusText}`);
          
          // Try with .png extension if .jpg failed (common on Pixiv)
          if (mediaUrl.endsWith('.jpg') || mediaUrl.endsWith('_p0.jpg')) {
            const pngUrl = mediaUrl.replace(/\.jpg$|_p0\.jpg$/, '_p0.png');
            console.log("Trying PNG instead:", pngUrl);
            
            const pngResponse = await fetch(pngUrl, {
              headers: {
                'Referer': 'https://www.pixiv.net/'
              }
            });
            
            if (!pngResponse.ok) {
              throw new Error(`Pixiv PNG fetch also failed: ${pngResponse.status}`);
            }
            
            const blob = await pngResponse.blob();
            const url = URL.createObjectURL(blob);
            
            // Update filename to match PNG extension
            let pngFilename = filename;
            if (pngFilename.endsWith('.jpg')) {
              pngFilename = pngFilename.replace(/\.jpg$/, '.png');
            }
            
            await browser.downloads.download({
              url: url,
              filename: `${settings.saveFolder}/${pngFilename}`,
              saveAs: false
            });
            
            setTimeout(() => URL.revokeObjectURL(url), 1000);
            return 'image';
          } else {
            throw new Error(`Pixiv fetch failed: ${response.status} ${response.statusText}`);
          }
        }
        
        const blob = await response.blob();
        const url = URL.createObjectURL(blob);
        
        await browser.downloads.download({
          url: url,
          filename: `${settings.saveFolder}/${filename}`,
          saveAs: false
        });
        
        setTimeout(() => URL.revokeObjectURL(url), 1000);
        return 'image';
      } catch (pixivError) {
        console.error("Pixiv special download failed:", pixivError);
        // Fall back to regular download as a last resort
        await browser.downloads.download({
          url: mediaUrl,
          filename: `${settings.saveFolder}/${filename}`,
          saveAs: false,
          headers: [
            { name: 'Referer', value: 'https://www.pixiv.net/' }
          ]
        }).catch(err => {
          console.error("Final download attempt failed:", err);
          throw err;
        });
        return 'image';
      }
    } else {
      // Regular download for other images and GIFs
      await browser.downloads.download({
        url: mediaUrl,
        filename: `${settings.saveFolder}/${filename}`,
        saveAs: false
      });
      return contentType;
    }
  } catch (error) {
    console.error(`Error downloading ${mediaUrl}:`, error);
    return null;
  }
}

async function searchTags(prefix) {
  if (settings.useLocalServer) {
    try {
      const serverAvailable = await checkServerConnection();
      if (serverAvailable) {
        const results = await apiRequest(`/api/tags/search?q=${encodeURIComponent(prefix)}&limit=30`);
        return results;
      }
    } catch (error) {
      console.error("Server search failed, falling back to browser storage:", error);
    }
  }
  
  // Fallback to original IndexedDB search
  return await searchTagsIndexedDB(prefix);
}

function searchTagsIndexedDB(prefix) {
  return new Promise((resolve, reject) => {
    try {
      const transaction = db.transaction([TAG_STORE], 'readonly');
      const store = transaction.objectStore(TAG_STORE);
      // Use any appropriate index
      const request = store.getAll();
      
      request.onsuccess = () => {
        // Extract tags as strings from whatever structure you have
        const tagStrings = [];
        request.result.forEach(record => {
          // Make sure to only include string tags
          if (record.tags && Array.isArray(record.tags)) {
            record.tags.forEach(tag => {
              if (typeof tag === 'string' && 
                  tag.toLowerCase().includes(prefix.toLowerCase())) {
                tagStrings.push(tag);
              }
            });
          }
        });
        
        // Return unique tags only
        const uniqueTags = [...new Set(tagStrings)];
        resolve(uniqueTags.slice(0, 30));
      };
      
      request.onerror = (event) => reject(event.target.error);
    } catch (error) {
      reject(error);
    }
  });
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
  const startTime = performance.now();

  try {
    // Generate filenames
    const timestamp = new Date().getTime();
    let urlParts;
    try {
      urlParts = new URL(data.url);
    } catch (e) {
      console.error("Invalid URL:", data.url);
      urlParts = { hostname: "unknown" };
    }
    const domain = urlParts.hostname ? urlParts.hostname.replace(/^www\./, '') : "unknown";
    const baseFilename = `${domain}_${timestamp}`;
    
    // Initialize hash variable
    let imageHash = null;
    
    // Calculate hash if we have an image URL
    if (data.imageUrl) {
      try {
        // Request hash calculation from content script
        if (data.sender && data.sender.tab && data.sender.tab.id) {
          console.log("Requesting hash calculation from content script");
          const response = await browser.tabs.sendMessage(data.sender.tab.id, {
            action: "compute-image-hash",
            imageUrl: data.imageUrl
          });
          
          if (response && response.success) {
            imageHash = response.hash;
            console.log("Hash computed successfully:", imageHash);
            
            // Check for duplicates if we have a hash and duplicate detection is enabled
            if (settings.duplicateDetection !== false && imageHash) {
              console.log("Checking for duplicates with hash:", imageHash);
              const duplicateCheck = await checkForDuplicateImage(
                imageHash, 
                settings.similarityThreshold || 10
              );
              
              if (duplicateCheck.isDuplicate) {
                console.log("Duplicate found:", duplicateCheck);
                // Notify user about duplicate
                try {
                  await browser.tabs.sendMessage(data.sender.tab.id, {
                    action: "show-duplicate-warning",
                    duplicateFound: true,
                    exactMatch: duplicateCheck.exactMatch,
                    originalRecord: duplicateCheck.originalRecord
                  });
                } catch (error) {
                  console.error("Error showing duplicate warning:", error);
                }
                
                return {
                  success: false,
                  duplicateFound: true,
                  exactMatch: duplicateCheck.exactMatch,
                  originalRecord: duplicateCheck.originalRecord
                };
              }
            }
          } else {
            console.warn("Hash computation failed:", response);
          }
        } else {
          console.warn("Cannot compute hash - no sender tab information");
        }
      } catch (error) {
        console.error("Error during hash calculation:", error);
        // Continue even if hash calculation fails
      }
    }
    
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
    
    // Handle pool conflicts if this is part of a pool
    if (data.poolId && data.poolIndex !== undefined) {
      await checkAndHandlePoolIndexConflict(data.poolId, data.poolIndex);
    }
    
    // Process tags for better search
    const tagTexts = data.tags.map(tag => {
      if (tag.includes(':')) {
        const [category, name] = tag.split(':', 2);
        return [tag.toLowerCase(), name.toLowerCase()];
      }
      return [tag.toLowerCase()];
    }).flat();

    // Prepare data for database
    const dbData = {
      url: data.url,
      tags: data.tags,
      tagText: tagTexts,
      imageUrl: data.imageUrl,
      timestamp: data.timestamp || new Date().toISOString(),
      imageHash: imageHash, // Add the hash to database
      ...(data.poolId && { 
        poolId: data.poolId,
        poolIndex: parseInt(data.poolIndex, 10) || 0
      })
    };
    
    // Save to database
    const dbStartTime = performance.now();
    await saveToDatabase(dbData);
    const dbTime = performance.now() - dbStartTime;
    
    // Save media if available
    let mediaSuccess = true;
    let mediaType = 'image';
    if (data.imageUrl) {
      // Check if this is a Pixiv URL
      const isPixivUrl = data.imageUrl.includes('pximg.net');
      
      // Extract file extension or default to jpg
      let extension = data.imageUrl.split('.').pop().split(/[?#]/)[0] || 'jpg';
      
      // For Pixiv URLs with _p0, get the extension from the filename
      if (isPixivUrl && data.imageUrl.includes('_p0')) {
        const match = data.imageUrl.match(/_p0\.([^.?]+)/);
        if (match && match[1]) {
          extension = match[1];
        }
      }
      
      const mediaResult = await downloadMedia(data.imageUrl, `${baseFilename}.${extension}`);
      mediaSuccess = !!mediaResult;
      mediaType = mediaResult || 'image';
    }
    
    // Save JSON data with categorized tags
    const jsonData = {
      sourceUrl: data.url,
      tags: categorizedTags,
      imageUrl: data.imageUrl,
      mediaType: mediaType,
      timestamp: data.timestamp || new Date().toISOString(),
      imageHash: imageHash, // Include hash in JSON export
      ...(data.poolId && {
        poolId: data.poolId,
        poolIndex: parseInt(data.poolIndex, 10) || 0
      })
    };
    
    const jsonSuccess = await saveJSON(jsonData, `${baseFilename}.json`);

    const totalTime = performance.now() - startTime;
    console.log(`📊 OPTIMIZED PERFORMANCE:
      Database save: ${dbTime.toFixed(2)}ms
      Total time: ${totalTime.toFixed(2)}ms`);

    return {
      success: true,
      mediaSuccess,
      mediaType,
      jsonSuccess,
      imageHash // Return the hash in the result
    };
  } catch (error) {
    console.error("Error in handleSaveData:", error);
    return { success: false, error: error.message };
  }
}

// Helper function for hash comparison
function calculateHammingDistance(hash1, hash2) {
  const bin1 = parseInt(hash1, 16).toString(2).padStart(64, '0');
  const bin2 = parseInt(hash2, 16).toString(2).padStart(64, '0');
  
  let distance = 0;
  for (let i = 0; i < bin1.length; i++) {
    if (bin1[i] !== bin2[i]) {
      distance++;
    }
  }
  
  return distance;
}

// Process all tabs from supported sites
async function processAllTabs() {
  try {
    // Get all open tabs
    const tabs = await browser.tabs.query({});
    const supportedTabs = [];
    
    // Check which tabs are from supported sites
    for (const tab of tabs) {
      try {
        const response = await browser.tabs.sendMessage(tab.id, {
          action: "check-if-supported"
        });
        
        if (response && response.supported) {
          supportedTabs.push(tab);
        }
      } catch (error) {
        // Content script might not be loaded, skip this tab
        console.log(`Skipping tab ${tab.id}, content script not available`);
      }
    }
    
    // Show a progress toast if available
    try {
      await browser.tabs.sendMessage(tabs[0].id, {
        action: "show-progress-toast",
        message: `Processing ${supportedTabs.length} tabs...`
      });
    } catch (error) {
      console.log("Could not show progress toast");
    }
    
    // Process each supported tab
    let successCount = 0;
    const successfulTabIds = []; // Keep track of successfully processed tab IDs
    
    for (let i = 0; i < supportedTabs.length; i++) {
      const tab = supportedTabs[i];
      
      // Extract content from the tab
      const content = await browser.tabs.sendMessage(tab.id, {
        action: "extract-content"
      });
      
      if (content && content.tags && content.tags.length > 0) {
        // Show progress update
        try {
          await browser.tabs.sendMessage(tabs[0].id, {
            action: "update-progress-toast",
            message: `Processing tab ${i+1}/${supportedTabs.length}...`,
            progress: (i+1) / supportedTabs.length
          });
        } catch (error) {
          console.log("Could not update progress toast");
        }
        
        // Save the data
        const result = await handleSaveData({
          url: tab.url,
          tags: content.tags,
          imageUrl: content.imageUrl,
          timestamp: new Date().toISOString(),
          // sender: {
          //   tab: {
          //     id: tab.id
          //   }
          // }
        });
        
        if (result.success) {
          successCount++;
          successfulTabIds.push(tab.id); // Add to successful tabs list
        }
      }
    }
    
    // Close successfully processed tabs
    if (successfulTabIds.length > 0) {
      await browser.tabs.remove(successfulTabIds);
    }
    
    // Show completion toast
    try {
      await browser.tabs.sendMessage(tabs[0].id, {
        action: "show-success-toast",
        message: `Processed and closed ${successCount} tabs successfully!`
      });
    } catch (error) {
      console.log("Could not show completion toast");
    }
    
    return {
      success: true,
      total: supportedTabs.length,
      processed: successCount,
      closed: successCount
    };
  } catch (error) {
    console.error("Error processing all tabs:", error);
    return { success: false, error: error.message };
  }
}

async function checkAndHandlePoolIndexConflict(poolId, index) {
  return new Promise((resolve, reject) => {
    try {
      const transaction = db.transaction([TAG_STORE], 'readwrite');
      const store = transaction.objectStore(TAG_STORE);
      const poolIndexIndex = store.index('poolIndex');
      
      // Get all entries with the same pool ID
      const request = poolIndexIndex.getAll([poolId, parseInt(index, 10)]);
      
      request.onsuccess = async () => {
        // If index already exists, shift all indices at and above this one
        if (request.result.length > 0) {
          // Get all entries in this pool
          const allPoolRequest = store.index('poolId').getAll(poolId);
          
          allPoolRequest.onsuccess = () => {
            // Filter entries with index >= the requested index, sort in descending order
            const entriesToUpdate = allPoolRequest.result
              .filter(entry => entry.poolIndex >= parseInt(index, 10))
              .sort((a, b) => b.poolIndex - a.poolIndex);
            
            // Increment each index
            entriesToUpdate.forEach(entry => {
              entry.poolIndex += 1;
              store.put(entry);
            });
            
            transaction.oncomplete = () => resolve();
            transaction.onerror = (e) => reject(e.target.error);
          };
          
          allPoolRequest.onerror = (e) => reject(e.target.error);
        } else {
          resolve(); // No conflict
        }
      };
      
      request.onerror = (e) => reject(e.target.error);
    } catch (error) {
      reject(error);
    }
  });
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

  browser.contextMenus.create({
    id: "export-database",
    title: "Export Tag Database",
    contexts: ["action"]
  });

  browser.contextMenus.create({
    id: "process-all-tabs",
    title: "Process All Open Booru Tabs",
    contexts: ["action"]
  });
}

// Get pool highest index
async function getPoolHighestIndex(poolId) {
  if (settings.useLocalServer) {
    try {
      const serverAvailable = await checkServerConnection();
      if (serverAvailable) {
        const result = await apiRequest(`/api/pools/${poolId}/highest-index`);
        return result.highestIndex;
      }
    } catch (error) {
      console.error("Server pool query failed:", error);
    }
  }
  
  // Fallback to original implementation
  return await getPoolHighestIndexIndexedDB(poolId);
}

async function getPoolHighestIndexIndexedDB(poolId) {
  return new Promise((resolve, reject) => {
    try {
      if (!db) {
        return reject(new Error("Database not initialized"));
      }
      
      const transaction = db.transaction([TAG_STORE], 'readonly');
      const store = transaction.objectStore(TAG_STORE);
      const poolIdIndex = store.index('poolId');
      
      const request = poolIdIndex.getAll(poolId);
      
      request.onsuccess = () => {
        if (request.result.length === 0) {
          // No entries for this pool
          resolve(null);
        } else {
          // Find highest index
          const highestIndex = Math.max(...request.result.map(entry => 
            entry.poolIndex !== undefined ? entry.poolIndex : 0
          ));
          resolve(highestIndex);
        }
      };
      
      request.onerror = (event) => reject(event.target.error);
    } catch (error) {
      reject(error);
    }
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

  if (info.menuItemId === "process-all-tabs") {
    processAllTabs();
  }
});

// Open overlay via hotkey or icon click
browser.commands.onCommand.addListener((command) => {
  if (command === "open-overlay") {
    // Send explicit message to trigger the smart overlay
    browser.tabs.query({active: true, currentWindow: true}).then(tabs => {
      browser.tabs.sendMessage(tabs[0].id, {
        action: "smart-overlay-shortcut"
      });
    });
  }
});

//browser.action.onClicked.addListener(() => {
//  showContentOverlay();
//});

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
    const dataWithSender = {
      ...message.data,
      sender: sender
    };
    handleSaveData(dataWithSender)
      .then(result => sendResponse(result))
      .catch(error => sendResponse({ success: false, error: error.message }));
    return true; // Required for async sendResponse
  }
  else if (message.action === "search-tags") {
    searchTags(message.query)
      .then(results => sendResponse(results))
      .catch(error => {
        console.error("Error searching tags:", error);
        sendResponse([]);
      });
    return true; // Required for async sendResponse
  }
  else if (message.action === "get-pool-highest-index") {
    getPoolHighestIndex(message.poolId)
      .then(index => sendResponse({ success: true, highestIndex: index }))
      .catch(error => {
        console.error("Error getting pool index:", error);
        sendResponse({ success: false, error: error.message });
      });
    return true; // Required for async sendResponse
  }
  else if (message.action === "export-database") {
    exportDatabase()
      .then(() => sendResponse({ success: true }))
      .catch(error => sendResponse({ success: false, error: error.message }));
    return true;
  }
  else if (message.action === "import-database") {
    // Parse the data from the message
    importDatabase(message.data)
      .then(count => sendResponse({ success: true, count }))
      .catch(error => sendResponse({ success: false, error: error.message }));
    return true;
  }
  else if (message.action === "process-all-tabs") {
    processAllTabs()
      .then(result => sendResponse(result))
      .catch(error => sendResponse({ success: false, error: error.message }));
    return true;
  }
  else if (message.action === "check-image-hash") {
    checkForDuplicateImage(message.hash)
      .then(result => sendResponse({ exists: result.isDuplicate }))
      .catch(error => sendResponse({ exists: false, error: error.message }));
    return true;
  }
});

browser.runtime.onInstalled.addListener(async (details) => {
  console.log("Extension installed or updated:", details.reason);
  
  // Only initialize settings once at install time
  if (details.reason === 'install') {
    try {
      // Check if settings exist
      const result = await browser.storage.local.get('settings');
      
      // If no settings exist, initialize with defaults
      if (!result.settings || Object.keys(result.settings).length === 0) {
        // Import the default settings from options.js
        const defaultSettings = {
          saveFolder: 'TagSaver',
          autoDetect: true,
          notificationsEnabled: true,
          duplicateDetection: true,
          similarityThreshold: 10,
          useLocalServer: true
        };
        
        // Save defaults to storage
        await browser.storage.local.set({ settings: defaultSettings });
        console.log("Default settings initialized:", defaultSettings);
      }
    } catch (error) {
      console.error("Error initializing settings:", error);
    }
  }
});

// Initialize
(async function() {
  initDB();
  await loadSettings();
  setupContextMenu(); // Add this line
})();