// Save options to browser.storage
function saveOptions(e) {
    e.preventDefault();
    
    const settings = {
      saveFolder: document.getElementById('saveFolder').value.trim(),
      autoDetect: document.getElementById('autoDetect').checked,
      notificationsEnabled: document.getElementById('notificationsEnabled').checked,
      duplicateDetection: document.getElementById('duplicateDetection').checked,
      similarityThreshold: parseInt(document.getElementById('similarityThreshold').value),
      useLocalServer: document.getElementById('useLocalServer').checked,
      theme:  document.getElementById('theme').value
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
    useLocalServer: true,
    theme: 'system'
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
    document.getElementById('theme').value = settings.theme || defaultSettings.theme;
    document.getElementById('thresholdValue').textContent = document.getElementById('similarityThreshold').value;
    document.getElementById('similarityThreshold').addEventListener('input', function() {
      document.getElementById('thresholdValue').textContent = this.value;
    });
  }).catch((error) => {
    console.error('Error loading settings:', error);
  });
}
  
// Apply theme immediately
function applyTheme(theme) {
  let effectiveTheme = theme;
  if (theme === 'system') {
    effectiveTheme = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }
  document.documentElement.classList.toggle('dark', effectiveTheme === 'dark');
}

// Event listeners
document.addEventListener('DOMContentLoaded', () => {
  restoreOptions();
  
  // Diffuse effect for buttons
  document.querySelectorAll('.btn').forEach(btn => {
    btn.addEventListener('click', function(e) {
      this.classList.remove('diffuse-active');
      void this.offsetWidth;
      this.classList.add('diffuse-active');
    });
    btn.addEventListener('animationend', function() {
      this.classList.remove('diffuse-active');
    });
  });
  
  // Slider value display
  const slider = document.getElementById('similarityThreshold');
  const thresholdValue = document.getElementById('thresholdValue');
  slider.addEventListener('input', () => {
    thresholdValue.textContent = slider.value;
  });
  
  // Live theme preview when changed
  document.getElementById('theme').addEventListener('change', function() {
    applyTheme(this.value);
  });
});
document.getElementById('save').addEventListener('click', saveOptions);
document.getElementById('theme').addEventListener('change', function() {applyTheme(this.value);});