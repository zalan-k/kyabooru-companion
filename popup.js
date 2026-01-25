// Popup menu functionality
document.getElementById('save-current').addEventListener('click', function() {
    browser.tabs.query({active: true, currentWindow: true}).then(tabs => {
      browser.tabs.sendMessage(tabs[0].id, {
        action: "show-overlay"
      });
      window.close();
    });
  });
  
  document.getElementById('select-image').addEventListener('click', function() {
    browser.tabs.query({active: true, currentWindow: true}).then(tabs => {
      browser.tabs.sendMessage(tabs[0].id, {
        action: "start-selection-mode"
      });
      window.close();
    });
  });

  document.getElementById('batch-upload').addEventListener('click', function() {
    browser.tabs.create({
      url: browser.runtime.getURL('batch-upload.html')
    });
    window.close();
  });
  
  document.getElementById('process-all-tabs').addEventListener('click', function() {
    browser.runtime.sendMessage({
      action: "process-all-tabs"
    });
    window.close();
  });
  
  document.getElementById('export-database').addEventListener('click', function() {
    browser.runtime.sendMessage({
      action: "export-database"
    });
    window.close();
  });
  
  document.getElementById('import-database').addEventListener('click', function() {
    // Create a file input element
    const fileInput = document.createElement('input');
    fileInput.type = 'file';
    fileInput.accept = '.json';
    
    fileInput.onchange = function(e) {
      const file = e.target.files[0];
      if (!file) return;
      
      const reader = new FileReader();
      reader.onload = function(event) {
        try {
          const data = JSON.parse(event.target.result);
          browser.runtime.sendMessage({
            action: "import-database",
            data: data
          });
        } catch (error) {
          console.error("Error parsing JSON:", error);
          alert("Error importing database: Invalid JSON file");
        }
        window.close();
      };
      reader.readAsText(file);
    };
    
    fileInput.click();
  });
  
  document.getElementById('staging-manager').addEventListener('click', function() {
    browser.tabs.create({
      url: browser.runtime.getURL('staging-manager/index.html')
    });
    window.close();
  });

  document.getElementById('options').addEventListener('click', function() {
    browser.runtime.openOptionsPage();
    window.close();
  });