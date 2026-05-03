/**
 * TagSaver injected styles
 *
 * Rewrite of the overlay design system. Highlights:
 *
 * - All CSS variables (--primary, --bg-card-rgb, --glass-bg, etc.) are scoped
 *   to .tag-saver-extension-overlay so they do not leak into host page CSS.
 *   The :root scope used previously could collide with vars on heavily-styled
 *   pages.
 * - rgba(var(--name-rgb), alpha) is used in place of color-mix(in srgb, ...).
 *   Firefox falls back to opaque on color-mix in some versions; the rgba form
 *   is universally supported.
 * - Each backdrop-filter has a -webkit-backdrop-filter sibling for Safari.
 * - Selectors are qualified with .tag-saver-extension-overlay (compound,
 *   specificity 0,2,0) to win the cascade against host page rules.
 *
 * Module exports both a getAllStyles() (used at overlay init) and the
 * individual style strings (so other modules like TagPills can inject just
 * the slice they need).
 *
 *  ============================================================
 *  IMAGE-SELECTOR + TOAST: keep your existing strings.
 *  Search for the "PRESERVED FROM YOUR EXISTING styles.js" markers below
 *  and paste your old imageSelectorStyles / toastStyles content into the
 *  template literals. Those subsystems weren't redesigned in this pass.
 *  ============================================================
 */

window.TagSaver = window.TagSaver || {};
window.TagSaver.UI = window.TagSaver.UI || {};

window.TagSaver.UI.Styles = (function() {

  /* ---------------------------------------------------------------
   *  Helpers
   * ------------------------------------------------------------- */

  function injectStyles(css) {
    const style = document.createElement('style');
    style.textContent = css;
    document.head.appendChild(style);
    return style;
  }

  function removeStyles(el) {
    if (el && el.parentNode) {
      el.parentNode.removeChild(el);
    }
  }

  /* ---------------------------------------------------------------
   *  CSS variables — scoped to the overlay root so they don't leak.
   *  Light defaults, dark overrides via html.dark (theme.js).
   * ------------------------------------------------------------- */

  const variableStyles = `
    .tag-saver-extension-overlay {
      --primary: #64748b;
      --primary-rgb: 100, 116, 139;
      --primary-hover: #475569;
      --primary-light: #e2e8f0;
      --primary-glow: rgba(100, 116, 139, 0.3);

      --text-primary: #334155;
      --text-secondary: #64748b;
      --text-muted: #94a3b8;

      --border: #e2e8f0;
      --border-rgb: 226, 232, 240;
      --border-strong: #cbd5e1;

      --bg-card: #ffffff;
      --bg-card-rgb: 255, 255, 255;
      --bg-section: #f8fafc;
      --bg-section-rgb: 248, 250, 252;
      --glass-bg: rgba(255, 255, 255, 0.2);

      --color-success: #22c55e;
      --color-warning: #f59e0b;
      --color-danger: #ef4444;

      --shadow-sm: 0 1px 2px rgba(0, 0, 0, 0.04);
      --shadow-md: 0 2px 4px rgba(0, 0, 0, 0.06);
      --shadow-lg: 0 4px 8px rgba(0, 0, 0, 0.08);

      --radius-sm: 6px;
      --radius-md: 8px;
      --radius-lg: 12px;
      --transition: 0.2s ease;

      --heat-color: rgba(255, 255, 255, 0.6);
      --heat-color-soft: rgba(255, 255, 255, 0.15);

      --tag-artist:    rgba(255, 117, 117, 0.9);
      --tag-character: rgba(121, 187, 255, 0.9);
      --tag-copyright: rgba(179, 136, 255, 0.9);
      --tag-general:   rgba(153, 153, 153, 0.9);
      --tag-meta:      rgba(251, 192, 45, 0.9);
    }

    html.dark .tag-saver-extension-overlay {
      --primary: #94a3b8;
      --primary-rgb: 148, 163, 184;
      --primary-hover: #cbd5e1;
      --primary-light: #334155;
      --primary-glow: rgba(148, 163, 184, 0.25);

      --text-primary: #e2e8f0;
      --text-secondary: #94a3b8;
      --text-muted: #64748b;

      --border: #334155;
      --border-rgb: 51, 65, 85;
      --border-strong: #475569;

      --bg-card: #1e293b;
      --bg-card-rgb: 30, 41, 59;
      --bg-section: #1e293b;
      --bg-section-rgb: 30, 41, 59;
      --glass-bg: rgba(30, 30, 30, 0.2);

      --color-success: #4ade80;
      --color-warning: #fbbf24;
      --color-danger: #f87171;

      --shadow-sm: 0 1px 2px rgba(0, 0, 0, 0.2);
      --shadow-md: 0 2px 4px rgba(0, 0, 0, 0.25);
      --shadow-lg: 0 4px 8px rgba(0, 0, 0, 0.3);

      --heat-color: rgba(0, 0, 0, 0.35);
      --heat-color-soft: rgba(0, 0, 0, 0.1);
    }
  `;

  /* ---------------------------------------------------------------
   *  Form element reset (Firefox UA stylesheet differs from Chromium
   *  on inputs/buttons — line-height, focus ring, appearance).
   * ------------------------------------------------------------- */

  const resetStyles = `
    .tag-saver-extension-overlay button,
    .tag-saver-extension-overlay input,
    .tag-saver-extension-overlay select,
    .tag-saver-extension-overlay textarea {
      font: inherit;
      line-height: 1.2;
      -webkit-appearance: none;
      -moz-appearance: none;
      appearance: none;
      border: 0;
      background: none;
      color: inherit;
      box-sizing: border-box;
      margin: 0;
      padding: 0;
    }
    .tag-saver-extension-overlay button { cursor: pointer; }
    .tag-saver-extension-overlay input::-moz-focus-inner { border: 0; padding: 0; }
    .tag-saver-extension-overlay * { box-sizing: border-box; }
  `;

  /* ---------------------------------------------------------------
   *  Overlay backdrop, layout, image card, content panel, inner
   * ------------------------------------------------------------- */

  const overlayStyles = `
    @keyframes ts-overlay-fade-in {
      from { opacity: 0; }
      to   { opacity: 1; }
    }

    .tag-saver-extension-overlay {
      position: fixed;
      inset: 0;
      background: rgba(0, 0, 0, 0.35);
      z-index: 999990;
      display: flex;
      align-items: center;
      font-family: 'DM Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      color: var(--text-primary);
      animation: ts-overlay-fade-in 0.1s ease-out;
    }

    .tag-saver-extension-overlay .overlay-layout {
      display: flex;
      align-items: center;
      gap: 16px;
      justify-content: flex-end;
      width: 100%;
      padding-right: 120px;
    }

    .tag-saver-extension-overlay .image-card {
      position: relative;
      flex: 0 0 auto;
      min-width: 200px;
      max-width: 480px;
      max-height: 600px;
      background: var(--glass-bg);
      backdrop-filter: blur(40px) saturate(220%);
      -webkit-backdrop-filter: blur(40px) saturate(220%);
      border: 1px solid rgba(var(--border-rgb), 0.35);
      border-radius: var(--radius-lg);
      padding: 6px;
      box-shadow:
        0 14px 44px rgba(0, 0, 0, 0.28),
        0 4px 12px rgba(0, 0, 0, 0.14),
        inset 0 1px 0 rgba(255, 255, 255, 0.16);
      display: flex;
      align-items: center;
      justify-content: center;
      opacity: 0;
      transform: translateX(-20px);
      transition: opacity 0.3s ease-out, transform 0.3s ease-out;
    }
    .tag-saver-extension-overlay .image-card.ready {
      opacity: 1;
      transform: translateX(0);
    }
    .tag-saver-extension-overlay .image-card.hidden {
      display: none;
    }
    .tag-saver-extension-overlay .image-card img {
      display: block;
      width: auto;
      height: auto;
      max-width: 100%;
      max-height: 360px;
      object-fit: contain;
      border-radius: var(--radius-md);
      position: relative;
      z-index: 1;
    }

    .tag-saver-extension-overlay .overlay-content {
      position: relative;
      flex: 0 0 310px;
      max-height: 90vh;
      background: var(--glass-bg);
      backdrop-filter: blur(40px) saturate(220%);
      -webkit-backdrop-filter: blur(40px) saturate(220%);
      border: none;
      border-radius: var(--radius-lg);
      box-shadow:
        0 14px 44px rgba(0, 0, 0, 0.28),
        0 4px 12px rgba(0, 0, 0, 0.14),
        inset 0 1px 0 rgba(255, 255, 255, 0.16);
      overflow: visible;
      display: flex;
      flex-direction: column;
    }
    .tag-saver-extension-overlay .overlay-inner {
      position: relative;
      z-index: 1;
      padding: 10px;
      display: flex;
      flex-direction: column;
      gap: 10px;
      overflow-y: auto;
      min-height: 0;
    }
  `;

  /* ---------------------------------------------------------------
   *  Duplicate warning — floating glass card above the panel.
   *  Inset 5px from each side of the panel; bottom: calc(100% + 10px)
   *  positions it above the panel's top edge.
   * ------------------------------------------------------------- */

  const duplicateWarningStyles = `
    .tag-saver-extension-overlay .duplicate-warning {
      position: absolute;
      left: 5px;
      right: 5px;
      bottom: calc(100% + 10px);
      margin-bottom: 0;
      z-index: 2;
      display: flex;
      align-items: center;
      gap: 10px;
      padding: 8px 14px;
      background: rgba(var(--bg-card-rgb), 0.7);
      backdrop-filter: blur(12px) saturate(150%);
      -webkit-backdrop-filter: blur(12px) saturate(150%);
      border: none;
      border-radius: 18px;
      box-shadow:
        0 4px 16px rgba(0, 0, 0, 0.10),
        inset 0 1px 0 rgba(255, 255, 255, 0.12);
      font-size: 12px;
    }
    html.dark .tag-saver-extension-overlay .duplicate-warning {
      background: rgba(var(--bg-card-rgb), 0.2);
    }
    .tag-saver-extension-overlay .duplicate-warning.hidden {
      display: none;
    }
    .tag-saver-extension-overlay .duplicate-warning .icon {
      flex-shrink: 0;
      width: 20px;
      height: 20px;
      display: flex;
      align-items: center;
      justify-content: center;
      color: var(--color-warning);
    }
    .tag-saver-extension-overlay .duplicate-warning .icon svg {
      width: 18px;
      height: 18px;
    }
    .tag-saver-extension-overlay .duplicate-warning .body {
      flex: 1;
      line-height: 1.3;
      min-width: 0;
    }
    .tag-saver-extension-overlay .duplicate-warning .body strong {
      color: var(--text-primary);
      display: block;
      font-weight: 600;
      font-size: 12px;
    }
    .tag-saver-extension-overlay .duplicate-warning .body .meta {
      color: var(--text-secondary);
      font-size: 11px;
    }
    .tag-saver-extension-overlay .duplicate-warning .meta code {
      font-family: 'JetBrains Mono', ui-monospace, monospace;
      font-size: 11px;
      color: var(--text-primary);
      background: rgba(var(--bg-section-rgb), 0.6);
      padding: 1px 5px;
      border-radius: 4px;
    }
  `;

  /* ---------------------------------------------------------------
   *  Pool block — header (title + memory buttons + Generate),
   *  fields (Pool ID + Index inputs).
   * ------------------------------------------------------------- */

  const poolStyles = `
    .tag-saver-extension-overlay .pool-block {
      background: rgba(var(--bg-section-rgb), 0.6);
      border: none;
      border-radius: var(--radius-md);
      padding: 10px 12px;
      backdrop-filter: blur(8px);
      -webkit-backdrop-filter: blur(8px);
    }
    .tag-saver-extension-overlay .pool-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-bottom: 10px;
    }
    .tag-saver-extension-overlay .pool-title {
      font-size: 11px;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.6px;
      color: var(--text-secondary);
      display: flex;
      align-items: center;
      gap: 6px;
    }
    .tag-saver-extension-overlay .pool-title::before {
      content: '';
      width: 2px;
      height: 12px;
      background: var(--primary);
      border-radius: 1px;
    }
    .tag-saver-extension-overlay .pool-buttons {
      display: flex;
      gap: 4px;
      align-items: center;
    }
    .tag-saver-extension-overlay .pool-action-btn {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      background: rgba(var(--primary-rgb), 0.12);
      border: none;
      color: var(--text-secondary);
      padding: 5px;
      border-radius: var(--radius-sm);
      cursor: pointer;
      transition: all var(--transition);
    }
    .tag-saver-extension-overlay .pool-action-btn:hover {
      background: rgba(var(--primary-rgb), 0.25);
      color: var(--text-primary);
      transform: translateY(-1px);
    }
    .tag-saver-extension-overlay .pool-action-btn:active {
      transform: translateY(0);
    }
    .tag-saver-extension-overlay .pool-action-btn svg {
      width: 14px;
      height: 14px;
    }
    .tag-saver-extension-overlay .pool-action-btn-text {
      padding: 5px 10px;
      font-size: 11px;
      font-weight: 600;
      font-family: inherit;
      color: white;
      background: var(--primary);
      border: 1px solid var(--primary);
      position: relative;
      overflow: hidden;
    }
    html.dark .tag-saver-extension-overlay .pool-action-btn-text {
      color: var(--bg-card);
    }
    .tag-saver-extension-overlay .pool-action-btn-text:hover {
      background: var(--primary);
      color: white;
      transform: scale(1.04);
      box-shadow:
        inset 0 0 0 1px var(--heat-color),
        inset 0 0 6px 2px var(--heat-color-soft);
      border-color: var(--heat-color);
    }
    html.dark .tag-saver-extension-overlay .pool-action-btn-text:hover {
      color: var(--bg-card);
    }
    .tag-saver-extension-overlay .pool-fields {
      display: grid;
      grid-template-columns: 1fr 100px;
      gap: 10px;
    }
    .tag-saver-extension-overlay .pool-field {
      display: flex;
      flex-direction: column;
      gap: 4px;
    }
    .tag-saver-extension-overlay .pool-field label {
      font-size: 10px;
      font-weight: 500;
      color: var(--text-muted);
      text-transform: uppercase;
      letter-spacing: 0.4px;
    }
    .tag-saver-extension-overlay .pool-field input {
      width: 100%;
      padding: 7px 10px;
      background: var(--bg-card);
      border: none;
      border-radius: var(--radius-sm);
      font-family: inherit;
      font-size: 12px;
      color: var(--text-primary);
      outline: none;
      transition: border-color var(--transition);
    }
    .tag-saver-extension-overlay .pool-field input:focus {
      border-color: var(--primary);
    }
    .tag-saver-extension-overlay .pool-field input::placeholder {
      color: var(--text-muted);
    }
    .tag-saver-extension-overlay input[type="number"] {
      -moz-appearance: textfield;
      appearance: textfield;
    }
    .tag-saver-extension-overlay input[type="number"]::-webkit-inner-spin-button,
    .tag-saver-extension-overlay input[type="number"]::-webkit-outer-spin-button {
      -webkit-appearance: none;
      margin: 0;
    }
  `;

  /* ---------------------------------------------------------------
   *  Tag input + autocomplete dropdown
   * ------------------------------------------------------------- */

  const autocompleteStyles = `
    .tag-saver-extension-overlay .tag-input-block {
      position: relative;
    }
    .tag-saver-extension-overlay .tag-input-block > input {
      width: 100%;
      padding: 10px 14px;
      background: var(--bg-card);
      border: none;
      border-radius: var(--radius-md);
      font-family: inherit;
      font-size: 13px;
      color: var(--text-primary);
      outline: none;
      transition: border-color var(--transition);
    }
    .tag-saver-extension-overlay .tag-input-block > input:focus {
      border-color: var(--primary);
    }
    .tag-saver-extension-overlay .tag-input-block > input::placeholder {
      color: var(--text-muted);
    }

    .tag-saver-extension-overlay .autocomplete-dropdown {
      position: absolute;
      top: calc(100% + 4px);
      left: 0;
      right: 0;
      max-height: 200px;
      overflow-y: auto;
      background: var(--bg-card);
      border: 1px solid var(--border);
      border-radius: var(--radius-md);
      box-shadow: var(--shadow-lg);
      z-index: 10;
      display: none;
    }
    .tag-saver-extension-overlay .autocomplete-dropdown.show {
      display: block;
    }
    .tag-saver-extension-overlay .autocomplete-item {
      padding: 8px 12px;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: space-between;
      font-size: 12px;
      color: var(--text-primary);
      border-bottom: 1px solid var(--border);
    }
    .tag-saver-extension-overlay .autocomplete-item:last-child {
      border-bottom: none;
    }

    .tag-saver-extension-overlay .autocomplete-item:hover {
      background: var(--bg-section);
    }

    .tag-saver-extension-overlay .autocomplete-item.selected {
      background: rgba(var(--primary-rgb), 0.18);
      color: var(--text-primary);
    }
    .tag-saver-extension-overlay .autocomplete-item.selected .name {
      color: var(--text-primary);
    }
    .tag-saver-extension-overlay .autocomplete-item .name {
      font-weight: 500;
    }
    .tag-saver-extension-overlay .autocomplete-category {
      font-size: 9px;
      padding: 2px 6px;
      background: var(--primary-light);
      color: var(--primary);
      border-radius: 3px;
      text-transform: uppercase;
      letter-spacing: 0.4px;
      font-weight: 600;
    }
  `;

  /* ---------------------------------------------------------------
   *  Tag pills + scrollable display.
   *  TagPills module also imports tagStyles separately for the
   *  category dropdown, which is rendered as a body-attached element
   *  outside the overlay. The dropdown selectors below are therefore
   *  NOT scoped to .tag-saver-extension-overlay.
   * ------------------------------------------------------------- */

  const tagStyles = `
    .tag-saver-extension-overlay .tag-display-wrapper {
      display: flex;
      flex-direction: column;
      gap: 6px;
      min-height: 0;
    }
    .tag-saver-extension-overlay .tag-display-label {
      display: flex;
      align-items: center;
      justify-content: space-between;
      font-size: 11px;
      font-weight: 600;
      color: var(--text-secondary);
      text-transform: uppercase;
      letter-spacing: 0.6px;
    }
    .tag-saver-extension-overlay .tag-display-label > span:first-child {
      display: flex;
      align-items: center;
      gap: 6px;
    }
    .tag-saver-extension-overlay .tag-display-label > span:first-child::before {
      content: '';
      width: 2px;
      height: 12px;
      background: var(--primary);
      border-radius: 1px;
    }
    .tag-saver-extension-overlay .tag-display-label .count {
      background: var(--primary-light);
      color: var(--primary);
      padding: 2px 7px;
      border-radius: 8px;
      font-size: 10px;
      font-weight: 600;
    }
    .tag-saver-extension-overlay .tag-display {
      min-height: 80px;
      max-height: 220px;
      overflow-y: auto;
      padding: 5px;
      margin-bottom: 0;
      background: rgba(var(--bg-section-rgb), 0.5);
      border: none;
      border-radius: var(--radius-md);
      display: flex;
      flex-wrap: wrap;
      gap: 6px;
      align-content: flex-start;
    }
    .tag-saver-extension-overlay .tag-display::-webkit-scrollbar {
      width: 6px;
    }
    .tag-saver-extension-overlay .tag-display::-webkit-scrollbar-track {
      background: transparent;
    }
    .tag-saver-extension-overlay .tag-display::-webkit-scrollbar-thumb {
      background: var(--border-strong);
      border-radius: 3px;
    }

    /* Tag pills — must work inside the overlay AND elsewhere
       (batch upload page, etc.) so these are NOT scoped. */
    .tag-pill {
      display: inline-flex;
      align-items: center;
      padding: 4px 8px;
      border-radius: 4px;
      font-size: 12px;
      white-space: nowrap;
      color: white;
      box-shadow: 0 1px 2px rgba(0, 0, 0, 0.15);
      cursor: default;
      transition: transform 0.1s ease;
    }
    .tag-pill:hover { transform: translateY(-1px); }
    .tag-artist    { background: rgba(255, 117, 117, 0.9); }
    .tag-character { background: rgba(121, 187, 255, 0.9); }
    .tag-copyright { background: rgba(179, 136, 255, 0.9); }
    .tag-general   { background: rgba(153, 153, 153, 0.9); }
    .tag-meta      { background: rgba(251, 192, 45, 0.9); }
    .tag-content { cursor: pointer; user-select: none; }
    .tag-content:hover { opacity: 0.85; }
    .tag-delete {
      cursor: pointer;
      margin-left: 6px;
      opacity: 0.7;
      font-weight: bold;
      font-size: 13px;
      line-height: 1;
    }
    .tag-delete:hover { opacity: 1; }

    /* Category dropdown is body-attached (outside overlay), so unscoped. */
    .tag-category-dropdown {
      background: white;
      border: 1px solid #e2e8f0;
      border-radius: 8px;
      box-shadow: 0 4px 16px rgba(0, 0, 0, 0.15);
      padding: 4px;
      min-width: 160px;
      z-index: 999999999;
    }
    html.dark .tag-category-dropdown {
      background: #1e293b;
      border-color: #334155;
    }
    .tag-category-option {
      padding: 6px 10px;
      border-radius: 4px;
      font-size: 12px;
      cursor: pointer;
      display: flex;
      align-items: center;
      gap: 8px;
      color: #334155;
    }
    html.dark .tag-category-option { color: #e2e8f0; }
    .tag-category-option:hover { background: #f1f5f9; }
    html.dark .tag-category-option:hover { background: #334155; }
    .tag-category-option .category-color {
      width: 10px;
      height: 10px;
      border-radius: 2px;
      flex-shrink: 0;
    }
    .tag-category-option .selected-mark {
      margin-left: auto;
      color: #64748b;
      font-size: 11px;
    }
  `;

  /* ---------------------------------------------------------------
   *  Media placeholder — shown briefly inside .image-card while
   *  Hash.extractVideoFirstFrame is computing for video/gif.
   * ------------------------------------------------------------- */

  const mediaPlaceholderStyles = `
    .tag-saver-extension-overlay .media-placeholder {
      width: 100%;
      min-height: 240px;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      gap: 8px;
      padding: 24px;
      background: rgba(var(--bg-section-rgb), 0.4);
      border-radius: var(--radius-md);
      color: var(--text-secondary);
      font-size: 12px;
    }
    .tag-saver-extension-overlay .media-placeholder svg {
      width: 36px;
      height: 36px;
      opacity: 0.7;
    }
    .tag-saver-extension-overlay .media-placeholder .label {
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.6px;
      font-size: 10px;
    }
  `;

  /* ===============================================================
   *  PRESERVED FROM YOUR EXISTING styles.js
   *  These two strings drive UI that wasn't redesigned in this pass.
   *  Open your old styles.js, copy the contents of imageSelectorStyles
   *  and toastStyles into the template literals below. The variable
   *  names below are the same as before so callers keep working.
   * ============================================================= */

  const imageSelectorStyles = `
    .ts-selectable-image {
      position: relative;
      cursor: pointer;
    }
    
    .ts-selectable-image:hover::after {
      content: "";
      position: absolute;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      border: 3px solid #4285f4;
      background-color: rgba(66, 133, 244, 0.2);
      z-index: 9999;
      pointer-events: none;
    }
    
    .ts-selectable-image:hover::before {
      content: "Click to select";
      position: absolute;
      top: 10px;
      left: 10px;
      background-color: rgba(0, 0, 0, 0.7);
      color: white;
      padding: 5px 10px;
      border-radius: 4px;
      font-size: 12px;
      z-index: 10000;
      pointer-events: none;
    }
    
    .ts-selected-image {
      border: 3px solid #0f9d58 !important;
    }
    
    .ts-selected-image::after {
      border-color: #0f9d58 !important;
      background-color: rgba(15, 157, 88, 0.2) !important;
    }
    
    .ts-selected-image::before {
      content: "✓ Selected" !important;
      background-color: rgba(15, 157, 88, 0.8) !important;
    }
    
    .ts-selection-toolbar {
      position: fixed;
      bottom: 70px;
      right: 20px;
      background-color: rgba(33, 33, 33, 0.9);
      color: white;
      border-radius: 8px;
      padding: 10px 15px;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
      z-index: 999999;
      display: flex;
      align-items: center;
      gap: 10px;
      transition: opacity 0.3s ease;
      opacity: 0;
    }
    
    .ts-selection-toolbar.active {
      opacity: 1;
    }
    
    .ts-toolbar-button {
      background-color: #4285f4;
      color: white;
      border: none;
      border-radius: 4px;
      padding: 5px 10px;
      font-size: 12px;
      cursor: pointer;
      transition: background-color 0.2s ease;
    }
    
    .ts-toolbar-button:hover {
      background-color: #5c9aff;
    }
    
    .ts-toolbar-button.cancel {
      background-color: transparent;
      border: 1px solid rgba(255, 255, 255, 0.3);
    }
    
    .ts-toolbar-button.cancel:hover {
      background-color: rgba(255, 255, 255, 0.1);
    }
    
    .ts-thumbnail {
      width: 40px;
      height: 40px;
      border-radius: 4px;
      object-fit: cover;
      border: 1px solid rgba(255, 255, 255, 0.2);
    }
  `;

  const toastStyles = `
    .ts-toast {
      position: fixed;
      bottom: 20px;
      right: 20px;
      background: rgba(40, 167, 69, 0.9);
      color: white;
      padding: 12px 20px;
      border-radius: 8px;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
      z-index: 9999999999;
      font-size: 14px;
      animation: ts-slideIn 0.3s ease-out;
      opacity: 1;
      transition: opacity 0.2s ease-out;
    }
    
    .ts-toast.error {
      background: rgba(220, 53, 69, 0.9);
    }

    .ts-toast.warning {
      background: rgba(255, 152, 0, 0.9); /* Orange for warnings */
      border-left: 4px solid #ff9800;
    }
    
    @keyframes ts-slideIn {
      from { transform: translateX(100%); opacity: 0; }
      to { transform: translateX(0); opacity: 1; }
    }
  `;

  /* ---------------------------------------------------------------
   *  Combined output for content.js's one-shot inject at startup.
   * ------------------------------------------------------------- */

  function getAllStyles() {
    return [
      variableStyles,
      resetStyles,
      overlayStyles,
      duplicateWarningStyles,
      poolStyles,
      autocompleteStyles,
      tagStyles,
      mediaPlaceholderStyles,
      imageSelectorStyles,
      toastStyles
    ].join('\n');
  }

  return {
    injectStyles,
    removeStyles,
    getAllStyles,

    // Individual slices (TagPills inject tagStyles directly when the
    // category dropdown is opened outside the overlay).
    variableStyles,
    resetStyles,
    overlayStyles,
    duplicateWarningStyles,
    poolStyles,
    autocompleteStyles,
    tagStyles,
    mediaPlaceholderStyles,
    imageSelectorStyles,
    toastStyles
  };
})();
