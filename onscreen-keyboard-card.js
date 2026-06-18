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
    
    // Key layouts for different modes
    this.layouts = {
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
  }

  set hass(hass) {
    this._hass = hass;
  }

  setConfig(config) {
    this._config = config;
  }

  connectedCallback() {
    this.render();
    this.attachInputObserver();
  }

  disconnectedCallback() {
    if (this._focusInHandler) {
      document.removeEventListener('focusin', this._focusInHandler, true);
      document.removeEventListener('focusout', this._focusOutHandler, true);
      document.removeEventListener('click', this._clickHandler, true);
    }
    this.removeKeyboard();
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
      this.showKeyboard();
    }
  }

  handleFocusOut(e) {
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
    this.render();
  }

  removeKeyboard() {
    this.visible = false;
    this.activeInput = null;
    this.render();
  }

  handleKey(key) {
    if (!this.activeInput) return;

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
        break;
      case 'Enter':
        this.submitInput();
        break;
      default:
        this.typeChar(key);
        break;
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

  typeChar(char) {
    if (!this.activeInput) return;
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
      }
    } catch (e) { /* number inputs throw on selection set */ }

    input.dispatchEvent(new KeyboardEvent('keydown', { key: char, bubbles: true, composed: true }));
    this._dispatchInputEvents(input, 'insertText', char);
    input.dispatchEvent(new KeyboardEvent('keyup', { key: char, bubbles: true, composed: true }));
    this._notifyParent(input);
  }

  backspace() {
    if (!this.activeInput) return;
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
      return;
    }

    const layout = this.currentLayout;
    const modeLabel = this.numSymbols ? 'Symbole' : this.shiftActive ? 'Großbuchstaben' : 'Kleinbuchstaben';

    let rowsHtml = layout.map((row, rowIndex) => `
      <div class="key-row">
        ${row.map(key => this.renderKey(key, rowIndex)).join('')}
      </div>
    `).join('');

    this.shadowRoot.innerHTML = `
      <style>
        :host {
          display: block;
          position: fixed;
          bottom: 0;
          left: 0;
          right: 0;
          z-index: 10000;
          background: #2c2c2c;
          padding: 8px;
          box-shadow: 0 -2px 10px rgba(0,0,0,0.3);
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
          user-select: none;
          -webkit-user-select: none;
        }
        .mode-indicator {
          text-align: center;
          color: #aaa;
          font-size: 12px;
          margin-bottom: 8px;
          text-transform: uppercase;
          letter-spacing: 1px;
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
          background: #444;
          color: #fff;
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
          background: #555;
        }
        .key:active {
          background: #666;
          transform: scale(0.95);
        }
        .key.active {
          background: #0a90ff;
        }
        .key.active:hover {
          background: #0b9dff;
        }
        .key.special {
          background: #555;
          font-size: 14px;
          max-width: 60px;
          flex: 1.5;
        }
        .key.special.active {
          background: #0a90ff;
        }
        .key.space {
          flex: 6;
          max-width: 200px;
        }
        .key.enter {
          background: #0a90ff;
          max-width: 80px;
          flex: 2;
        }
        .key.enter:hover {
          background: #0b9dff;
        }
      </style>
      <div class="mode-indicator">${modeLabel}</div>
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
  }

  renderKey(key, rowIndex) {
    let className = 'key';
    let display = key;

    if (key === 'Shift') {
      className += this.shiftActive ? ' special active' : ' special';
      display = '⇧';
    } else if (key === '123' || key === 'ABC' || key === 'abc') {
      className += this.numSymbols ? ' special active' : ' special';
      display = key;
    } else if (key === '⌫') {
      className += ' special';
      display = '⌫';
    } else if (key === ' ') {
      className += ' space';
      display = '';
    } else if (key === 'Enter') {
      className += ' enter';
      display = '✓';
    }

    return `<button class="${className}" data-key="${key}">${display}</button>`;
  }
}

class OnscreenKeyboardCardEditor extends HTMLElement {
  setConfig(config) {
    this._config = config;
    this.innerHTML = `<p style="padding: 16px;">No configuration needed. Just add this card to your dashboard.</p>`;
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
