# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev          # Start Electron app with hot reload
npm run build        # Compile TypeScript via electron-vite
npm run package      # Package for current platform
npm run package:win  # Build Windows NSIS + portable EXE
npm run package:mac  # Build macOS DMG
```

```bash
npm run build              # Required before first test run
npm run test:e2e           # Build + run all E2E tests
npm run test:e2e:headed    # With visible Electron window
npm run test:e2e:report    # Open HTML report
```

## E2E Testing (Playwright + Test Agents)

### Test Agents workflow (run once to initialize)
```bash
npx playwright init-agents --loop=claude
```
Then invoke agents via Claude Code prompts:
- `"Run Planner agent"` — explores app, creates `specs/*.md` test plans
- `"Run Generator agent"` — reads specs, writes `tests/*.spec.ts`
- `"Run Healer agent"` — runs failing tests and auto-repairs them

### Architecture
- Tests launch built app (`out/main/index.js`) — always build first
- `E2E_TEST=1` env var bypasses close handler in `src/main/index.ts`
- Session restore is disabled in E2E mode — each test starts clean
- `workers: 1` — one Electron instance at a time
- `testDir: ./tests` — Generator agent writes tests here

### Monaco gotchas
1. Click `.monaco-editor textarea` before `keyboard.type()`
2. Fixture already waits for textarea (~1-2s after React mount)
3. IntelliSense popup: press Escape before asserting if needed
4. Native menu actions: use `app.evaluate()` + `webContents.send(channel)`

## Architecture

This is an Electron + React + Monaco Editor desktop app (Notepad++ clone). The three Electron processes each have distinct roles:

### Main Process (`src/main/`)
Node.js backend. Entry: `src/main/index.ts`.
- `menu.ts` — Full native OS menu (9 sections). Menu actions fire IPC events to the renderer.
- `ipc/fileHandlers.ts` — File I/O via `chardet` (encoding detection) + `iconv-lite` (encoding conversion).
- `ipc/configHandlers.ts` — Read/write app config from `~/.config/notepad-and-more/config/`.
- `ipc/pluginHandlers.ts` — Plugin query/control.
- `plugins/PluginLoader.ts` — Loads plugins from `~/.config/notepad-and-more/plugins/`. Each plugin exports `activate(api)`.
- `sessions/SessionManager.ts` — Saves/restores open files + cursor positions to `session.json`.

### Preload (`src/preload/index.ts`)
Security bridge. Exposes `window.api` to the renderer with a whitelist of allowed IPC channels. Context isolation is enabled; node integration is disabled.

### Renderer (`src/renderer/src/`)
React frontend.
- `App.tsx` — Root component. Wires all menu IPC events to store actions and file ops. Manages layout via `react-resizable-panels`.
- `components/EditorPane/` — Monaco Editor wrapper. Handles buffer switching with view state preservation, and listens to `editor:command` IPC for menu-driven editor operations (line ops, case, comments, zoom).
- `components/TabBar/` — Tabs with drag-to-reorder and right-click context menu.
- `components/StatusBar/` — Cursor position, EOL, encoding, language, dirty state.

### State Management (Zustand)
- `store/editorStore.ts` — Buffers array + active buffer ID. Each `Buffer` holds file path, content, `isDirty`, encoding, EOL, language, Monaco `viewState`, and Monaco `model`.
- `store/uiStore.ts` — Theme, visibility toggles (toolbar/statusbar/sidebar), dialog visibility, toast queue.

### Data Flow
Menu click → IPC to main → main process I/O → IPC to renderer → `useFileOps` hook or store action → React re-render.

File operations live in `src/renderer/src/hooks/useFileOps.ts` (open, save, close, reload). Language-to-extension mapping is in `src/renderer/src/utils/languageDetect.ts`.

## Build System

`electron-vite` compiles three separate bundles:
- **main** — CommonJS, externalizes `node_modules` (except `fast-xml-parser`)
- **preload** — CommonJS, externalizes everything
- **renderer** — ESNext/DOM, React plugin, path alias `@renderer/*` → `src/renderer/src/*`

Compiled output goes to `out/`. Packaged distributable goes to `dist/`.

## Incomplete / Stubbed Features

Several features have menu entries and store state but no UI yet: Find/Replace panel, Preferences dialog, Plugin Manager, UDL Editor, Macro recording, Sidebar panels (files/project/docmap/functions), and Split View.
