# Home Assistant OnScreen Keyboard - Lovelace Custom Card

A simple on-screen keyboard custom card for Home Assistant that automatically appears when clicking on text inputs. Works across Shadow DOM boundaries with Home Assistant's nested custom elements.

## Features

- Automatically opens when clicking/focusing on any input field on a dashboard
- Works with text, search, email, URL, password, number, and time input types
- Traverses Shadow DOM boundaries (composedPath) to detect inputs inside HA custom elements (ha-textfield, search-input, etc.)
- Supports German QWERTZ layout with lowercase (a-z), uppercase (A-Z), numbers (0-9)
- German special characters: ö, ä, ü, ß, Ö, Ä, Ü, ẞ, °
- Special characters: @, #, $, %, &, *, -, +, ~, `, =, /, \, |, (, ), [, ]
- Punctuation: , . ? ! : ; " '
- Shift toggle for uppercase
- Symbol/number mode toggle (123/ABC/abc)
- Backspace (works on number inputs via fallback logic)
- Space bar
- Enter key (dispatches Enter event and closes keyboard)
- Uses native value setter to properly trigger framework reactivity (floating labels, validation)
- Syncs value to parent HA custom elements and triggers Material layout updates

## Installation

### 1. Create the card file

Place the `onscreen-keyboard-card.js` file in your `www` folder inside your Home Assistant config directory:

```bash
config/
├── www/
│   └── onscreen-keyboard-card.js
```

To access the `www` folder:

1. In Home Assistant, go to **Settings** → **System** → **Backups**
2. Click **Storage** and navigate to **OS Media** → **config** → **www**
3. Or use the Samba add-on to access `\\YOUR_HA_IP\config\www\`

### 2. Register the resource in Lovelace

Go to **Settings** → **Dashboards** → Click the three dots on your dashboard → **Edit Dashboard** → **Resources** → **Add Resource**

Enter the URL:

```bash
/local/onscreen-keyboard-card.js
```

Set the type to **JavaScript URL**.

### 3. Add the card to your dashboard

In dashboard edit mode, add a **Manual** card (or **Vertical Stack** / **Horizontal Stack**) and configure it as:

```yaml
type: custom:onscreen-keyboard-card
```

Or in YAML mode:

```yaml
views:
  - title: Main
    cards:
      - type: custom:onscreen-keyboard-card
```

### 4. Refresh and test

- Refresh your browser (hard reload / clear cache)
- Click on any text input field on your dashboard
- The keyboard should appear at the bottom of the screen

## Keyboard Layouts

### Lowercase (default)

| Row | Keys |
| --- | ---- |
| 1 | q w e r t z u i o p |
| 2 | a s d f g h j k l ö ä |
| 3 | ⇧ y x c v b n m ü ß ⌫ |
| 4 | 123 [Space] , . ? ! ✓ |

### Uppercase (Shift active)

| Row | Keys |
| --- | ---- |
| 1 | Q W E R T Z U I O P |
| 2 | A S D F G H J K L Ö Ä |
| 3 | ⇧ Y X C V B N M Ü ẞ ⌫ |
| 4 | 123 [Space] , . ? ! ✓ |

### Symbols/Numbers (123 mode)

| Row | Keys |
| --- | ---- |
| 1 | 0 1 2 3 4 5 6 7 8 9 |
| 2 | @ # $ % & * - + ~ ` ° |
| 3 | ABC ß = / \ \| ( ) [ ] ⌫ |
| 4 | abc [Space] : ; " ' ✓ |

## Supported Input Types

| Type | Support |
| ---- | ------- |
| text | Full (selection-aware cursor) |
| search | Full |
| email | Full |
| url | Full |
| password | Full |
| number | Append/remove last char (no selection API) |
| time | Append/remove last char (no selection API) |
| textarea | Full (selection-aware cursor) |

## Special Keys

| Key | Display | Description |
| --- | ------- | ----------- |
| Shift | ⇧ | Toggle uppercase/lowercase |
| 123 | 123 | Switch to numbers & symbols |
| ABC / abc | ABC/abc | Switch back to letters |
| Backspace | ⌫ | Delete character before cursor (or last char for number inputs) |
| Space | [wide key] | Insert space |
| Enter | ✓ | Dispatch Enter event and close keyboard |

## Customization

You can modify the CSS in the `render()` method of `onscreen-keyboard-card.js` to change:

- Colors (background, button colors)
- Button sizes
- Position on screen
- Font styles

## Technical Details

- Built with Vanilla JavaScript and Web Components (Shadow DOM)
- No build tools or dependencies required
- Uses `composedPath()` and capturing event listeners to detect focus across nested Shadow DOMs
- Uses native `HTMLInputElement.prototype.value` setter to bypass framework property interceptors
- Dispatches proper `InputEvent` with `inputType` for framework compatibility
- Syncs value to parent custom elements and calls `.layout()` for Material floating labels
- Gracefully handles number/time inputs that don't support the Selection API

## Development

To modify the keyboard, edit `onscreen-keyboard-card.js` and reload Home Assistant. Clear your browser cache to ensure the updated file is loaded.
