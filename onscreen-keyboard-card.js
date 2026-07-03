// OnScreenKeyboard Lovelace Card
// Custom card for Home Assistant with on-screen keyboard

class OnScreenKeyboardCard extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
    this.visible = false;
    this.activeInput = null;
    this.shiftActive = false;
    this.numSymbols = false;
    this.stickyShift = false;
    this._savedSelection = null;
    
    // Default key layouts for different modes
    this.defaultLayouts = {
      lowercase: [
        ['q', 'w', 'e', 'r', 't', 'z', 'u', 'i', 'o', 'p'],
        ['a', 's', 'd', 'f', 'g', 'h', 'j', 'k', 'l', 'ö', 'ä'],
        ['Shift', 'y', 'x', 'c', 'v', 'b', 'n', 'm', 'ü', 'ß', '⌫'],
        ['123', ' ', ',', '.', '?', '!', 'Enter']
      ],
      uppercase: [
        ['Q', 'W', 'E', 'R', 'T', 'Z', 'U', 'I', 'O', 'P'],
        ['A', 'S', 'D', 'F', 'G', 'H', 'J', 'K', 'L', 'Ö', 'Ä'],
        ['Shift', 'Y', 'X', 'C', 'V', 'B', 'N', 'M', 'Ü', 'ẞ', '⌫'],
        ['123', ' ', ',', '.', '?', '!', 'Enter']
      ],
      symbols: [
        ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9'],
        ['@', '#', '$', '%', '&', '*', '-', '+', '~', '`', '°'],
        ['ABC', 'ß', '=', '/', '\\', '|', '(', ')', '[', ']', '⌫'],
        ['abc', ' ', ':', ';', '"', "'", 'Enter']
      ]
    };

    // Active layouts (may be overridden via card config)
    this.layouts = this.defaultLayouts;
  }

  static getConfigElement() {
    return document.createElement('onscreen-keyboard-card-editor');
  }

  static getStubConfig() {
    return {};
  }

  set hass(hass) {
    this._hass = hass;
  }

  setConfig(config) {
    this._config = config || {};
    this.layouts = this._buildLayouts(this._config.layouts);
    this.stickyShift = this._config.sticky_shift === true;
    this._labels = this._buildLabels(this._config.labels);
    if (this.shadowRoot) {
      this.render();
    }
  }

  _buildLabels(override) {
    // Only keep string overrides for the three known modes.
    const result = {};
    if (override && typeof override === 'object') {
      for (const mode of ['lowercase', 'uppercase', 'symbols']) {
        if (typeof override[mode] === 'string') {
          result[mode] = override[mode];
        }
      }
    }
    return result;
  }

  _getModeLabel() {
    const mode = this.numSymbols ? 'symbols' : this.shiftActive ? 'uppercase' : 'lowercase';
    // 1. Explicit override from the card config wins.
    if (this._labels && typeof this._labels[mode] === 'string') {
      return this._labels[mode];
    }
    // 2. Otherwise pick built-in labels based on the Home Assistant language.
    const table = OnScreenKeyboardCard.MODE_LABELS[this._currentLang()] || OnScreenKeyboardCard.MODE_LABELS.en;
    return table[mode];
  }

  _currentLang() {
    return (this._hass && (this._hass.language
      || (this._hass.locale && this._hass.locale.language))) || 'en';
  }

  _getUiLabel(key) {
    const table = OnScreenKeyboardCard.UI_LABELS[this._currentLang()] || OnScreenKeyboardCard.UI_LABELS.en;
    return table[key] || OnScreenKeyboardCard.UI_LABELS.en[key] || key;
  }

  _buildLayouts(override) {
    // Start from the defaults, then overwrite individual modes from config.
    const result = {
      lowercase: this.defaultLayouts.lowercase,
      uppercase: this.defaultLayouts.uppercase,
      symbols: this.defaultLayouts.symbols
    };

    if (!override || typeof override !== 'object') {
      return result;
    }

    for (const mode of ['lowercase', 'uppercase', 'symbols']) {
      if (override[mode] === undefined) continue;
      const rows = override[mode];
      if (!this._isValidLayout(rows)) {
        console.warn(`onscreen-keyboard-card: ignoring invalid "${mode}" layout in config; expected an array of rows of string keys.`);
        continue;
      }
      // Normalize every key to a string so rendering stays consistent.
      result[mode] = rows.map(row => row.map(key => String(key)));
    }

    return result;
  }

  _isValidLayout(rows) {
    return Array.isArray(rows)
      && rows.length > 0
      && rows.every(row => Array.isArray(row) && row.length > 0
        && row.every(key => typeof key === 'string' || typeof key === 'number'));
  }

  connectedCallback() {
    // Only one keyboard instance listens for inputs and renders at a time,
    // otherwise multiple cards on a dashboard would show duplicate keyboards.
    OnScreenKeyboardCard._instances.add(this);
    if (!OnScreenKeyboardCard._primary) {
      this._becomePrimary();
    }
  }

  disconnectedCallback() {
    OnScreenKeyboardCard._instances.delete(this);
    this._detachInputObserver();
    this.removeKeyboard();
    if (OnScreenKeyboardCard._primary === this) {
      OnScreenKeyboardCard._primary = null;
      // Promote another mounted instance, if any, to keep the keyboard working.
      const next = OnScreenKeyboardCard._instances.values().next().value;
      if (next) {
        next._becomePrimary();
      }
    }
  }

  _becomePrimary() {
    OnScreenKeyboardCard._primary = this;
    this.render();
    this.attachInputObserver();
  }

  _detachInputObserver() {
    if (this._focusInHandler) {
      document.removeEventListener('focusin', this._focusInHandler, true);
      document.removeEventListener('focusout', this._focusOutHandler, true);
      document.removeEventListener('click', this._clickHandler, true);
      this._focusInHandler = null;
      this._focusOutHandler = null;
      this._clickHandler = null;
    }
  }

  attachInputObserver() {
    // Use capturing + composedPath to traverse Shadow DOM boundaries
    this._focusInHandler = (e) => this.handleFocusIn(e);
    this._focusOutHandler = (e) => this.handleFocusOut(e);
    this._clickHandler = (e) => this.handleClick(e);
    document.addEventListener('focusin', this._focusInHandler, true);
    document.addEventListener('focusout', this._focusOutHandler, true);
    document.addEventListener('click', this._clickHandler, true);
  }

  handleClick(e) {
    // Fallback: detect clicks on input fields even if focusin doesn't propagate
    if (this.visible) return;
    const path = e.composedPath();
    for (const el of path) {
      if (el === this || (this.shadowRoot && this.shadowRoot.contains(el))) return;
      if (el instanceof HTMLInputElement && ['text', 'search', 'email', 'url', 'password', 'number', 'time', ''].includes(el.type)) {
        this.activeInput = el;
        this.showKeyboard();
        return;
      }
      if (el instanceof HTMLTextAreaElement) {
        this.activeInput = el;
        this.showKeyboard();
        return;
      }
    }
    // Check shadow roots of HA custom elements
    for (const el of path) {
      if (el && el.shadowRoot) {
        const input = el.shadowRoot.querySelector('input[type="text"], input[type="search"], input[type="time"], input[type="number"], input:not([type]), textarea');
        if (input) {
          this.activeInput = input;
          this.showKeyboard();
          return;
        }
      }
    }
  }

  _findInputInPath(e) {
    // composedPath() gives us the full event path through all shadow DOMs
    const path = e.composedPath();
    for (const el of path) {
      if (el instanceof HTMLInputElement && ['text', 'search', 'email', 'url', 'password', 'number', 'time', ''].includes(el.type)) {
        return el;
      }
      if (el instanceof HTMLTextAreaElement) {
        return el;
      }
    }
    // Also check inside HA custom elements (ha-textfield, search-input, etc.)
    for (const el of path) {
      if (el && el.shadowRoot) {
        const input = el.shadowRoot.querySelector('input[type="text"], input[type="search"], input[type="email"], input[type="url"], input[type="password"], input:not([type]), textarea');
        if (input) return input;
      }
    }
    return null;
  }

  handleFocusIn(e) {
    const input = this._findInputInPath(e);
    if (input) {
      this.activeInput = input;
      this._rememberSelection();
      this.showKeyboard();
    }
  }

  handleFocusOut(e) {
    // Remember the caret position right before the input loses focus, so typing
    // after clicking elsewhere continues at the caret instead of the start.
    const losing = e.composedPath()[0];
    if (this.activeInput && losing === this.activeInput) {
      this._rememberSelection();
    }
    // Don't hide if focus moved to the keyboard itself
    const related = e.relatedTarget;
    if (related && this.shadowRoot?.contains(related)) {
      return;
    }
    // Check composedPath for keyboard element
    const path = e.composedPath();
    if (path.includes(this)) {
      return;
    }
    // Delay to allow keyboard buttons to capture focus
    setTimeout(() => {
      if (this.activeInput) {
        try {
          if (!this.activeInput.matches(':focus')) {
            // this.hideKeyboard();
          }
        } catch (err) {
          // Input may have been removed from DOM
        }
      }
    }, 150);
  }

  showKeyboard() {
    if (this.visible) return;
    this.visible = true;
    this.render();
  }

  hideKeyboard() {
    this.visible = false;
    this.activeInput = null;
    this.shiftActive = false;
    this.numSymbols = false;
    this._savedSelection = null;
    this.render();
  }

  removeKeyboard() {
    this.visible = false;
    this.activeInput = null;
    this.render();
  }

  handleKey(key) {
    if (!this.activeInput) return;

    let typedChar = false;
    switch (key) {
      case 'Shift':
        this.toggleShift();
        break;
      case '123':
      case 'ABC':
      case 'abc':
        this.toggleSymbols();
        break;
      case '⌫':
        this.backspace();
        break;
      case ' ':
        this.typeChar(' ');
        typedChar = true;
        break;
      case 'Enter':
        this.submitInput();
        break;
      default:
        this.typeChar(key);
        typedChar = true;
        break;
    }

    // Auto-release Shift after typing a character (phone-style), unless sticky.
    if (typedChar && this.shiftActive && !this.stickyShift) {
      this.shiftActive = false;
    }
    this.render();
  }

  toggleShift() {
    this.shiftActive = !this.shiftActive;
    this.numSymbols = false;
  }

  toggleSymbols() {
    this.numSymbols = !this.numSymbols;
    this.shiftActive = false;
  }

  get currentLayout() {
    if (this.numSymbols) return this.layouts.symbols;
    return this.shiftActive ? this.layouts.uppercase : this.layouts.lowercase;
  }

  _setNativeValue(input, value) {
    // Use the native setter to bypass framework property interceptors
    const proto = input instanceof HTMLTextAreaElement
      ? HTMLTextAreaElement.prototype
      : HTMLInputElement.prototype;
    const nativeSetter = Object.getOwnPropertyDescriptor(proto, 'value').set;
    nativeSetter.call(input, value);
  }

  _notifyParent(input) {
    // Walk up to find the parent custom element (ha-textfield, etc.) and sync its value
    let el = input;
    while (el) {
      el = el.parentNode || el.host;
      if (el && el.tagName && el.tagName.includes('-')) {
        // Found a custom element parent — sync its value property
        if ('value' in el && el.value !== input.value) {
          el.value = input.value;
        }
        // Trigger layout update for Material components (floating label)
        if (typeof el.layout === 'function') {
          el.layout();
        }
        break;
      }
      // Traverse out of shadow root
      if (el instanceof ShadowRoot) {
        el = el.host;
      }
    }
  }

  _dispatchInputEvents(input, inputType, data) {
    input.dispatchEvent(new InputEvent('input', {
      bubbles: true,
      composed: true,
      inputType: inputType,
      data: data || null
    }));
    input.dispatchEvent(new Event('change', { bubbles: true, composed: true }));
  }

  _rememberSelection() {
    const input = this.activeInput;
    if (!input) return;
    try {
      if (input.selectionStart !== null && input.selectionStart !== undefined) {
        this._savedSelection = { start: input.selectionStart, end: input.selectionEnd };
      }
    } catch (e) { /* number/time inputs don't support the Selection API */ }
  }

  _focusActiveInput() {
    const input = this.activeInput;
    if (!input) return;
    let active = null;
    try { active = input.getRootNode().activeElement; } catch (e) { /* ignore */ }
    if (active === input) return;
    // Input lost focus (e.g. user clicked elsewhere) — restore focus and caret.
    try {
      input.focus({ preventScroll: true });
      if (this._savedSelection && input.selectionStart !== null) {
        input.setSelectionRange(this._savedSelection.start, this._savedSelection.end);
      }
    } catch (e) { /* number/time inputs throw on selection set */ }
  }

  typeChar(char) {
    if (!this.activeInput) return;
    this._focusActiveInput();
    const input = this.activeInput;
    const start = input.selectionStart;
    const end = input.selectionEnd;
    const value = input.value;

    let newValue;
    if (start !== null && end !== null) {
      newValue = value.substring(0, start) + char + value.substring(end);
    } else {
      // Number inputs don't support selectionStart/End — append at end
      newValue = value + char;
    }

    this._setNativeValue(input, newValue);
    try {
      if (start !== null) {
        input.selectionStart = input.selectionEnd = start + char.length;
        this._savedSelection = { start: start + char.length, end: start + char.length };
      }
    } catch (e) { /* number inputs throw on selection set */ }

    input.dispatchEvent(new KeyboardEvent('keydown', { key: char, bubbles: true, composed: true }));
    this._dispatchInputEvents(input, 'insertText', char);
    input.dispatchEvent(new KeyboardEvent('keyup', { key: char, bubbles: true, composed: true }));
    this._notifyParent(input);
  }

  backspace() {
    if (!this.activeInput) return;
    this._focusActiveInput();
    const input = this.activeInput;
    const start = input.selectionStart;
    const end = input.selectionEnd;
    const value = input.value;

    let newValue;
    let newCursor;

    if (start !== null && end !== null) {
      // Normal text input with selection support
      if (start === end) {
        if (start > 0) {
          newValue = value.substring(0, start - 1) + value.substring(end);
          newCursor = start - 1;
        } else {
          return;
        }
      } else {
        newValue = value.substring(0, start) + value.substring(end);
        newCursor = start;
      }
    } else {
      // Number inputs: just remove last character
      if (value.length === 0) return;
      newValue = value.slice(0, -1);
      newCursor = null;
    }

    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Backspace', code: 'Backspace', bubbles: true, composed: true }));
    this._setNativeValue(input, newValue);
    try {
      if (newCursor !== null) {
        input.selectionStart = input.selectionEnd = newCursor;
        this._savedSelection = { start: newCursor, end: newCursor };
      }
    } catch (e) { /* number inputs throw on selection set */ }
    this._dispatchInputEvents(input, 'deleteContentBackward', null);
    input.dispatchEvent(new KeyboardEvent('keyup', { key: 'Backspace', code: 'Backspace', bubbles: true, composed: true }));
    this._notifyParent(input);
  }

  submitInput() {
    if (!this.activeInput) return;
    const input = this.activeInput;
    this._notifyParent(input);
    input.dispatchEvent(new Event('change', { bubbles: true, composed: true }));
    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', code: 'Enter', bubbles: true, composed: true }));
    input.dispatchEvent(new KeyboardEvent('keyup', { key: 'Enter', code: 'Enter', bubbles: true, composed: true }));
    // Don't call input.blur() — it breaks HA's internal focus management
    // and prevents the keyboard from reopening on the next click
    this.hideKeyboard();
  }

  render() {
    if (!this.visible && !this.activeInput) {
      this.shadowRoot.innerHTML = '';
      this.removeAttribute('role');
      this.removeAttribute('aria-label');
      return;
    }

    const layout = this.currentLayout;
    const modeLabel = this._getModeLabel();
    const closeLabel = this._getUiLabel('close');

    let rowsHtml = layout.map((row, rowIndex) => `
      <div class="key-row">
        ${row.map(key => this.renderKey(key, rowIndex)).join('')}
      </div>
    `).join('');

    this.shadowRoot.innerHTML = `
      <style>
        :host {
          --osk-bg: var(--ha-card-background, var(--card-background-color, #2c2c2c));
          --osk-key-bg: var(--secondary-background-color, #444);
          --osk-key-bg-hover: var(--divider-color, #555);
          --osk-key-color: var(--primary-text-color, #fff);
          --osk-accent: var(--primary-color, #0a90ff);
          --osk-accent-color: var(--text-primary-color, #fff);
          --osk-indicator-color: var(--secondary-text-color, #aaa);
          display: block;
          position: fixed;
          bottom: 0;
          left: 0;
          right: 0;
          z-index: 10000;
          background: var(--osk-bg);
          padding: 8px;
          box-shadow: 0 -2px 10px rgba(0,0,0,0.3);
          font-family: var(--paper-font-body1_-_font-family, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif);
          user-select: none;
          -webkit-user-select: none;
        }
        .mode-indicator {
          text-align: center;
          color: var(--osk-indicator-color);
          font-size: 12px;
          text-transform: uppercase;
          letter-spacing: 1px;
        }
        .kb-header {
          display: flex;
          align-items: center;
          justify-content: center;
          position: relative;
          margin-bottom: 8px;
        }
        .kb-close {
          position: absolute;
          right: 0;
          top: 50%;
          transform: translateY(-50%);
          width: 28px;
          height: 28px;
          border: none;
          border-radius: 6px;
          background: var(--osk-key-bg);
          color: var(--osk-key-color);
          font-size: 14px;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
        }
        .kb-close:hover {
          background: var(--osk-key-bg-hover);
        }
        .key-row {
          display: flex;
          justify-content: center;
          gap: 4px;
          margin-bottom: 4px;
        }
        .key {
          min-width: 32px;
          height: 42px;
          border: none;
          border-radius: 6px;
          background: var(--osk-key-bg);
          color: var(--osk-key-color);
          font-size: 16px;
          font-weight: 500;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: background 0.1s;
          flex: 1;
          max-width: 45px;
        }
        .key:hover {
          background: var(--osk-key-bg-hover);
        }
        .key:active {
          transform: scale(0.95);
          filter: brightness(1.15);
        }
        .key.active {
          background: var(--osk-accent);
          color: var(--osk-accent-color);
        }
        .key.active:hover {
          background: var(--osk-accent);
          filter: brightness(1.08);
        }
        .key.special {
          background: var(--osk-key-bg-hover);
          font-size: 14px;
          max-width: 60px;
          flex: 1.5;
        }
        .key.special.active {
          background: var(--osk-accent);
          color: var(--osk-accent-color);
        }
        .key.space {
          flex: 6;
          max-width: 200px;
        }
        .key.enter {
          background: var(--osk-accent);
          color: var(--osk-accent-color);
          max-width: 80px;
          flex: 2;
        }
        .key.enter:hover {
          background: var(--osk-accent);
          filter: brightness(1.08);
        }
      </style>
      <div class="kb-header">
        <span class="mode-indicator">${this._escapeHtml(modeLabel)}</span>
        <button type="button" class="kb-close" aria-label="${this._escapeHtml(closeLabel)}" title="${this._escapeHtml(closeLabel)}">✕</button>
      </div>
      ${rowsHtml}
    `;

    // Attach event listeners
    this.shadowRoot.querySelectorAll('.key').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        this.handleKey(btn.dataset.key);
      });
      // Prevent focus loss from input
      btn.addEventListener('mousedown', (e) => {
        e.preventDefault();
        e.stopPropagation();
      });
    });

    const closeBtn = this.shadowRoot.querySelector('.kb-close');
    if (closeBtn) {
      closeBtn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        this.hideKeyboard();
      });
      closeBtn.addEventListener('mousedown', (e) => {
        e.preventDefault();
        e.stopPropagation();
      });
    }

    // Accessibility: expose the keyboard as a labelled group with a language hint.
    this.setAttribute('role', 'group');
    this.setAttribute('aria-label', this._getUiLabel('keyboard'));
    this.setAttribute('lang', this._currentLang());
  }

  renderKey(key, rowIndex) {
    let className = 'key';
    let display = key;
    let ariaLabel = key;

    if (key === 'Shift') {
      className += this.shiftActive ? ' special active' : ' special';
      display = '⇧';
      ariaLabel = this._getUiLabel('shift');
    } else if (key === '123' || key === 'ABC' || key === 'abc') {
      className += this.numSymbols ? ' special active' : ' special';
      display = key;
      ariaLabel = key === '123' ? this._getUiLabel('symbols') : this._getUiLabel('letters');
    } else if (key === '⌫') {
      className += ' special';
      display = '⌫';
      ariaLabel = this._getUiLabel('backspace');
    } else if (key === ' ') {
      className += ' space';
      display = '';
      ariaLabel = this._getUiLabel('space');
    } else if (key === 'Enter') {
      className += ' enter';
      display = '✓';
      ariaLabel = this._getUiLabel('enter');
    }

    return `<button type="button" class="${className}" data-key="${this._escapeHtml(key)}" aria-label="${this._escapeHtml(ariaLabel)}">${this._escapeHtml(display)}</button>`;
  }

  _escapeHtml(str) {
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }
}

// Built-in mode-indicator labels per language (fallback is English).
OnScreenKeyboardCard.MODE_LABELS = {
  en: { lowercase: 'Lowercase', uppercase: 'Uppercase', symbols: 'Symbols' },
  de: { lowercase: 'Kleinbuchstaben', uppercase: 'Großbuchstaben', symbols: 'Symbole' }
};

// Accessibility labels for special keys and the keyboard itself (fallback is English).
OnScreenKeyboardCard.UI_LABELS = {
  en: {
    keyboard: 'On-screen keyboard', close: 'Close keyboard', shift: 'Shift',
    backspace: 'Backspace', space: 'Space', enter: 'Enter',
    symbols: 'Numbers and symbols', letters: 'Letters'
  },
  de: {
    keyboard: 'Bildschirmtastatur', close: 'Tastatur schließen', shift: 'Umschalt',
    backspace: 'Rücktaste', space: 'Leertaste', enter: 'Eingabe',
    symbols: 'Zahlen und Symbole', letters: 'Buchstaben'
  }
};

// Track mounted instances so only one keyboard is active at a time.
OnScreenKeyboardCard._instances = new Set();
OnScreenKeyboardCard._primary = null;

class OnscreenKeyboardCardEditor extends HTMLElement {
  set hass(hass) {
    this._hass = hass;
  }

  setConfig(config) {
    this._config = { ...config };
    this._render();
  }

  _render() {
    if (!this._rendered) {
      this.innerHTML = `
        <div style="padding: 16px; display: flex; flex-direction: column; gap: 12px;">
          <label style="display: flex; align-items: center; gap: 8px; cursor: pointer;">
            <input type="checkbox" id="sticky_shift">
            <span>Sticky Shift (keep Shift active after typing a letter)</span>
          </label>
          <p style="margin: 0; color: var(--secondary-text-color);">
            Advanced options (<code>layouts</code>, <code>labels</code>) can be configured in YAML. See the documentation.
          </p>
        </div>`;
      this._rendered = true;
      this._checkbox = this.querySelector('#sticky_shift');
      this._checkbox.addEventListener('change', () => {
        this._config = { ...this._config, sticky_shift: this._checkbox.checked };
        this.dispatchEvent(new CustomEvent('config-changed', {
          detail: { config: this._config },
          bubbles: true,
          composed: true
        }));
      });
    }
    if (this._checkbox) {
      this._checkbox.checked = this._config.sticky_shift === true;
    }
  }

  get _configValue() {
    return this._config || {};
  }
}

// Register the custom element
customElements.define('onscreen-keyboard-card', OnScreenKeyboardCard);
customElements.define('onscreen-keyboard-card-editor', OnscreenKeyboardCardEditor);

window.customCards = window.customCards || [];
window.customCards.push({
  type: 'onscreen-keyboard-card',
  name: 'On-Screen Keyboard',
  description: 'A virtual on-screen keyboard that dispatches real keyboard events to text inputs.',
  preview: false
});
