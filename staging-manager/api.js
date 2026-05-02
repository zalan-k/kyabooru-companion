// ============================================
// CONFIGURATION
// ============================================
const API_BASE = 'http://localhost:3737';
const VALID_CATEGORIES = ['artist', 'character', 'copyright', 'general', 'meta'];



// ============================================
// SAVE QUEUE
// ============================================
let saveQueue = Promise.resolve();
// ============================================
// CONNECTION STATUS
// ============================================
let connectionStatus = {
    isConnected: false,
    lastChecked: null,
    error: null,
    serverVersion: null
};

async function initializeConnection() {
    await checkConnection();

    // Set up periodic connection checks (every minute) & when returning to tab
    setInterval(checkConnection, 60000);
    document.addEventListener('visibilitychange', () => {
      if (!document.hidden) {
        checkConnection();
      }
    });
}

async function checkConnection() {
    const statusEl = document.getElementById('status-indicator');
    try {
      statusEl.className = 'status-indicator connecting';
      
      // Try to connect to server
      const response = await fetch(`${API_BASE}/api/health`, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
        timeout: 5000 // This would need proper timeout handling
      });
      
      if (response.ok) {
        const data = await response.json();
        connectionStatus.isConnected = true;
        connectionStatus.lastChecked = new Date();
        connectionStatus.serverVersion = data.version;
        connectionStatus.error = null;
        
        statusEl.className = 'status-indicator connected';
        showConnectionAlert('Connected to server', 'success');
        
        return true;
      } else {
      // TODO
        return true;
        //throw new Error(`Server returned ${response.status}`);
      }
    } catch (error) {
      return true;
      //connectionStatus.isConnected = false;
      //connectionStatus.error = error.message;
      
      // Check if it's a connection error or server error
      if (error.name === 'TypeError' && error.message.includes('Failed to fetch')) {
        statusEl.className = 'status-indicator disconnected';
        showConnectionAlert('Cannot connect to server. Make sure the server is running at ' + API_BASE, 'error');
      } else {
        statusEl.className = 'status-indicator error';
        showConnectionAlert('Server error: ' + error.message, 'warning');
      }
      
      return false;
    }
}

function showConnectionAlert(message, type = 'info') {
    // Remove existing alert
    const existing = document.getElementById('connection-alert');
    if (existing) existing.remove();
    
    // Create new alert
    const alert = document.createElement('div');
    alert.id = 'connection-alert';
    alert.className = `connection-alert ${type}`;
    alert.innerHTML = `
      <div style="flex:1;">
        <div style="font-weight:500;margin-bottom:4px;">${type === 'success' ? '✅ Connected' : type === 'error' ? '❌ Connection Error' : '⚠️ Warning'}</div>
        <div style="font-size:12px;opacity:0.9;">${escapeHtml(message)}</div>
      </div>
      <button class="connection-alert-close" style="background:none;border:none;color:inherit;cursor:pointer;font-size:18px;">×</button>
    `;
    
    document.body.appendChild(alert);
    alert.querySelector('.connection-alert-close').addEventListener('click', () => alert.remove());

    // Auto-hide success messages after 3 seconds
    if (type === 'success') {
      setTimeout(() => {
        if (alert.parentElement) {
          alert.remove();
        }
      }, 3000);
    }
}

// ============================================
// API HELPERS
// ============================================

async function apiCall(endpoint, options = {}) {
    try {
        const response = await fetch(`${API_BASE}${endpoint}`, {
        headers: { 'Content-Type': 'application/json' },
        ...options
        });
        if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`${response.status}: ${errorText}`);
        }
        return await response.json();
    } catch (error) {
        console.error(`API call failed: ${endpoint}`, error);
        throw error;
    }
}

async function loadConfig() {
    try {
        config = await apiCall('/api/config');
        delete config.suggestions;
        delete config.dismissed;
        renderAliases();
        renderExclusions();
        renderHierarchy();
        renderSuggestions();
    } catch (error) {
        showToast('Failed to load config - is the server running?', 'error');
    }
}

async function loadStats() {
    try {
        const stats = await apiCall('/api/stats');
        document.getElementById('stat-images').textContent = stats.imageCount || 0;
        document.getElementById('stat-tags').textContent = stats.uniqueTags || 0;
    } catch (error) {
        // Stats endpoint may not exist
    }
}

async function saveAliases() {
  saveQueue = saveQueue.then(async () => {
    try {
      await apiCall('/api/config/aliases', {
        method: 'PUT',
        body: JSON.stringify(config.aliases)
      });
      showToast('Aliases saved');
      updateAllCounts();
    } catch (error) {
      showToast('Failed to save aliases', 'error');
    }
  });
  return saveQueue;
}

async function saveExclusions() {
  saveQueue = saveQueue.then(async () => {
    try {
      await apiCall('/api/config/exclusions', {
        method: 'PUT',
        body: JSON.stringify(config.exclusions)
      });
      showToast('Exclusions saved');
      updateAllCounts();
    } catch (error) {
      showToast('Failed to save exclusions', 'error');
    }
  });
  
  return saveQueue;
}

async function saveHierarchy() {
    try {
      await apiCall('/api/config/hierarchy', {
        method: 'PUT',
        body: JSON.stringify(config.hierarchy)
      });
      showToast('Hierarchy saved');
      updateAllCounts();
    } catch (error) {
      showToast('Failed to save hierarchy', 'error');
    }
}

async function runAnalyzer() {
  showSpinner('Analyzing tags...');
  try {
    const res = await fetch(`${API_BASE}/api/config/suggestions/analyze`, { method: 'POST' });
    const result = await res.json();
    if (!res.ok) throw new Error(result.error || `HTTP ${res.status}`);

    hideSpinner();
    showToast(
      `Analyzed: ${result.aliasGroups} alias groups, ` +
      `${result.blacklistCandidates} blacklist candidates`
    );

    aliasSuggestionsPage = 0;
    garbageSuggestionsPage = 0;
    await renderSuggestions();
    updateAllCounts();
  } catch (err) {
    hideSpinner();
    showToast(`Analyze failed: ${err.message}`, 'error');
  }
}

async function saveCurrentImage() {
  if (selectedIds.size === 0) return;

  // Multi-select: just push the pending-tags buffer to all selected
  if (selectedIds.size > 1) {
    if (pendingTagAdditions.length === 0) {
      showToast('No tags to add', 'info');
      return;
    }
    try {
      const summary = await apiCall('/api/staging/images/batch', {
        method: 'PATCH',
        body: JSON.stringify({
          ids: [...selectedIds],
          addTags: pendingTagAdditions,
        }),
      });
      const msg = summary.failed > 0
        ? `Tagged ${summary.succeeded}/${summary.total} (${summary.failed} failed)`
        : `Tagged ${summary.succeeded} images`;
      showToast(msg, summary.failed > 0 ? 'warning' : 'success');
      pendingTagAdditions = [];
      renderPendingTags();

      // Refresh visible badges on cards (the count went up by N tags each)
      // Cheapest correct refresh: reload the grid.
      loadImages(true);
    } catch (err) {
      showToast(`Batch tag failed: ${err.message}`, 'error');
    }
    return;
  }

  // Single-select: existing flow, unchanged
  if (!currentImageData) return;
  const id = [...selectedIds][0];
  try {
    await apiCall(`/api/staging/images/${encodeURIComponent(id)}`, {
      method: 'PUT',
      body: JSON.stringify({
        tags: currentImageData.tags,
        sourceUrl: document.getElementById('sidebar-source-url').value,
        poolId: document.getElementById('sidebar-pool-id').value || null,
        poolIndex: parseInt(document.getElementById('sidebar-pool-index').value) || null,
      }),
    });
    showToast('Image saved');

    const card = document.querySelector(`.image-card[data-id="${id}"]`);
    if (card) {
      const badge = card.querySelector('.tag-count-badge');
      if (badge) badge.textContent = `${currentImageData.tags.length} tags`;
    }
  } catch (error) {
    showToast('Failed to save image', 'error');
  }
}

async function deleteCurrentImage() {
  if (selectedIds.size === 0) return;

  const count = selectedIds.size;
  const confirmMsg = count === 1
    ? 'Delete this image from staging?'
    : `Delete ${count} images from staging?`;
  if (!confirm(confirmMsg)) return;

  try {
    const summary = await apiCall('/api/staging/images/batch', {
      method: 'DELETE',
      body: JSON.stringify({ ids: [...selectedIds] }),
    });

    const msg = summary.failed > 0
      ? `Deleted ${summary.succeeded}/${summary.total} (${summary.failed} failed)`
      : `Deleted ${summary.succeeded} image${summary.succeeded === 1 ? '' : 's'}`;
    showToast(msg, summary.failed > 0 ? 'warning' : 'success');

    // Remove successful cards from the DOM
    summary.results.forEach(r => {
      if (r.success) {
        const card = document.querySelector(`.image-card[data-id="${r.id}"]`);
        if (card) card.remove();
      }
    });

    // Update local cache + close sidebar
    const successIds = new Set(summary.results.filter(r => r.success).map(r => r.id));
    stagingImages = stagingImages.filter(img => !successIds.has(img.id));
    selectedIds = new Set([...selectedIds].filter(id => !successIds.has(id)));
    applySelection();
    updateAllCounts();
  } catch (error) {
    showToast(`Delete failed: ${error.message}`, 'error');
  }
}

function generatePoolId() {
    const id = 'pool_' + Date.now().toString(36) + Math.random().toString(36).substr(2, 5);
    document.getElementById('sidebar-pool-id').value = id;
}

async function showAutocompleteResults(input, dropdown, onSelect) {
    const query = input.value.trim();

    if (query.length < 2) {
      dropdown.classList.remove('visible');
      return;
    }

    try {
      const results = await apiCall(`/api/tags/search?q=${encodeURIComponent(query)}&limit=15`);

      if (!results || results.length === 0) {
        dropdown.innerHTML = '<div class="autocomplete-item" style="color:var(--text-muted);">No matches found</div>';
      } else {
          dropdown.innerHTML = results.map((tag, idx) => {
            const tagStr = tag.tag || tag;
            const { category, name } = parseTag(tagStr);
            const displayed = (name || '').replace(/_/g, ' ');
            return `
              <div class="autocomplete-item" data-tag="${escapeAttr(tagStr)}" data-index="${idx}">
                <span class="tag-name">${escapeHtml(displayed)}</span>
                <span class="category-badge category-${category}">${category}</span>
              </div>
            `;
          }).join('');

        dropdown.querySelectorAll('.autocomplete-item[data-tag]').forEach(item => {
          item.onclick = () => {
            const selectedTag = item.dataset.tag;
            if (onSelect) {
              onSelect(selectedTag);
            } else {
              input.value = selectedTag;
            }
            dropdown.classList.remove('visible');
          };
        });
      }

      dropdown.classList.add('visible');
      autocompleteSelectedIndex = -1;
    } catch (error) {
      console.error('Autocomplete error:', error);
    }
}

let currentUploadFilter = 'all';

async function loadImages(reset = false) {
    if (imagesLoading) return;
    if (!imagesHasMore && !reset) return;

    if (reset) {
      imagesOffset = 0;
      stagingImages = [];
      imagesHasMore = true;
      document.getElementById('images-grid').innerHTML = '';
    }

    imagesLoading = true;
    document.getElementById('load-more-trigger').style.display = 'flex';

    try {
      // Add the sort parameter to the API call
      const result = await apiCall(`/api/staging/images?limit=50&offset=${imagesOffset}&sort=${currentSort}&upload=${currentUploadFilter}`);
      stagingImages = stagingImages.concat(result.images || []);
      imagesHasMore = result.hasMore ?? false;
      imagesOffset += (result.images || []).length;
      renderImages(result.images || []);
      updateAllCounts();
    } catch (error) {
      showToast('Failed to load images', 'error');
    } finally {
      imagesLoading = false;
      document.getElementById('load-more-trigger').style.display = imagesHasMore ? 'flex' : 'none';
    }
}

async function loadSidebarSingle(id) {
  try {
    currentImageData = await apiCall(`/api/staging/images/${encodeURIComponent(id)}`);

    const fileUrl = `${API_BASE}/api/staging/image/${encodeURIComponent(id)}`;
    const imgEl = document.getElementById('sidebar-image');
    const videoEl = document.getElementById('sidebar-video');

    if (currentImageData.mediaType === 'video') {
      imgEl.style.display = 'none';
      imgEl.removeAttribute('src');

      videoEl.style.display = '';
      videoEl.src = fileUrl;
      videoEl.play().catch(() => {
        // Autoplay blocked — that's fine, user can hit play
      });
    } else {
      videoEl.style.display = 'none';
      videoEl.pause();
      videoEl.removeAttribute('src');
      videoEl.load();   // releases the previous video resource

      imgEl.style.display = '';
      imgEl.src = fileUrl;
    }

    document.getElementById('sidebar-image').src =
      `${API_BASE}/api/staging/image/${encodeURIComponent(id)}`;
    document.getElementById('sidebar-source-url').value = currentImageData.sourceUrl || '';
    document.getElementById('sidebar-pool-id').value = currentImageData.poolId || '';
    document.getElementById('sidebar-pool-index').value = currentImageData.poolIndex ?? '';
    document.getElementById('sidebar-phash').value = currentImageData.phash || '';

    // Clear multi-select state if any
    pendingTagAdditions = [];

    // Re-enable everything (in case we were just in multi-select mode)
    setSidebarMultiMode(false);

    renderSidebarTags();
    document.getElementById('image-sidebar').classList.remove('hidden');
  } catch (error) {
    showToast('Failed to load image details', 'error');
  }
}

function selectImage(id) {
  selectedIds.clear();
  selectedIds.add(id);
  lastClickedId = id;
  applySelection();
}

// ============================================
// BOORU UPLOAD WITH PROGRESS
// ============================================

// SVG path strings for the three cloud states. Swapped into the icon
// element by replacing innerHTML — same width/height/stroke, only the
// paths differ.
const CLOUD_ICONS = {
  check: `<path d="m9 16 2 2 4-4"/>`,
  cog: `
    <path d="m8 17 4-4 4 4"/>
    <path d="M12 13v9"/>
  `,
  alert: `
    <path d="M12 12v4"/>
    <path d="M12 20h.01"/>
  `,
};

const cloudStatus = (() => {
  let card, icon, text, hideTimeout;

  function ensure() {
    if (card) return;
    card = document.getElementById('cloud-status-card');
    icon = document.getElementById('cloud-status-icon');
    text = document.getElementById('cloud-status-text');
  }

  function setState(state, label, iconKey) {
    ensure();
    card.classList.remove('state-uploading', 'state-error');
    if (state) card.classList.add('state-' + state);
    text.textContent = label;
    // Only update the accent group, not the whole icon
    const accent = document.getElementById('cloud-status-accent');
    if (accent) accent.innerHTML = CLOUD_ICONS[iconKey];
  }

  function idle() {
    clearTimeout(hideTimeout);
    setState(null, 'Synced', 'check');
  }

  function start(total) {
    clearTimeout(hideTimeout);
    setState('uploading', `0/${total}`, 'cog');
  }

  function update(completed, total) {
    setState('uploading', `${completed}/${total}`, 'cog');
  }

  function complete(succeeded, failed) {
    if (failed > 0) {
      setState('error', `${failed} error${failed === 1 ? '' : 's'}`, 'alert');
      // Auto-clear error state after 6s
      hideTimeout = setTimeout(idle, 6000);
    } else {
      setState(null, 'Synced', 'check');
    }
  }

  function fail() {
    setState('error', 'Failed', 'alert');
    hideTimeout = setTimeout(idle, 6000);
  }

  return { idle, start, update, complete, fail };
})();

// Initialize to idle on page load
document.addEventListener('DOMContentLoaded', () => cloudStatus.idle());

// Parse one SSE event block ("event: foo\ndata: {...}").
function parseSSEEvent(raw) {
  const lines = raw.split('\n');
  let eventType = 'message';
  let data = '';
  for (const line of lines) {
    if (line.startsWith('event:')) eventType = line.slice(6).trim();
    else if (line.startsWith('data:')) data += line.slice(5).trim();
  }
  if (!data) return null;
  try {
    return { type: eventType, data: JSON.parse(data) };
  } catch {
    return { type: eventType, data };
  }
}

let isBooruUploading = false;

/**
 * POST to /upload-to-booru/stream and feed events.
 * Returns the final summary on success. Throws on transport / fatal error.
 */
async function streamBooruUpload(payload) {
  if (isBooruUploading) {
    throw new Error('An upload is already in progress');
  }
  isBooruUploading = true;

  try {
    const response = await fetch(`${API_BASE}/api/staging/upload-to-booru/stream`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const errBody = await response.json().catch(() => ({ error: response.statusText }));
      throw new Error(errBody.error || `Server returned ${response.status}`);
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    let summary = null;
    let fatalError = null;

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });

      // Events are separated by a blank line (\n\n).
      let idx;
      while ((idx = buffer.indexOf('\n\n')) !== -1) {
        const rawEvent = buffer.slice(0, idx);
        buffer = buffer.slice(idx + 2);

        const ev = parseSSEEvent(rawEvent);
        if (!ev) continue;

        switch (ev.type) {
          case 'start':   cloudStatus.start(ev.data.total); break;
          case 'item':    cloudStatus.update(ev.data.completed, ev.data.total); break;
          case 'done':    cloudStatus.complete(ev.data.succeeded, ev.data.failed); break;
          case 'error':   cloudStatus.fail(); break;
        }
      }
    }

    if (fatalError) throw fatalError;
    return summary;
  } catch (err) {
    // Network / transport errors that fired before any 'error' event arrived.
    throw err;
  } finally {
    isBooruUploading = false;
  }
}

/** Trigger: upload all un-uploaded staging images. */
async function startBooruUploadAll() {
  if (!confirm('Upload all un-uploaded staging images to the booru?')) return;
  try {
    await streamBooruUpload({ all: true });
    loadImages(true); // refresh grid (will pick up overlay state once that lands)
  } catch (err) {
    console.error('Booru upload failed:', err);
  }
}

/** Trigger: upload the currently selected staging image. */
async function uploadCurrentImageToBooru() {
  if (selectedIds.size === 0) {
    showToast('No image selected', 'error');
    return;
  }
  try {
    await streamBooruUpload({ ids: [...selectedIds] });
    // Refresh whatever's visible — single image gets re-fetched, otherwise reload grid
    if (selectedIds.size === 1) {
      const id = [...selectedIds][0];
      loadSidebarSingle(id);
    } else {
      loadImages(true);
    }
  } catch (err) {
    console.error('Booru upload failed:', err);
  }
}

document.addEventListener('DOMContentLoaded', () => {
  const uploadAllBtn = document.getElementById('upload-to-booru-btn');
  if (uploadAllBtn) uploadAllBtn.addEventListener('click', startBooruUploadAll);

  const sidebarUploadBtn = document.getElementById('sidebar-upload-btn');
  if (sidebarUploadBtn) sidebarUploadBtn.addEventListener('click', uploadCurrentImageToBooru);

  const closeBtn = document.getElementById('sidebar-close-btn');
  if (closeBtn) closeBtn.addEventListener('click', closeSidebar);

  const saveBtn = document.getElementById('sidebar-save-btn');
  if (saveBtn) saveBtn.addEventListener('click', saveCurrentImage);

  const deleteBtn = document.getElementById('sidebar-delete-btn');
  if (deleteBtn) deleteBtn.addEventListener('click', deleteCurrentImage);

  const newPoolBtn = document.getElementById('sidebar-new-pool-btn');
  if (newPoolBtn) newPoolBtn.addEventListener('click', generatePoolId);

  const wire = (id, fn, eventType = 'click') => {
    const el = document.getElementById(id);
    if (el) el.addEventListener(eventType, fn);
  };

  // --- Top dropdown menu ---
  // --- Top dropdown ---
  wire('dropdown-run-analyzer-btn',           runAnalyzer);

  // Import (canonize-from-file)
  wire('dropdown-import-aliases-btn',         () => canonizeConfigSection('aliases'));
  wire('dropdown-import-hierarchy-btn',       () => canonizeConfigSection('hierarchy'));
  wire('dropdown-import-exclusions-btn',      () => canonizeConfigSection('blacklist'));

  // Export (download-as-JSON)
  wire('dropdown-export-all-btn',             exportAllConfigs);
  wire('dropdown-export-aliases-btn',         () => exportConfigSection('aliases'));
  wire('dropdown-export-hierarchy-btn',       () => exportConfigSection('hierarchy'));
  wire('dropdown-export-exclusions-btn',      () => exportConfigSection('blacklist'));

  // Reload submenu
  wire('dropdown-reload-btn',                 () => location.reload());
  wire('dropdown-refresh-all-btn',            refreshAllImages);
  wire('dropdown-rebuild-index-btn',          rebuildIndex);

  // --- Images toolbar (kept) ---
  wire('images-reload-btn',                   () => loadImages(true));

  // --- Filter inputs ---
  document.getElementById('aliases-filter')?.addEventListener('input', () => {
    aliasesCurrentPage = 0;
    renderAliases();
  });

  wire('upload-filter-container', () => {
    const states = ['all', 'pending', 'uploaded'];
    const titles = {
      all:      'Showing all (click for pending only)',
      pending:  'Showing pending uploads (click for uploaded only)',
      uploaded: 'Showing uploaded only (click for all)'
    };
    currentUploadFilter = states[(states.indexOf(currentUploadFilter) + 1) % states.length];

    const container = document.getElementById('upload-filter-container');
    container.dataset.state = currentUploadFilter;
    container.title = titles[currentUploadFilter];
    container.classList.toggle('filter-active', currentUploadFilter !== 'all');

    document.querySelectorAll('.upload-filter-icon').forEach(svg => {
      svg.style.display = svg.dataset.state === currentUploadFilter ? '' : 'none';
  });

  loadImages(true);
  });

  wire('blacklist-filter',                    filterBlacklist,  'input');
  wire('whitelist-filter',                    filterWhitelist,  'input');
  wire('hierarchy-filter',                    filterHierarchy,  'input');

  // --- Hierarchy toolbar ---
  wire('hierarchy-expand-all-btn',            expandAllHierarchy);
  wire('hierarchy-collapse-all-btn',          collapseAllHierarchy);

  // --- Hierarchy modal ---
  wire('hierarchy-modal-cancel-btn',          () => closeModal('hierarchy-modal'));

  // --- Sidebar refresh + rescan ---
  wire('sidebar-refresh-btn',                 refreshCurrentImage);
  wire('sidebar-rescan-btn',                  rescanCurrentImage);

  wire('alias-suggestions-prev-btn',        () => loadAliasSuggestions(aliasSuggestionsPage - 1));
  wire('alias-suggestions-next-btn',        () => loadAliasSuggestions(aliasSuggestionsPage + 1));
  wire('garbage-suggestions-prev-btn',      () => loadGarbageSuggestions(garbageSuggestionsPage - 1));
  wire('garbage-suggestions-next-btn',      () => loadGarbageSuggestions(garbageSuggestionsPage + 1));

  wire('aliases-prev-btn', () => window.aliasesPrevPage());
  wire('aliases-next-btn', () => window.aliasesNextPage());

  setupHierarchyDelegation();
  setupSuggestionsDelegation();
});