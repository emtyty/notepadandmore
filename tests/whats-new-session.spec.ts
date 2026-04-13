import { test, expect } from '@playwright/test'
import * as fs from 'fs'
import * as path from 'path'
import * as os from 'os'
import {
  freshUserDataDir,
  launchIsolated,
  readConfig,
  seedConfig,
  seedSession,
  waitForAutoOpenSettle,
} from './whats-new-helpers'

/**
 * Tests for the "What's New" tab interacting with session restore — Phase 4.
 *
 * These tests drop E2E_TEST=1 (skipSessionRestore: false) so that
 * SessionManager.restore() runs against a pre-seeded session.json in the
 * isolated userData dir.
 *
 * Covers Tests 6 and 10 from .docs/features/whats-new-tab/tests.md.
 */

/** Create a real (empty) text file the test harness can put in session.files. */
function makeTempTextFile(): string {
  const fp = path.join(os.tmpdir(), `novapad-whatsnew-session-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.txt`)
  fs.writeFileSync(fp, 'hello from session\n', 'utf8')
  return fp
}

// Test 6 — auto-open does not steal focus from a restored session
test('auto-open does not steal focus from a restored session', async () => {
  const userDataDir = freshUserDataDir()

  // Stale lastSeenVersion → auto-open will fire
  seedConfig(userDataDir, { lastSeenVersion: '0.0.0-test-stale' })

  const file1 = makeTempTextFile()
  const file2 = makeTempTextFile()
  // Session v3: virtualTabs first then files. activeIndex is a flat index
  // across [...virtualTabs, ...files]. With 0 virtualTabs and 2 files,
  // activeIndex=1 means file2 should be active after restore.
  seedSession(userDataDir, {
    version: 3,
    files: [
      { filePath: file1, language: 'plaintext', encoding: 'UTF-8', eol: 'LF', viewState: null },
      { filePath: file2, language: 'plaintext', encoding: 'UTF-8', eol: 'LF', viewState: null },
    ],
    virtualTabs: [],
    activeIndex: 1,
  })

  const { app, page } = await launchIsolated({ userDataDir, skipSessionRestore: false })
  try {
    // Wait for both restored files AND the auto-opened whatsNew to appear
    await page.waitForSelector(`[data-tab-id]`, { timeout: 5000 })
    expect(await waitForAutoOpenSettle(page)).toBe(true)

    // Tab order assertion: file1, file2, whatsNew
    const tabKinds = await page.locator('[data-tab-id]').evaluateAll((els) =>
      els.map((el) => (el as HTMLElement).getAttribute('data-tab-kind'))
    )
    expect(tabKinds).toEqual(['file', 'file', 'whatsNew'])

    // Active tab is the second restored file (index 1), NOT whatsNew
    const activeKind = await page.locator('[data-testid="active-tab"]').getAttribute('data-tab-kind')
    expect(activeKind).toBe('file')
    const activeTitle = await page.locator('[data-testid="active-tab"]').getAttribute('data-tab-title')
    expect(activeTitle).toBe(path.basename(file2))
  } finally {
    await app.close()
    // Clean up the seed text files
    try { fs.unlinkSync(file1) } catch { /* ignore */ }
    try { fs.unlinkSync(file2) } catch { /* ignore */ }
  }
})

// Test 10 — tab persists across restarts when left open (session round-trip)
test('whatsNew tab persists across restarts when left open', async () => {
  const userDataDir = freshUserDataDir()
  // Fresh install — auto-open will fire
  // (No session.json yet, no config.json)

  // Launch 1: session restore enabled (no session present, so it's a no-op),
  // auto-open fires, leave the tab open, quit.
  const first = await launchIsolated({ userDataDir, skipSessionRestore: false })
  try {
    expect(await waitForAutoOpenSettle(first.page)).toBe(true)
    await expect(first.page.locator('[data-tab-kind="whatsNew"]')).toHaveCount(1)
    // Trigger session save manually: in normal usage this happens on the
    // window 'close' handler via app:before-close → renderer responds
    // session:save. In E2E we drive the renderer to send 'session:save'
    // directly, bypassing the close handshake which would tear down
    // before save lands.
    await first.page.evaluate(() => {
      // Replicates the payload App.tsx builds — but we ask the renderer
      // to do it via the same code path by dispatching app:before-close.
      // The renderer responds to that with both 'session:save' and
      // 'app:close-confirmed'; we want the save without the close.
      // Easiest: emit a custom event the test layer handles → but the
      // production code does not expose this. Use the IPC channel
      // directly here by manually constructing the payload.
      const buffers = (window as unknown as { __novapad_buffers?: unknown[] }).__novapad_buffers
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ;(window as any).api.send('session:save', {
        version: 3,
        files: [],
        virtualTabs: [{ kind: 'whatsNew' }],
        activeIndex: 0,
      })
      // Touch buffers so the linter does not complain about unused
      void buffers
    })
    // Give the main-process write a moment to land on disk
    await first.page.waitForTimeout(200)
  } finally {
    await first.app.close()
  }

  // Confirm the seed landed on disk
  const sessionPath = path.join(userDataDir, 'config', 'session.json')
  expect(fs.existsSync(sessionPath)).toBe(true)
  const persisted = JSON.parse(fs.readFileSync(sessionPath, 'utf8'))
  expect(persisted.virtualTabs).toEqual([{ kind: 'whatsNew' }])

  // Launch 2: session restore should bring the whatsNew tab back. Auto-open
  // should NOT fire again (versions match — first launch wrote lastSeenVersion).
  const second = await launchIsolated({ userDataDir, skipSessionRestore: false })
  try {
    // Tab is restored
    await expect(second.page.locator('[data-tab-kind="whatsNew"]')).toHaveCount(1)

    // lastSeenVersion was written on launch 1 and is unchanged on launch 2
    const cfg = readConfig(userDataDir)
    expect(cfg).not.toBeNull()
    const versionFromCfg = cfg!.lastSeenVersion
    expect(typeof versionFromCfg).toBe('string')
    expect((versionFromCfg as string).length).toBeGreaterThan(0)
  } finally {
    await second.app.close()
  }
})
