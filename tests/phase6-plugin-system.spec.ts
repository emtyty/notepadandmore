// spec: specs/phase6-plugin-system.md

import { test as base, expect } from './fixtures'
import { _electron as electron, ElectronApplication } from 'playwright'
import path from 'path'
import fs from 'fs'

// Extended fixture: shared ElectronApplication + Page
const test = base.extend<{ electronApp: ElectronApplication }>({
  electronApp: async ({}, use) => {
    const app = await electron.launch({
      args: [path.resolve(__dirname, '../out/main/index.js')],
      env: { ...process.env, E2E_TEST: '1', NODE_ENV: 'test' },
      timeout: 15_000,
    })
    await use(app)
    await app.close()
  },
  page: async ({ electronApp }, use) => {
    const page = await electronApp.firstWindow()
    await page.waitForSelector('[data-testid="app"]', { timeout: 10_000 })
    await page.waitForSelector('.monaco-editor textarea', { timeout: 10_000 })
    await page.waitForSelector('[data-testid="tabbar"] [data-tab-title]', { timeout: 5_000 })
    await use(page)
  },
})

// IPC helper — sends a channel + args from main process to the renderer
async function sendIPC(electronApp: ElectronApplication, channel: string, ...args: unknown[]) {
  await electronApp.evaluate(
    ({ BrowserWindow }, { ch, a }) =>
      BrowserWindow.getAllWindows()[0].webContents.send(ch, ...(a as unknown[])),
    { ch: channel, a: args }
  )
}

// Helper: get userData plugins directory (path.join done in test context, not evaluate)
async function getPluginsDir(electronApp: ElectronApplication): Promise<string> {
  const userData = await electronApp.evaluate(({ app }) => app.getPath('userData'))
  return path.join(userData, 'plugins')
}

// ─── Feature 1: Plugin Manager Dialog — Open & Close ────────────────────────

test.describe('Feature 1: Plugin Manager Dialog', () => {

  // Scenario 1: Dialog opens via menu:plugin-manager IPC
  test('Scenario 1 — plugin manager opens via IPC', async ({ electronApp, page }) => {
    // Dialog should not be visible initially
    await expect(page.locator('[data-testid="plugin-manager-dialog"]')).not.toBeVisible()

    // Send the IPC event to open the dialog
    await sendIPC(electronApp, 'menu:plugin-manager')

    // Dialog should appear
    await expect(
      page.locator('[data-testid="plugin-manager-dialog"]')
    ).toBeVisible({ timeout: 2_000 })
  })

  // Scenario 2: Dialog closes via Close (✕) button
  test('Scenario 2 — plugin manager closes via close button', async ({ electronApp, page }) => {
    // Open the dialog
    await sendIPC(electronApp, 'menu:plugin-manager')
    await page.locator('[data-testid="plugin-manager-dialog"]').waitFor({ state: 'visible', timeout: 2_000 })

    // Click the close button
    await page.locator('[data-testid="plugin-manager-close"]').click()

    // Dialog should disappear
    await expect(
      page.locator('[data-testid="plugin-manager-dialog"]')
    ).not.toBeVisible()
  })

  // Scenario 3: Dialog closes via Escape key
  test('Scenario 3 — plugin manager closes via Escape key', async ({ electronApp, page }) => {
    // Open the dialog
    await sendIPC(electronApp, 'menu:plugin-manager')
    await page.locator('[data-testid="plugin-manager-dialog"]').waitFor({ state: 'visible', timeout: 2_000 })

    // Press Escape
    await page.keyboard.press('Escape')

    // Dialog should disappear
    await expect(
      page.locator('[data-testid="plugin-manager-dialog"]')
    ).not.toBeVisible()
  })

  // Scenario 4: Dialog shows empty state when no plugins installed
  test('Scenario 4 — plugin manager shows empty state when no plugins', async ({ electronApp, page }) => {
    const pluginsDir = await getPluginsDir(electronApp)

    // Skip if plugins exist
    const hasPlugins = fs.existsSync(pluginsDir) &&
      fs.readdirSync(pluginsDir).some(entry =>
        fs.statSync(path.join(pluginsDir, entry)).isDirectory()
      )
    if (hasPlugins) {
      test.skip()
      return
    }

    // Open Plugin Manager
    await sendIPC(electronApp, 'menu:plugin-manager')
    await page.locator('[data-testid="plugin-manager-dialog"]').waitFor({ state: 'visible', timeout: 2_000 })

    // Empty state should be visible
    await expect(page.locator('[data-testid="plugin-manager-empty"]')).toBeVisible()
    await expect(
      page.locator('[data-testid="plugin-manager-dialog"]').getByText('No plugins installed.')
    ).toBeVisible()
  })

  // Scenario 5: Dialog shows plugin table when plugins exist [requires temp plugin]
  test('Scenario 5 — plugin manager shows table with installed plugins', async ({ electronApp, page }) => {
    const pluginsDir = await getPluginsDir(electronApp)
    const pluginDir = path.join(pluginsDir, 'e2e-test-plugin')

    try {
      // Create a minimal valid plugin
      fs.mkdirSync(pluginDir, { recursive: true })
      fs.writeFileSync(
        path.join(pluginDir, 'package.json'),
        JSON.stringify({ name: 'e2e-test-plugin', version: '1.2.3', author: 'Tester', description: 'E2E test plugin' })
      )
      fs.writeFileSync(path.join(pluginDir, 'index.js'), 'exports.activate = function(api) {}')

      // Open Plugin Manager and reload to pick up the new plugin
      await sendIPC(electronApp, 'menu:plugin-manager')
      await page.locator('[data-testid="plugin-manager-dialog"]').waitFor({ state: 'visible', timeout: 2_000 })
      await page.locator('[data-testid="plugin-manager-reload"]').click()

      // Plugin table should appear
      await expect(
        page.locator('[data-testid="plugin-manager-table"]')
      ).toBeVisible({ timeout: 3_000 })

      // Plugin metadata should be in the table
      const dialog = page.locator('[data-testid="plugin-manager-dialog"]')
      await expect(dialog.getByText('e2e-test-plugin')).toBeVisible()
      await expect(dialog.getByText('1.2.3')).toBeVisible()
      await expect(dialog.getByText('Tester')).toBeVisible()
      await expect(dialog.getByText('Active')).toBeVisible()
    } finally {
      fs.rmSync(pluginDir, { recursive: true, force: true })
    }
  })

})

// ─── Feature 2: Plugin Manager — Reload ─────────────────────────────────────

test.describe('Feature 2: Plugin Manager Reload', () => {

  // Scenario 6: Reload button re-fetches plugin list
  test('Scenario 6 — reload button discovers newly installed plugin', async ({ electronApp, page }) => {
    const pluginsDir = await getPluginsDir(electronApp)
    const pluginDir = path.join(pluginsDir, 'e2e-reload-plugin')

    try {
      // Open Plugin Manager before creating the plugin
      await sendIPC(electronApp, 'menu:plugin-manager')
      await page.locator('[data-testid="plugin-manager-dialog"]').waitFor({ state: 'visible', timeout: 2_000 })

      // Create the plugin after dialog is open
      fs.mkdirSync(pluginDir, { recursive: true })
      fs.writeFileSync(
        path.join(pluginDir, 'package.json'),
        JSON.stringify({ name: 'e2e-reload-plugin', version: '0.1.0' })
      )
      fs.writeFileSync(path.join(pluginDir, 'index.js'), 'exports.activate = function(api) {}')

      // Click Reload
      await page.locator('[data-testid="plugin-manager-reload"]').click()

      // Plugin table should appear with the new plugin
      await expect(
        page.locator('[data-testid="plugin-manager-dialog"]').getByText('e2e-reload-plugin')
      ).toBeVisible({ timeout: 3_000 })
    } finally {
      fs.rmSync(pluginDir, { recursive: true, force: true })
    }
  })

  // Scenario 7: Reload button re-enables after reload completes
  test('Scenario 7 — reload button is re-enabled after reload completes', async ({ electronApp, page }) => {
    // Open Plugin Manager
    await sendIPC(electronApp, 'menu:plugin-manager')
    await page.locator('[data-testid="plugin-manager-dialog"]').waitFor({ state: 'visible', timeout: 2_000 })

    const reloadBtn = page.locator('[data-testid="plugin-manager-reload"]')

    // Click reload and wait for it to be re-enabled
    await reloadBtn.click()
    await expect(reloadBtn).toBeEnabled({ timeout: 3_000 })
  })

  // Scenario 8: Plugin that throws during activate shows "Error" status
  test('Scenario 8 — plugin that throws during activate shows Error status', async ({ electronApp, page }) => {
    const pluginsDir = await getPluginsDir(electronApp)
    const pluginDir = path.join(pluginsDir, 'e2e-error-plugin')

    try {
      fs.mkdirSync(pluginDir, { recursive: true })
      fs.writeFileSync(
        path.join(pluginDir, 'package.json'),
        JSON.stringify({ name: 'e2e-error-plugin', version: '1.0.0' })
      )
      fs.writeFileSync(
        path.join(pluginDir, 'index.js'),
        'exports.activate = function() { throw new Error("Boom!") }'
      )

      // Open Plugin Manager and reload
      await sendIPC(electronApp, 'menu:plugin-manager')
      await page.locator('[data-testid="plugin-manager-dialog"]').waitFor({ state: 'visible', timeout: 2_000 })
      await page.locator('[data-testid="plugin-manager-reload"]').click()

      const dialog = page.locator('[data-testid="plugin-manager-dialog"]')
      await expect(dialog.getByText('e2e-error-plugin')).toBeVisible({ timeout: 3_000 })
      await expect(dialog.getByText('Error', { exact: true })).toBeVisible()
    } finally {
      fs.rmSync(pluginDir, { recursive: true, force: true })
    }
  })

})

// ─── Feature 3: Plugin Events via IPC ───────────────────────────────────────

test.describe('Feature 3: Plugin Events via IPC', () => {

  // Scenario 9: ui:show-toast IPC shows a toast notification
  test('Scenario 9 — ui:show-toast IPC shows a toast', async ({ electronApp, page }) => {
    await sendIPC(electronApp, 'ui:show-toast', 'Hello from plugin!', 'info')
    await expect(page.getByText('Hello from plugin!')).toBeVisible({ timeout: 2_000 })
  })

  // Scenario 10: plugin:add-menu-item IPC is received without crashing
  test('Scenario 10 — plugin:add-menu-item IPC is handled without error', async ({ electronApp, page }) => {
    await sendIPC(electronApp, 'plugin:add-menu-item', 'my-plugin', 'Do Something')
    await page.waitForTimeout(300)

    // No error toast should appear (handler is silent)
    await expect(page.getByText(/error/i)).not.toBeVisible()

    // App stays functional
    await expect(page.locator('.monaco-editor textarea')).toBeVisible()
  })

  // Scenario 11: plugin:insert-text IPC inserts text at cursor
  test('Scenario 11 — plugin:insert-text inserts text at cursor in editor', async ({ electronApp, page }) => {
    // Focus editor and position cursor at start
    await page.locator('.monaco-editor textarea').first().click({ force: true })
    await page.keyboard.press('Control+Home')
    await page.waitForTimeout(100)

    // Send plugin insert-text IPC
    await sendIPC(electronApp, 'plugin:insert-text', 'test-plugin', 'PLUGIN_INSERTED')
    await page.waitForTimeout(300)

    // Check that the inserted text is in the first line of the editor
    const firstLine = await page.locator('.monaco-editor .view-line').first().textContent()
    expect(firstLine).toContain('PLUGIN_INSERTED')
  })

  // Scenario 12: plugin:editor-get-text IPC replies with buffer content
  test('Scenario 12 — plugin:editor-get-text IPC replies with buffer content', async ({ electronApp, page }) => {
    // Type known text into the editor
    await page.locator('.monaco-editor textarea').first().click({ force: true })
    await page.keyboard.press('Control+A')
    await page.keyboard.type('hello plugin world')
    await page.waitForTimeout(200)

    // Register ipcMain listener BEFORE sending the request
    const replyPromise = electronApp.evaluate(({ ipcMain }) =>
      new Promise<string>((resolve) => {
        ipcMain.once('plugin:editor-get-text:reply', (_e: unknown, val: unknown) => resolve(val as string))
      })
    )

    // Send the IPC request (simulates plugin calling api.editor.getText())
    await sendIPC(electronApp, 'plugin:editor-get-text')

    const reply = await replyPromise
    expect(reply).toContain('hello plugin world')
  })

})

// ─── Feature 4: Plugin Loading Integration ──────────────────────────────────

test.describe('Feature 4: Plugin Loading Integration', () => {

  // Scenario 13: Plugin is available after reload (simulates startup)
  test('Scenario 13 — plugin is listed after reload', async ({ electronApp, page }) => {
    const pluginsDir = await getPluginsDir(electronApp)
    const pluginDir = path.join(pluginsDir, 'e2e-startup-plugin')

    try {
      fs.mkdirSync(pluginDir, { recursive: true })
      fs.writeFileSync(
        path.join(pluginDir, 'package.json'),
        JSON.stringify({ name: 'e2e-startup-plugin', version: '0.0.1' })
      )
      fs.writeFileSync(path.join(pluginDir, 'index.js'), 'exports.activate = function(api) {}')

      // Open Plugin Manager and reload
      await sendIPC(electronApp, 'menu:plugin-manager')
      await page.locator('[data-testid="plugin-manager-dialog"]').waitFor({ state: 'visible', timeout: 2_000 })
      await page.locator('[data-testid="plugin-manager-reload"]').click()

      await expect(
        page.locator('[data-testid="plugin-manager-dialog"]').getByText('e2e-startup-plugin')
      ).toBeVisible({ timeout: 3_000 })
    } finally {
      fs.rmSync(pluginDir, { recursive: true, force: true })
    }
  })

  // Scenario 14: Plugin that calls api.ui.showMessage triggers visible toast
  test('Scenario 14 — plugin using api.ui.showMessage shows toast on activate', async ({ electronApp, page }) => {
    const pluginsDir = await getPluginsDir(electronApp)
    const pluginDir = path.join(pluginsDir, 'e2e-toast-plugin')

    try {
      fs.mkdirSync(pluginDir, { recursive: true })
      fs.writeFileSync(
        path.join(pluginDir, 'package.json'),
        JSON.stringify({ name: 'e2e-toast-plugin', version: '1.0.0' })
      )
      fs.writeFileSync(
        path.join(pluginDir, 'index.js'),
        'exports.activate = function(api) { api.ui.showMessage("Plugin loaded OK", "info") }'
      )

      // Reload plugins — activate() will run and showMessage() will fire
      await sendIPC(electronApp, 'menu:plugin-manager')
      await page.locator('[data-testid="plugin-manager-dialog"]').waitFor({ state: 'visible', timeout: 2_000 })
      await page.locator('[data-testid="plugin-manager-reload"]').click()

      // Toast from the plugin's activate() should appear
      await expect(page.getByText('Plugin loaded OK')).toBeVisible({ timeout: 4_000 })
    } finally {
      fs.rmSync(pluginDir, { recursive: true, force: true })
    }
  })

  // Scenario 15: Plugin without activate() shows "Missing activate() export" error
  test('Scenario 15 — plugin without activate() shows missing-activate error', async ({ electronApp, page }) => {
    const pluginsDir = await getPluginsDir(electronApp)
    const pluginDir = path.join(pluginsDir, 'e2e-noactivate-plugin')

    try {
      fs.mkdirSync(pluginDir, { recursive: true })
      fs.writeFileSync(
        path.join(pluginDir, 'package.json'),
        JSON.stringify({ name: 'e2e-noactivate-plugin', version: '1.0.0' })
      )
      // No activate function exported
      fs.writeFileSync(path.join(pluginDir, 'index.js'), 'module.exports = {}')

      // Open Plugin Manager and reload
      await sendIPC(electronApp, 'menu:plugin-manager')
      await page.locator('[data-testid="plugin-manager-dialog"]').waitFor({ state: 'visible', timeout: 2_000 })
      await page.locator('[data-testid="plugin-manager-reload"]').click()

      const dialog = page.locator('[data-testid="plugin-manager-dialog"]')
      await expect(dialog.getByText('e2e-noactivate-plugin')).toBeVisible({ timeout: 3_000 })
      await expect(dialog.getByText('Error', { exact: true })).toBeVisible()
    } finally {
      fs.rmSync(pluginDir, { recursive: true, force: true })
    }
  })

  // Scenario 16: plugin:editor-get-path replies null for untitled buffer
  test('Scenario 16 — plugin:editor-get-path replies null for untitled buffer', async ({ electronApp, page }) => {
    // Register ipcMain listener BEFORE sending the request
    const replyPromise = electronApp.evaluate(({ ipcMain }) =>
      new Promise<string | null>((resolve) => {
        ipcMain.once('plugin:editor-get-path:reply', (_e: unknown, val: unknown) => resolve(val as string | null))
      })
    )

    // Send the IPC request (untitled buffer has no file path)
    await sendIPC(electronApp, 'plugin:editor-get-path')

    const reply = await replyPromise
    expect(reply).toBeNull()
  })

})
