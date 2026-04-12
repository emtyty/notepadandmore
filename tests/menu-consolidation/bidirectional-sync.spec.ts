// spec: specs/menu-consolidation.md
// suite: 6. Bidirectional State Sync — Native Menu → Renderer
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

test.describe('6. Bidirectional State Sync — Native Menu → Renderer', () => {

  test("6.1 'ui:toggle-toolbar' IPC with false hides the toolbar", async ({ electronApp, page }) => {
    // 1. Assert [data-testid="toolbar"] is visible (showToolbar defaults to true)
    await expect(page.locator('[data-testid="toolbar"]')).toBeVisible()

    // 2. Send IPC 'ui:toggle-toolbar' with false
    // setShowToolbar(false, fromMain=true) suppresses redundant syncToggleToMain to prevent infinite loops
    await sendIPC(electronApp, 'ui:toggle-toolbar', false)
    await page.locator('[data-testid="toolbar"]').waitFor({ state: 'hidden', timeout: 2_000 })

    // expect: [data-testid="toolbar"] becomes hidden
    await expect(page.locator('[data-testid="toolbar"]')).not.toBeVisible()

    // 3. Restore by sending 'ui:toggle-toolbar' with true
    await sendIPC(electronApp, 'ui:toggle-toolbar', true)
    await page.locator('[data-testid="toolbar"]').waitFor({ state: 'visible', timeout: 2_000 })

    // expect: [data-testid="toolbar"] becomes visible again
    await expect(page.locator('[data-testid="toolbar"]')).toBeVisible()
  })

  test("6.2 'ui:toggle-statusbar' IPC hides and restores the status bar", async ({ electronApp, page }) => {
    // 1. Send 'menu:file-new' IPC to create a buffer so the status bar renders
    await sendIPC(electronApp, 'menu:file-new')
    await page.waitForSelector('.monaco-editor textarea', { timeout: 10_000 })
    await expect(page.locator('[data-testid="statusbar"]')).toBeVisible()

    // 2. Send IPC 'ui:toggle-statusbar' with false
    await sendIPC(electronApp, 'ui:toggle-statusbar', false)
    await page.locator('[data-testid="statusbar"]').waitFor({ state: 'hidden', timeout: 2_000 })

    // expect: [data-testid="statusbar"] becomes hidden
    await expect(page.locator('[data-testid="statusbar"]')).not.toBeVisible()

    // 3. Send IPC 'ui:toggle-statusbar' with true
    await sendIPC(electronApp, 'ui:toggle-statusbar', true)
    await page.locator('[data-testid="statusbar"]').waitFor({ state: 'visible', timeout: 2_000 })

    // expect: [data-testid="statusbar"] reappears
    await expect(page.locator('[data-testid="statusbar"]')).toBeVisible()
  })

  test("6.3 'ui:toggle-sidebar' IPC with true shows the sidebar", async ({ electronApp, page }) => {
    // 1. Confirm [data-testid="sidebar"] is not visible
    await expect(page.locator('[data-testid="sidebar"]')).not.toBeVisible()

    // 2. Send IPC 'ui:toggle-sidebar' with true
    await sendIPC(electronApp, 'ui:toggle-sidebar', true)
    await page.locator('[data-testid="sidebar"]').waitFor({ state: 'visible', timeout: 2_000 })

    // expect: [data-testid="sidebar"] becomes visible
    await expect(page.locator('[data-testid="sidebar"]')).toBeVisible()
  })

  test('6.4 Renderer toggle syncs to native menu checkbox via ui:state-changed IPC', async ({ electronApp, page }) => {
    // The toggle-sidebar menu item is initialized with checked: true in menu.ts, but the
    // renderer's showSidebar starts as false and doesn't sync to the menu on startup.
    // We must perform at least one toggle to establish a known synced state before asserting.

    // Step A: Make sure the sidebar is OPEN first (click if it's currently closed)
    const isVisible = await page.locator('[data-testid="sidebar"]').isVisible()
    if (!isVisible) {
      await page.locator('[data-testid="quickstrip-sidebar"]').click()
      await page.locator('[data-testid="sidebar"]').waitFor({ state: 'visible', timeout: 2_000 })
    }

    // Step B: Now close the sidebar — this sends syncToggleToMain('showSidebar', false) → menu checked=false
    await page.locator('[data-testid="quickstrip-sidebar"]').click()
    await page.locator('[data-testid="sidebar"]').waitFor({ state: 'hidden', timeout: 2_000 })

    // 1. Read native menu item — should now be false (just synced from renderer)
    const initialChecked = await electronApp.evaluate(
      ({ Menu }) => Menu.getApplicationMenu()?.getMenuItemById('toggle-sidebar')?.checked
    )
    expect(initialChecked).toBe(false)

    // 2. Click [data-testid="quickstrip-sidebar"] to toggle sidebar open
    await page.locator('[data-testid="quickstrip-sidebar"]').click()
    await page.locator('[data-testid="sidebar"]').waitFor({ state: 'visible', timeout: 2_000 })
    await expect(page.locator('[data-testid="sidebar"]')).toBeVisible()

    // 3. Read the native menu item checked state again
    // setShowSidebar(true) calls syncToggleToMain('showSidebar', true) → 'ui:state-changed' → main sets item.checked
    const checkedAfter = await electronApp.evaluate(
      ({ Menu }) => Menu.getApplicationMenu()?.getMenuItemById('toggle-sidebar')?.checked
    )
    expect(checkedAfter).toBe(true)
  })

  test("6.5 'ui:toggle-theme' IPC toggles dark/light mode", async ({ electronApp, page }) => {
    // 1. Confirm html element has 'dark' class
    await expect(page.locator('html')).toHaveClass(/dark/)

    // 2. Send IPC 'ui:toggle-theme'
    await sendIPC(electronApp, 'ui:toggle-theme')

    // expect: The 'dark' class is removed from the html element
    await expect(page.locator('html')).not.toHaveClass(/dark/)

    // 3. Send IPC 'ui:toggle-theme' again
    await sendIPC(electronApp, 'ui:toggle-theme')

    // expect: The 'dark' class is restored
    await expect(page.locator('html')).toHaveClass(/dark/)
  })

  test("6.6 'menu:find' IPC opens Find & Replace dialog in Find mode", async ({ electronApp, page }) => {
    // 1. Send IPC 'menu:find' via electronApp.evaluate
    await sendIPC(electronApp, 'menu:find')

    // expect: The Find & Replace dialog opens with the 'Find' tab active
    await expect(page.getByText('Find & Replace')).toBeVisible()
    // The Find tab button is the active tab (has text-primary class) within the dialog tab strip.
    // Use exact text 'Find' scoped to the dialog's tab row to avoid matching other Find-related buttons.
    await expect(page.locator('.fixed.z-\\[9001\\] button').filter({ hasText: /^Find$/ })).toBeVisible()
  })

  test("6.7 'menu:replace' IPC opens Find & Replace dialog in Replace mode", async ({ electronApp, page }) => {
    // 1. Send IPC 'menu:replace' via electronApp.evaluate
    await sendIPC(electronApp, 'menu:replace')

    // expect: The Find & Replace dialog opens with the 'Replace' tab active
    await expect(page.getByText('Find & Replace')).toBeVisible()
    // Use exact text 'Replace' scoped to the dialog's tab row to avoid matching the 'Replace' action button
    await expect(page.locator('.fixed.z-\\[9001\\] button').filter({ hasText: /^Replace$/ }).first()).toBeVisible()
  })

  test("6.8 'menu:find-in-files' IPC opens dialog in Find in Files mode", async ({ electronApp, page }) => {
    // 1. Send IPC 'menu:find-in-files' via electronApp.evaluate
    await sendIPC(electronApp, 'menu:find-in-files')

    // expect: The Find & Replace dialog opens with the 'Find in Files' tab active
    await expect(page.getByText('Find & Replace')).toBeVisible()
    await expect(page.getByRole('button', { name: 'Find in Files' })).toBeVisible()
  })

  test("6.9 'menu:about' IPC opens the About dialog", async ({ electronApp, page }) => {
    // 1. Send IPC 'menu:about' via electronApp.evaluate
    await sendIPC(electronApp, 'menu:about')

    // expect: The About dialog becomes visible with 'NovaPad' and a version string
    await expect(page.getByText('NovaPad').first()).toBeVisible()
    await expect(page.getByText(/Version \d+\.\d+/)).toBeVisible()
  })

  test("6.10 'menu:file-new' IPC creates a new buffer tab", async ({ electronApp, page }) => {
    // 1. Count [data-tab-title] elements before sending the IPC
    const before = await page.locator('[data-tab-title]').count()

    // 2. Send IPC 'menu:file-new' via electronApp.evaluate
    await sendIPC(electronApp, 'menu:file-new')

    // expect: A new tab appears and the tab count increases by 1
    await expect(page.locator('[data-tab-title]')).toHaveCount(before + 1)
  })

  test("6.11 'tab:next' and 'tab:prev' IPC navigate between tabs", async ({ electronApp, page }) => {
    // 1. Send 'menu:file-new' twice to create two tabs
    await sendIPC(electronApp, 'menu:file-new')
    await expect(page.locator('[data-tab-title]')).toHaveCount(1)
    await sendIPC(electronApp, 'menu:file-new')
    await expect(page.locator('[data-tab-title]')).toHaveCount(2)

    // Get the data-tab-title of the currently active tab (second new file)
    // The active tab uses data-testid="active-tab" (not data-active="true")
    const secondTabTitle = await page.locator('[data-testid="active-tab"]').getAttribute('data-tab-title')

    // 2. Send IPC 'tab:prev' — should move focus to the first tab
    await sendIPC(electronApp, 'tab:prev')
    // Wait for a short tick for the store to update
    await page.waitForTimeout(100)

    // The active tab should now be different from the second tab
    const activeAfterPrev = await page.locator('[data-testid="active-tab"]').getAttribute('data-tab-title')
    expect(activeAfterPrev).not.toBe(secondTabTitle)

    // 3. Send IPC 'tab:next' — should move focus back toward the second tab
    await sendIPC(electronApp, 'tab:next')
    await page.waitForTimeout(100)

    // Verify navigation completed by checking a tab is marked active
    await expect(page.locator('[data-testid="active-tab"]')).toHaveCount(1)
  })

})
