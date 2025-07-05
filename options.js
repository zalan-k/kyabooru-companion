// Save options to browser.storage
function saveOptions(e) {
    e.preventDefault();
    
    const settings = {
      saveFolder: document.getElementById('saveFolder').value.trim(),
      autoDetect: document.getElementById('autoDetect').checked,
      notificationsEnabled: document.getElementById('notificationsEnabled').checked,
      duplicateDetection: document.getElementById('duplicateDetection').checked,
      similarityThreshold: parseInt(document.getElementById('similarityThreshold').value),
      useLocalServer: document.getElementById('useLocalServer').checked  // Add this line
    };
    
    console.log('Saving settings:', settings); // Debug log
    
    browser.storage.local.set({
      settings: settings
    }).then(() => {
      // Update status to let user know options were saved
      const status = document.getElementById('status');
      status.textContent = 'Options saved successfully!';
      status.className = 'status success';
      
      setTimeout(() => {
        status.textContent = '';
        status.className = 'status';
      }, 3000);
    }).catch((error) => {
      // Show error
      const status = document.getElementById('status');
      status.textContent = 'Error saving options: ' + error;
      status.className = 'status error';
    });
  }
  
  // Load options from browser.storage
  function restoreOptions() {
    const defaultSettings = {
      saveFolder: 'TagSaver',
      autoDetect: true,
      notificationsEnabled: true,
      duplicateDetection: true,
      similarityThreshold: 8,
      useLocalServer: true  // Add this line
    };
    
    browser.storage.local.get('settings').then((result) => {
      const settings = result.settings || defaultSettings;
      
      console.log('Loading settings:', settings); // Debug log
      
      document.getElementById('saveFolder').value = settings.saveFolder || defaultSettings.saveFolder;
      document.getElementById('autoDetect').checked = settings.autoDetect !== undefined ? settings.autoDetect : defaultSettings.autoDetect;
      document.getElementById('notificationsEnabled').checked = settings.notificationsEnabled !== undefined ? settings.notificationsEnabled : defaultSettings.notificationsEnabled;
      document.getElementById('duplicateDetection').checked = settings.duplicateDetection !== undefined ? settings.duplicateDetection : defaultSettings.duplicateDetection;
      document.getElementById('similarityThreshold').value = settings.similarityThreshold !== undefined ? settings.similarityThreshold : defaultSettings.similarityThreshold;
      document.getElementById('useLocalServer').checked = settings.useLocalServer !== undefined ? settings.useLocalServer : defaultSettings.useLocalServer;  // Add this line
      
      document.getElementById('thresholdValue').textContent = document.getElementById('similarityThreshold').value;
      document.getElementById('similarityThreshold').addEventListener('input', function() {
        document.getElementById('thresholdValue').textContent = this.value;
      });
    }).catch((error) => {
      console.error('Error loading settings:', error);
    });
  }
  
  // Event listeners
  document.addEventListener('DOMContentLoaded', restoreOptions);
  document.getElementById('save').addEventListener('click', saveOptions);