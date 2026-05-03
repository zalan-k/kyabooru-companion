  // ============================================
  // STATE
  // ============================================
  let config = {
    aliases: {},        // { canonical: { category, variants: [fullTags] } }
    exclusions: { 
      blacklist: [],    // [fullTags with category prefix]
      whitelist: [] 
    },
    hierarchy: {},      // { tag: { category, implies: [] } }
    suggestions: { 
      aliases: [],
      garbage: [],
      lastRun: null 
    }
  };

  // ============================================================
  // Config — export / canonize buttons
  // ============================================================

  const CONFIG_TYPE_NAMES = {
    aliases: 'Aliases',
    hierarchy: 'Hierarchy',
    blacklist: 'Blacklist',
  };


  let stagingImages       = [];
  let selectedIds         = new Set();
  let lastClickedId       = null;
  let currentImageData    = null;
  let pendingTagAdditions = [];
  let imagesOffset        = 0;
  let imagesLoading       = false;
  let imagesHasMore       = true;

  let collapsedNodes = new Set();
  let autocompleteSelectedIndex = -1;
  let hierarchyFilter = '';
  let aliasesFilter = '';
  let blacklistFilter = '';
  let whitelistFilter = '';

  let currentSort = 'newest'; // Default sort

  // ============================================
  // INITIALIZATION
  // ============================================
  document.addEventListener('DOMContentLoaded', async () => {
    // Initialize connection status
    await initializeConnection();
    // Tab switching
    document.querySelectorAll('.tab').forEach(tab => {
      tab.addEventListener('click', () => switchTab(tab.dataset.tab));
    });

    let _eventStream = null;
    function startEventStream() {
      if (_eventStream) return;
      _eventStream = openStagingEventStream({
        onImageSaved: (image) => {
          // Skip if we already have it in `images` (defensive — shouldn't
          // normally happen, but server retry / multiple SSE connections
          // could theoretically deliver twice).
          if (images.find(i => i.id === image.id)) return;

          // Prepend to the in-memory list and refresh the grid.
          // Respects current filter — if the image is filtered out by the
          // active filter, it just won't render but stays in the list.
          images.unshift(image);

          // Re-render. If you have a more efficient append-one path that
          // matches the current sort/filter, use it; otherwise renderImages
          // is the catch-all.
          renderImages();
        },
      });
    }
        
    // Infinite scroll
    const scrollContainer = document.getElementById('images-scroll-container');
    scrollContainer.addEventListener('scroll', handleImageScroll);
    const headerSearchExpand = document.getElementById('header-search-expand');
    const globalSearchInput = document.getElementById('global-search');
    const expandSearchBtn = document.getElementById('expand-search-btn');

    // Setup all autocomplete inputs
    setupAutocomplete('sidebar-tag-input', 'sidebar-tag-dropdown', handleSidebarTagSelect);
    setupAutocomplete('add-blacklist-input', 'blacklist-dropdown', addToBlacklistDirect);
    setupAutocomplete('add-whitelist-input', 'whitelist-dropdown', addToWhitelistDirect);
    setupAutocomplete('new-hierarchy-tag', 'hierarchy-tag-dropdown');
    setupAutocomplete('add-alias-input', 'add-alias-dropdown');
    setupAutocomplete('hierarchy-modal-tag', 'hierarchy-modal-dropdown');
    setupAutocomplete('global-search', 'global-search-dropdown', (tag) => {
      handleGlobalSearchSelect(tag);
      // Optionally clear the search after selection
      globalSearchInput.value = '';
      updateSearchState();
      globalSearchInput.focus(); // Keep focus for quick typing
    });

    // Add Enter key handlers for exclusion inputs
    document.getElementById('add-blacklist-input').addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && autocompleteSelectedIndex < 0) {
        e.preventDefault();
        addToBlacklist();
      }
    });
    document.getElementById('add-whitelist-input').addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && autocompleteSelectedIndex < 0) {
        e.preventDefault();
        addToWhitelist();
      }
    });
    
    // Add Enter key handler for hierarchy input
    document.getElementById('new-hierarchy-tag').addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && autocompleteSelectedIndex < 0) {
        e.preventDefault();
        addRootTag();
      }
    });
    
    // Add Enter key handler for alias input
    document.getElementById('add-alias-input').addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && autocompleteSelectedIndex < 0) {
        e.preventDefault();
        addAliasFromInput();
      }
    });

    // Load data
    await loadConfig();
    await loadImages();
    await loadStats();

    updateAllCounts();

    // Initialize tab pill position
    const initialTab = document.querySelector('.tab.active');
    if (initialTab) movePill(initialTab);

    // Reposition pill on window resize
    window.addEventListener('resize', () => {
      const activeTab = document.querySelector('.tab.active');
      if (activeTab) movePill(activeTab);
    });

    // Stat card tilt effect
    document.querySelectorAll('.stat-card').forEach(card => {
      card.addEventListener('mousemove', (e) => {
        const rect = card.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        const centerX = rect.width / 2;
        const centerY = rect.height / 2;
        
        const tiltX = ((y - centerY) / centerY) * -6;
        const tiltY = ((x - centerX) / centerX) * 6;
        const angle = Math.atan2(y - centerY, x - centerX) * (180 / Math.PI) + 270;
        const distFromCenter = Math.sqrt(Math.pow(x - centerX, 2) + Math.pow(y - centerY, 2));
        const maxDist = Math.sqrt(Math.pow(centerX, 2) + Math.pow(centerY, 2));
        const shineOpacity = Math.min(0.1, (distFromCenter / maxDist) * 0.2);
        
        card.style.transform = `perspective(800px) rotateX(${tiltX}deg) rotateY(${tiltY}deg)`;
        card.style.setProperty('--shine-angle', `${angle}deg`);
        card.style.setProperty('--shine-opacity', shineOpacity);
      });
      
      card.addEventListener('mouseleave', () => {
        card.style.transform = 'perspective(800px) rotateX(0deg) rotateY(0deg)';
        card.style.setProperty('--shine-opacity', 0);
      });
    });

    // Secondary button diffuse effect
    document.querySelectorAll('.btn-secondary').forEach(btn => {
      btn.addEventListener('click', function() {
        this.classList.remove('diffuse-active');
        void this.offsetWidth; // Force reflow
        this.classList.add('diffuse-active');
      });
      btn.addEventListener('animationend', function() {
        this.classList.remove('diffuse-active');
      });
    });

    // ============================================
    // UPLOAD FILTER DROPDOWN (mirrors sort dropdown)
    // ============================================
    const uploadFilterContainer = document.getElementById('upload-filter-container');
    const uploadFilterDropdown = document.getElementById('upload-filter-dropdown');

    function showUploadFilterDropdown() {
      const rect = uploadFilterContainer.getBoundingClientRect();
      uploadFilterDropdown.style.top = (rect.bottom + 6) + 'px';
      uploadFilterDropdown.style.left = rect.left + 'px';
      uploadFilterDropdown.classList.add('show');
    }

    function hideUploadFilterDropdown() {
      uploadFilterDropdown.classList.remove('show');
    }

    function updateUploadFilterIcon() {
      uploadFilterContainer.dataset.state = currentUploadFilter;
      document.querySelectorAll('.upload-filter-icon').forEach(svg => {
        svg.style.display = svg.dataset.state === currentUploadFilter ? '' : 'none';
      });
    }

    uploadFilterContainer.addEventListener('mouseenter', showUploadFilterDropdown);
    uploadFilterContainer.addEventListener('mouseleave', () => {
      setTimeout(() => {
        if (!uploadFilterContainer.matches(':hover') && !uploadFilterDropdown.matches(':hover')) {
          hideUploadFilterDropdown();
        }
      }, 100);
    });
    uploadFilterDropdown.addEventListener('mouseenter', () => uploadFilterDropdown.classList.add('show'));
    uploadFilterDropdown.addEventListener('mouseleave', () => {
      setTimeout(() => {
        if (!uploadFilterContainer.matches(':hover') && !uploadFilterDropdown.matches(':hover')) {
          hideUploadFilterDropdown();
        }
      }, 100);
    });
    document.addEventListener('click', (e) => {
      if (!uploadFilterContainer.contains(e.target) && !uploadFilterDropdown.contains(e.target)) {
        hideUploadFilterDropdown();
      }
    });
    document.getElementById('images-scroll-container').addEventListener('scroll', hideUploadFilterDropdown);

    // Filter selections
    uploadFilterDropdown.querySelectorAll('.dropdown-item[data-value]').forEach(item => {
      item.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        currentUploadFilter = item.dataset.value;
        updateUploadFilterIcon();
        hideUploadFilterDropdown();
        imagesOffset = 0;
        loadImages(true);
      });
    });

    // Initialize icon to whatever currentUploadFilter starts as
    updateUploadFilterIcon();

    // ============================================
    // FROSTING TOGGLE (in-dropdown, persists in localStorage)
    // ============================================
    const FROSTING_KEY = 'staging.frostingEnabled';
    const frostingToggle = document.getElementById('frosting-toggle-item');

    function isFrostingEnabled() {
      return localStorage.getItem(FROSTING_KEY) !== 'false'; // default: on
    }

    function applyFrostingState() {
      const on = isFrostingEnabled();
      document.body.classList.toggle('frosting-disabled', !on);
      if (frostingToggle) frostingToggle.dataset.state = on ? 'on' : 'off';
    }

    frostingToggle.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      const next = !isFrostingEnabled();
      localStorage.setItem(FROSTING_KEY, String(next));
      applyFrostingState();
      // Don't close the dropdown — user can see the change immediately;
      // hover-out closes it naturally.
    });

    // Apply on load
    applyFrostingState();

    // Dropdown toggle for import menu (new design)
    const importBtn = document.getElementById('import-btn');
    const importDropdown = document.getElementById('import-dropdown');
    
    if (importBtn && importDropdown) {
      importBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        importDropdown.classList.toggle('show');
      });

      document.addEventListener('click', () => {
        importDropdown.classList.remove('show');
      });
    }

    function updateSearchState() {
      if (globalSearchInput.value.trim() !== '') {
        headerSearchExpand.classList.add('has-text');
      } else {
        headerSearchExpand.classList.remove('has-text');
      }
    }
    updateSearchState();
    // Listen for input changes
    globalSearchInput.addEventListener('input', updateSearchState);

    // Focus input when hovering over container
    headerSearchExpand.addEventListener('mouseenter', () => {
      if (!globalSearchInput.matches(':focus')) {
        globalSearchInput.focus();
      }
    });

    // Optional: Keep focus when clicking the button too
    expandSearchBtn.addEventListener('click', (e) => {
      e.preventDefault();
      globalSearchInput.focus();
    });

    // Don't contract if there's text when mouse leaves
    headerSearchExpand.addEventListener('mouseleave', () => {
      // Only remove focus if there's no text
      if (globalSearchInput.value.trim() === '') {
        globalSearchInput.blur();
      }
    });

    // Keep expanded when input is focused (clicked)
    globalSearchInput.addEventListener('focus', () => {
      headerSearchExpand.classList.add('has-text');
    });

    // Optional: Collapse when input loses focus and is empty
    globalSearchInput.addEventListener('blur', () => {
      if (globalSearchInput.value.trim() === '') {
        setTimeout(() => {
          if (!headerSearchExpand.matches(':hover') && !globalSearchInput.matches(':focus')) {
            headerSearchExpand.classList.remove('has-text');
          }
        }, 100);
      }
    });

    // Add keyboard shortcut (Ctrl/Cmd + F)
    document.addEventListener('keydown', (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'f') {
        e.preventDefault();
        globalSearchInput.focus();
        globalSearchInput.select();
      }
    });

    // Escape key to clear and blur when empty
    globalSearchInput.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        if (globalSearchInput.value.trim() === '') {
          globalSearchInput.blur();
        } else {
          globalSearchInput.value = '';
          updateSearchState();
        }
        e.preventDefault();
      }
    });

    // Sort dropdown functionality
    const sortContainer = document.getElementById('sort-container');
    const sortToggle = document.getElementById('sort-toggle');
    const sortDropdown = document.getElementById('sort-dropdown');
    const sortIcon = document.getElementById('sort-icon');

    // Initialize with correct icon
    updateSortIcon(currentSort);

    // Position and show dropdown
    function showSortDropdown() {
      const rect = sortContainer.getBoundingClientRect();
      sortDropdown.style.top = (rect.bottom + 6) + 'px';
      sortDropdown.style.left = rect.left + 'px';
      sortDropdown.classList.add('show');
    }

    // Hide dropdown
    function hideSortDropdown() {
      sortDropdown.classList.remove('show');
    }

    // Click to toggle dropdown
    sortContainer.addEventListener('mouseenter', () => {
      showSortDropdown();
    });

    // Hide when leaving button (with delay to allow moving to dropdown)
    sortContainer.addEventListener('mouseleave', () => {
      setTimeout(() => {
        if (!sortContainer.matches(':hover') && !sortDropdown.matches(':hover')) {
          hideSortDropdown();
        }
      }, 100);
    });

    // Keep open when hovering dropdown
    sortDropdown.addEventListener('mouseenter', () => {
      sortDropdown.classList.add('show');
    });

    // Hide when leaving dropdown (with delay to allow moving back to button)
    sortDropdown.addEventListener('mouseleave', () => {
      setTimeout(() => {
        if (!sortContainer.matches(':hover') && !sortDropdown.matches(':hover')) {
          hideSortDropdown();
        }
      }, 100);
    });

    // Also close when clicking outside (fallback)
    document.addEventListener('click', (e) => {
      if (!sortContainer.contains(e.target) && !sortDropdown.contains(e.target)) {
        hideSortDropdown();
      }
    });

    // Close on scroll (since it's fixed position)
    document.getElementById('images-scroll-container').addEventListener('scroll', () => {
      hideSortDropdown();
    });

    // Set up sort dropdown click handlers
    sortDropdown.querySelectorAll('.dropdown-item').forEach(item => {
      item.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        const value = item.dataset.value;
        currentSort = value;
        
        // Update the sort icon based on selection
        updateSortIcon(value);
        
        // Close dropdown
        hideSortDropdown();
        
        // Trigger image reload with new sort
        imagesOffset = 0;
        loadImages(true);
      });
    });

    // Update sort icon based on current selection
    function updateSortIcon(sortValue) {
      switch(sortValue) {
        case 'newest':
          sortIcon.innerHTML = `<path d="m14 18 4 4 4-4"></path><path d="M16 2v4"></path><path d="M18 14v8"></path><path d="M21 11.354V6a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h7.343"></path><path d="M3 10h18"></path><path d="M8 2v4"></path>`;
          break;
        case 'oldest':
          sortIcon.innerHTML = `<path d="m14 18 4-4 4 4"></path><path d="M16 2v4"></path><path d="M18 22v-8"></path><path d="M21 11.343V6a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h9"></path><path d="M3 10h18"></path><path d="M8 2v4"></path>`;
          break;
        case 'tags-desc':
          sortIcon.innerHTML = `<path d="m3 16 4 4 4-4"></path><path d="M7 20V4"></path><path d="M11 4h10"></path><path d="M11 8h7"></path><path d="M11 12h4"></path>`;
          break;
        case 'tags-asc':
          sortIcon.innerHTML = `<path d="m3 8 4-4 4 4"></path><path d="M7 4v16"></path><path d="M11 12h4"></path><path d="M11 16h7"></path><path d="M11 20h10"></path>`;
          break;
      }
    }

  });

  function toggleDropdown(id) {
    const dropdown = document.getElementById(id);
    const wasHidden = dropdown.classList.contains('hidden');
    
    document.querySelectorAll('.header-dropdown').forEach(d => d.classList.add('hidden'));
    
    if (wasHidden) {
      dropdown.classList.remove('hidden');
      setTimeout(() => {
        document.addEventListener('click', function closeDropdown(e) {
          if (!e.target.closest('.dropdown-container')) {
            dropdown.classList.add('hidden');
            document.removeEventListener('click', closeDropdown);
          }
        });
      }, 0);
    }
  }

  function pickJSONFile(callback) {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.onchange = (e) => {
      const file = e.target.files[0];
      if (!file) return;
      
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const data = JSON.parse(e.target.result);
          callback(data);
        } catch (err) {
          showToast('Invalid JSON file', 'error');
        }
      };
      reader.readAsText(file);
    };
    input.click();
  }
  // ============================================
  // FANCY THINGS
  // ============================================


  // ============================================
  // TAB MANAGEMENT
  // ============================================
  function movePill(tab) {
    const tabPill = document.getElementById('tab-pill');
    if (tabPill && tab) {
      tabPill.style.left = tab.offsetLeft + 'px';
      tabPill.style.width = tab.offsetWidth + 'px';
    }
  }

  function switchTab(tabId) {
    document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
    
    const activeTab = document.querySelector(`.tab[data-tab="${tabId}"]`);
    activeTab.classList.add('active');
    document.getElementById(`tab-${tabId}`).classList.add('active');
    
    // Move the glass pill
    movePill(activeTab);
  }

  function updateAllCounts() {
    document.getElementById('tab-images-count').textContent = stagingImages.length || '...';
    document.getElementById('tab-aliases-count').textContent = Object.keys(config.aliases).length;
    document.getElementById('tab-exclusions-count').textContent = 
      (config.exclusions?.blacklist?.length || 0) + (config.exclusions?.whitelist?.length || 0);
    document.getElementById('tab-hierarchy-count').textContent = Object.keys(config.hierarchy).length;

    document.getElementById('stat-aliases').textContent = Object.keys(config.aliases).length;
    document.getElementById('stat-blacklist').textContent = config.exclusions?.blacklist?.length || 0;
    
    const suggestionCount = (config.suggestions?.aliases?.length || 0) + 
                            (config.suggestions?.garbage?.length || 0);
    document.getElementById('stat-suggestions').textContent = suggestionCount;
  }

  // ============================================
  // IMAGES TAB
  // ============================================
function renderImages(newImages) {
  const grid = document.getElementById('images-grid');

  newImages.forEach(img => {
    const card = document.createElement('div');
    // 'uploaded' state = sent to booru (regardless of whether a post was created).
    // Both successful posts and duplicate-skipped images get the frosted look.
    const isOnBooru = img.booruPostState === 'posted' || img.booruPostState === 'duplicate';
    card.className = 'image-card' + (isOnBooru ? ' uploaded' : '');
    card.dataset.id = img.id;
    card.addEventListener('click', (e) => handleCardClick(img.id, e));

    const booruOverlay = isOnBooru ? `
      <a class="booru-frost-icon-link${img.booruPostState === 'duplicate' ? ' no-link' : ''}
        ${img.booruPostState === 'posted' ? `href="${img.booruPublicUrl}" target="_blank" rel="noopener"` : ''}
        title="${img.booruPostState === 'posted'
          ? `View on booru (post #${img.booruPostId})`
          : 'Already on booru (duplicate — no post id available)'}">
        <svg class="booru-frost-icon" viewBox="0 0 24 24" fill="none"
            stroke="none" stroke-width="1.5"
            stroke-linecap="round" stroke-linejoin="round">
          <path fill-rule="evenodd" clip-rule="evenodd" d="M17.4975 18.4851L20.6281 9.09378C21.419 6.72107 21.9594 5.1 21.9978 3.97919C22.0108 3.60165 21.5845 3.47624 21.3173 3.74336L6.85855 18.2022C6.62519 18.4355 6.6807 18.8286 6.99826 18.9185C7.02946 18.9273 7.0609 18.9356 7.09257 18.9433C7.59254 19.0657 8.24578 18.977 9.5522 18.7997L9.62363 18.79C9.99191 18.74 10.1761 18.715 10.3529 18.7257C10.6738 18.7451 10.9838 18.8496 11.251 19.0286C11.3981 19.1271 11.5295 19.2586 11.7923 19.5213L12.0436 19.7726C13.5539 21.2828 14.309 22.0379 15.1101 21.9986C15.3309 21.9877 15.5479 21.9365 15.7503 21.8475C16.4844 21.5244 16.8221 20.5113 17.4975 18.4851Z" fill="currentColor"/>
          <path d="M14.906 3.37194L5.57477 6.48223C3.49295 7.17615 2.45203 7.5231 2.13608 8.28642C2.06182 8.46582 2.01692 8.65601 2.00311 8.84968C1.94433 9.6737 2.72018 10.4495 4.27188 12.0012L4.55451 12.2838C4.80921 12.5385 4.93655 12.6658 5.03282 12.8076C5.22269 13.0871 5.33046 13.4143 5.34393 13.752C5.35076 13.9232 5.32403 14.1013 5.27057 14.4575C5.07488 15.7613 4.97703 16.4131 5.0923 16.9148C5.09632 16.9322 5.1005 16.9497 5.10484 16.967C5.18629 17.292 5.58551 17.3539 5.82242 17.117L20.2567 2.68271C20.5238 2.41559 20.3984 1.9893 20.0209 2.00224C18.9 2.04066 17.2788 2.58102 14.906 3.37194Z" fill="currentColor"/>
        </svg>
      </a>
    ` : '';

    card.innerHTML = `
      <img src="${API_BASE}/api/staging/thumbnail/${encodeURIComponent(img.id)}?size=200"
            alt="${escapeHtml(img.filename || '')}" loading="lazy"
            class="card-thumb"
            data-fallback="no-image">
      <span class="tag-count-badge">${img.tagCount || 0} tags</span>
      ${img.poolId ? '<span class="pool-badge">Pool</span>' : ''}
      ${booruOverlay}
    `;

    grid.appendChild(card);
    const thumb = card.querySelector('.card-thumb');
    if (thumb) {
      thumb.addEventListener('error', () => {
        thumb.src = 'data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 100 100%22><rect fill=%22%231a1a2e%22 width=%22100%22 height=%22100%22/><g transform=%22translate(30 30) scale(1.67)%22 fill=%22none%22 stroke=%22%23666%22 stroke-width=%222%22 stroke-linecap=%22round%22 stroke-linejoin=%22round%22><line x1=%222%22 y1=%222%22 x2=%2222%22 y2=%2222%22/><path d=%22M10.41 10.41a2 2 0 1 1-2.83-2.83%22/><line x1=%2213.5%22 y1=%2213.5%22 x2=%226%22 y2=%2221%22/><line x1=%2218%22 y1=%2212%22 x2=%2221%22 y2=%2215%22/><path d=%22M3.59 3.59A1.99 1.99 0 0 0 3 5v14a2 2 0 0 0 2 2h14c.55 0 1.052-.22 1.41-.59%22/><path d=%22M21 15V5a2 2 0 0 0-2-2H9%22/></g></svg>';
      });
    }
  });
}

  function handleCardClick(id, event) {
    if (event.target.closest('.booru-frost-icon-link')) return;
    if (event.shiftKey && lastClickedId) {
      // Range select from lastClickedId to id, in current grid order
      const cards = Array.from(document.querySelectorAll('.image-card'));
      const order = cards.map(c => c.dataset.id);
      const a = order.indexOf(lastClickedId);
      const b = order.indexOf(id);
      if (a !== -1 && b !== -1) {
        const [from, to] = a < b ? [a, b] : [b, a];
        // Shift-click extends the existing selection rather than replacing it
        for (let i = from; i <= to; i++) selectedIds.add(order[i]);
      }
    } else if (event.ctrlKey || event.metaKey) {
      // Toggle this one in/out of selection
      if (selectedIds.has(id)) selectedIds.delete(id);
      else selectedIds.add(id);
      lastClickedId = id;
    } else {
      // Plain click — collapse to single selection
      selectedIds.clear();
      selectedIds.add(id);
      lastClickedId = id;
    }

    applySelection();
  }

  async function applySelection() {
    // Update card visuals
    document.querySelectorAll('.image-card').forEach(card => {
      card.classList.toggle('selected', selectedIds.has(card.dataset.id));
    });

    if (selectedIds.size === 0) {
      closeSidebar();
      return;
    }

    if (selectedIds.size === 1) {
      // Single-select: existing flow, fetch and populate
      const id = [...selectedIds][0];
      await loadSidebarSingle(id);
    } else {
      // Multi-select: blank everything except the tag input
      showSidebarMulti(selectedIds.size);
    }
  }

  function showSidebarMulti(count) {
    // Make sure the sidebar is open
    document.getElementById('image-sidebar').classList.remove('hidden');

    // Switch to multi mode visually
    setSidebarMultiMode(true);

    // Replace preview with placeholder
    document.getElementById('sidebar-image').removeAttribute('src');

    // Blank per-image fields
    document.getElementById('sidebar-source-url').value = '';
    document.getElementById('sidebar-pool-id').value = '';
    document.getElementById('sidebar-pool-index').value = '';
    document.getElementById('sidebar-phash').value = '';

    // Tags display: render the pending-additions buffer (empty on entry)
    renderPendingTags();

    // Update the sidebar header to reflect count
    const header = document.querySelector('#image-sidebar .sidebar-header h3');
    if (header) header.textContent = `${count} images selected`;

    currentImageData = null; // not single-select
  }

  // Toggle the multi-mode CSS class on the sidebar root and disable the
  // per-image fields. The .multi-select-mode class drives the placeholder +
  // disabled-look styling (see CSS section below).
  function setSidebarMultiMode(on) {
    const sidebar = document.getElementById('image-sidebar');
    sidebar.classList.toggle('multi-select-mode', on);

    ['sidebar-source-url', 'sidebar-pool-id', 'sidebar-pool-index',
    'sidebar-phash', 'sidebar-new-pool-btn'].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.disabled = on;
    });

    // Reset header back to default in single mode
    if (!on) {
      const header = document.querySelector('#image-sidebar .sidebar-header h3');
      if (header) header.textContent = 'Edit Image';
    }
  }

  // Render the pending-tag-additions buffer in the sidebar tags container.
  // Same pill component as single-select, but pills come from
  // `pendingTagAdditions`, and removing one removes from the buffer (not
  // from any image).
  function renderPendingTags() {
    const container = document.getElementById('sidebar-tags');
    container.innerHTML = '';

    pendingTagAdditions.forEach(tag => {
      const { category, name } = parseTag(tag);
      const pill = createTagPill(tag, category, name, {
        onRemove: () => {
          pendingTagAdditions = pendingTagAdditions.filter(t => t !== tag);
          renderPendingTags();
        },
        onCategoryChange: (newCat) => {
          const newTag = newCat === 'general' ? name : `${newCat}:${name}`;
          const idx = pendingTagAdditions.indexOf(tag);
          if (idx !== -1) {
            pendingTagAdditions[idx] = newTag;
            renderPendingTags();
          }
        },
      });
      container.appendChild(pill);
    });
  }

  function handleImageScroll(e) {
    const { scrollTop, scrollHeight, clientHeight } = e.target;
    if (scrollTop + clientHeight >= scrollHeight - 300) {
      loadImages();
    }
  }

  function closeSidebar() {
    // Stop video playback if any
    const videoEl = document.getElementById('sidebar-video');
    if (videoEl) {
      videoEl.pause();
      videoEl.removeAttribute('src');
      videoEl.load();
    }

    document.getElementById('image-sidebar').classList.add('hidden');
    document.querySelectorAll('.image-card').forEach(c => c.classList.remove('selected'));
    currentImageId = null;
    currentImageData = null;
  }

  function renderSidebarTags() {
    const container = document.getElementById('sidebar-tags');
    container.innerHTML = '';

    (currentImageData?.tags || []).forEach(tag => {
      const { category, name } = parseTag(tag);
      const pill = createTagPill(tag, category, name, {
        onRemove: () => removeTagFromCurrent(tag),
        onCategoryChange: (newCat) => changeImageTagCategory(tag, name, newCat)
      });
      container.appendChild(pill);
    });
  }

  function handleSidebarTagSelect(tag) {
    if (selectedIds.size > 1) {
      if (!pendingTagAdditions.includes(tag)) {
        pendingTagAdditions.push(tag);
        renderPendingTags();
      }
    } else if (currentImageData) {
      if (!currentImageData.tags.includes(tag)) {
        currentImageData.tags.push(tag);
        renderSidebarTags();
      }
    }
    document.getElementById('sidebar-tag-input').value = '';
  }

  function removeTagFromCurrent(tag) {
    if (!currentImageData) return;
    currentImageData.tags = currentImageData.tags.filter(t => t !== tag);
    renderSidebarTags();
  }

  function changeImageTagCategory(oldTag, name, newCategory) {
    if (!currentImageData) return;
    const newTag = newCategory === 'general' ? name : `${newCategory}:${name}`;
    const idx = currentImageData.tags.indexOf(oldTag);
    if (idx !== -1) {
      currentImageData.tags[idx] = newTag;
    }
    renderSidebarTags();
  }

  async function exportAllConfigs() {
    try {
      const [aliases, hierarchy, blacklist] = await Promise.all([
        fetch(`${API_BASE}/api/config/aliases/export`).then(r => r.json()),
        fetch(`${API_BASE}/api/config/hierarchy/export`).then(r => r.json()),
        fetch(`${API_BASE}/api/config/blacklist/export`).then(r => r.json()),
      ]);

      const bundle = {
        aliases: aliases.aliases,
        hierarchy: hierarchy.hierarchy,
        blacklist: blacklist.blacklist,
        exportedAt: new Date().toISOString(),
      };

      const blob = new Blob([JSON.stringify(bundle, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'kyabooru-config.json';
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (err) {
      alert(`Export failed: ${err.message}`);
    }
  }

  async function exportConfigSection(type) {
    if (!CONFIG_TYPE_NAMES[type]) {
      console.error('Unknown config type:', type);
      return;
    }
    try {
      const res = await fetch(`${API_BASE}/api/config/${type}/export`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();

      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${type}.json`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (err) {
      alert(`Export failed: ${err.message}`);
    }
  }

  async function canonizeConfigSection(type) {
    if (!CONFIG_TYPE_NAMES[type]) {
      console.error('Unknown config type:', type);
      return;
    }

    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'application/json,.json';
    input.onchange = async () => {
      const file = input.files && input.files[0];
      if (!file) return;

      let body;
      try {
        const text = await file.text();
        body = JSON.parse(text);
      } catch (err) {
        alert(`Invalid JSON: ${err.message}`);
        return;
      }

      const name = CONFIG_TYPE_NAMES[type];
      if (!confirm(
        `Replace the current ${name} section with the contents of ${file.name}?\n\n` +
        `This will overwrite all existing entries.`
      )) {
        return;
      }

      try {
        const result = await withDeferredSpinner(
          `Canonizing ${name.toLowerCase()}...`,
          async () => {
            const res = await fetch(`${API_BASE}/api/config/${type}/canonize`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(body),
            });
            const r = await res.json();
            if (!res.ok) throw new Error(r.error || `HTTP ${res.status}`);
            return r;
          }
        );

        alert(`${name} canonized — loaded ${result.count} entries.`);
        await loadConfig();
      } catch (err) {
        alert(`Canonize failed: ${err.message}`);
      }
    };
    input.click();
  }

  // ============================================================
  // Per-image refresh + rescan (sidebar buttons)
  // ============================================================

  async function refreshCurrentImage() {
    if (selectedIds.size === 0) return;
    const ids = [...selectedIds];

    try {
      const summary = await withDeferredSpinner(
        ids.length === 1 ? 'Refreshing transformations...' : `Refreshing ${ids.length} images...`,
        async () => {
          const res = await fetch(`${API_BASE}/api/staging/images/refresh-batch`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ ids }),
          });
          const result = await res.json();
          if (!res.ok) throw new Error(result.error || `HTTP ${res.status}`);
          return result;
        }
      );

      // Update tag-count badges in place for changed images (no full reload)
      for (const r of summary.results) {
        if (!r.success) continue;
        const card = document.querySelector(`.image-card[data-id="${r.id}"]`);
        if (card) {
          const badge = card.querySelector('.tag-count-badge');
          if (badge && typeof r.tagCount === 'number') {
            badge.textContent = `${r.tagCount} tags`;
          }
        }
      }

      // If single-select, reload sidebar to reflect new tags
      if (selectedIds.size === 1) {
        await loadSidebarSingle([...selectedIds][0]);
      }

      if (summary.failed > 0) {
        showToast(`Refreshed ${summary.succeeded}/${summary.total} (${summary.failed} failed)`, 'warning');
      } else if (summary.changed === 0) {
        showToast('No changes — already canonical');
      } else {
        showToast(`Refreshed ${summary.changed} image${summary.changed === 1 ? '' : 's'}`);
      }
    } catch (err) {
      showToast(`Refresh failed: ${err.message}`, 'error');
    }
  }

  async function rescanCurrentImage() {
    if (selectedIds.size === 0) return;
    const ids = [...selectedIds];

    try {
      const summary = await withDeferredSpinner(
        ids.length === 1 ? 'Rescanning sidecar...' : `Rescanning ${ids.length} sidecars...`,
        async () => {
          const res = await fetch(`${API_BASE}/api/staging/images/rescan-batch`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ ids }),
          });
          const result = await res.json();
          if (!res.ok) throw new Error(result.error || `HTTP ${res.status}`);
          return result;
        }
      );

      for (const r of summary.results) {
        if (!r.success) continue;
        const card = document.querySelector(`.image-card[data-id="${r.id}"]`);
        if (card) {
          const badge = card.querySelector('.tag-count-badge');
          if (badge && typeof r.tagCount === 'number') {
            badge.textContent = `${r.tagCount} tags`;
          }
        }
      }

      if (selectedIds.size === 1) {
        await loadSidebarSingle([...selectedIds][0]);
      }

      if (summary.failed > 0) {
        showToast(`Rescanned ${summary.succeeded}/${summary.total} (${summary.failed} failed)`, 'warning');
      } else {
        showToast(`Rescanned ${summary.succeeded} image${summary.succeeded === 1 ? '' : 's'}`);
      }
    } catch (err) {
      showToast(`Rescan failed: ${err.message}`, 'error');
    }
  }

  // ============================================================
  // Global refresh + rebuild (images toolbar buttons)
  // ============================================================

  async function refreshAllImages() {
    if (!confirm(
      'Refresh transformations on ALL images?\n\n' +
      'This re-applies aliases, hierarchy, and blacklist to every staging ' +
      'image. May take several minutes on large datasets.'
    )) {
      return;
    }

    try {
      const result = await withDeferredSpinner(
        'Refreshing all images... this may take a while.',
        async () => {
          const res = await fetch(`${API_BASE}/api/staging/refresh-all`, { method: 'POST' });
          const r = await res.json();
          if (!res.ok) throw new Error(r.error || `HTTP ${res.status}`);
          return r;
        }
      );

      alert(
        `Refresh complete.\n\n` +
        `Total: ${result.total}\n` +
        `Changed: ${result.changed}\n` +
        `Unchanged: ${result.unchanged}\n` +
        `Errored: ${result.errored}\n` +
        `Elapsed: ${(result.elapsed / 1000).toFixed(1)}s`
      );

      await loadImages(true);
    } catch (err) {
      alert(`Refresh-all failed: ${err.message}`);
    }
  }

  async function rebuildIndex() {
    if (!confirm(
      'Rebuild staging index from disk?\n\n' +
      'This wipes the database index and re-reads every sidecar JSON. ' +
      'Use this after editing sidecars externally or if the index seems out of sync. ' +
      'May take several minutes on large datasets.'
    )) {
      return;
    }

    try {
      const result = await withDeferredSpinner(
        'Rebuilding index... this may take a while.',
        async () => {
          const res = await fetch(`${API_BASE}/api/staging/rebuild`, { method: 'POST' });
          const r = await res.json();
          if (!res.ok) throw new Error(r.error || `HTTP ${res.status}`);
          return r;
        }
      );

      alert(
        `Rebuild complete.\n\n` +
        `Inserted: ${result.inserted}\n` +
        `Errored: ${result.errored}\n` +
        `Elapsed: ${(result.elapsed / 1000).toFixed(1)}s`
      );

      await loadImages(true);
    } catch (err) {
      alert(`Rebuild failed: ${err.message}`);
    }
  }

  // ============================================================
  // Spinner helpers
  // ============================================================
  //
  // If your UI already has a global spinner / overlay, replace these
  // with your existing functions. Otherwise this creates a minimal one.

  /**
   * Run async work with a spinner that only appears if the work
   * takes longer than `delay` ms. Avoids the 100ms flash on fast ops.
   */
  async function withDeferredSpinner(message, work, delay = 500) {
    let shown = false;
    const timer = setTimeout(() => {
      showSpinner(message);
      shown = true;
    }, delay);
    try {
      return await work();
    } finally {
      clearTimeout(timer);
      if (shown) hideSpinner();
    }
  }

  function showSpinner(message) {
    let overlay = document.getElementById('global-spinner-overlay');
    if (!overlay) {
      overlay = document.createElement('div');
      overlay.id = 'global-spinner-overlay';
      overlay.innerHTML = `
        <div class="spinner-box">
          <div class="spinner-circle"></div>
          <div class="spinner-message"></div>
        </div>
      `;
      document.body.appendChild(overlay);
    }
    overlay.querySelector('.spinner-message').textContent = message || 'Working...';
    overlay.style.display = 'flex';
  }

  function hideSpinner() {
    const overlay = document.getElementById('global-spinner-overlay');
    if (overlay) overlay.style.display = 'none';
  }

  // ============================================
  // ALIASES TAB
  // ============================================
  const ALIASES_BATCH_SIZE = 50;
  let aliasesAllEntries = [];   // current filtered set, in display order
  let aliasesRenderedCount = 0; // how many of those have been appended to DOM
  let aliasesAppending = false; // re-entrancy guard
  
  function getFilteredAliasEntries() {
    let entries = Object.entries(config.aliases || {});
    const filter = (document.getElementById('aliases-filter')?.value || '').toLowerCase();
    if (filter) {
      entries = entries.filter(([canonical, data]) => {
        const canonicalMatch = canonical.toLowerCase().includes(filter);
        const variantMatch = (data.variants || []).some(v => v.toLowerCase().includes(filter));
        return canonicalMatch || variantMatch;
      });
    }
    return entries;
  }

  function renderAliases(options = {}) {
    const { resetScroll = false } = options;
    const scrollContainer = document.querySelector('.aliases-container');
    const savedScrollTop = (!resetScroll && scrollContainer) ? scrollContainer.scrollTop : 0;

    const container = document.getElementById('aliases-list');
    const emptyState = document.getElementById('aliases-empty');

    container.innerHTML = '';
    aliasesAllEntries = getFilteredAliasEntries();
    aliasesRenderedCount = 0;

    if (aliasesAllEntries.length === 0) {
      emptyState.style.display = 'block';
      if (scrollContainer) scrollContainer.scrollTop = 0;
      return;
    }
    emptyState.style.display = 'none';

    // Always render at least one batch
    appendNextAliasBatch();

    if (!resetScroll && savedScrollTop > 0 && scrollContainer) {
      // Keep appending until the saved scrollTop is reachable
      while (
        aliasesRenderedCount < aliasesAllEntries.length &&
        scrollContainer.scrollHeight - scrollContainer.clientHeight < savedScrollTop
      ) {
        appendNextAliasBatch();
      }
      const maxScrollTop = Math.max(0, scrollContainer.scrollHeight - scrollContainer.clientHeight);
      scrollContainer.scrollTop = Math.min(savedScrollTop, maxScrollTop);
    } else if (scrollContainer) {
      scrollContainer.scrollTop = 0;
    }

    attachAliasesScrollListener();
  }

  function appendNextAliasBatch() {
    if (aliasesAppending) return;
    if (aliasesRenderedCount >= aliasesAllEntries.length) return;
    aliasesAppending = true;

    const container = document.getElementById('aliases-list');
    const slice = aliasesAllEntries.slice(
      aliasesRenderedCount,
      aliasesRenderedCount + ALIASES_BATCH_SIZE
    );

    slice.forEach(([canonicalKey, data]) => {
      buildAliasCard(canonicalKey, data, container);
    });

    aliasesRenderedCount += slice.length;
    aliasesAppending = false;
  }

  function buildAliasCard(canonicalKey, data, container) {
    const { category: canonicalCat, name: canonicalName } = parseTag(canonicalKey);
    const effectiveCategory = data.category || canonicalCat || 'general';

    const card = document.createElement('div');
    card.className = 'alias-card';
    card.dataset.canonical = canonicalKey;

    // Canonical section
    const canonicalSection = document.createElement('div');
    canonicalSection.className = 'alias-canonical';
    canonicalSection.innerHTML = `<div class="alias-canonical-label">Canonical</div>`;

    const canonicalPill = createTagPill(canonicalKey, effectiveCategory, canonicalName, {
      onRemove: () => removeAliasGroup(canonicalKey),
      onCategoryChange: (newCat) => changeAliasCanonicalCategory(canonicalKey, newCat),
      onEdit: (newFullTag) => renameAliasCanonical(canonicalKey, newFullTag),
      showEdit: true
    });
    canonicalSection.appendChild(canonicalPill);
    card.appendChild(canonicalSection);

    // Variants section
    const variantsSection = document.createElement('div');
    variantsSection.className = 'alias-variants';
    variantsSection.innerHTML = `<div class="alias-variants-label">Variants (${(data.variants || []).length})</div>`;

    const variantsList = document.createElement('div');
    variantsList.className = 'alias-variants-list';

    const variantInputWrapper = document.createElement('div');
    variantInputWrapper.className = 'autocomplete-wrapper variant-input-inline';
    variantInputWrapper.innerHTML = `
      <input type="text" id="add-var-${escapeAttr(canonicalKey)}" placeholder="Add variant...">
      <div class="autocomplete-dropdown" id="add-var-dropdown-${escapeAttr(canonicalKey)}"></div>
    `;
    variantsList.appendChild(variantInputWrapper);

    (data.variants || []).forEach(v => {
      const { category: vCat, name: vName } = parseTag(v);
      const pill = createTagPill(v, vCat || 'general', vName, {
        onRemove: () => removeVariant(canonicalKey, v),
        onCategoryChange: (newCat) => changeVariantCategory(canonicalKey, v, newCat)
      });
      variantsList.appendChild(pill);
    });

    variantsSection.appendChild(variantsList);
    card.appendChild(variantsSection);

    container.appendChild(card);

    // Wire autocomplete after the elements are in the DOM
    const variantInputId = `add-var-${canonicalKey}`;
    setupAutocomplete(
      variantInputId,
      `add-var-dropdown-${canonicalKey}`,
      (tag) => addVariantToAliasDirect(canonicalKey, tag)
    );

    const variantInput = document.getElementById(variantInputId);
    if (variantInput) {
      variantInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && autocompleteSelectedIndex < 0) {
          e.preventDefault();
          addVariantToAlias(canonicalKey);
        }
      });
    }
  }

  function attachAliasesScrollListener() {
    const container = document.querySelector('.aliases-container');
    if (!container || container.dataset.aliasesScrollAttached === 'true') return;
    container.dataset.aliasesScrollAttached = 'true';
    container.addEventListener('scroll', () => {
      const { scrollTop, scrollHeight, clientHeight } = container;
      if (scrollTop + clientHeight >= scrollHeight - 300) {
        appendNextAliasBatch();
      }
    });
  }

  function filterAliases() {
    aliasesFilter = document.getElementById('aliases-filter').value;
    renderAliases();
  }

// ============================================================
  // SUGGESTIONS — backed by /api/config/suggestions/* endpoints
  // ============================================================

  const SUGGESTIONS_PAGE_SIZE = 25;
  let aliasSuggestionsPage = 0;
  let garbageSuggestionsPage = 0;

  /**
   * Initial render — called once on tab open. Hides sections until
   * the user clicks Analyze. (Suggestions persist in DB across
   * sessions, so on a fresh load we still need to fetch and display
   * any existing pending suggestions.)
   */
  async function renderSuggestions() {
    await Promise.all([
      loadAliasSuggestions(0),
      loadGarbageSuggestions(0),
    ]);
  }

  async function loadAliasSuggestions(page = 0) {
    const offset = page * SUGGESTIONS_PAGE_SIZE;
    let data;
    try {
      const res = await fetch(`${API_BASE}/api/config/suggestions/aliases?limit=${SUGGESTIONS_PAGE_SIZE}&offset=${offset}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      data = await res.json();
    } catch (err) {
      // Endpoint missing or error — hide section silently. Don't
      // alert; user might not be using suggester at all.
      document.getElementById('alias-suggestions-section').style.display = 'none';
      return;
    }

    aliasSuggestionsPage = page;
    const section = document.getElementById('alias-suggestions-section');
    const list    = document.getElementById('alias-suggestions');
    const meta    = document.getElementById('alias-suggestions-meta');

    if (!data.groups || data.groups.length === 0) {
      // Nothing pending — keep the panel visible if total > 0
      // (means user has cleared the pending set), or hide if total
      // is zero (never analyzed or fully resolved).
      if (data.total === 0) {
        section.style.display = 'none';
      } else {
        section.style.display = '';
        list.innerHTML = `<div class="suggestions-empty">All caught up — no pending alias suggestions.</div>`;
        meta.textContent = `${data.total} groups`;
      }
      document.getElementById('alias-suggestions-pager').style.display = 'none';
      return;
    }

    section.style.display = '';
    if (meta) meta.textContent = `${data.total} groups total`;

    list.innerHTML = data.groups.map((g, idx) => {
      const { category: canCategory, name: canName } = parseTag(g.canonical);
      return `
        <div class="card suggestion" data-canonical="${escapeAttr(g.canonical)}">
          <div class="card-header">
            <div>
              <div class="card-title">
                <span class="tag-pill tag-${canCategory}">${escapeHtml(canName.replace(/_/g, ' '))}</span>
              </div>
              <div class="card-meta">${g.sources.length} variant${g.sources.length === 1 ? '' : 's'} · ${g.group_count} total uses</div>
            </div>
            <div class="card-actions">
              <button class="btn btn-small btn-success" data-suggestion-action="accept-alias-all">Accept All</button>
              <button class="btn btn-small btn-ghost" data-suggestion-action="dismiss-alias-all">Dismiss All</button>
            </div>
          </div>
          <div class="suggestion-variants-list">
            ${g.sources.map(s => {
              const { category, name } = parseTag(s.source);
              return `
                 <div class="suggestion-variant-row" data-source="${escapeAttr(s.source)}">
                  <span class="tag-pill tag-${category}">${escapeHtml(name.replace(/_/g, ' '))}</span>
                  <span class="alias-variant-count">${s.count}</span>
                  <button class="btn btn-small btn-success" data-suggestion-action="accept-alias-one">✓</button>
                  <button class="btn btn-small btn-ghost"   data-suggestion-action="dismiss-alias-one">✕</button>
                </div>
              `;
            }).join('')}
          </div>
        </div>
      `;
    }).join('');

    // Pagination controls
    const pager = document.getElementById('alias-suggestions-pager');
    const totalPages = Math.ceil(data.total / SUGGESTIONS_PAGE_SIZE);
    if (totalPages > 1) {
      pager.style.display = '';
      document.getElementById('alias-suggestions-page-info').textContent =
        `Page ${page + 1} of ${totalPages}`;
      document.getElementById('alias-suggestions-prev-btn').disabled = page <= 0;
      document.getElementById('alias-suggestions-next-btn').disabled = page >= totalPages - 1;
    } else {
      pager.style.display = 'none';
    }
  }

  async function loadGarbageSuggestions(page = 0) {
    const offset = page * SUGGESTIONS_PAGE_SIZE;
    let data;
    try {
      const res = await fetch(`${API_BASE}/api/config/suggestions/blacklist?limit=${SUGGESTIONS_PAGE_SIZE}&offset=${offset}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      data = await res.json();
    } catch {
      document.getElementById('garbage-suggestions-section').style.display = 'none';
      return;
    }

    garbageSuggestionsPage = page;
    const section = document.getElementById('garbage-suggestions-section');
    const list    = document.getElementById('garbage-suggestions');
    const meta    = document.getElementById('garbage-suggestions-meta');

    if (!data.items || data.items.length === 0) {
      if (data.total === 0) {
        section.style.display = 'none';
      } else {
        section.style.display = '';
        list.innerHTML = `<div class="suggestions-empty">All caught up — no pending blacklist suggestions.</div>`;
        if (meta) meta.textContent = `${data.total} candidates`;
      }
      document.getElementById('garbage-suggestions-pager').style.display = 'none';
      return;
    }

    section.style.display = '';
    if (meta) meta.textContent = `${data.total} candidates total`;

    list.innerHTML = data.items.map(item => {
      const { category, name } = parseTag(item.tag);
      const reasonLabel = item.reason === 'non-ascii' ? 'non-ASCII'
                       : item.reason === 'low-count'  ? `low usage (${item.post_count})`
                       : item.reason;
      return `
        <div class="garbage-row" data-tag="${escapeAttr(item.tag)}">
          <span class="tag-pill tag-${category}">${escapeHtml(name.replace(/_/g, ' '))}</span>
          <span class="garbage-reason">${escapeHtml(reasonLabel)}</span>
          <div class="garbage-actions">
            <button class="btn btn-small btn-danger" data-suggestion-action="accept-garbage">Blacklist</button>
            <button class="btn btn-small btn-ghost"  data-suggestion-action="dismiss-garbage">Dismiss</button>
          </div>
        </div>
      `;
    }).join('');

    const pager = document.getElementById('garbage-suggestions-pager');
    const totalPages = Math.ceil(data.total / SUGGESTIONS_PAGE_SIZE);
    if (totalPages > 1) {
      pager.style.display = '';
      document.getElementById('garbage-suggestions-page-info').textContent =
        `Page ${page + 1} of ${totalPages}`;
      document.getElementById('garbage-suggestions-prev-btn').disabled = page <= 0;
      document.getElementById('garbage-suggestions-next-btn').disabled = page >= totalPages - 1;
    } else {
      pager.style.display = 'none';
    }
  }

  // ============================================================
  // Accept / dismiss actions
  // ============================================================

  async function acceptAliasGroup(canonical, sources) {
    try {
      const res = await fetch(`${API_BASE}/api/config/suggestions/aliases/accept`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ canonical, sources }),
      });
      const result = await res.json();
      if (!res.ok) throw new Error(result.error || `HTTP ${res.status}`);

      showToast(`Accepted ${result.count} alias${result.count === 1 ? '' : 'es'}`);
      // Reload both the aliases panel AND the suggestions panel
      await loadConfig();
      await loadAliasSuggestions(aliasSuggestionsPage);
    } catch (err) {
      showToast(`Accept failed: ${err.message}`, 'error');
    }
  }

  async function dismissAliasGroup(canonical, sources) {
    try {
      const res = await fetch(`${API_BASE}/api/config/suggestions/aliases/reject`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ canonical, sources }),
      });
      const result = await res.json();
      if (!res.ok) throw new Error(result.error || `HTTP ${res.status}`);

      showToast(`Dismissed ${result.count} suggestion${result.count === 1 ? '' : 's'}`);
      await loadAliasSuggestions(aliasSuggestionsPage);
    } catch (err) {
      showToast(`Dismiss failed: ${err.message}`, 'error');
    }
  }

  async function acceptGarbageTag(tag) {
    try {
      const res = await fetch(`${API_BASE}/api/config/suggestions/blacklist/accept`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tags: [tag] }),
      });
      const result = await res.json();
      if (!res.ok) throw new Error(result.error || `HTTP ${res.status}`);

      showToast(`Blacklisted ${tag}`);
      await loadConfig();
      await loadGarbageSuggestions(garbageSuggestionsPage);
    } catch (err) {
      showToast(`Blacklist failed: ${err.message}`, 'error');
    }
  }

  async function dismissGarbageTag(tag) {
    try {
      const res = await fetch(`${API_BASE}/api/config/suggestions/blacklist/reject`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tags: [tag] }),
      });
      const result = await res.json();
      if (!res.ok) throw new Error(result.error || `HTTP ${res.status}`);

      showToast(`Dismissed ${tag}`);
      await loadGarbageSuggestions(garbageSuggestionsPage);
    } catch (err) {
      showToast(`Dismiss failed: ${err.message}`, 'error');
    }
  }

  function addAliasFromInput() {
    const rawInput = document.getElementById('add-alias-input').value.trim();

    if (!rawInput) {
      return;
    }

    const { category, name } = parseTag(rawInput);
    const canonicalKey = normalizeTagName(name);

    if (!canonicalKey) {
      showToast('Enter a valid tag name', 'error');
      return;
    }

    if (config.aliases[canonicalKey]) {
      showToast('Alias group already exists', 'error');
      return;
    }

    config.aliases[canonicalKey] = {
      category,
      variants: []
    };

    saveAliases();
    renderAliases({ resetScroll: true });
    document.getElementById('add-alias-input').value = '';
  }

  function removeAliasGroup(canonical) {
    if (!confirm(`Remove alias group "${canonical}"?`)) return;
    delete config.aliases[canonical];
    saveAliases();
    renderAliases();
  }

  function changeAliasCanonicalCategory(canonical, newCategory) {
    if (!config.aliases[canonical]) return;
    
    const { name } = parseTag(canonical);
    const newKey = newCategory === 'general' ? name : `${newCategory}:${name}`;
    
    if (newKey !== canonical) {
      config.aliases[newKey] = { ...config.aliases[canonical], category: newCategory };
      delete config.aliases[canonical];
    } else {
      config.aliases[canonical].category = newCategory;
    }
    
    saveAliases();
    renderAliases();
  }

  function renameAliasCanonical(oldCanonical, newFullTag) {
    if (!config.aliases[oldCanonical]) return;
    
    const { category, name } = parseTag(newFullTag);
    const normalizedNew = normalizeTagName(newFullTag);
    
    if (normalizedNew === oldCanonical) return;
    
    config.aliases[normalizedNew] = {
      ...config.aliases[oldCanonical],
      category: VALID_CATEGORIES.includes(category) ? category : config.aliases[oldCanonical].category
    };
    delete config.aliases[oldCanonical];
    
    saveAliases();
    renderAliases();
  }

  function addVariantToAlias(canonical) {
    const input = document.getElementById(`add-var-${canonical}`);
    if (!input) return;
    addVariantToAliasDirect(canonical, input.value);
    input.value = '';
    input.focus();
  }

  function addVariantToAliasDirect(canonical, tag) {
    if (!config.aliases[canonical]) return;
    
    const normalizedTag = normalizeTagName(tag);
    if (!normalizedTag) return;
    
    if (!config.aliases[canonical].variants.includes(normalizedTag)) {
      config.aliases[canonical].variants.push(normalizedTag);
      saveAliases();
      renderAliases();
    }
    
    const input = document.getElementById(`add-var-${canonical}`);
    if (input) {
        input.value = '';
        input.focus();
    }
  }

  function removeVariant(canonical, variant) {
    if (!config.aliases[canonical]) return;
    config.aliases[canonical].variants = config.aliases[canonical].variants.filter(v => v !== variant);
    saveAliases();
    renderAliases();
  }

  function changeVariantCategory(canonical, oldVariant, newCategory) {
    if (!config.aliases[canonical]) return;
    
    const { name } = parseTag(oldVariant);
    const newVariant = newCategory === 'general' ? name : `${newCategory}:${name}`;
    
    const idx = config.aliases[canonical].variants.indexOf(oldVariant);
    if (idx !== -1) {
      config.aliases[canonical].variants[idx] = newVariant;
      saveAliases();
      renderAliases();
    }
  }

  // ============================================
  // EXCLUSIONS TAB
  // ============================================
  function renderExclusions() {
    renderBlacklist();
    renderWhitelist();
  }

  function renderBlacklist() {
    const container = document.getElementById('blacklist-items');
    let items = config.exclusions?.blacklist || [];
    
    if (blacklistFilter) {
      const filter = blacklistFilter.toLowerCase();
      items = items.filter(t => t.toLowerCase().includes(filter));
    }
    
    if (items.length === 0) {
      container.innerHTML = '<div style="color:var(--text-muted);padding:20px;text-align:center;width:100%;">No blacklisted tags</div>';
      return;
    }
    
    container.innerHTML = '';
    items.forEach(tag => {
      const { category, name } = parseTag(tag);
      const pill = createTagPill(tag, category, name, {
        onRemove: () => removeFromBlacklist(tag),
        onCategoryChange: (newCat) => changeBlacklistCategory(tag, newCat),
        onSwap: () => moveToWhitelist(tag),
        swapDirection: 'right'
      });
      container.appendChild(pill);
    });
  }

  function renderWhitelist() {
    const container = document.getElementById('whitelist-items');
    let items = config.exclusions?.whitelist || [];
    
    if (whitelistFilter) {
      const filter = whitelistFilter.toLowerCase();
      items = items.filter(t => t.toLowerCase().includes(filter));
    }
    
    if (items.length === 0) {
      container.innerHTML = '<div style="color:var(--text-muted);padding:20px;text-align:center;width:100%;">No whitelisted tags</div>';
      return;
    }
    
    container.innerHTML = '';
    items.forEach(tag => {
      const { category, name } = parseTag(tag);
      const pill = createTagPill(tag, category, name, {
        onRemove: () => removeFromWhitelist(tag),
        onCategoryChange: (newCat) => changeWhitelistCategory(tag, newCat),
        onSwap: () => moveToBlacklist(tag),
        swapDirection: 'left'
      });
      container.appendChild(pill);
    });
  }

  function filterBlacklist() {
    blacklistFilter = document.getElementById('blacklist-filter').value;
    renderBlacklist();
  }

  function filterWhitelist() {
    whitelistFilter = document.getElementById('whitelist-filter').value;
    renderWhitelist();
  }

  function addToBlacklist() {
    const input = document.getElementById('add-blacklist-input');
    addToBlacklistDirect(input.value);
    input.value = '';
  }

  function addToBlacklistDirect(tag) {
    const normalizedTag = normalizeTagName(tag);
    if (!normalizedTag) return;

    if (!config.exclusions.blacklist) config.exclusions.blacklist = [];
    if (!config.exclusions.blacklist.includes(normalizedTag)) {
      config.exclusions.blacklist.push(normalizedTag);
      saveExclusions();
      renderExclusions();
    }
    document.getElementById('add-blacklist-input').value = '';
  }

  function removeFromBlacklist(tag) {
    config.exclusions.blacklist = config.exclusions.blacklist.filter(t => t !== tag);
    saveExclusions();
    renderExclusions();
  }

  function changeBlacklistCategory(oldTag, newCategory) {
    const { name } = parseTag(oldTag);
    const newTag = newCategory === 'general' ? name : `${newCategory}:${name}`;
    
    const idx = config.exclusions.blacklist.indexOf(oldTag);
    if (idx !== -1) {
      config.exclusions.blacklist[idx] = newTag;
      saveExclusions();
      renderExclusions();
    }
  }

  function addToWhitelist() {
    const input = document.getElementById('add-whitelist-input');
    addToWhitelistDirect(input.value);
    input.value = '';
  }

  function addToWhitelistDirect(tag) {
    const normalizedTag = normalizeTagName(tag);
    if (!normalizedTag) return;

    if (!config.exclusions.whitelist) config.exclusions.whitelist = [];
    if (!config.exclusions.whitelist.includes(normalizedTag)) {
      config.exclusions.whitelist.push(normalizedTag);
      saveExclusions();
      renderExclusions();
    }
    document.getElementById('add-whitelist-input').value = '';
  }

  function removeFromWhitelist(tag) {
    config.exclusions.whitelist = config.exclusions.whitelist.filter(t => t !== tag);
    saveExclusions();
    renderExclusions();
  }

  function changeWhitelistCategory(oldTag, newCategory) {
    const { name } = parseTag(oldTag);
    const newTag = newCategory === 'general' ? name : `${newCategory}:${name}`;
    
    const idx = config.exclusions.whitelist.indexOf(oldTag);
    if (idx !== -1) {
      config.exclusions.whitelist[idx] = newTag;
      saveExclusions();
      renderExclusions();
    }
  }

  function moveToWhitelist(tag) {
    // Remove from blacklist
    config.exclusions.blacklist = config.exclusions.blacklist.filter(t => t !== tag);
    // Add to whitelist if not already there
    if (!config.exclusions.whitelist) config.exclusions.whitelist = [];
    if (!config.exclusions.whitelist.includes(tag)) {
      config.exclusions.whitelist.push(tag);
    }
    saveExclusions();
    renderExclusions();
  }

  function moveToBlacklist(tag) {
    // Remove from whitelist
    config.exclusions.whitelist = config.exclusions.whitelist.filter(t => t !== tag);
    // Add to blacklist if not already there
    if (!config.exclusions.blacklist) config.exclusions.blacklist = [];
    if (!config.exclusions.blacklist.includes(tag)) {
      config.exclusions.blacklist.push(tag);
    }
    saveExclusions();
    renderExclusions();
  }

  // ============================================
  // HIERARCHY TAB
  // ============================================
  function renderHierarchy() {
    const container = document.getElementById('hierarchy-tree');
    const emptyState = document.getElementById('hierarchy-empty');
    container.innerHTML = '';

    const hierarchyEntries = Object.entries(config.hierarchy || {});

    if (hierarchyEntries.length === 0) {
      emptyState.style.display = 'block';
      return;
    }

    emptyState.style.display = 'none';

    // Build tree structure
    const childrenMap = {};
    const parentsOf = {};
    const allTags = new Set();

    for (const [parent, children] of hierarchyEntries) {
      allTags.add(parent);
      if (!childrenMap[parent]) childrenMap[parent] = [];
      for (const child of children) {
        allTags.add(child);
        childrenMap[parent].push(child);
        if (!parentsOf[child]) parentsOf[child] = [];
        parentsOf[child].push(parent);
      }
    }

    const rootTags = [...allTags].filter(t => !parentsOf[t] || parentsOf[t].length === 0);
    rootTags.sort();

    // Filter check
    const matchesFilter = (tag) => {
      if (!hierarchyFilter) return true;
      return tag.toLowerCase().includes(hierarchyFilter.toLowerCase());
    };

    const hasMatchingDescendant = (tag) => {
      if (matchesFilter(tag)) return true;
      const children = childrenMap[tag] || [];
      return children.some(child => hasMatchingDescendant(child));
    };

    // Render tree recursively
    function renderNode(tag, depth = 0) {
      const { category } = parseTag(tag);
      const children = (childrenMap[tag] || []).filter(c => hasMatchingDescendant(c));
      const hasChildren = children.length > 0;
      const isCollapsed = collapsedNodes.has(tag);
      const matches = matchesFilter(tag);

      const nodeEl = document.createElement('div');
      nodeEl.style.opacity = matches ? '1' : '0.5';

      // ── Row ────────────────────────────────────────────────────────────
      const nodeDiv = document.createElement('div');
      nodeDiv.className = 'hierarchy-node';
      nodeDiv.draggable = true;
      nodeDiv.addEventListener('dragstart', (e) => handleDragStart(e, tag));
      nodeDiv.addEventListener('dragover',  handleDragOver);
      nodeDiv.addEventListener('dragleave', handleDragLeave);
      nodeDiv.addEventListener('drop',      (e) => handleDrop(e, tag));

      // Toggle arrow
      const toggle = document.createElement('span');
      toggle.className = [
        'hierarchy-toggle',
        isCollapsed   ? 'collapsed'    : '',
        !hasChildren  ? 'no-children'  : '',
      ].join(' ').trim();
      toggle.textContent = '▼';
      toggle.addEventListener('click', () => toggleHierarchyNode(tag));
      nodeDiv.appendChild(toggle);

      // Category badge
      const catBadge = document.createElement('span');
      catBadge.className = `category-badge category-${category}`;
      catBadge.textContent = category;
      nodeDiv.appendChild(catBadge);

      // Tag name
      const nameSpan = document.createElement('span');
      nameSpan.className = 'hierarchy-node-name';
      nameSpan.textContent = tag;
      nameSpan.addEventListener('click', (e) => startHierarchyTagEdit(e, tag));
      nodeDiv.appendChild(nameSpan);

      // Action buttons
      const actions = document.createElement('div');
      actions.className = 'hierarchy-node-actions';

      const mkBtn = (label, handler) => {
        const btn = document.createElement('button');
        btn.textContent = label;
        btn.addEventListener('click', (e) => { e.stopPropagation(); handler(); });
        return btn;
      };

      actions.appendChild(mkBtn('+ Child',  () => addHierarchyChild(tag)));
      actions.appendChild(mkBtn('+ Parent', () => addHierarchyParent(tag)));
      actions.appendChild(mkBtn('×',        () => removeHierarchyNode(tag)));
      nodeDiv.appendChild(actions);
      nodeEl.appendChild(nodeDiv);

      // ── Children container ─────────────────────────────────────────────
      const childrenDiv = document.createElement('div');
      childrenDiv.className = 'hierarchy-children' + (isCollapsed ? ' collapsed' : '');
      childrenDiv.id = `children-${tag}`;

      if (hasChildren) {
        children.sort().forEach(child => childrenDiv.appendChild(renderNode(child, depth + 1)));
      }

      nodeEl.appendChild(childrenDiv);
      return nodeEl;
    }

    const visibleRoots = rootTags.filter(tag => hasMatchingDescendant(tag));
    visibleRoots.sort().forEach(tag => {
      container.appendChild(renderNode(tag));
    });
  }

  function filterHierarchy() {
    hierarchyFilter = document.getElementById('hierarchy-filter').value;
    renderHierarchy();
  }

  function startHierarchyTagEdit(event, tag) {
    event.stopPropagation();
    const nameSpan = event.target;
    const originalTag = tag;
    
    const input = document.createElement('input');
    input.type = 'text';
    input.value = tag;
    input.className = 'hierarchy-edit-input';
    
    input.onkeydown = (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        finishHierarchyTagEdit(originalTag, input.value);
      } else if (e.key === 'Escape') {
        renderHierarchy();
      }
    };
    
    input.onblur = () => {
      finishHierarchyTagEdit(originalTag, input.value);
    };
    
    nameSpan.innerHTML = '';
    nameSpan.appendChild(input);
    input.focus();
    input.select();
  }

  function finishHierarchyTagEdit(oldTag, newTag) {
    newTag = normalizeTagName(newTag);
    
    if (!newTag || newTag === oldTag) {
      renderHierarchy();
      return;
    }
    
    if (config.hierarchy[newTag] && newTag !== oldTag) {
      showToast('Tag already exists in hierarchy', 'error');
      renderHierarchy();
      return;
    }
    
    // Update the tag
    config.hierarchy[newTag] = config.hierarchy[oldTag];
    delete config.hierarchy[oldTag];
    
    // Update any child references in OTHER entries
    for (const [p, children] of Object.entries(config.hierarchy)) {
      config.hierarchy[p] = children.map(c => c === oldTag ? newTag : c);
    }
    
    saveHierarchy();
    renderHierarchy();
  }

  function toggleHierarchyNode(tag) {
    if (collapsedNodes.has(tag)) {
      collapsedNodes.delete(tag);
    } else {
      collapsedNodes.add(tag);
    }
    renderHierarchy();
  }

  function expandAllHierarchy() {
    collapsedNodes.clear();
    renderHierarchy();
  }

  function collapseAllHierarchy() {
    Object.keys(config.hierarchy).forEach(tag => collapsedNodes.add(tag));
    renderHierarchy();
  }

  function addRootTag() {
    const rawInput = document.getElementById('new-hierarchy-tag').value.trim();

    if (!rawInput) {
      showToast('Enter a tag name', 'error');
      return;
    }

    const { category, name } = parseTag(rawInput);
    const tagName = normalizeTagName(name);

    if (!tagName) {
      showToast('Enter a valid tag name', 'error');
      return;
    }

    const tag = `${category}:${tagName}`;

    if (config.hierarchy[tag]) {
      showToast('Tag already in hierarchy', 'error');
      return;
    }

    config.hierarchy[tag] = [];
    saveHierarchy();
    renderHierarchy();
    document.getElementById('new-hierarchy-tag').value = '';
  }

  function addHierarchyChild(parentTag) {
    document.getElementById('hierarchy-modal-title').textContent = `Add Child Under "${parentTag}"`;
    document.getElementById('hierarchy-modal-tag').value = '';

    const parentCategory = parseTag(parentTag).category;
    document.getElementById('hierarchy-modal-tag').placeholder = `e.g. ${parentCategory}:tag_name`;

    const submitBtn = document.getElementById('hierarchy-modal-submit');
    submitBtn.textContent = 'Add Child';
    submitBtn.onclick = () => {
      const rawInput = document.getElementById('hierarchy-modal-tag').value.trim();
      if (!rawInput) { showToast('Enter a tag name', 'error'); return; }

      let { category, name } = parseTag(rawInput);
      const tagName = normalizeTagName(name);
      if (!tagName) { showToast('Enter a valid tag name', 'error'); return; }

      if (!rawInput.includes(':')) category = parentCategory;
      const childTag = `${category}:${tagName}`;

      // Add edge: parent → child
      if (!config.hierarchy[parentTag]) config.hierarchy[parentTag] = [];
      if (!config.hierarchy[parentTag].includes(childTag)) {
        config.hierarchy[parentTag].push(childTag);
      }
      // Make sure the child key exists too (with empty children) so it
      // shows up in render even if it's a leaf
      if (!config.hierarchy[childTag]) config.hierarchy[childTag] = [];

      collapsedNodes.delete(parentTag);
      saveHierarchy();
      renderHierarchy();
      closeModal('hierarchy-modal');
    };

    document.getElementById('hierarchy-modal').classList.remove('hidden');
  }

  function addHierarchyParent(childTag) {
    document.getElementById('hierarchy-modal-title').textContent = `Add Parent Above "${childTag}"`;
    document.getElementById('hierarchy-modal-tag').value = '';

    const childCategory = parseTag(childTag).category;
    document.getElementById('hierarchy-modal-tag').placeholder = `e.g. ${childCategory}:tag_name`;

    const submitBtn = document.getElementById('hierarchy-modal-submit');
    submitBtn.textContent = 'Add Parent';
    submitBtn.onclick = () => {
      const rawInput = document.getElementById('hierarchy-modal-tag').value.trim();
      if (!rawInput) { showToast('Enter a tag name', 'error'); return; }

      let { category, name } = parseTag(rawInput);
      const parentName = normalizeTagName(name);
      if (!parentName) { showToast('Enter a valid tag name', 'error'); return; }

      if (!rawInput.includes(':')) category = childCategory;
      const newParentTag = `${category}:${parentName}`;

      if (!config.hierarchy[newParentTag]) config.hierarchy[newParentTag] = [];
      if (!config.hierarchy[newParentTag].includes(childTag)) {
        config.hierarchy[newParentTag].push(childTag);
      }
      if (!config.hierarchy[childTag]) config.hierarchy[childTag] = [];

      saveHierarchy();
      renderHierarchy();
      closeModal('hierarchy-modal');
    };

    document.getElementById('hierarchy-modal').classList.remove('hidden');
  }

  function removeHierarchyNode(tag) {
    if (!confirm(`Remove "${tag}" from hierarchy?`)) return;

    // What were tag's parents? (Need to know to potentially reparent
    // tag's children to them.)
    const parents = [];
    for (const [p, children] of Object.entries(config.hierarchy)) {
      if (children.includes(tag)) parents.push(p);
    }

    // What were tag's children?
    const children = config.hierarchy[tag] || [];

    // Reparent: every child of tag becomes a child of every parent of tag.
    for (const parent of parents) {
      config.hierarchy[parent] = config.hierarchy[parent].filter(c => c !== tag);
      for (const child of children) {
        if (!config.hierarchy[parent].includes(child)) {
          config.hierarchy[parent].push(child);
        }
      }
    }

    // Remove tag's own entry
    delete config.hierarchy[tag];

    // Clean up: if any other entry still mentions tag as a child, drop
    // the reference (defensive — shouldn't happen but cheap)
    for (const [p, kids] of Object.entries(config.hierarchy)) {
      config.hierarchy[p] = kids.filter(c => c !== tag);
    }

    saveHierarchy();
    renderHierarchy();
  }

  function setupSuggestionsDelegation() {
    // Aliases section
    const aliasContainer = document.getElementById('alias-suggestions-section');
    if (aliasContainer) {
      aliasContainer.addEventListener('click', async (event) => {
        const target = event.target.closest('[data-suggestion-action]');
        if (!target) return;

        const action = target.dataset.suggestionAction;
        const card = target.closest('.card.suggestion');
        const canonical = card?.dataset.canonical;
        if (!canonical) return;

        if (action === 'accept-alias-all') {
          const sources = [...card.querySelectorAll('.suggestion-variant-row')]
            .map(row => row.dataset.source);
          if (sources.length > 0) await acceptAliasGroup(canonical, sources);
        } else if (action === 'dismiss-alias-all') {
          const sources = [...card.querySelectorAll('.suggestion-variant-row')]
            .map(row => row.dataset.source);
          if (sources.length > 0) await dismissAliasGroup(canonical, sources);
        } else if (action === 'accept-alias-one') {
          const row = target.closest('.suggestion-variant-row');
          const source = row?.dataset.source;
          if (source) await acceptAliasGroup(canonical, [source]);
        } else if (action === 'dismiss-alias-one') {
          const row = target.closest('.suggestion-variant-row');
          const source = row?.dataset.source;
          if (source) await dismissAliasGroup(canonical, [source]);
        }
      });
    }

    // Blacklist section
    const garbageContainer = document.getElementById('garbage-suggestions-section');
    if (garbageContainer) {
      garbageContainer.addEventListener('click', async (event) => {
        const target = event.target.closest('[data-suggestion-action]');
        if (!target) return;

        const action = target.dataset.suggestionAction;
        const row = target.closest('.garbage-row');
        const tag = row?.dataset.tag;
        if (!tag) return;

        if (action === 'accept-garbage')      await acceptGarbageTag(tag);
        else if (action === 'dismiss-garbage') await dismissGarbageTag(tag);
      });
    }
  }

  function setupHierarchyDelegation() {
    const container = document.getElementById('hierarchy-tree');
    if (!container) return;

    // Click delegation
    container.addEventListener('click', (event) => {
      const target = event.target.closest('[data-action]');
      if (!target) return;

      const action = target.dataset.action;
      const node = target.closest('.hierarchy-node');
      const tag = node?.dataset.tag;
      if (!tag) return;

      switch (action) {
        case 'toggle':            toggleHierarchyNode(tag); break;
        case 'edit-name':         startHierarchyTagEdit(event, tag); break;
        case 'add-child':         addHierarchyChild(tag); break;
        case 'add-parent':        addHierarchyParent(tag); break;
        case 'remove':            removeHierarchyNode(tag); break;
      }
    });

    // Drag-drop delegation. Drag events don't bubble the same way as
    // clicks — they fire on the dragged element directly. But since
    // the draggable element IS the .hierarchy-node, we can listen at
    // the container and check event.target.
    container.addEventListener('dragstart', (event) => {
      const node = event.target.closest('.hierarchy-node');
      if (!node) return;
      const tag = node.dataset.tag;
      if (tag) handleDragStart(event, tag);
    });

    container.addEventListener('dragover', (event) => {
      const node = event.target.closest('.hierarchy-node');
      if (!node) return;
      handleDragOver(event);
    });

    container.addEventListener('drop', (event) => {
      const node = event.target.closest('.hierarchy-node');
      if (!node) return;
      const tag = node.dataset.tag;
      if (tag) handleDrop(event, tag);
    });
  }

  // Drag and drop
  let draggedTag = null;

  function handleDragStart(event, tag) {
    draggedTag = tag;
    event.dataTransfer.effectAllowed = 'move';
    event.target.style.opacity = '0.5';
  }

  function handleDragOver(event) {
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
    event.currentTarget.classList.add('drag-over');
  }

  function handleDragLeave(event) {
    event.currentTarget.classList.remove('drag-over');
  }

  function handleDrop(event, targetTag) {
    event.preventDefault();
    document.querySelectorAll('.hierarchy-node.drag-over').forEach(el =>
      el.classList.remove('drag-over')
    );

    if (!draggedTag || draggedTag === targetTag) return;

    // Disconnect dragged from all its current parents
    for (const [p, children] of Object.entries(config.hierarchy)) {
      config.hierarchy[p] = children.filter(c => c !== draggedTag);
    }

    // Connect target → dragged (target becomes parent)
    if (!config.hierarchy[targetTag]) config.hierarchy[targetTag] = [];
    if (!config.hierarchy[targetTag].includes(draggedTag)) {
      config.hierarchy[targetTag].push(draggedTag);
    }

    // Make sure dragged still has its own entry
    if (!config.hierarchy[draggedTag]) config.hierarchy[draggedTag] = [];

    draggedTag = null;
    saveHierarchy();
    renderHierarchy();
  }

  function isAncestor(potentialAncestor, tag) {
    const data = config.hierarchy[tag];
    if (!data?.implies) return false;

    for (const parent of data.implies) {
      if (parent === potentialAncestor) return true;
      if (isAncestor(potentialAncestor, parent)) return true;
    }
    return false;
  }

  // ============================================
  // TAG PILL COMPONENT
  // ============================================
  function createTagPill(fullTag, category, name, options = {}) {
    const { onRemove, onCategoryChange, onEdit, showEdit = false, onSwap, swapDirection } = options;
    
    const pill = document.createElement('span');
    pill.className = `tag-pill tag-${category}`;
    pill.dataset.tag = fullTag;
    
    const nameSpan = document.createElement('span');
    nameSpan.className = 'tag-name';
    nameSpan.textContent = (name || '').replace(/_/g, ' ');
    nameSpan.onclick = (e) => {
      e.stopPropagation();
      if (onCategoryChange) {
        showCategoryDropdown(pill, onCategoryChange);
      }
    };
    
    // Double-click to edit (replaces pencil icon)
    if (showEdit && onEdit) {
      nameSpan.ondblclick = (e) => {
        e.stopPropagation();
        startPillEdit(pill, fullTag, onEdit);
      };
      nameSpan.title = 'Double-click to edit';
      nameSpan.style.cursor = 'text';
    }
    
    pill.appendChild(nameSpan);
    
    // For blacklist (right arrow): swap then X
    // For whitelist (left arrow): X then swap
    
    const swapBtn = onSwap ? document.createElement('span') : null;
    if (swapBtn) {
      swapBtn.className = 'tag-swap';
      swapBtn.textContent = '⇆';
      swapBtn.title = swapDirection === 'right' ? 'Move to whitelist' : 'Move to blacklist';
      swapBtn.onclick = (e) => {
        e.stopPropagation();
        onSwap();
      };
    }
    
    const removeBtn = onRemove ? document.createElement('span') : null;
    if (removeBtn) {
      removeBtn.className = 'tag-remove';
      removeBtn.textContent = '×';
      removeBtn.onclick = (e) => {
        e.stopPropagation();
        onRemove();
      };
    }
    if (swapBtn || removeBtn) {
      const buttonContainer = document.createElement('span');
      buttonContainer.style.display = 'flex';
      buttonContainer.style.alignItems = 'center';
      buttonContainer.style.marginLeft = '10px'; // Small space between tag name and buttons
      
      // Add swap button first (to the left)
      if (swapBtn) {
        buttonContainer.appendChild(swapBtn);
        // Add a small margin between arrow and X when both exist
        if (removeBtn) {
          swapBtn.style.marginRight = '10px';
        }
      }
      
      // Add remove button second (to the right)
      if (removeBtn) {
        buttonContainer.appendChild(removeBtn);
      }
      
      pill.appendChild(buttonContainer);
    }
    return pill;
  }

  function startPillEdit(pill, currentFullTag, onSave) {
    const nameSpan = pill.querySelector('.tag-name');
    const removeBtn = pill.querySelector('.tag-remove');
    
    if (removeBtn) removeBtn.style.display = 'none';
    
    const input = document.createElement('input');
    input.type = 'text';
    input.className = 'tag-inline-edit';
    input.value = currentFullTag;
    
    input.onkeydown = (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        onSave(input.value);
      } else if (e.key === 'Escape') {
        // Restore original
        nameSpan.textContent = parseTag(currentFullTag).name.replace(/_/g, ' ');
        nameSpan.style.display = '';
        input.remove();
        if (removeBtn) removeBtn.style.display = '';
      }
    };
    
    input.onblur = () => {
      onSave(input.value);
    };
    
    nameSpan.style.display = 'none';
    pill.insertBefore(input, nameSpan.nextSibling);
    input.focus();
    input.select();
  }

  let currentDropdownTarget = null;
  
  function showCategoryDropdown(targetEl, onSelect) {
    // Remove existing dropdown
    const existing = document.querySelector('.category-dropdown');
    if (existing) {
      const wasOpen = currentDropdownTarget === targetEl;
      existing.remove();
      currentDropdownTarget = null;
      // If clicking same element, just close (toggle off)
      if (wasOpen) return;
    }
    
    const rect = targetEl.getBoundingClientRect();
    const dropdown = document.createElement('div');
    dropdown.className = 'category-dropdown';
    dropdown.style.top = `${rect.bottom + 4}px`;
    dropdown.style.left = `${rect.left}px`;
    
    VALID_CATEGORIES.forEach(cat => {
      const item = document.createElement('div');
      item.className = 'category-dropdown-item';
      item.innerHTML = `<span class="category-badge category-${cat}">${cat}</span>`;
      item.onclick = (e) => {
        e.stopPropagation();
        onSelect(cat);
        dropdown.remove();
        currentDropdownTarget = null;
      };
      dropdown.appendChild(item);
    });
    
    document.body.appendChild(dropdown);
    currentDropdownTarget = targetEl;
    
    setTimeout(() => {
      document.addEventListener('click', function closeDropdown(e) {
        if (!dropdown.contains(e.target) && e.target !== targetEl) {
          dropdown.remove();
          currentDropdownTarget = null;
          document.removeEventListener('click', closeDropdown);
        }
      });
    }, 0);
  }

  // ============================================
  // AUTOCOMPLETE
  // ============================================
  function setupAutocomplete(inputId, dropdownId, onSelect = null) {
    const input = document.getElementById(inputId);
    const dropdown = document.getElementById(dropdownId);

    if (!input || !dropdown) return;

    input.addEventListener('input', debounce(() => {
      showAutocompleteResults(input, dropdown, onSelect);
    }, 200));

    input.addEventListener('keydown', (e) => {
      handleAutocompleteKeydown(e, input, dropdown, onSelect);
    });

    document.addEventListener('click', (e) => {
      if (!input.contains(e.target) && !dropdown.contains(e.target)) {
        dropdown.classList.remove('visible');
      }
    });
  }



  function handleAutocompleteKeydown(e, input, dropdown, onSelect) {
    if (!dropdown.classList.contains('visible')) return;

    const items = dropdown.querySelectorAll('.autocomplete-item[data-tag]');

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      autocompleteSelectedIndex = Math.min(autocompleteSelectedIndex + 1, items.length - 1);
      updateAutocompleteSelection(items);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      autocompleteSelectedIndex = Math.max(autocompleteSelectedIndex - 1, 0);
      updateAutocompleteSelection(items);
    } else if (e.key === 'Enter' && autocompleteSelectedIndex >= 0) {
      e.preventDefault();
      const selected = items[autocompleteSelectedIndex];
      if (selected) {
        const selectedTag = selected.dataset.tag;
        if (onSelect) {
          onSelect(selectedTag);
        } else {
          input.value = selectedTag;
        }
        dropdown.classList.remove('visible');
      }
    } else if (e.key === 'Escape') {
      dropdown.classList.remove('visible');
    }
  }

  function updateAutocompleteSelection(items) {
    items.forEach((item, idx) => {
      item.classList.toggle('selected', idx === autocompleteSelectedIndex);
    });

    if (autocompleteSelectedIndex >= 0 && items[autocompleteSelectedIndex]) {
      items[autocompleteSelectedIndex].scrollIntoView({ block: 'nearest' });
    }
  }

  function handleGlobalSearchSelect(tag) {
    switchTab('images');
    document.getElementById('images-filter').value = tag;
    showToast(`Filtering by: ${tag}`, 'info');
  }

  // ============================================
  // UTILITIES
  // ============================================
  function parseTag(tag) {
    if (tag && tag.includes(':')) {
      const [category, ...rest] = tag.split(':');
      const validCategory = VALID_CATEGORIES.includes(category) ? category : 'general';
      return { category: validCategory, name: rest.join(':') };
    }
    return { category: 'general', name: tag || '' };
  }

  function normalizeTagName(name) {
    return (name || '').toLowerCase().trim().replace(/\s+/g, '_');
  }

  function showToast(message, type = 'success') {
    const container = document.getElementById('toast-container');
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.textContent = message;

    container.appendChild(toast);

    setTimeout(() => {
      toast.style.animation = 'toastOut 0.3s ease forwards';
      setTimeout(() => toast.remove(), 300);
    }, 3000);
  }

  /**
   * Convert a canonical tag string into its display form.
   * Strips category prefix; converts underscores to spaces.
   *
   *   "character:dizzy_dokuro" → "dizzy dokuro"
   *   "1girl"                  → "1girl"
   *   "general:school_uniform" → "school uniform"
   */
  function displayName(tag) {
    if (!tag) return '';
    const { name } = parseTag(tag);
    return (name || '').replace(/_/g, ' ');
  }

  function closeModal(modalId) {
    document.getElementById(modalId).classList.add('hidden');
  }

  function downloadJSON(obj, filename) {
    const blob = new Blob([JSON.stringify(obj, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  }

  function escapeHtml(str) {
    return String(str || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function escapeAttr(str) {
    return String(str || '')
      .replace(/&/g, '&amp;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
  }

  function debounce(func, wait) {
    let timeout;
    return function(...args) {
      clearTimeout(timeout);
      timeout = setTimeout(() => func.apply(this, args), wait);
    };
  }

window.filterAliases       = filterAliases;
window.filterBlacklist     = filterBlacklist;
window.filterWhitelist     = filterWhitelist;
window.filterHierarchy     = filterHierarchy;
window.expandAllHierarchy  = expandAllHierarchy;
window.collapseAllHierarchy = collapseAllHierarchy;
window.closeModal          = closeModal;
window.canonizeConfigSection = canonizeConfigSection;
window.exportConfigSection   = exportConfigSection;
window.exportAllConfigs      = exportAllConfigs;
window.refreshAllImages      = refreshAllImages;
window.rebuildIndex          = rebuildIndex;
window.refreshCurrentImage   = refreshCurrentImage;
window.rescanCurrentImage    = rescanCurrentImage;
window.setupHierarchyDelegation = setupHierarchyDelegation;
window.setupSuggestionsDelegation = setupSuggestionsDelegation;