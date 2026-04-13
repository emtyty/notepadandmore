import { test, expect } from '@playwright/test'
import {
  freshUserDataDir,
  getRuntimeAppVersion,
  launchIsolated,
  readConfig,
  seedConfig,
  waitForAutoOpenIdle,
  waitForAutoOpenSettle,
} from './whats-new-helpers'

/**
 * Tests for the "What's New" version-mismatch auto-open trigger — Phase 4.
 *
 * These tests use a per-test temp userData dir (--user-data-dir flag) so
 * lastSeenVersion writes do not pollute the developer's real config. The
 * IsolatedApp keeps E2E_TEST=1 to skip session restore (clean slate).
 *
 * Covers Tests 3, 4, 5, 9, 16, 20 from .docs/features/whats-new-tab/tests.md.
 * Test 14 (no focus steal) is rolled into Test 3. Tests 12, 13, 15, 17, 18, 19
 * are documented as covered/redundant in the Phase 4 completion note.
 */

// Test 3 (also covers Test 14)
test('auto-open fires on fresh install (lastSeenVersion = null) without stealing focus', async () => {
  const userDataDir = freshUserDataDir()
  // No config file at all — fresh install
  const { app, page } = await launchIsolated({ userDataDir })
  try {
    expect(await waitForAutoOpenSettle(page)).toBe(true)

    // Tab is present
    await expect(page.locator('[data-tab-kind="whatsNew"]')).toHaveCount(1)

    // BR-002 focus-no-steal: WhatsNew is NOT the active tab. With no other
    // buffer, no tab is active at all and WelcomeScreen renders behind.
    await expect(page.locator('[data-testid="active-tab"]')).toHaveCount(0)
    await expect(page.locator('[data-testid="whatsnew-tab"]')).toHaveCount(0) // body not mounted

    // BR-001 + BR-004 write-on-fire: lastSeenVersion is now persisted to disk
    const version = await getRuntimeAppVersion(app)
    // Allow a small grace for the debounced config save (configStore uses 500ms)
    await page.waitForTimeout(700)
    const cfg = readConfig(userDataDir)
    expect(cfg).not.toBeNull()
    expect(cfg!.lastSeenVersion).toBe(version)
  } finally {
    await app.close()
  }
})

// Test 4
test('auto-open fires on version mismatch (stale lastSeenVersion)', async () => {
  const userDataDir = freshUserDataDir()
  seedConfig(userDataDir, { lastSeenVersion: '0.0.0-test-stale' })
  const { app, page } = await launchIsolated({ userDataDir })
  try {
    expect(await waitForAutoOpenSettle(page)).toBe(true)
    await expect(page.locator('[data-tab-kind="whatsNew"]')).toHaveCount(1)
    await expect(page.locator('[data-testid="active-tab"]')).toHaveCount(0)

    await page.waitForTimeout(700)
    const version = await getRuntimeAppVersion(app)
    expect(readConfig(userDataDir)!.lastSeenVersion).toBe(version)
  } finally {
    await app.close()
  }
})

// Test 5
test('no auto-open when versions match', async () => {
  const userDataDir = freshUserDataDir()

  // We need to know what version the launched Electron will report so we can
  // pre-seed it. Launch once just to read app.getVersion(), then close, seed,
  // and relaunch. (A simpler alternative would be to first launch with a
  // different known-mismatch seed and read the written value back from disk,
  // but the explicit launch-to-probe is clearer.)
  const probe = await launchIsolated({ userDataDir })
  const version = await getRuntimeAppVersion(probe.app)
  await probe.app.close()
  // Wipe whatever the probe wrote and reseed with version-matched value
  seedConfig(userDataDir, { lastSeenVersion: version })

  const { app, page } = await launchIsolated({ userDataDir })
  try {
    await waitForAutoOpenIdle(page)
    await expect(page.locator('[data-tab-kind="whatsNew"]')).toHaveCount(0)
    // No tabs at all → WelcomeScreen visible
    await expect(page.locator('[data-tab-id]')).toHaveCount(0)
  } finally {
    await app.close()
  }
})

// Test 9 — at-most-once across launches via write-on-fire
test('auto-open is at-most-once across launches (write-on-fire)', async () => {
  const userDataDir = freshUserDataDir()

  // Launch 1: clean slate → auto-open fires, lastSeenVersion gets written
  let version: string
  const first = await launchIsolated({ userDataDir })
  try {
    expect(await waitForAutoOpenSettle(first.page)).toBe(true)
    version = await getRuntimeAppVersion(first.app)
    await first.page.waitForTimeout(700) // let debounced save flush
  } finally {
    await first.app.close()
  }

  // Sanity: lastSeenVersion is now on disk
  expect(readConfig(userDataDir)!.lastSeenVersion).toBe(version)

  // Launch 2: same userData dir → no auto-open should fire
  const second = await launchIsolated({ userDataDir })
  try {
    await waitForAutoOpenIdle(second.page)
    await expect(second.page.locator('[data-tab-kind="whatsNew"]')).toHaveCount(0)
  } finally {
    await second.app.close()
  }
})

// Test 16 — dedupe regardless of activate option (auto background + manual foreground)
test('Help-menu open after auto-open re-activates the existing tab (no duplicate)', async () => {
  const userDataDir = freshUserDataDir()
  // Stale version → auto-open fires in background
  seedConfig(userDataDir, { lastSeenVersion: '0.0.0-test-stale' })
  const { app, page } = await launchIsolated({ userDataDir })
  try {
    expect(await waitForAutoOpenSettle(page)).toBe(true)
    await expect(page.locator('[data-tab-kind="whatsNew"]')).toHaveCount(1)
    await expect(page.locator('[data-testid="active-tab"]')).toHaveCount(0) // still inactive

    // Now trigger Help → What's New via IPC
    await app.evaluate(({ BrowserWindow }) => {
      const win = BrowserWindow.getAllWindows()[0]
      win.webContents.send('menu:whats-new-open')
    })

    // Still only 1 whats-new tab — and now it IS active
    await expect(page.locator('[data-tab-kind="whatsNew"]')).toHaveCount(1)
    await expect(page.locator('[data-testid="active-tab"][data-tab-kind="whatsNew"]')).toHaveCount(1)
    // Body now mounted
    await expect(page.locator('[data-testid="whatsnew-tab"]')).toBeVisible()
  } finally {
    await app.close()
  }
})

// Test 20 — closing the auto-opened tab in the same session does not re-trigger
test('closing the auto-opened tab in the same session does not re-trigger it', async () => {
  const userDataDir = freshUserDataDir()
  const { app, page } = await launchIsolated({ userDataDir })
  try {
    expect(await waitForAutoOpenSettle(page)).toBe(true)
    await expect(page.locator('[data-tab-kind="whatsNew"]')).toHaveCount(1)

    // Click the tab to activate (so its close button is reachable), then close it.
    // Inactive-tab close buttons only appear on hover; activating is the simplest
    // way to make the close button click-receivable.
    await page.locator('[data-tab-kind="whatsNew"]').click()
    // Active-tab close button is the inner <button> within the tab cell.
    await page.locator('[data-tab-kind="whatsNew"] button').click()
    await expect(page.locator('[data-tab-kind="whatsNew"]')).toHaveCount(0)

    // Wait beyond the auto-open settle window to confirm no re-trigger
    await waitForAutoOpenIdle(page)
    await expect(page.locator('[data-tab-kind="whatsNew"]')).toHaveCount(0)

    // lastSeenVersion was still written when auto-open fired (BR-004)
    await page.waitForTimeout(700)
    const version = await getRuntimeAppVersion(app)
    expect(readConfig(userDataDir)!.lastSeenVersion).toBe(version)
  } finally {
    await app.close()
  }
})
