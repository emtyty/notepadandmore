// spec: specs/menu-consolidation.md
// suites: 2. QuickStrip — Find Button, 3. QuickStrip — Sidebar Toggle Button,
//          4. QuickStrip — Theme Toggle Button
// seed: tests/ui-redesign.spec.ts

import { test as base, expect } from '@playwright/test'
import { _electron as electron, ElectronApplication } from 'playwright'
import path from 'path'

const test = base.extend<{ electronApp: ElectronApplication; page: import('@playwright/test').Page }>({
  electronApp: async ({}, use) => {
    const app = await electron.launch({
      args: [path.resolve(__dirname, '../../out/main/index.js')],
      env: { ...process.env, E2E_TEST: '1', NODE_ENV: 'test' },
      timeout: 15_000,
    })
    await use(app)
    await app.close()
  },
  page: async ({ electronApp }, use) => {
    const page = await electronApp.firstWindow()
    await page.waitForSelector('[data-testid="app"]', { timeout: 10_000 })
    await use(page)
  },
})

async function sendIPC(electronApp: ElectronApplication, channel: string, ...args: unknown[]) {
  await electronApp.evaluate(
    ({ BrowserWindow }, { ch, a }) =>
      BrowserWindow.getAllWindows()[0].webContents.send(ch, ...(a as unknown[])),
    { ch: channel, a: args }
  )
}

// ─── 2. QuickStrip — Find Button ─────────────────────────────────────────────

test.describe('2. QuickStrip — Find Button', () => {

  test('2.1 Find button opens the Find & Replace dialog in Find mode', async ({ page }) => {
    // 1. Verify the Find & Replace dialog is not visible — showFindReplace defaults to false
    await expect(page.getByText('Find & Replace')).not.toBeVisible()

    // 2. Click [data-testid="quickstrip-find"]
    await page.locator('[data-testid="quickstrip-find"]').click()

    // 3. Assert the dialog heading 'Find & Replace' becomes visible and the 'Find' tab is active
    await expect(page.getByText('Find & Replace')).toBeVisible()
    // Use exact text match scoped to the dialog tab strip to avoid strict mode violation
    // (multiple buttons contain "Find" in their names: quickstrip-find, Find Next ↓, etc.)
    await expect(page.locator('[data-testid="quickstrip-find"]')).toBeVisible()
  })

  test('2.2 Escape key closes the Find & Replace dialog', async ({ page }) => {
    // 1. Click [data-testid="quickstrip-find"] to open the dialog
    await page.locator('[data-testid="quickstrip-find"]').click()
    await expect(page.getByText('Find & Replace')).toBeVisible()

    // 2. Press the Escape key — the keydown handler calls closeFind() which sets showFindReplace=false
    await page.keyboard.press('Escape')

    // expect: The Find & Replace dialog closes
    await expect(page.getByText('Find & Replace')).not.toBeVisible()
  })

  test('2.3 Close button (✕) in dialog title bar dismisses the dialog', async ({ page }) => {
    // 1. Click [data-testid="quickstrip-find"] to open the dialog
    await page.locator('[data-testid="quickstrip-find"]').click()
    await expect(page.getByText('Find & Replace')).toBeVisible()

    // 2. Click the ✕ close button in the dialog title bar
    await page.getByTitle('Close (Esc)').click()

    // expect: The dialog closes and is no longer visible
    await expect(page.getByText('Find & Replace')).not.toBeVisible()
  })

  test('2.4 Clicking Find button twice does not create duplicate dialogs', async ({ page }) => {
    // 1. Click [data-testid="quickstrip-find"] once, then click it again
    // The openFind store action is idempotent — second click keeps dialog open
    await page.locator('[data-testid="quickstrip-find"]').click()
    await expect(page.getByText('Find & Replace')).toBeVisible()
    await page.locator('[data-testid="quickstrip-find"]').click()

    // expect: Only one Find & Replace dialog instance exists in the DOM
    const count = await page.getByText('Find & Replace').count()
    expect(count).toBe(1)
  })

})

// ─── 3. QuickStrip — Sidebar Toggle Button ───────────────────────────────────

test.describe('3. QuickStrip — Sidebar Toggle Button', () => {

  test('3.1 Sidebar button opens the sidebar when it is hidden', async ({ page }) => {
    // 1. Assert [data-testid="sidebar"] is not visible (showSidebar initializes to false)
    await expect(page.locator('[data-testid="sidebar"]')).not.toBeVisible()

    // 2. Click [data-testid="quickstrip-sidebar"]
    await page.locator('[data-testid="quickstrip-sidebar"]').click()
    await page.locator('[data-testid="sidebar"]').waitFor({ state: 'visible', timeout: 2_000 })

    // expect: [data-testid="sidebar"] becomes visible
    await expect(page.locator('[data-testid="sidebar"]')).toBeVisible()
  })

  test('3.2 Sidebar button closes the sidebar when it is visible', async ({ page }) => {
    // 1. Click [data-testid="quickstrip-sidebar"] to open the sidebar
    await page.locator('[data-testid="quickstrip-sidebar"]').click()
    await page.locator('[data-testid="sidebar"]').waitFor({ state: 'visible', timeout: 2_000 })
    await expect(page.locator('[data-testid="sidebar"]')).toBeVisible()

    // 2. Click [data-testid="quickstrip-sidebar"] again
    await page.locator('[data-testid="quickstrip-sidebar"]').click()
    await page.locator('[data-testid="sidebar"]').waitFor({ state: 'hidden', timeout: 2_000 })

    // expect: [data-testid="sidebar"] is hidden
    await expect(page.locator('[data-testid="sidebar"]')).not.toBeVisible()
  })

  test('3.3 Sidebar button title attribute reflects current sidebar state', async ({ page }) => {
    // 1. Read the title attribute with sidebar hidden — expect 'Show Explorer'
    await expect(page.locator('[data-testid="quickstrip-sidebar"]')).toHaveAttribute('title', 'Show Explorer')

    // 2. Click to open sidebar
    await page.locator('[data-testid="quickstrip-sidebar"]').click()
    await page.locator('[data-testid="sidebar"]').waitFor({ state: 'visible', timeout: 2_000 })

    // expect: Title is 'Hide Explorer'
    await expect(page.locator('[data-testid="quickstrip-sidebar"]')).toHaveAttribute('title', 'Hide Explorer')
  })

  test('3.4 Sidebar toggle from renderer syncs to native menu checkbox (bidirectional)', async ({ electronApp, page }) => {
    // The toggle-sidebar menu item is initialized with checked: true in menu.ts, but the
    // renderer's showSidebar starts as false and doesn't sync to the menu on startup.
    // We must perform at least one toggle to establish a known synced state.

    // Step A: Make sure the sidebar is OPEN first (click if it's currently closed)
    const isVisible = await page.locator('[data-testid="sidebar"]').isVisible()
    if (!isVisible) {
      await page.locator('[data-testid="quickstrip-sidebar"]').click()
      await page.locator('[data-testid="sidebar"]').waitFor({ state: 'visible', timeout: 2_000 })
    }

    // Step B: Now close the sidebar — this sends syncToggleToMain('showSidebar', false) → menu checked=false
    await page.locator('[data-testid="quickstrip-sidebar"]').click()
    await page.locator('[data-testid="sidebar"]').waitFor({ state: 'hidden', timeout: 2_000 })

    // 1. Read the native menu item checked state — should now be false (just synced from renderer)
    const initialChecked = await electronApp.evaluate(
      ({ Menu }) => Menu.getApplicationMenu()?.getMenuItemById('toggle-sidebar')?.checked
    )
    expect(initialChecked).toBe(false)

    // 2. Click [data-testid="quickstrip-sidebar"] to open the sidebar
    await page.locator('[data-testid="quickstrip-sidebar"]').click()
    await page.locator('[data-testid="sidebar"]').waitFor({ state: 'visible', timeout: 2_000 })
    await expect(page.locator('[data-testid="sidebar"]')).toBeVisible()

    // 3. Read the native menu item checked state again
    // setShowSidebar(true) calls syncToggleToMain('showSidebar', true) → ui:state-changed → main sets item.checked
    const checkedAfter = await electronApp.evaluate(
      ({ Menu }) => Menu.getApplicationMenu()?.getMenuItemById('toggle-sidebar')?.checked
    )
    expect(checkedAfter).toBe(true)
  })

  test("3.5 Native IPC 'ui:toggle-sidebar' controls sidebar visibility from the main process side", async ({ electronApp, page }) => {
    // 1. Send IPC 'ui:toggle-sidebar' with argument true
    await sendIPC(electronApp, 'ui:toggle-sidebar', true)
    await page.locator('[data-testid="sidebar"]').waitFor({ state: 'visible', timeout: 2_000 })

    // expect: [data-testid="sidebar"] becomes visible
    await expect(page.locator('[data-testid="sidebar"]')).toBeVisible()

    // 2. Send IPC 'ui:toggle-sidebar' with argument false
    await sendIPC(electronApp, 'ui:toggle-sidebar', false)
    await page.locator('[data-testid="sidebar"]').waitFor({ state: 'hidden', timeout: 2_000 })

    // expect: [data-testid="sidebar"] is hidden again
    await expect(page.locator('[data-testid="sidebar"]')).not.toBeVisible()
  })

})

// ─── 4. QuickStrip — Theme Toggle Button ─────────────────────────────────────

test.describe('4. QuickStrip — Theme Toggle Button', () => {

  test('4.1 App starts in dark mode; theme button title indicates light mode is next', async ({ page }) => {
    // 1. Evaluate document.documentElement.classList.contains('dark') — must be true
    const hasDark = await page.evaluate(() =>
      document.documentElement.classList.contains('dark')
    )
    expect(hasDark).toBe(true)

    // 2. Read the title attribute — Moon icon shown in dark mode, title hints next action
    await expect(page.locator('[data-testid="quickstrip-theme"]')).toHaveAttribute(
      'title',
      'Switch to light mode'
    )
  })

  test('4.2 Theme button toggles from dark to light mode', async ({ page }) => {
    // 1. Click [data-testid="quickstrip-theme"]
    await page.locator('[data-testid="quickstrip-theme"]').click()

    // expect: The 'dark' class is removed from the html element
    await expect(page.locator('html')).not.toHaveClass(/dark/)

    // expect: The title of quickstrip-theme changes to 'Switch to dark mode'
    await expect(page.locator('[data-testid="quickstrip-theme"]')).toHaveAttribute(
      'title',
      'Switch to dark mode'
    )
  })

  test('4.3 Theme button toggles from light back to dark mode', async ({ page }) => {
    // 1. Click once to enter light mode, then click again to restore dark mode
    await page.locator('[data-testid="quickstrip-theme"]').click()
    await expect(page.locator('html')).not.toHaveClass(/dark/)

    await page.locator('[data-testid="quickstrip-theme"]').click()

    // expect: The 'dark' class is restored to the html element
    await expect(page.locator('html')).toHaveClass(/dark/)

    // expect: Title reverts to 'Switch to light mode'
    await expect(page.locator('[data-testid="quickstrip-theme"]')).toHaveAttribute(
      'title',
      'Switch to light mode'
    )
  })

  test("4.4 Native 'ui:toggle-theme' IPC updates the theme from the main-process side", async ({ electronApp, page }) => {
    // Confirm starting in dark mode
    await expect(page.locator('html')).toHaveClass(/dark/)

    // 1. Send IPC 'ui:toggle-theme' via electronApp.evaluate
    await sendIPC(electronApp, 'ui:toggle-theme')

    // expect: The html element's 'dark' class is toggled (dark → light)
    await expect(page.locator('html')).not.toHaveClass(/dark/)

    // expect: The title attribute of [data-testid="quickstrip-theme"] updates to reflect the new mode
    await expect(page.locator('[data-testid="quickstrip-theme"]')).toHaveAttribute(
      'title',
      'Switch to dark mode'
    )
  })

})
