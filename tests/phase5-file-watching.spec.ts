// spec: specs/phase5-sidebar-filewatching.md

import { test as base, expect } from './fixtures'
import { _electron as electron, ElectronApplication } from 'playwright'
import path from 'path'
import os from 'os'
import fs from 'fs'

// Extended fixture that shares ONE ElectronApplication instance between electronApp and page
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

// IPC helper — sends a channel+args from main process to the renderer
async function sendIPC(electronApp: ElectronApplication, channel: string, ...args: unknown[]) {
  await electronApp.evaluate(
    ({ BrowserWindow }, { ch, a }) =>
      BrowserWindow.getAllWindows()[0].webContents.send(ch, ...(a as unknown[])),
    { ch: channel, a: args }
  )
}

// Helper: open a file via the sidebar file tree
async function openFileViaTree(
  electronApp: ElectronApplication,
  page: import('@playwright/test').Page,
  folderPath: string,
  fileName: string
) {
  await sendIPC(electronApp, 'ui:toggle-sidebar', true)
  await page.locator('[data-testid="sidebar"]').waitFor({ state: 'visible', timeout: 2_000 })
  await sendIPC(electronApp, 'menu:folder-open', folderPath)
  const sidebar = page.locator('[data-testid="sidebar"]')
  await expect(sidebar.getByText(fileName)).toBeVisible({ timeout: 3_000 })
  await sidebar.getByText(fileName).click()
  await page.locator(`[data-tab-title="${fileName}"]`).waitFor({ state: 'visible', timeout: 5_000 })
}

// Toast locator — tries data-testid first, falls back to text search
function toastLocator(page: import('@playwright/test').Page, textFragment: string) {
  // The toast may have data-testid="toast" or appear as visible text in the DOM
  return page.locator(`text=${textFragment}`).first()
}

test.describe('Feature 6: File Watching', () => {

  // Scenario 26: External change on a clean buffer triggers auto-reload and toast
  test('Scenario 26 — external change on clean buffer triggers auto-reload toast', async ({ electronApp, page }) => {
    // Create a temp file to watch
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'e2e-watch-'))
    const tmpFile = path.join(tmpDir, 'watched.txt')
    fs.writeFileSync(tmpFile, 'version 1')

    try {
      // Open the file via the sidebar file tree
      await openFileViaTree(electronApp, page, tmpDir, 'watched.txt')

      // Confirm the tab is active and not dirty
      await expect(page.locator('[data-tab-title="watched.txt"]')).toBeVisible()
      await expect(page.locator('[data-tab-dirty="true"]')).not.toBeVisible()

      // Simulate an external file change by sending the IPC event directly
      await sendIPC(electronApp, 'file:externally-changed', tmpFile)

      // Wait for the toast notification to appear (auto-reload path: isDirty is false)
      await page.locator('text=reloaded (external change)').waitFor({ state: 'visible', timeout: 2_000 })

      // Assert the toast contains the expected message
      await expect(
        page.locator('text=reloaded (external change)').first()
      ).toBeVisible()
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true })
    }
  })

  // Scenario 27: External change on a dirty buffer shows "changed on disk" warning toast
  test('Scenario 27 — external change on dirty buffer shows changed-on-disk warning toast', async ({ electronApp, page }) => {
    // Create a temp file to watch
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'e2e-watch-dirty-'))
    const tmpFile = path.join(tmpDir, 'watched-dirty.txt')
    fs.writeFileSync(tmpFile, 'original content')

    try {
      // Open the file via the sidebar file tree
      await openFileViaTree(electronApp, page, tmpDir, 'watched-dirty.txt')

      // Mark the buffer as dirty by typing in the editor
      await page.locator('.monaco-editor textarea').first().click()
      await page.keyboard.type('x')

      // Assert the tab is now dirty
      await expect(page.locator('[data-tab-dirty="true"]')).toBeVisible({ timeout: 2_000 })

      // Simulate an external file change on the dirty buffer
      await sendIPC(electronApp, 'file:externally-changed', tmpFile)

      // Wait for the warning toast (dirty path: no auto-reload)
      await page.locator('text=changed on disk').waitFor({ state: 'visible', timeout: 2_000 })

      // Assert the toast contains the expected warning message
      await expect(
        page.locator('text=changed on disk').first()
      ).toBeVisible()
      await expect(
        page.locator('text=Use Reload to update').first()
      ).toBeVisible()
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true })
    }
  })

  // Scenario 28: External change on a file not open in editor is silently ignored
  test('Scenario 28 — external change for unopened path produces no toast', async ({ electronApp, page }) => {
    // Do NOT open any file — use the default untitled "new 1" buffer
    await expect(page.locator('[data-tab-title="new 1"]')).toBeVisible()

    // Send IPC for a file that is not open
    await sendIPC(electronApp, 'file:externally-changed', '/tmp/not-open.txt')

    // Wait 1 second to allow any potential toast to appear
    await page.waitForTimeout(1_000)

    // Assert no toast notification appeared
    await expect(
      page.locator('text=reloaded (external change)')
    ).not.toBeVisible()
    await expect(
      page.locator('text=changed on disk')
    ).not.toBeVisible()
  })

  // Scenario 29: External deletion shows a warning toast
  test('Scenario 29 — external deletion shows "was deleted from disk" toast', async ({ electronApp, page }) => {
    // Create a temp file to simulate deletion
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'e2e-delete-'))
    const tmpFile = path.join(tmpDir, 'to-delete.txt')
    fs.writeFileSync(tmpFile, 'about to be deleted')

    try {
      // Open the file via the sidebar file tree
      await openFileViaTree(electronApp, page, tmpDir, 'to-delete.txt')

      // Confirm the tab is active
      await expect(page.locator('[data-tab-title="to-delete.txt"]')).toBeVisible()

      // Send the IPC event simulating external file deletion
      await sendIPC(electronApp, 'file:externally-deleted', tmpFile)

      // Wait for the deletion warning toast to appear
      await page.locator('text=was deleted from disk').waitFor({ state: 'visible', timeout: 2_000 })

      // Assert the toast contains the expected deletion message
      await expect(
        page.locator('text=was deleted from disk').first()
      ).toBeVisible()

      // Tab should remain open (deletion does not auto-close the buffer)
      await expect(page.locator('[data-tab-title="to-delete.txt"]')).toBeVisible()
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true })
    }
  })

  // Scenario 30: External deletion on a file not open is silently ignored
  test('Scenario 30 — external deletion for unopened path produces no toast', async ({ electronApp, page }) => {
    // No files open — default untitled buffer
    await expect(page.locator('[data-tab-title="new 1"]')).toBeVisible()

    // Send IPC for a path that has no open buffer
    await sendIPC(electronApp, 'file:externally-deleted', '/tmp/ghost-file.txt')

    // Wait 1 second to allow any potential toast to appear
    await page.waitForTimeout(1_000)

    // Assert no deletion toast appeared
    await expect(
      page.locator('text=was deleted from disk')
    ).not.toBeVisible()
  })

  // Scenario 31: File watcher registered via watch:add IPC fires on real disk change
  test('Scenario 31 — file watcher auto-reloads on real disk write (chokidar integration)', async ({ electronApp, page }) => {
    // Create a temp file to be watched by chokidar
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'e2e-chokidar-'))
    const tmpFile = path.join(tmpDir, 'watcher-test.txt')
    fs.writeFileSync(tmpFile, 'initial content')

    try {
      // Open the file (renderer will call watch:add during open, registering chokidar watcher)
      await openFileViaTree(electronApp, page, tmpDir, 'watcher-test.txt')

      // Confirm the file is open and clean
      await expect(page.locator('[data-tab-title="watcher-test.txt"]')).toBeVisible()
      await expect(page.locator('[data-tab-dirty="true"]')).not.toBeVisible()

      // Write new content to the file on disk (triggers chokidar's awaitWriteFinish after ~300 ms)
      fs.writeFileSync(tmpFile, 'new content written by test')

      // Wait for chokidar to detect the change and for the app to show the reload toast
      // Allow up to 5 s for chokidar + IPC + React render cycle
      await page.locator('text=reloaded (external change)').waitFor({ state: 'visible', timeout: 5_000 })

      // Assert the toast confirming auto-reload is visible
      await expect(
        page.locator('text=reloaded (external change)').first()
      ).toBeVisible()
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true })
    }
  })

})
