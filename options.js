// Save options to browser.storage
function saveOptions(e) {
    e.preventDefault();
    
    const settings = {
      saveFolder: document.getElementById('saveFolder').value.trim(),
      autoDetect: document.getElementById('autoDetect').checked,
      notificationsEnabled: document.getElementById('notificationsEnabled').checked
    };
    
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
      notificationsEnabled: true
    };
    
    browser.storage.local.get('settings').then((result) => {
      const settings = result.settings || defaultSettings;
      
      document.getElementById('saveFolder').value = settings.saveFolder || defaultSettings.saveFolder;
      document.getElementById('autoDetect').checked = settings.autoDetect !== undefined ? settings.autoDetect : defaultSettings.autoDetect;
      document.getElementById('notificationsEnabled').checked = settings.notificationsEnabled !== undefined ? settings.notificationsEnabled : defaultSettings.notificationsEnabled;
    }).catch((error) => {
      console.error('Error loading settings:', error);
    });
  }
  
  // Event listeners
  document.addEventListener('DOMContentLoaded', restoreOptions);
  document.getElementById('save').addEventListener('click', saveOptions);