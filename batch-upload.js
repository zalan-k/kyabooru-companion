// Batch Upload Functionality
class BatchUploader {
  constructor() {
    this.files = [];
    this.sharedTags = [];
    this.poolId = null;
    this.isProcessing = false;
    
    this.initializeElements();
    this.setupEventListeners();
    // Don't generate pool ID until first image is added
  }

  initializeElements() {
    this.addPlaceholder = document.getElementById('add-placeholder');
    this.fileInput = document.getElementById('file-input');
    this.tagDisplay = document.getElementById('tag-display');
    this.tagInput = document.getElementById('tag-input');
    this.thumbnailGrid = document.getElementById('thumbnail-grid');
    this.poolIdDisplay = document.getElementById('pool-id');
    this.poolSection = document.getElementById('pool-section');
    this.imageCountDisplay = document.getElementById('image-count');
    this.processBtn = document.getElementById('process-btn');
    this.clearAllBtn = document.getElementById('clear-all-btn');
    this.progressContainer = document.getElementById('progress-container');
    this.progressBar = document.getElementById('progress-bar');
    this.progressText = document.getElementById('progress-text');
    this.statusMessage = document.getElementById('status-message');
  }

  setupEventListeners() {
    // Placeholder events (replaces drop zone)
    this.addPlaceholder.addEventListener('click', () => this.fileInput.click());
    this.addPlaceholder.addEventListener('dragover', this.handlePlaceholderDragOver.bind(this));
    this.addPlaceholder.addEventListener('dragleave', this.handlePlaceholderDragLeave.bind(this));
    this.addPlaceholder.addEventListener('drop', this.handlePlaceholderDrop.bind(this));

    // Grid-level drag/drop for when images exist (to add more)
    this.thumbnailGrid.addEventListener('dragover', this.handleGridDragOver.bind(this));
    this.thumbnailGrid.addEventListener('drop', this.handleGridDrop.bind(this));

    // File input
    this.fileInput.addEventListener('change', this.handleFileSelect.bind(this));

    // Tag input with autocomplete
    this.tagInput.addEventListener('input', this.debounce(this.updateAutocompleteSuggestions.bind(this), 200));
    this.tagInput.addEventListener('keydown', this.handleTagInput.bind(this));

    // Create autocomplete dropdown
    this.autocompleteDropdown = document.createElement('div');
    this.autocompleteDropdown.className = 'tag-autocomplete-dropdown';
    this.autocompleteDropdown.style.display = 'none';
    this.tagInput.parentNode.appendChild(this.autocompleteDropdown);
    this.selectedIndex = -1;

    // Close dropdown when clicking outside
    document.addEventListener('click', (e) => {
      if (!this.autocompleteDropdown.contains(e.target) && e.target !== this.tagInput) {
        this.autocompleteDropdown.style.display = 'none';
        this.selectedIndex = -1;
      }
    });

    // Action buttons
    this.processBtn.addEventListener('click', this.processImages.bind(this));
    this.clearAllBtn.addEventListener('click', this.clearAll.bind(this));
  }

  generatePoolId() {
    if (!this.poolId) {
      // Generate a unique random pool ID only when first image is added
      this.poolId = Math.random().toString(36).substring(2, 10);
      this.poolIdDisplay.textContent = this.poolId;
      this.poolSection.style.display = 'block';
    }
  }

  // Placeholder-specific drag handlers
  handlePlaceholderDragOver(e) {
    e.preventDefault();
    e.stopPropagation();
    this.addPlaceholder.classList.add('drag-over');
  }

  handlePlaceholderDragLeave(e) {
    e.preventDefault();
    e.stopPropagation();
    this.addPlaceholder.classList.remove('drag-over');
  }

  handlePlaceholderDrop(e) {
    e.preventDefault();
    e.stopPropagation();
    this.addPlaceholder.classList.remove('drag-over');
    
    const files = Array.from(e.dataTransfer.files);
    this.addFiles(files);
  }

  // Grid-specific drag handlers (for when placeholder is hidden)
  handleGridDragOver(e) {
    // Only handle if placeholder is hidden (files exist)
    if (this.files.length > 0) {
      e.preventDefault();
      e.stopPropagation();
    }
  }

  handleGridDrop(e) {
    // Only handle if placeholder is hidden (files exist) and not dropping on existing thumbnails
    if (this.files.length > 0 && !e.target.closest('.thumbnail-item')) {
      e.preventDefault();
      e.stopPropagation();
      
      const files = Array.from(e.dataTransfer.files);
      this.addFiles(files);
    }
  }

  handleFileSelect(e) {
    const files = Array.from(e.target.files);
    this.addFiles(files);
    
    // Reset file input
    this.fileInput.value = '';
  }

  addFiles(newFiles) {
    const validFiles = newFiles.filter(file => this.isValidFile(file));
    
    if (validFiles.length === 0) {
      this.showStatus('No valid image or video files selected.', 'error');
      return;
    }

    // Generate pool ID when first image is added
    if (this.files.length === 0 && validFiles.length > 0) {
      this.generatePoolId();
    }

    // Add to files array with metadata
    validFiles.forEach(file => {
      const fileData = {
        file: file,
        id: Date.now() + Math.random(), // Unique ID for tracking
        name: file.name,
        size: file.size,
        type: file.type,
        thumbnail: null
      };
      
      this.files.push(fileData);
    });

    this.updateUI();
    this.generateThumbnails();
    
    if (validFiles.length !== newFiles.length) {
      this.showStatus(`Added ${validFiles.length} files. ${newFiles.length - validFiles.length} files were skipped (invalid format).`, 'error');
    } else {
      this.showStatus(`Added ${validFiles.length} files successfully.`, 'success');
    }
  }

  isValidFile(file) {
    const validTypes = [
      'image/jpeg',
      'image/png', 
      'image/gif',
      'image/webp',
      'video/webm',
      'video/mp4'
    ];
    
    return validTypes.includes(file.type) && file.size <= 100 * 1024 * 1024; // 100MB limit
  }

  async generateThumbnails() {
    for (const fileData of this.files) {
      if (!fileData.thumbnail) {
        try {
          fileData.thumbnail = await this.createThumbnail(fileData.file);
        } catch (error) {
          console.error('Error generating thumbnail:', error);
          fileData.thumbnail = this.getDefaultThumbnail(fileData.type);
        }
      }
    }
    this.renderThumbnails();
  }

  createThumbnail(file) {
    return new Promise((resolve, reject) => {
      if (file.type.startsWith('image/')) {
        const img = new Image();
        img.onload = () => {
          const canvas = document.createElement('canvas');
          const ctx = canvas.getContext('2d');
          
          // Set canvas to exact thumbnail size for better quality
          canvas.width = 150;
          canvas.height = 197;
          
          // Enable better image smoothing
          ctx.imageSmoothingEnabled = true;
          ctx.imageSmoothingQuality = 'high';
          
          // Calculate scaling to cover the entire canvas (like object-fit: cover)
          const imgAspect = img.width / img.height;
          const canvasAspect = canvas.width / canvas.height;
          
          let drawWidth, drawHeight, offsetX = 0, offsetY = 0;
          
          if (imgAspect > canvasAspect) {
            // Image is wider than canvas ratio - fit height and crop width
            drawHeight = canvas.height;
            drawWidth = drawHeight * imgAspect;
            offsetX = (canvas.width - drawWidth) / 2;
          } else {
            // Image is taller than canvas ratio - fit width and crop height
            drawWidth = canvas.width;
            drawHeight = drawWidth / imgAspect;
            offsetY = (canvas.height - drawHeight) / 2;
          }
          
          ctx.drawImage(img, offsetX, offsetY, drawWidth, drawHeight);
          
          resolve(canvas.toDataURL('image/jpeg', 0.9)); // Higher quality
        };
        img.onerror = reject;
        img.src = URL.createObjectURL(file);
      } else if (file.type.startsWith('video/')) {
        // For videos, extract first frame with better quality
        const video = document.createElement('video');
        video.onloadedmetadata = () => {
          video.currentTime = 0.1; // Seek to first frame
        };
        video.onseeked = () => {
          const canvas = document.createElement('canvas');
          const ctx = canvas.getContext('2d');
          
          canvas.width = 150;
          canvas.height = 197;
          
          // Enable better image smoothing
          ctx.imageSmoothingEnabled = true;
          ctx.imageSmoothingQuality = 'high';
          
          // Scale video to cover canvas
          const videoAspect = video.videoWidth / video.videoHeight;
          const canvasAspect = canvas.width / canvas.height;
          
          let drawWidth, drawHeight, offsetX = 0, offsetY = 0;
          
          if (videoAspect > canvasAspect) {
            drawHeight = canvas.height;
            drawWidth = drawHeight * videoAspect;
            offsetX = (canvas.width - drawWidth) / 2;
          } else {
            drawWidth = canvas.width;
            drawHeight = drawWidth / videoAspect;
            offsetY = (canvas.height - drawHeight) / 2;
          }
          
          ctx.drawImage(video, offsetX, offsetY, drawWidth, drawHeight);
          URL.revokeObjectURL(video.src);
          
          resolve(canvas.toDataURL('image/jpeg', 0.9));
        };
        video.onerror = reject;
        video.src = URL.createObjectURL(file);
      }
    });
  }

  getDefaultThumbnail(type) {
    // Return a simple colored rectangle as fallback
    const canvas = document.createElement('canvas');
    canvas.width = 150;
    canvas.height = 100;
    const ctx = canvas.getContext('2d');
    
    ctx.fillStyle = type.startsWith('video/') ? '#e74c3c' : '#95a5a6';
    ctx.fillRect(0, 0, 150, 100);
    
    ctx.fillStyle = 'white';
    ctx.font = '14px Arial';
    ctx.textAlign = 'center';
    ctx.fillText(type.startsWith('video/') ? 'Video' : 'Image', 75, 55);
    
    return canvas.toDataURL('image/jpeg', 0.8);
  }

  renderThumbnails() {
    // Hide/show placeholder based on file count
    if (this.files.length === 0) {
      this.addPlaceholder.style.display = 'flex';
      // Remove any existing thumbnail items
      const existingThumbnails = this.thumbnailGrid.querySelectorAll('.thumbnail-item');
      existingThumbnails.forEach(item => item.remove());
      return;
    } else {
      this.addPlaceholder.style.display = 'none';
    }

    // Remove existing thumbnails
    const existingThumbnails = this.thumbnailGrid.querySelectorAll('.thumbnail-item');
    existingThumbnails.forEach(item => item.remove());

    this.files.forEach((fileData, index) => {
      const item = document.createElement('div');
      item.className = 'thumbnail-item';
      item.draggable = true;
      item.dataset.fileId = fileData.id;

      item.innerHTML = `
        <div class="thumbnail-index">${index + 1}</div>
        <button class="thumbnail-remove" data-file-id="${fileData.id}">×</button>
        <img class="thumbnail-image" src="${fileData.thumbnail || ''}" alt="Image">
      `;

      // Add remove button event listener
      const removeBtn = item.querySelector('.thumbnail-remove');
      removeBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        this.removeFile(fileData.id);
      });

      // Add drag and drop for reordering
      item.addEventListener('dragstart', this.handleThumbnailDragStart.bind(this));
      item.addEventListener('dragover', this.handleThumbnailDragOver.bind(this));
      item.addEventListener('drop', this.handleThumbnailDrop.bind(this));
      item.addEventListener('dragend', this.handleThumbnailDragEnd.bind(this));

      this.thumbnailGrid.appendChild(item);
    });
  }

  formatFileSize(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  }

  handleThumbnailDragStart(e) {
    e.dataTransfer.setData('text/plain', e.currentTarget.dataset.fileId);
    e.currentTarget.classList.add('dragging');
  }

  handleThumbnailDragOver(e) {
    e.preventDefault();
  }

  handleThumbnailDrop(e) {
    e.preventDefault();
    const draggedId = e.dataTransfer.getData('text/plain');
    const targetId = e.currentTarget.dataset.fileId;

    if (draggedId !== targetId) {
      this.reorderFiles(draggedId, targetId);
    }
  }

  handleThumbnailDragEnd(e) {
    e.currentTarget.classList.remove('dragging');
  }

  reorderFiles(draggedId, targetId) {
    const draggedIndex = this.files.findIndex(f => f.id == draggedId);
    const targetIndex = this.files.findIndex(f => f.id == targetId);

    if (draggedIndex !== -1 && targetIndex !== -1) {
      // Move the dragged item to the target position
      const [draggedFile] = this.files.splice(draggedIndex, 1);
      this.files.splice(targetIndex, 0, draggedFile);
      
      this.renderThumbnails();
    }
  }

  removeFile(fileId) {
    this.files = this.files.filter(f => f.id != fileId);
    this.updateUI();
    this.renderThumbnails();
  }

  handleTagInput(e) {
    // Autocomplete dropdown navigation
    if (this.autocompleteDropdown.style.display === 'block') {
      const items = this.autocompleteDropdown.querySelectorAll('.autocomplete-item');
      
      // Down arrow - move selection down
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        this.selectedIndex = (this.selectedIndex + 1) % items.length;
        this.highlightSelectedItem(items, this.selectedIndex);
      }
      
      // Up arrow - move selection up
      else if (e.key === 'ArrowUp') {
        e.preventDefault();
        this.selectedIndex = this.selectedIndex <= 0 ? items.length - 1 : this.selectedIndex - 1;
        this.highlightSelectedItem(items, this.selectedIndex);
      }
      
      // Tab or Enter with selection - select current item
      else if ((e.key === 'Tab' || e.key === 'Enter') && this.selectedIndex >= 0) {
        e.preventDefault();
        
        const selectedItem = items[this.selectedIndex];
        const tagName = selectedItem.querySelector('.tag-name').textContent;
        const category = selectedItem.querySelector('.autocomplete-category').textContent;
        
        const fullTag = category !== 'general' ? `${category}:${tagName}` : tagName;
        this.selectTag(fullTag);
        return;
      }
    }

    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      
      // If dropdown is visible but no selection, hide it
      if (this.autocompleteDropdown.style.display === 'block' && this.selectedIndex === -1) {
        this.autocompleteDropdown.style.display = 'none';
      }
      // Check if this is to add a tag
      else if (this.tagInput.value.trim()) {
        // Get current raw input - split by commas if multiple tags entered at once
        const newTags = this.tagInput.value.trim().split(',').map(tag => tag.trim()).filter(tag => tag);
        
        newTags.forEach(tag => {
          if (!this.sharedTags.includes(tag)) {
            this.sharedTags.push(tag);
          }
        });
        
        this.tagInput.value = '';
        this.autocompleteDropdown.style.display = 'none';
        this.renderTags();
      }
    }
  }

  // Handle autocomplete suggestions
  async updateAutocompleteSuggestions() {
    const query = this.tagInput.value.trim();
    
    if (query.length < 2) {
      this.autocompleteDropdown.style.display = 'none';
      this.selectedIndex = -1;
      return;
    }
    
    try {
      // Request tag suggestions from background script
      const suggestions = await browser.runtime.sendMessage({
        action: 'search-tags',
        query: query
      });

      if (suggestions && suggestions.length > 0) {
        // Render suggestions in dropdown
        this.autocompleteDropdown.innerHTML = '';
        
        suggestions.forEach(tag => {
          const item = document.createElement('div');
          item.className = 'autocomplete-item';
          
          // Format tag display (category:name)
          let displayText = tag;
          let category = 'general';
          
          if (tag.includes(':')) {
            const [cat, name] = tag.split(':', 2);
            category = cat;
            displayText = name;
          }
          
          item.innerHTML = `
            <span class="tag-name">${displayText}</span>
            <span class="autocomplete-category">${category}</span>
          `;
          
          // Add click handler to select tag
          item.addEventListener('click', () => {
            this.selectTag(tag);
          });
          
          this.autocompleteDropdown.appendChild(item);
        });
        
        this.autocompleteDropdown.style.display = 'block';
        this.selectedIndex = -1;
      } else {
        this.autocompleteDropdown.style.display = 'none';
        this.selectedIndex = -1;
      }
    } catch (error) {
      console.error('Autocomplete error:', error);
      this.autocompleteDropdown.style.display = 'none';
    }
  }

  // Select a tag from autocomplete
  selectTag(tag) {
    // Only add if not already there
    if (!this.sharedTags.includes(tag)) {
      this.sharedTags.push(tag);
      this.renderTags();
    }
    
    // Reset input and dropdown
    this.tagInput.value = '';
    this.autocompleteDropdown.style.display = 'none';
    this.selectedIndex = -1;
    this.tagInput.focus();
  }

  // Highlight selected autocomplete item
  highlightSelectedItem(items, index) {
    items.forEach((item, i) => {
      item.classList.toggle('selected', i === index);
    });
    
    if (index >= 0) {
      items[index].scrollIntoView({ block: 'nearest' });
    }
  }

  // Debounce function
  debounce(func, wait) {
    let timeout;
    return function() {
      const context = this;
      const args = arguments;
      clearTimeout(timeout);
      timeout = setTimeout(() => func.apply(context, args), wait);
    };
  }

  renderTags() {
    this.tagDisplay.innerHTML = '';
    
    this.sharedTags.forEach(tag => {
      const [category, name] = tag.includes(':') ? tag.split(':', 2) : ['general', tag];
      
      const pill = document.createElement('span');
      pill.className = `tag-pill tag-${category}`;
      pill.setAttribute('data-tag', tag);
      pill.innerHTML = `
        <span class="tag-content">${name}</span> 
        <span class="tag-delete" data-tag="${tag}">×</span>
      `;
      
      // Add remove event listener
      const deleteBtn = pill.querySelector('.tag-delete');
      deleteBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        this.removeTag(tag);
      });

      // Add category change handler
      const contentSpan = pill.querySelector('.tag-content');
      contentSpan.addEventListener('click', (e) => {
        e.stopPropagation();
        this.showCategoryDropdown(pill, tag);
      });
      
      this.tagDisplay.appendChild(pill);
    });
  }

  // Show category dropdown for a tag
  showCategoryDropdown(pillElement, currentTag) {
    // Remove existing dropdown
    const existing = document.querySelector('.tag-category-dropdown');
    if (existing) existing.remove();
    
    const [currentCategory, tagName] = currentTag.includes(':') ? 
      currentTag.split(':', 2) : ['general', currentTag];
    
    const categories = [
      { value: 'general', label: 'General', color: 'rgba(153, 153, 153, 0.7)' },
      { value: 'artist', label: 'Artist', color: 'rgba(255, 117, 117, 0.7)' },
      { value: 'character', label: 'Character', color: 'rgba(121, 187, 255, 0.7)' },
      { value: 'copyright', label: 'Copyright', color: 'rgba(179, 136, 255, 0.7)' },
      { value: 'meta', label: 'Meta', color: 'rgba(251, 192, 45, 0.7)' }
    ];
    
    const dropdown = document.createElement('div');
    dropdown.className = 'tag-category-dropdown';
    
    const rect = pillElement.getBoundingClientRect();
    dropdown.style.cssText = `position: fixed; top: ${rect.bottom + 5}px; left: ${rect.left}px; z-index: 999999999;`;
    
    categories.forEach(cat => {
      const option = document.createElement('div');
      option.className = 'tag-category-option';
      option.innerHTML = `
        <div class="category-color" style="background: ${cat.color};"></div>
        <span>${cat.label}</span>
        ${cat.value === currentCategory ? '<span class="selected-mark">✓</span>' : ''}
      `;
      if (cat.value === currentCategory) option.classList.add('selected');
      
      option.addEventListener('click', (e) => {
        e.stopPropagation();
        if (cat.value !== currentCategory) {
          const newTag = cat.value === 'general' ? tagName : `${cat.value}:${tagName}`;
          
          // Update the tag in the array
          const tagIndex = this.sharedTags.indexOf(currentTag);
          if (tagIndex !== -1) {
            this.sharedTags[tagIndex] = newTag;
            this.renderTags();
          }
        }
        dropdown.remove();
      });
      
      dropdown.appendChild(option);
    });
    
    document.body.appendChild(dropdown);
    
    // Close on outside click
    setTimeout(() => {
      const close = (e) => {
        if (!dropdown.contains(e.target) && !pillElement.contains(e.target)) {
          dropdown.remove();
          document.removeEventListener('click', close);
        }
      };
      document.addEventListener('click', close);
    }, 10);
  }

  removeTag(tag) {
    this.sharedTags = this.sharedTags.filter(t => t !== tag);
    this.renderTags();
  }

  updateUI() {
    this.imageCountDisplay.textContent = this.files.length;
    this.processBtn.disabled = this.files.length === 0 || this.isProcessing;
  }

  async processImages() {
    if (this.files.length === 0) {
      this.showStatus('No images to process.', 'error');
      return;
    }

    this.isProcessing = true;
    this.processBtn.disabled = true;
    this.clearAllBtn.disabled = true;
    this.progressContainer.style.display = 'block';
    
    try {
      for (let i = 0; i < this.files.length; i++) {
        const fileData = this.files[i];
        const progress = ((i + 1) / this.files.length) * 100;
        
        this.updateProgress(progress, `Processing ${fileData.name}...`);
        
        // Create the data object for saving
        const saveData = {
          url: `file://${fileData.name}`, // Local file reference
          tags: [...this.sharedTags], // Copy shared tags
          imageUrl: null, // Will be set to local file path after save
          timestamp: new Date().toISOString(),
          poolId: this.poolId,
          poolIndex: i,
          localFile: true,
          fileName: fileData.name,
          fileData: fileData.file
        };

        // Send to background script for processing
        await this.saveImageData(saveData);
        
        // Small delay to prevent overwhelming the system
        await new Promise(resolve => setTimeout(resolve, 100));
      }
      
      this.updateProgress(100, 'All images processed successfully!');
      this.showStatus(`Successfully processed ${this.files.length} images with pool ID: ${this.poolId}`, 'success');
      
      // Auto-clear after successful processing
      setTimeout(() => {
        this.clearAll();
      }, 3000);
      
    } catch (error) {
      console.error('Error processing images:', error);
      this.showStatus(`Error processing images: ${error.message}`, 'error');
    } finally {
      this.isProcessing = false;
      this.processBtn.disabled = false;
      this.clearAllBtn.disabled = false;
      
      setTimeout(() => {
        this.progressContainer.style.display = 'none';
      }, 2000);
    }
  }

  async saveImageData(data) {
    return new Promise((resolve, reject) => {
      // Create a blob URL for the file
      const blob = new Blob([data.fileData], { type: data.fileData.type });
      const url = URL.createObjectURL(blob);
      
      const finalData = {
        ...data,
        blobUrl: url,
        fileData: null // Remove file object since it can't be serialized
      };
      
      browser.runtime.sendMessage({
        action: "save-batch-image",
        data: finalData
      }).then(response => {
        URL.revokeObjectURL(url); // Clean up
        if (response && response.success) {
          resolve(response);
        } else {
          reject(new Error(response?.error || 'Unknown error'));
        }
      }).catch(error => {
        URL.revokeObjectURL(url); // Clean up on error
        reject(error);
      });
    });
  }

  updateProgress(percent, text) {
    this.progressBar.style.width = `${percent}%`;
    this.progressText.textContent = text;
  }

  showStatus(message, type) {
    this.statusMessage.textContent = message;
    this.statusMessage.className = `status-message ${type}`;
    this.statusMessage.style.display = 'block';
    
    setTimeout(() => {
      this.statusMessage.style.display = 'none';
    }, 5000);
  }

  clearAll() {
    this.files = [];
    this.sharedTags = [];
    this.poolId = null; // Reset pool ID
    this.poolIdDisplay.textContent = 'Not assigned yet';
    this.poolSection.style.display = 'none'; // Hide pool section
    this.renderTags();
    this.renderThumbnails();
    this.updateUI();
    this.tagInput.value = '';
    this.progressContainer.style.display = 'none';
    this.statusMessage.style.display = 'none';
  }
}

// Tag pill styles (reusing from main extension)
const tagStyles = `
  .tag-pill {
    display: inline-flex;
    align-items: center;
    padding: 4px 8px;
    border-radius: 4px;
    font-size: 12px;
    white-space: nowrap;
    box-shadow: 0 1px 2px rgba(0, 0, 0, 0.1);
    margin: 2px;
    transition: transform 0.1s ease;
  }

  .tag-pill:hover {
    transform: translateY(-1px);
  }

  .tag-artist { background-color: rgba(255, 117, 117, 0.9); color: white; }
  .tag-character { background-color: rgba(121, 187, 255, 0.9); color: white; }
  .tag-copyright { background-color: rgba(179, 136, 255, 0.9); color: white; }
  .tag-general { background-color: rgba(153, 153, 153, 0.9); color: white; }
  .tag-meta { background-color: rgba(251, 192, 45, 0.9); color: white; }

  .tag-delete {
    cursor: pointer;
    margin-left: 4px;
    opacity: 0.7;
  }

  .tag-delete:hover {
    opacity: 1;
  }

  .tag-content {
    cursor: pointer;
    user-select: none;
  }

  .tag-content:hover {
    opacity: 0.8;
  }
`;

// Inject tag styles
const styleElement = document.createElement('style');
styleElement.textContent = tagStyles;
document.head.appendChild(styleElement);

// Initialize the batch uploader when the page loads
let batchUploader;
document.addEventListener('DOMContentLoaded', () => {
  batchUploader = new BatchUploader();
});