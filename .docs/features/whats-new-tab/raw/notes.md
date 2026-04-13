# What's New tab — brainstorm notes

Date: 2026-04-13
Status: brainstorming

## Raw idea (verbatim from user)

> tạo page What's new (cách open tương tự như Setting)
> nội dung (tạm để trống. sẽ add sau)
> sẽ xuất hiện khi user lần đầu open ở version mới hoặc tự menu help

Restated: a "What's New" virtual tab — opened the same way as the Settings tab — that
appears automatically the first time a user launches a new version of the app, and is
also reachable on demand from the Help menu. Body content is intentionally TBD.

## Existing landscape (already in the codebase)

- Virtual-tab system in `src/renderer/src/store/editorStore.ts:128` — `openVirtualTab(kind)`
  with kind union `'settings' | 'shortcuts'`. Dedupes: re-activates an existing tab
  instead of creating a duplicate.
- Settings tab entry points:
  - `src/renderer/src/components/editor/SettingsMenu.tsx:48` (gear dropdown)
  - `src/renderer/src/components/SideNav/SideNav.tsx:35` (left nav)
  - IPC `menu:settings-open` from `src/main/menu.ts` Help submenu (Win/Linux only,
    `Ctrl+,`) → `src/renderer/src/App.tsx:113`
- Help submenu: `src/main/menu.ts:373` — currently has About + DevTools + hidden
  Settings accelerator. Natural home for a "What's New" item.
- Session restore replays virtual tabs (`useFileOps.ts:155`), so a "What's New" tab will
  reopen across restarts unless explicitly excluded.
- **No** existing `lastSeenVersion` field in config — needs to be added to
  `configStore` + `~/.config/notepad-and-more/config/`.
- App version source: `app.getVersion()` in main process (read from `package.json`).

## Open questions (need user input)

1. **Trigger granularity** — auto-open on *any* version bump (e.g. 1.0.3 → 1.0.4),
   or only minor/major bumps (skip patch releases)?
2. **Behavior on session restore** — if user has 5 files open, should "What's New"
   appear as a *new* tab and steal focus, or open in the background as the rightmost
   tab? Or only auto-open when there's no prior session?
3. **Session persistence** — Settings/Shortcuts tabs survive across restarts today.
   Should "What's New" do the same, or always close on quit (so the user doesn't see
   it forever after dismissing it once)?
4. **Help menu label & position** — "What's New" at top of Help, or under DevTools?
   Any accelerator?
5. **Title** — fixed "What's New", or version-stamped "What's New in v1.2.0"?
6. **Sidenav entry** — Settings has a sidenav button. Does What's New get one too,
   or is it only reachable via Help menu?
7. **Content source (future, but shapes the contract)** — markdown bundled with the
   app? HTML? React component? This decides what `kind: 'whatsNew'` renders.

## Tentative classification (pre-answers)

- **Features**
  - New virtual-tab kind `'whatsNew'` rendered by a new `WhatsNewTab.tsx` component
    (placeholder body for now).
  - Help menu item that fires `menu:whats-new-open` IPC → `openVirtualTab('whatsNew')`.
  - First-launch-on-new-version detector in main: compare `app.getVersion()` to
    `config.lastSeenVersion`; if different (or missing), send `menu:whats-new-open`
    to the renderer once after window ready, then write current version back to config.
- **Business rules**
  - Auto-open fires *at most once* per (user, version) pair.
  - Manual open via Help menu always works regardless of `lastSeenVersion`.
- **Dependencies**
  - New config field `lastSeenVersion: string | null`.
  - Extend virtual-tab kind union in `editorStore.ts` and any switch statements
    that render virtual tabs.
- **Out of scope (for this iteration)**
  - Actual release-notes content / authoring pipeline.
  - Localization of release notes.
  - In-tab navigation between versions ("see older releases").

## Decisions made

### Round 1 (2026-04-13)

1. **Trigger granularity = any version change.**
   Compare `app.getVersion()` to `config.lastSeenVersion` with plain string equality.
   Patch bumps (1.0.3 → 1.0.4) trigger the auto-open just like minor/major bumps.
   No semver parsing needed.

2. **Auto-open behavior = VS Code style (background, no focus steal).**
   When the auto-open fires after a version bump, the "What's New" tab is appended as
   the rightmost tab but does NOT become the active tab. The user lands on whatever
   was active from the restored session (or the default empty buffer on first install).
   → `openVirtualTab('whatsNew')` needs an `activate: boolean` option, OR a separate
     `openVirtualTabInBackground(kind)` helper. Existing manual-open paths (Help menu,
     future sidenav button) still activate the tab as Settings does today.

3. **Session persistence = same as Settings/Shortcuts.**
   "What's New" is included in `session.json` via the existing virtual-tab restore
   path. If the user leaves it open, it returns on next launch. If they close it,
   it stays closed until the next version bump (because `lastSeenVersion` is
   written immediately when auto-open fires — see edge case below).

### Edge cases captured

- **Fresh install** (`lastSeenVersion` missing/null): treat as a version change →
  auto-open fires once. This is the user's "welcome" experience.
- **`lastSeenVersion` write timing**: write the new version to config the moment the
  auto-open IPC is sent, not when the user closes the tab. This guarantees
  "at most once per (user, version)" even if the user crashes / force-quits before
  closing the tab.
- **No window yet**: the trigger must wait for the renderer to be ready (existing
  `did-finish-load` or whichever signal session restore already uses), otherwise the
  IPC fires into the void.

### Round 2 (2026-04-13)

4. **Help menu = top entry, no accelerator, label "What's New".**
   Place above the existing `About NovaPad` item in `src/main/menu.ts:373`. New IPC
   channel: `menu:whats-new-open`. Preload allow-list must be extended.

5. **No sidenav entry — Help menu only.**
   Rationale: low-frequency surface; sidenav is reserved for daily-use entry points.
   A badge/dot indicator on something existing is left as a possible future
   enhancement (option (c) from brainstorm), not in scope.

6. **Tab title = static "What's New".**
   Simpler than version-stamping; version-stamping can come with the content
   pipeline if/when "view older releases" becomes a thing.

7. **Content = deferred — ship a `"Coming soon"` placeholder.**
   This PRD is plumbing-only: virtual-tab kind, version-detection, Help menu wiring,
   `WhatsNewTab.tsx` shell. The content-authoring strategy (markdown vs JSX vs JSON)
   is explicitly punted to a follow-up feature so this iteration stays small and
   ship-able.

## Final classified requirements

### Features
- New virtual-tab kind `'whatsNew'` in `editorStore.ts` (extend the union, the title
  map, and the dedupe lookup).
- New `WhatsNewTab.tsx` component under `src/renderer/src/components/WhatsNewTab/`
  rendering a "Coming soon" placeholder.
- Wherever virtual tabs are routed to components (likely `EditorPane` or a switch in
  `App.tsx`), add the `'whatsNew'` branch.
- `openVirtualTab` (or a sibling helper) gains a way to open a tab in the
  background without stealing focus — used only by the auto-open path.
- Help menu: new `What's New` item at top of submenu → `menu:whats-new-open` IPC.
- Preload bridge: allow `menu:whats-new-open` channel.
- Renderer (`App.tsx`): wire `menu:whats-new-open` → `openVirtualTab('whatsNew')`
  (foreground / activate).
- Main process startup: after window is ready and session restore has finished,
  compare `app.getVersion()` to `config.lastSeenVersion`; if mismatched (or null),
  send a *background* open IPC (e.g., `menu:whats-new-auto-open`) and write the
  current version back to config immediately.
- Config: new field `lastSeenVersion: string | null` (default `null`) in
  `configStore` and the on-disk config schema.

### User stories
- *As a user upgrading to a new build*, I see a "What's New" tab quietly appear on
  the right after launch, so I can read about changes when I'm ready — without
  losing my place in the file I was editing.
- *As any user*, I can open "What's New" any time from `Help → What's New`.
- *As a returning user on the same version*, I never see the auto-open again unless
  I upgrade.

### Business rules
- Auto-open fires at most once per (user, version) pair.
- Manual open via Help menu always works, regardless of `lastSeenVersion`.
- Auto-open never steals focus from the active/restored tab.
- `lastSeenVersion` is written when the auto-open fires, not when the tab is closed.

### Dependencies
- Existing virtual-tab infrastructure (`editorStore.openVirtualTab`).
- Existing session-restore pipeline (no changes — virtual tabs already round-trip).
- Existing config read/write pipeline (`ipc/configHandlers.ts`).
- `app.getVersion()` from Electron main.

### Out of scope
- Actual release-notes content & authoring pipeline.
- Localization.
- "View older releases" navigation.
- Sidenav entry / unread-version badge.
- Accelerator for the Help menu item.
