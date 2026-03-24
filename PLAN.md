# NotepadAndMore — Implementation Plan

## Phase Status Overview

| Phase | Status | Notes |
|-------|--------|-------|
| Phase 1 — Bootstrap | ✅ Complete | Electron + React + Monaco running |
| Phase 2 — Tab System | ✅ Complete | Tabs, buffers, session, drag-reorder |
| Phase 3 — Syntax Highlighting | 🟡 Partial | Monaco built-ins work; TextMate grammars + UDL missing |
| Phase 4 — Editor Features | 🟡 In Progress | Core Monaco features work; dialog/macro/bookmark missing |
| Phase 5 — Panels & File Management | ❌ Not started | Sidebar, File Browser, DocMap, Function List |
| Phase 6 — Plugin System | 🟡 60% | Loader works; menu callback dispatch incomplete |
| Phase 7 — Preferences & UDL | ❌ Not started | All dialogs stubbed |
| Phase 8 — Polish & Packaging | ❌ Not started | |

---

## Current Task List (Phase 4 + 5)

### Priority Order

| # | Task | Phase | Priority | Status |
|---|------|-------|----------|--------|
| 1 | Fix Bookmark implementation | 4 | 🔴 Bug fix | pending |
| 2 | Implement Find/Replace Dialog | 4 | 🔴 Core feature | pending |
| 3 | Implement Find in Files (backend) | 4 | 🟡 | pending |
| 4 | Implement Find Results panel (bottom) | 4+5 | 🟡 depends on #3 | pending |
| 5 | Implement Sidebar container + docking layout | 5 | 🟡 Foundation | pending |
| 6 | Implement File Browser panel | 5 | 🟡 depends on #5 | pending |
| 7 | Implement Document Map panel | 5 | 🟢 depends on #5 | pending |
| 8 | Implement Function List panel | 5 | 🟢 depends on #5 | pending |
| 9 | Implement Split View (dual editor panes) | 4+5 | 🟢 | pending |
| 10 | Implement Macro recording/playback | 4 | 🟢 | pending |

---

## Task Details

### Task 1 — Fix Bookmark implementation
**Bug:** Bookmark bị map sai sang `toggleStickyScroll`.

- Monaco `deltaDecorations` để tạo bookmark gutter icon (dấu chấm xanh bên trái line number)
- Lưu bookmark list per buffer trong `editorStore`
- Menu actions: Toggle Bookmark (Ctrl+F2), Next Bookmark (F2), Prev Bookmark (Shift+F2), Clear All Bookmarks
- Wire IPC `editor:command` với các action bookmark trong `EditorPane.tsx`

---

### Task 2 — Implement Find/Replace Dialog
**File:** `src/renderer/src/components/Dialogs/FindReplace/FindReplaceDialog.tsx`

- Floating dialog (draggable), không phải panel cố định
- Fields: Search term, Replace term
- Options: Match Case, Whole Word, Regex, Wrap Around
- Buttons: Find Next, Find Prev, Replace, Replace All, Mark All, Close
- Search history dropdown (lưu trong uiStore)
- Dùng Monaco `editor.trigger` để execute search
- Wire với `uiStore.isFindReplaceOpen` + menu events `menu:find` / `menu:replace`

---

### Task 3 — Implement Find in Files (backend)
**File:** `src/main/ipc/fileHandlers.ts` (thêm handler mới)

- IPC handler: `search:find-in-files`
- Params: `{ query, directory, caseSensitive, wholeWord, useRegex, includePattern, excludePattern }`
- Node.js recursive readdir + regex match per line
- Return: `Array<{ filePath, line, column, lineText, matchStart, matchEnd }>`
- Max results: 10000 để tránh treo app
- Expose qua `window.api` trong `preload/index.ts`

---

### Task 4 — Implement Find Results panel (bottom)
**File:** `src/renderer/src/components/Panels/FindResults/FindResultsPanel.tsx`

- Depends on: Task 3
- Table/list hiển thị kết quả
- Columns: File path (relative), Line, Col, Match text (highlight phần match)
- Click row → mở file tại line đó
- Group by file (collapsible)
- Clear button
- Panel visible ở bottom khi có kết quả

---

### Task 5 — Implement Sidebar container + docking layout
**File:** `src/renderer/src/components/Sidebar/Sidebar.tsx`

- Tab icons ở cạnh trái: Files, Project, DocMap, Functions
- `react-resizable-panels` collapsible (min 200px, max 500px)
- Kết nối `uiStore.sidebarVisible` + `uiStore.activeSidebarPanel`
- Placeholder nội dung cho từng panel
- Mount vào `App.tsx` thay thế sidebar stub

---

### Task 6 — Implement File Browser panel
**File:** `src/renderer/src/components/FileBrowser/FileBrowserPanel.tsx`

- Depends on: Task 5
- Tree view (recursive component hoặc `react-arborist`)
- Root = workspace folder hoặc folder của file đang mở
- Expand/collapse folders, click file → mở trong editor
- Right-click context menu: Open, Rename, New File, New Folder, Delete, Reveal in Explorer
- Rename inline (double-click)
- IPC: `file:list-dir`, `file:create`, `file:delete`, `file:rename`, `file:reveal`
- Wire menu "Open Folder" (`menu:open-folder`) để set root folder

---

### Task 7 — Implement Document Map panel
**File:** `src/renderer/src/components/DocumentMap/DocumentMapPanel.tsx`

- Depends on: Task 5
- Second read-only Monaco instance, font size 3-4px
- Sync model với active buffer
- Scroll position sync (main ↔ minimap)
- Click trên minimap → scroll main editor

---

### Task 8 — Implement Function List panel
**File:** `src/renderer/src/components/FunctionList/FunctionListPanel.tsx`

- Depends on: Task 5
- Dùng Monaco `DocumentSymbolProvider` API để lấy symbols
- Hiển thị tree: Class > Method/Function/Variable (theo SymbolKind)
- Click item → `editor.revealLineInCenter` + setCursorPosition
- Auto-refresh debounce 500ms khi buffer thay đổi

---

### Task 9 — Implement Split View (dual editor panes)
**Store state đã có sẵn:** `splitActive`, `splitActiveId`

- `App.tsx`: thêm second `EditorPane` khi `splitActive === true`
- `react-resizable-panels` chia horizontal/vertical
- `EditorPane` nhận prop `paneId: 'main' | 'split'`
- Close split: toggle menu lần 2
- Persist split state trong `session.json`

---

### Task 10 — Implement Macro recording/playback
- Intercept Monaco `onDidType` + command executions
- Serialize: `Array<{ type: 'type'|'command', value: string }>`
- State: `uiStore.recordingMacro` (boolean) + `uiStore.currentMacro`
- Playback: replay với delay 50ms dùng `editor.trigger` + `editor.executeEdits`
- Save: persist vào `shortcuts.xml` via configHandlers
- Wire menu: `menu:macro-start`, `menu:macro-stop`, `menu:macro-playback`

---

## Known Bugs (to fix before continuing)

> Được ghi lại trong quá trình test — cập nhật tại đây khi phát hiện bug mới.

- [ ] Bookmark mapped sai sang `toggleStickyScroll` (xem Task 1)

---

## Notes

- Notepad++ source tại `notepad-plus-plus/` chỉ dùng làm **reference**, không tái sử dụng code (GPL license)
- Config dir: `~/.config/notepad-and-more/` (macOS/Linux), `%APPDATA%\notepad-and-more\` (Windows)
- Plugin dir: `~/.config/notepad-and-more/plugins/`
