# What's New Tab - Overview

## 1. Description

NovaPad ships frequent updates, but users have no in-app surface to discover what changed. This feature adds a "What's New" virtual tab — opened the same way as the Settings tab — that appears automatically (in the background, without stealing focus) the first time a user launches a build whose version differs from the last one they saw, and is also reachable on demand from the Help menu. This iteration ships the plumbing only; the actual release-notes content and authoring pipeline are explicitly deferred to a follow-up feature so the tab body renders a "Coming soon" placeholder.

> See [Brainstorm Notes](./raw/notes.md) for decision rationale and rejected alternatives.

---

## 2. Features

| ID | Feature | Priority | Stories | Description |
|----|---------|----------|---------|-------------|
| F1 | `whatsNew` virtual-tab kind | Must Have | US-001, US-002 | New entry in the virtual-tab kind union, rendered by a new `WhatsNewTab` component containing a "Coming soon" placeholder. Dedupe and session-restore behavior matches existing virtual tabs (Settings, Shortcuts). |
| F2 | Background-open variant of `openVirtualTab` | Must Have | US-003 | A way to open a virtual tab as the rightmost tab without making it active, used by the auto-open trigger. Existing manual entry points keep their current activate-on-open behavior. |
| F3 | Help menu entry | Must Have | US-004 | New "What's New" item at the top of the Help submenu, no accelerator, fires `menu:whats-new-open` IPC → opens the tab in the foreground. |
| F4 | Version-change auto-open | Must Have | US-003, US-005 | After window-ready and session restore, the main process compares `app.getVersion()` to `config.lastSeenVersion`. If different (or null), it opens the tab in the background and writes the current version back to config immediately. |
| F5 | `lastSeenVersion` config field | Must Have | US-005 | New persisted config field tracking the last app version for which the user saw the auto-open. Defaults to `null` (treated as "never seen"). |

---

## 3. User Stories

### Actors

| Actor | Description |
|-------|-------------|
| Returning User | A NovaPad user who has previously launched the app at least once |
| Fresh Install User | A user launching NovaPad for the first time on this machine/profile |
| Curious User | Any user who wants to read release notes on demand |

### Stories

#### US-001: What's New tab opens like Settings
> **As a** Curious User, **I want** the "What's New" tab to behave like the Settings tab, **so that** I have a familiar, predictable mental model for in-app information surfaces.

**Acceptance Criteria:**
- [ ] Opening "What's New" while it is already open re-activates the existing tab instead of creating a duplicate
- [ ] The tab title in the tab bar reads `"What's New"` (static, not version-stamped)
- [ ] The tab is non-dirty and cannot be marked dirty
- [ ] Closing the tab via the tab-bar close button works the same as closing Settings
- [ ] If the tab is open at quit, it is restored on next launch via the existing session-restore path

#### US-002: Placeholder body
> **As a** Curious User, **I want** the tab to load instantly with a clear "Coming soon" message, **so that** I understand the surface exists even before content is authored.

**Acceptance Criteria:**
- [ ] The tab body renders a visible "Coming soon" message (exact copy TBD by design, but must be present)
- [ ] No errors are logged when the tab opens
- [ ] The tab respects the current theme (light/dark) using existing tokens

#### US-003: Quiet auto-open after upgrade
> **As a** Returning User upgrading to a new NovaPad version, **I want** the "What's New" tab to appear quietly on the right after launch without interrupting my work, **so that** I can read it on my own time without losing my place in the file I was editing.

**Acceptance Criteria:**
- [ ] When `app.getVersion()` differs from `config.lastSeenVersion`, the "What's New" tab is opened automatically after window-ready and session restore complete
- [ ] The auto-opened tab is appended as the rightmost tab
- [ ] The auto-opened tab does NOT become the active tab — focus remains on whatever tab was active from session restore (or the default empty buffer if there was no session)
- [ ] The tab bar visually indicates the new tab exists (per existing tab-bar styling) so the user notices it

#### US-004: Manual open from Help menu
> **As a** Curious User, **I want** to open "What's New" any time from the Help menu, **so that** I can re-read release notes whenever I want.

**Acceptance Criteria:**
- [ ] A "What's New" item appears at the top of the Help submenu on all platforms (macOS native menu and Windows/Linux native fallback)
- [ ] Clicking it opens the "What's New" tab and makes it the active tab (foreground open, unlike the auto-open path)
- [ ] If the tab is already open, clicking the menu item re-activates it (no duplicate)
- [ ] Menu entry has no keyboard accelerator
- [ ] Menu entry is positioned above the existing "About NovaPad" item

#### US-005: At-most-once auto-open per version
> **As a** Returning User, **I want** the auto-open to fire at most once per version I install, **so that** I am not nagged on every launch.

**Acceptance Criteria:**
- [ ] After the auto-open fires, `config.lastSeenVersion` is written to disk with the current `app.getVersion()` value
- [ ] On subsequent launches with the same app version, the auto-open does NOT fire again, regardless of whether the user closed or kept the tab
- [ ] `config.lastSeenVersion` is written immediately when the auto-open IPC is dispatched, not when the user closes the tab — so a crash before close still counts as "seen"
- [ ] If a Fresh Install User launches NovaPad for the first time (no prior `lastSeenVersion`), the auto-open fires once

---

## 4. Business Rules

| ID | Rule | Description |
|----|------|-------------|
| BR-001 | At-most-once auto-open | The version-change auto-open fires at most once per (user, app version) pair. Manual open from the Help menu always works. |
| BR-002 | No focus steal on auto-open | The auto-open path must never change the active tab. The active tab is whatever session restore (or default-empty-buffer fallback) decided. |
| BR-003 | String-equality version compare | Any difference between `app.getVersion()` and `config.lastSeenVersion` is a trigger, including patch bumps. No semver awareness — `null` and missing both count as "different." |
| BR-004 | Write-on-fire, not write-on-close | `lastSeenVersion` is persisted at the moment the auto-open IPC is sent, so a crash or force-quit before the user closes the tab does not cause a re-fire on next launch. |
| BR-005 | Auto-open waits for renderer ready | The trigger fires only after the renderer has reported it is ready and session restore has completed, so the IPC is not lost. |
| BR-006 | Virtual-tab dedupe | Opening "What's New" while an existing tab of the same kind is open re-activates that tab — never creates a duplicate. (Inherits from the existing virtual-tab system.) |

---

## 5. Dependencies

### Upstream (Required by this feature)

| Dependency | Purpose |
|------------|---------|
| Existing virtual-tab system in `editorStore` | Provides `openVirtualTab(kind)`, dedupe, and the session-restore round-trip for kind-based tabs |
| Existing config read/write pipeline (`ipc/configHandlers.ts`, `configStore`) | Persists the new `lastSeenVersion` field |
| Electron `app.getVersion()` | Source of truth for the current app version (read from `package.json` at build time) |
| Existing Help submenu in `src/main/menu.ts` | Host for the new menu entry |
| Existing preload IPC allow-list | Must be extended to whitelist the new channel(s) |
| Existing session-restore signal in main | Lets the auto-open trigger wait until restore is done before firing |

### Downstream (Features that depend on this)

| Feature | Impact |
|---------|--------|
| Future "Release notes content" feature | Will replace the "Coming soon" placeholder with the real authoring pipeline (markdown, JSX, or JSON — TBD) |
| Future "Unread version badge" enhancement | Could decorate Help menu / sidenav with a notification dot when `lastSeenVersion` is stale, building on the same config field |

---

## 6. Out of Scope

- **Release-notes content and authoring pipeline.** The tab body is a "Coming soon" placeholder. Whether content lives as bundled markdown, JSX, JSON, or a remote feed is deferred to a follow-up feature.
- **Localization** of the eventual release-notes content.
- **"View older releases"** navigation inside the tab.
- **Sidenav entry** for "What's New" — Help menu is the only manual surface in this iteration.
- **Unread-version badge / notification dot** on the Help menu, sidenav, or anywhere else.
- **Keyboard accelerator** for the Help menu item.
- **Version-stamped tab title** (e.g., "What's New in v1.2.0") — title is static.
- **Semver-aware filtering** of which version bumps qualify as triggers — every version change counts.
- **Telemetry** of how many users actually read the tab.

---

## 7. Assumptions

- The renderer can reliably tell the main process when session restore has finished (or main can reliably observe it), so the auto-open trigger has a deterministic moment to fire.
- `app.getVersion()` returns a stable string for any given build; the value does not change at runtime.
- Users are comfortable with the VS Code-style "background tab on the right" pattern as a release-notes affordance.
- The existing config persistence layer can accept a new optional string field without a migration step (new field defaults to `null` when missing).
- The Help submenu has room for one more entry without being reorganized.

---

## 8. Glossary

| Term | Definition |
|------|------------|
| Virtual tab | A NovaPad tab that has no backing file on disk — it is a UI surface (Settings, Shortcuts, and now What's New). Identified by a `kind` discriminator on the buffer. |
| Auto-open | The act of the main process opening the What's New tab on the user's behalf after detecting a version change, as opposed to the user clicking it from the Help menu. |
| Background open | Opening a tab as the rightmost tab without making it the active tab — the user must click it to view it. The opposite of foreground/activate-on-open. |
| `lastSeenVersion` | New persisted config field holding the app version string the user was last shown the auto-open for. `null` means "never seen." |
| `kind` | The discriminator field on a virtual-tab buffer that identifies which UI to render (`'settings' | 'shortcuts' | 'whatsNew'`). |
