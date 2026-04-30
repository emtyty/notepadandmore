# NovaPad

A lightweight, fast, and modern text editor for Windows and macOS. Built on Electron + React + Monaco Editor.

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

## Features

- **Monaco-powered editor** — same engine as VS Code, with syntax highlighting for ~70 languages, IntelliSense, bracket-pair colorization, and folding.
- **Auto language detection** — extension-based on load, then refined by [Magika](https://github.com/google/magika) on load, on save, and on paste, so highlighting tracks the actual content (paste minified JSON into a `.txt` and it becomes JSON automatically).
- **JSON beautify** — `Ctrl+Alt+Shift+M` (`Cmd+Alt+Shift+M` on macOS) reformats minified JSON. Works on selection if any, otherwise the whole document.
- **Tab UX**
  - Double-click the tab bar to open a new untitled document.
  - Drag-to-reorder, middle-click to close, right-click for context actions.
- **File-aware Save dialog** — when you save an untitled buffer, the dialog pre-selects the right file type and appends the suggested extension based on the detected language.
- **CSV TableLens viewer** — large CSVs render as a virtualized table for fast browsing.
- **Plugin system** — VS Code-style extension manager; plugins load from `~/.config/notepad-and-more/plugins/`.
- **Native OS integration**
  - Registered for `Open With` on Windows and macOS for ~50 text/source extensions.
  - Open files from Explorer / Finder; subsequent opens forward to the running instance.
  - Recent Files menu entries on Windows and macOS Dock.
- **Session restore** — buffers, cursor positions, and workspace folder are restored on launch.
- **Auto-update** via electron-updater (GitHub Releases).
- **Find / Replace / Find in Files** with regex support.

## Install

Download the latest installer from the [Releases page](https://github.com/haht-dev/novapad-releases/releases) and run it. Per-user install — no admin/UAC needed on Windows.

## Build from source

Requires Node.js 20+ and npm.

```bash
git clone https://github.com/emtyty/notepadandmore
cd notepadandmore
npm install

npm run dev          # start with hot reload
npm run build        # compile (electron-vite)
npm run package:win  # produce dist/NovaPad Setup <version>.exe
npm run package:mac  # produce dist/NovaPad-<version>-mac.dmg + .zip
```

## Tests

End-to-end tests run against the built app via Playwright + Electron driver.

```bash
npm run test:e2e          # build + run the full suite
npm run test:e2e:headed   # with a visible window
npm run test:e2e:report   # open the HTML report from the last run
```

> **Note:** if your shell has `ELECTRON_RUN_AS_NODE=1` exported (some Electron tooling sets this), the test fixture forcibly clears it before launching — otherwise `electron.exe` boots as plain Node and every test fails with "Process failed to launch!".

## Keyboard shortcuts (highlights)

| Shortcut | Action |
| --- | --- |
| `Ctrl/Cmd + N` | New file |
| `Ctrl/Cmd + O` | Open file |
| `Ctrl/Cmd + S` | Save (Save As when untitled) |
| `Ctrl/Cmd + Shift + S` | Save As |
| `Ctrl/Cmd + W` | Close tab |
| `Ctrl/Cmd + F` / `Ctrl/Cmd + H` | Find / Replace |
| `Ctrl/Cmd + Shift + F` | Find in Files |
| `Ctrl/Cmd + Alt + Shift + M` | Beautify JSON |
| `Ctrl/Cmd + /` | Toggle line comment |
| `Ctrl/Cmd + D` | Duplicate line |
| `Alt + Up/Down` | Move line up/down |
| `Ctrl/Cmd + B` | Toggle sidebar |
| `Ctrl/Cmd + Tab` / `Ctrl/Cmd + Shift + Tab` | Next / Previous tab |
| `Alt + Left/Right` | Navigation history back/forward |

The full list is in **Help → Keyboard Shortcuts**.

## Architecture

Three Electron processes:

- **Main** (`src/main/`) — Node.js backend. Native menu, file I/O with encoding detection (`chardet` + `iconv-lite`), session manager, plugin loader, file watcher, auto-updater.
- **Preload** (`src/preload/index.ts`) — Security bridge. Exposes a whitelist IPC API on `window.api`. Context isolation enabled, node integration disabled.
- **Renderer** (`src/renderer/src/`) — React frontend. Monaco editor wrapper, Zustand stores (`editorStore`, `uiStore`, `configStore`), tab bar, status bar, sidebar.

State boundaries:
- `editorStore` — buffers and active id; each buffer holds path/content/encoding/EOL/language/Monaco model/view state/dirty flag.
- `uiStore` — theme, layout toggles, dialog visibility, toast queue.
- `configStore` — persisted preferences in `~/.config/notepad-and-more/config/config.json`.

## Contributing

Pull requests welcome. Please run `npm run build` and the relevant test suite before submitting.

## License

[MIT](LICENSE) © NovaPad contributors
