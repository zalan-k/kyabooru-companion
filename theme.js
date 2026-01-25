function applyThemeFromSettings() {
  if (typeof browser === 'undefined') return;
  
  browser.storage.local.get('settings').then((result) => {
    const theme = result.settings?.theme || 'system';
    applyTheme(theme);
  }).catch(err => {
    console.error('Error loading theme:', err);
  });
}

function applyTheme(theme) {
  let effectiveTheme = theme;
  if (theme === 'system') {
    effectiveTheme = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }
  document.documentElement.classList.toggle('dark', effectiveTheme === 'dark');
}

// Apply immediately when script loads
applyThemeFromSettings();

// Also listen for storage changes (if user changes theme in another tab)
if (typeof browser !== 'undefined') {
  browser.storage.onChanged.addListener((changes, area) => {
    if (area === 'local' && changes.settings?.newValue?.theme) {
      applyTheme(changes.settings.newValue.theme);
    }
  });
}