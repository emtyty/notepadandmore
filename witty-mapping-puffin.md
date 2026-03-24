# NotepadAndMore — Cross-Platform Notepad++ Clone (Electron)

## Stack Comparison

### Cross-Platform Framework Options

| | **Electron** ✅ | **Tauri (Rust)** | **Qt (C++)** | **Flutter Desktop** |
|---|---|---|---|---|
| **Language** | JS/TS + Node.js | Rust + JS/TS | C++ | Dart |
| **Performance** | ⭐⭐⭐ (Chromium overhead) | ⭐⭐⭐⭐ (Rust + native webview) | ⭐⭐⭐⭐⭐ (native) | ⭐⭐⭐⭐ |
| **Memory footprint** | ~200MB RAM | ~50MB RAM | ~30MB RAM | ~80MB RAM |
| **Bundle size** | ~150MB | ~30MB | ~50MB | ~70MB |
| **Plugin system** | ⭐⭐⭐⭐⭐ (npm ecosystem, plain JS) | ⭐⭐⭐ (JS front + Rust back, more complex) | ⭐⭐⭐ (C++ DLLs, high barrier) | ⭐⭐ (Dart packages, limited) |
| **Monaco Editor** | ✅ First-class support | ✅ Works in webview | ❌ Not available | ❌ Not available |
| **Dev speed** | ⭐⭐⭐⭐⭐ (web ecosystem) | ⭐⭐⭐⭐ (Rust learning curve) | ⭐⭐⭐ (verbose C++) | ⭐⭐⭐⭐ |
| **Cross-platform maturity** | ⭐⭐⭐⭐⭐ (VS Code, Slack, etc.) | ⭐⭐⭐⭐ (growing fast) | ⭐⭐⭐⭐⭐ (decades proven) | ⭐⭐⭐ (desktop still maturing) |
| **License risk** | ✅ MIT/BSD | ✅ MIT/Apache | ⚠️ LGPL (commercial = paid) | ✅ BSD |
| **Startup speed** | ⭐⭐⭐ (~1-2s) | ⭐⭐⭐⭐⭐ (<0.5s) | ⭐⭐⭐⭐⭐ (<0.5s) | ⭐⭐⭐⭐ |

**Why Electron wins here:**
- Monaco Editor (VS Code) is the only production-grade, cross-platform code editor component with 100+ language grammars, built-in multi-caret, folding, and find/replace — it works natively in Electron only
- Plugin system simplest for users (plain JS, no compilation needed)
- Largest ecosystem of reference examples (VS Code extension API is close analog)
- Team doesn't need Rust or C++ expertise
- Proven at scale: VS Code, Atom, Cursor all demonstrate Electron can handle code editor workloads

**Tradeoffs accepted:**
- Higher RAM (~200MB vs ~50MB for Tauri) — acceptable for a developer tool (VS Code users accept this)
- Larger installer (~150MB) — one-time download, not a dealbreaker
- Slower startup vs native — can mitigate with lazy loading

### Editor Engine Options (within Electron)

| | **Monaco** ✅ | **CodeMirror 6** |
|---|---|---|
| Built-in multi-caret | ✅ | ✅ (via extensions) |
| Built-in find/replace | ✅ full dialog | ✅ basic, needs extension |
| Code folding | ✅ | ✅ (via extension) |
| Language support | ✅ 50+ built-in + TextMate grammars | ✅ 20+ official + Lezer parsers |
| Minimap / document map | ✅ built-in | ❌ must build |
| Symbol provider (Function List) | ✅ built-in API | ❌ must build |
| Diff editor | ✅ built-in | ❌ must build |
| Bundle size | ~3MB gzipped | ~0.5MB gzipped |
| Customization | ⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ (more granular) |
| Performance (very large files) | ⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ |

**Monaco chosen** because it ships the most features we need out-of-the-box, reducing implementation work for Phase 4-5 features.

---

## Context

Build a cross-platform (Windows + macOS) text editor with full Notepad++ feature parity and a plugin registration system. The Notepad++ source at `notepad-plus-plus/` is used **only as a behavioral reference** (features, config XML schemas, UDL format) — no code is reused due to GPL licensing. The implementation is a clean new codebase.

**Tech stack: Electron + React + TypeScript + Monaco Editor**

---

## Tech Stack

| Component | Choice | Rationale |
|-----------|--------|-----------|
| App Shell | Electron 32+ | Cross-platform, native menus/dialogs, Node.js backend |
| UI Framework | React 18 + TypeScript | Rapid development, huge ecosystem |
| Editor Engine | Monaco Editor | VS Code's editor; built-in multi-caret, folding, find/replace, 50+ language grammars |
| Syntax Grammars | TextMate grammars (via `vscode-textmate`) | Same grammar format VS Code uses; 100+ languages |
| Styling | CSS Modules + CSS Variables | Theme switching (light/dark/custom) |
| State Management | Zustand | Lightweight, no boilerplate |
| Build Tool | Vite + `electron-vite` | Fast HMR in dev, optimized production build |
| Packaging | `electron-builder` | NSIS installer (Win), DMG (macOS), auto-update |
| Plugin System | Node.js `require()` (JS/TS plugins) | Cross-platform, no native ABI issues |
| Config | XML via `fast-xml-parser` | Compatible with Notepad++ config format (reference only) |
| File Watching | `chokidar` | Cross-platform file system events |
| Encoding | `iconv-lite` + `chardet` | Encode/decode any charset; auto-detect |
| Regex | Built-in + `re2` (optional) | Monaco has regex search built-in |

**Notepad++ source used as reference for:**
- Feature list and behavior (`Notepad_plus.h`, `NppCommands.cpp`)
- Config file schemas (`langs.model.xml`, `stylers.model.xml`)
- UDL XML format (`UserDefineDialog` behavior)
- Plugin API contract (`PluginInterface.h` — for designing our equivalent)

---

## Project Structure

```
NotepadAndMore/
├── electron-vite.config.ts
├── package.json
├── tsconfig.json
├── src/
│   ├── main/                    # Electron main process (Node.js)
│   │   ├── index.ts             # App entry, BrowserWindow creation
│   │   ├── menu.ts              # Native menu bar builder
│   │   ├── ipc/                 # IPC handlers (file, config, plugins)
│   │   │   ├── fileHandlers.ts
│   │   │   ├── configHandlers.ts
│   │   │   └── pluginHandlers.ts
│   │   ├── fileSystem/          # File I/O, watcher, encoding
│   │   ├── config/              # Config XML read/write
│   │   ├── plugins/             # Plugin loader & host
│   │   └── sessions/            # Session persistence
│   ├── preload/
│   │   └── index.ts             # Context bridge (safe IPC API to renderer)
│   └── renderer/                # React frontend
│       ├── index.html
│       ├── App.tsx
│       ├── components/
│       │   ├── EditorPane/      # Monaco wrapper
│       │   ├── TabBar/          # Tab management UI
│       │   ├── Sidebar/         # Left sidebar container
│       │   ├── FileBrowser/     # File explorer panel
│       │   ├── DocumentMap/     # Mini-map panel
│       │   ├── FunctionList/    # Symbol/function list
│       │   ├── ProjectPanel/    # Workspace/project panel
│       │   ├── StatusBar/       # Bottom status bar
│       │   ├── ToolBar/         # Toolbar
│       │   ├── Panels/          # Bottom docked panels
│       │   │   ├── FindResults/
│       │   │   └── Console/
│       │   └── Dialogs/
│       │       ├── FindReplace/
│       │       ├── Preferences/
│       │       ├── UDLEditor/
│       │       ├── ShortcutMapper/
│       │       └── PluginManager/
│       ├── store/               # Zustand stores
│       │   ├── editorStore.ts   # Open buffers, active tab
│       │   ├── configStore.ts   # App settings
│       │   ├── uiStore.ts       # Panel visibility, layout
│       │   └── pluginStore.ts   # Loaded plugins
│       ├── hooks/               # Custom React hooks
│       ├── plugins/             # Plugin host runtime (renderer side)
│       │   ├── PluginHost.ts
│       │   └── PluginAPI.ts     # API object passed to plugins
│       └── utils/               # Encoding, language detect, UDL parser
├── plugins/                     # User-installed plugins (runtime dir)
├── config/                      # Bundled default config templates
│   ├── langs.xml
│   ├── stylers.xml
│   └── userDefineLangs/
└── resources/                   # App icons
```

---

## Plugin API Design

Plugins are **Node.js CommonJS/ESM modules** placed in `~/.config/NotepadAndMore/plugins/<PluginName>/index.js`.

```ts
// PluginAPI.ts — object passed to every plugin on load
interface NmpAPI {
  // Editor access
  editor: {
    getText(): string
    setText(text: string): void
    getSelectedText(): string
    insertText(text: string): void
    getCursorPosition(): { line: number; column: number }
    setCursorPosition(line: number, column: number): void
    openFile(path: string): Promise<void>
    getCurrentFilePath(): string | null
    saveCurrentFile(): Promise<void>
    runCommand(commandId: string): void        // Monaco command IDs
  }
  // UI extensions
  ui: {
    addMenuItem(item: MenuItem): void          // Adds to Plugins menu
    addToolbarButton(btn: ToolbarButton): void
    addPanel(panel: PanelDefinition): void     // Dockable panel
    showMessage(msg: string, level?: 'info'|'warn'|'error'): void
    showInputBox(prompt: string): Promise<string | null>
  }
  // Events
  events: {
    on(event: NmpEvent, handler: (...args: any[]) => void): void
    off(event: NmpEvent, handler: (...args: any[]) => void): void
  }
  // File system (proxied via IPC)
  fs: {
    readFile(path: string, encoding?: string): Promise<string>
    writeFile(path: string, content: string): Promise<void>
    exists(path: string): Promise<boolean>
  }
  // Config access
  config: {
    get<T>(key: string): T
    set(key: string, value: unknown): void
  }
}

// Events plugins can subscribe to
type NmpEvent =
  | 'file:opened'
  | 'file:saved'
  | 'file:closed'
  | 'editor:textChanged'
  | 'editor:selectionChanged'
  | 'tab:switched'
  | 'app:ready'
  | 'app:beforeClose'

// Plugin module must export:
interface PluginModule {
  name: string
  version: string
  activate(api: NmpAPI): void | Promise<void>
  deactivate?(): void | Promise<void>
}
```

---

## Config System (Notepad++ Compatible Format)

All config files stored in `~/.config/NotepadAndMore/` (macOS/Linux) or `%APPDATA%\NotepadAndMore\` (Windows).

| File | Purpose |
|------|---------|
| `config.xml` | Window geometry, toolbar/tab prefs, editor defaults |
| `stylers.xml` | Syntax highlight themes (colors, fonts per language/token) |
| `langs.xml` | Language → file extension mapping + comment syntax |
| `shortcuts.xml` | Keyboard shortcut overrides + recorded macros |
| `session.xml` | Last session open files + cursor positions |
| `userDefineLangs/*.xml` | UDL definitions (one file per custom language) |

Schema mirrors Notepad++ format so community UDL files can be imported.

---

## Implementation Phases

### Phase 1 — Project Bootstrap
**Goal:** Working Electron + React + Monaco window on Windows and macOS.

- [ ] Init with `electron-vite`: `npm create electron-vite@latest`
- [ ] Add Monaco Editor (`@monaco-editor/react`)
- [ ] Configure `electron-builder` for Win (NSIS) + macOS (DMG)
- [ ] Main window: full-screen layout shell (toolbar, editor area, status bar placeholders)
- [ ] Single Monaco instance displayed, can type
- [ ] File > Open / Save / Exit via Electron dialog + IPC
- [ ] Basic native menu bar

**Key packages:** `electron`, `electron-vite`, `electron-builder`, `@monaco-editor/react`, `react`, `zustand`

---

### Phase 2 — Tab System & Buffer Management
**Goal:** Multiple files open in tabs; full document lifecycle.

- [ ] `editorStore`: array of `Buffer` objects `{ id, filePath, content, isDirty, encoding, eol, language, viewState }`
- [ ] `TabBar` component: tabs with close button, unsaved dot indicator, drag-reorder (`dnd-kit`), right-click context menu (Close, Close Others, Close All, Reload, Copy Path)
- [ ] Split view: two independent `EditorPane` instances with splitter (`react-resizable-panels`)
- [ ] Monaco model management: one `ITextModel` per buffer, swap models on tab switch (preserve cursor/scroll via `viewState`)
- [ ] IPC: `file:open`, `file:save`, `file:saveAs`, `file:close`, `file:reload`
- [ ] Session save/restore: write/read `session.xml` on close/open
- [ ] Ctrl+Tab quick switcher overlay

---

### Phase 3 — Syntax Highlighting & Language System
**Goal:** Correct highlighting for 50+ languages; language auto-detection.

- [ ] Monaco built-in language support covers most languages (JS, TS, Python, C++, HTML, CSS, JSON, XML, SQL, etc.)
- [ ] Extended TextMate grammars via `vscode-textmate` + `vscode-oniguruma` for additional languages
- [ ] `langs.xml` parser: extension → Monaco `languageId` mapping
- [ ] Language menu in menu bar: list all languages, manual override sets Monaco model language
- [ ] Auto-detect language by file extension on open; fallback to content sniffing
- [ ] Theme system: map `stylers.xml` token colors → Monaco `ITokenThemeRule[]`; built-in Light + Dark + ability to import Notepad++ themes
- [ ] Status bar: show current language, click to change

---

### Phase 4 — Editor Features
**Goal:** Full Notepad++ editing feature set.

Monaco provides natively (configure/expose):
- Multi-caret (Ctrl+Click, Alt+Click column select, `Ctrl+D` for next match)
- Code folding (all languages with Monaco folding providers)
- Bracket matching
- Auto-indentation, indentation guides
- Word wrap toggle (`editor.wordWrap`)
- Minimap (reuse for Document Map)
- Find widget (Ctrl+H inline)

Implement additionally:
- [ ] **Find & Replace Dialog** (`Dialogs/FindReplace`): extended Notepad++-style dialog with regex, match case, whole word, wrap, find in files, mark all, search history
- [ ] **Find in Files**: Node.js recursive file search via main process IPC; results in Find Results panel
- [ ] **Macro record/playback**: intercept Monaco `onDidType` + command executions; serialize to `shortcuts.xml`; replay via Monaco API
- [ ] **Bookmarks**: Monaco `deltaDecorations` for bookmark gutter icons; navigate prev/next
- [ ] **Line operations**: duplicate line (`Shift+Ctrl+D`), move up/down, delete line, sort lines — implemented as Monaco `editor.action.*` commands or custom
- [ ] **Comment/Uncomment**: use Monaco `editor.action.commentLine`; line comment char from `langs.xml`
- [ ] **Case conversion**: UPPER / lower / Title — custom commands via `editor.executeEdits()`
- [ ] **Whitespace/EOL visibility**: Monaco `renderWhitespace`, `renderControlCharacters`
- [ ] **EOL conversion**: CRLF ↔ LF per file; shown + editable in status bar
- [ ] **Encoding**: detect via `chardet` on file open; re-encode via `iconv-lite` on save; shown + editable in status bar
- [ ] **Column/block select**: Monaco `columnSelection` mode toggle (Alt+Shift+drag)

---

### Phase 5 — Panels & File Management
**Goal:** Dockable sidebar panels; file browser; project workspaces.

- [ ] **Docking layout**: left sidebar (collapsible), bottom panel area (collapsible), right sidebar (optional) using `react-resizable-panels`; panel visibility persisted in `config.xml`
- [ ] **File Browser panel**: `react-arborist` tree view; root = workspace folder or current file dir; context menu (open, rename, new file/folder, delete, reveal in OS explorer)
- [ ] **Document Map panel**: second read-only Monaco instance at 20% font size; synced scroll position; click-to-navigate
- [ ] **Function List panel**: use Monaco `DocumentSymbolProvider` API; tree of functions/classes; click to navigate; auto-refresh on change
- [ ] **Project Panel**: 3 independent workspace slots; custom JSON/XML project files; persisted folder lists
- [ ] **Find Results panel**: docked bottom; table with file, line, column, match text; click to open file at line
- [ ] External file change detection via `chokidar`; toast notification → reload or keep option
- [ ] Recent files list (File menu, configurable max N)

---

### Phase 6 — Plugin System
**Goal:** Load, run, and manage plugins; Plugin Manager UI.

- [ ] **Plugin discovery**: on app start, scan `~/.config/NotepadAndMore/plugins/` for subdirs containing `package.json` + `index.js`
- [ ] **Plugin loader** (main process): `require()` each plugin module; validate exports (`name`, `version`, `activate`); call `activate(api)` with sandboxed `NmpAPI` object
- [ ] **NmpAPI implementation**: editor commands proxied via IPC to Monaco; UI actions post messages to renderer store; fs ops via Node.js; config via config store
- [ ] **Plugin menu**: dynamically built from `addMenuItem()` calls; sub-menu per plugin
- [ ] **Plugin Manager UI** (`Dialogs/PluginManager`): list installed plugins (name, version, enabled toggle, uninstall); optional: fetch plugin registry JSON from a hosted index
- [ ] **Plugin isolation**: run in separate context via `vm.runInNewContext()` or Electron utility process for security (optional, can start simple with plain `require`)
- [ ] **Plugin SDK**: publish `nmp-plugin-sdk` npm package with `NmpAPI` types + example plugin template
- [ ] Plugin config dir: `~/.config/NotepadAndMore/plugins/config/<PluginName>/`

---

### Phase 7 — Preferences, Shortcuts & UDL
**Goal:** Full settings UI; keyboard shortcut mapper; User Defined Language editor.

- [ ] **Preferences Dialog** (tabbed): General, Editor, Appearance, Syntax Highlighting, New Document defaults, Backup/AutoSave, Auto-Completion, Shortcuts, Plugins — all read/write `config.xml` via Zustand `configStore`
- [ ] **Shortcut Mapper**: table of all built-in commands + plugin commands; editable shortcuts; write to `shortcuts.xml`; register via Electron `globalShortcut` or Monaco keybinding overrides
- [ ] **Style Configurator**: list all languages + token types; color pickers for fg/bg; font bold/italic; preview pane — writes to `stylers.xml`
- [ ] **UDL Editor Dialog**: define custom language: name, extension, keywords (8 groups), operators, delimiters, comment symbols, folding rules, style per token — write to `userDefineLangs/<name>.xml`; register as Monaco `IMonarchLanguage` dynamically
- [ ] **Theme import**: parse Notepad++ `stylers.xml` → Monaco theme rules (for migrating user themes)
- [ ] AutoSave: configurable interval; backup dir option

---

### Phase 8 — Polish & Packaging
**Goal:** Native feel, installers, auto-update.

- [ ] macOS: native menu, `NSRecentDocuments` via `app.addRecentDocument()`, dock icon badge for unsaved
- [ ] Windows: file type associations via registry at install time (NSIS script); taskbar jump list recent files
- [ ] High-DPI: Electron handles automatically; test on 4K Windows + Retina macOS
- [ ] `electron-updater`: auto-update from GitHub Releases (or custom server)
- [ ] `electron-builder` configs: Win (NSIS exe + portable), macOS (DMG + pkg)
- [ ] Toolbar: icon buttons for New, Open, Save, Save All, Close, Print, Cut, Copy, Paste, Undo, Redo, Find, Replace, Zoom in/out, Wrap toggle
- [ ] About dialog, Welcome screen on first launch
- [ ] Localization: i18n via `react-i18next`; language XML files mirroring Notepad++ `nativeLang.xml` format

---

## Verification Plan

1. **Phase 1**: `npm run dev` launches app on Windows and macOS; type in Monaco; File > Open loads a file
2. **Phase 2**: Open 5 files in tabs; close one; reopen; dirty dot appears on edit; session restores after restart
3. **Phase 3**: Open `.py`, `.cpp`, `.html`, `.json` — correct syntax colors; Language menu override applies
4. **Phase 4**: Regex find/replace works; Ctrl+Click multi-caret types simultaneously; record macro, replay it
5. **Phase 5**: File Browser reflects disk; Document Map scrolls in sync; Find in Files returns results clickable to navigate
6. **Phase 6**: Drop example plugin in plugins dir → restarts app → appears in Plugins menu → executes → Plugin Manager UI lists it
7. **Phase 7**: Change editor tab size in Preferences → persists after restart; define UDL for custom language → file with that extension highlights correctly
8. **Phase 8**: `npm run build` produces NSIS installer on Windows, DMG on macOS; auto-update downloads and installs
