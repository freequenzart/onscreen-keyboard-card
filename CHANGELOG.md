# Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.9.0] - 2026-06-30

### Added

- **Custom layouts** — override the `lowercase`, `uppercase`, and/or `symbols` layouts directly from the card YAML via the `layouts` option.
- **Custom mode labels** — rename the mode indicator with the `labels` option, or let it follow the Home Assistant language (English and German built in).
- **Sticky Shift option** — `sticky_shift: true` keeps Shift active (caps-lock style); by default Shift now auto-releases after one letter (phone-style).
- **Close button (✕)** — dismiss the keyboard without pressing Enter.
- **Theme support** — the keyboard adapts to the active Home Assistant theme via CSS custom properties, with dark-mode fallbacks.
- **Visual editor** — a Sticky Shift toggle is available in the card's GUI editor.
- Localized `aria-label`s and a labelled `role="group"` with a `lang` hint for accessibility.

### Changed

- Only a single keyboard is shown even when multiple cards are placed on a dashboard.
- Layout keys are HTML-escaped for safe rendering.

### Fixed

- Fixed the caret jumping to the start of the input after clicking next to the keyboard — the cursor position is now remembered and restored.

## [0.8.3] - 2026-06-16

### Added

- Initial release with basic on-screen keyboard functionality.
- Automatic open on input focus/click across Shadow DOM boundaries.
- German QWERTZ layout with lowercase, uppercase, numbers, and symbols modes.
- Shift and 123/ABC mode toggles, Backspace, Space, and Enter keys.
- Support for text, search, email, URL, password, number, time, and textarea inputs.

[0.9.0]: https://github.com/freequenzart/onscreen-keyboard-card/releases/tag/v0.9.0
[0.8.3]: https://github.com/freequenzart/onscreen-keyboard-card/releases/tag/v0.8.3
