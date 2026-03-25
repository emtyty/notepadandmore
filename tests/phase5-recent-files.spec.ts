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

// Helper: open a file via the sidebar file tree and wait for its tab to become active
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

// Helper: close the active tab via keyboard shortcut Ctrl+W / Cmd+W
async function closeActiveTab(page: import('@playwright/test').Page) {
  const isMac = process.platform === 'darwin'
  await page.keyboard.press(isMac ? 'Meta+w' : 'Control+w')
  await page.waitForTimeout(300)
}

test.describe('Feature 7: Recent Files', () => {

  // Scenario 32: file:get-recents IPC returns an array
  test('Scenario 32 — getRecents returns a string array', async ({ page }) => {
    // Call getRecents() from the renderer context where window.api is available
    const recents = await page.evaluate(async () => {
      return await (window as Window & typeof globalThis & { api: { file: { getRecents: () => Promise<string[]> } } }).api.file.getRecents()
    })

    // The return value must be an array
    expect(Array.isArray(recents)).toBe(true)

    // Every element in the array must be a string (file path)
    for (const entry of recents) {
      expect(typeof entry).toBe('string')
    }
  })

  // Scenario 33: Opening a file adds it to the recents list [requires temp file]
  test('Scenario 33 — opening a file prepends it to the recents list', async ({ electronApp, page }) => {
    // Create a temp file
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'e2e-recents-'))
    const tmpFile = path.join(tmpDir, 'recent-test.txt')
    fs.writeFileSync(tmpFile, 'recent test content')

    try {
      // Record the recents list before opening the file
      const before = await page.evaluate(async () => {
        return await (window as Window & typeof globalThis & { api: { file: { getRecents: () => Promise<string[]> } } }).api.file.getRecents()
      })

      // Open the temp file via the sidebar file tree
      await openFileViaTree(electronApp, page, tmpDir, 'recent-test.txt')

      // Wait briefly for the addRecent side-effect to persist
      await page.waitForTimeout(300)

      // Record the recents list after opening the file
      const after = await page.evaluate(async () => {
        return await (window as Window & typeof globalThis & { api: { file: { getRecents: () => Promise<string[]> } } }).api.file.getRecents()
      })

      // The opened file should now be at position 0 (most recent)
      expect(after[0]).toBe(tmpFile)

      // The list should have grown by 1, or stayed the same length if it was already present
      expect(after.length).toBeGreaterThanOrEqual(before.length)
      expect(after.length).toBeLessThanOrEqual(before.length + 1)
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true })
    }
  })

  // Scenario 34: Recent files list is capped at 15 entries [requires setup]
  test('Scenario 34 — recent files list is capped at 15 entries', async ({ electronApp, page }) => {
    // Create 16 distinct temp files
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'e2e-recents-cap-'))
    const filePaths: string[] = []

    for (let i = 0; i < 16; i++) {
      const fp = path.join(tmpDir, `file-${String(i).padStart(2, '0')}.txt`)
      fs.writeFileSync(fp, `content ${i}`)
      filePaths.push(fp)
    }

    try {
      // Open the folder so the file tree is available
      await sendIPC(electronApp, 'ui:toggle-sidebar', true)
      await page.locator('[data-testid="sidebar"]').waitFor({ state: 'visible', timeout: 2_000 })
      await sendIPC(electronApp, 'menu:folder-open', tmpDir)

      const sidebar = page.locator('[data-testid="sidebar"]')

      // Open each of the 16 files sequentially
      for (let i = 0; i < 16; i++) {
        const fileName = `file-${String(i).padStart(2, '0')}.txt`
        await expect(sidebar.getByText(fileName)).toBeVisible({ timeout: 3_000 })
        await sidebar.getByText(fileName).click()
        await page.locator(`[data-tab-title="${fileName}"]`).waitFor({ state: 'visible', timeout: 5_000 })
        // Brief pause to allow addRecent to run
        await page.waitForTimeout(100)
      }

      // Wait for all addRecent operations to settle
      await page.waitForTimeout(500)

      // Retrieve the recents list
      const recents = await page.evaluate(async () => {
        return await (window as Window & typeof globalThis & { api: { file: { getRecents: () => Promise<string[]> } } }).api.file.getRecents()
      })

      // List must be capped at 15
      expect(recents.length).toBeLessThanOrEqual(15)

      // The most recently opened file (file-15.txt, index 15) should be first
      expect(recents[0]).toBe(filePaths[15])

      // The first file opened (file-00.txt, index 0) should have been dropped from the list
      expect(recents).not.toContain(filePaths[0])
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true })
    }
  })

  // Scenario 35: Recent files list deduplicates on re-open [requires temp file]
  test('Scenario 35 — re-opening a file deduplicates the recents list', async ({ electronApp, page }) => {
    // Create two temp files for this test
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'e2e-recents-dedup-'))
    fs.writeFileSync(path.join(tmpDir, 'recent-file.txt'), 'first file content')
    fs.writeFileSync(path.join(tmpDir, 'other.txt'), 'second file content')

    try {
      // Show sidebar and open workspace
      await sendIPC(electronApp, 'ui:toggle-sidebar', true)
      await page.locator('[data-testid="sidebar"]').waitFor({ state: 'visible', timeout: 2_000 })
      await sendIPC(electronApp, 'menu:folder-open', tmpDir)

      const sidebar = page.locator('[data-testid="sidebar"]')

      // Step 1: Open recent-file.txt for the first time
      await expect(sidebar.getByText('recent-file.txt')).toBeVisible({ timeout: 3_000 })
      await sidebar.getByText('recent-file.txt').click()
      await page.locator('[data-tab-title="recent-file.txt"]').waitFor({ state: 'visible', timeout: 5_000 })
      await page.waitForTimeout(300)

      // Record the recents list after the first open
      const recents1 = await page.evaluate(async () => {
        return await (window as Window & typeof globalThis & { api: { file: { getRecents: () => Promise<string[]> } } }).api.file.getRecents()
      })

      expect(recents1[0]).toBe(path.join(tmpDir, 'recent-file.txt'))

      // Step 2: Close the recent-file.txt tab
      await closeActiveTab(page)
      await page.waitForTimeout(200)

      // Step 3: Open other.txt so it becomes recents[0]
      // Re-open folder IPC to ensure File Browser is visible after close
      await sendIPC(electronApp, 'menu:folder-open', tmpDir)
      await expect(sidebar.getByText('other.txt')).toBeVisible({ timeout: 3_000 })
      await sidebar.getByText('other.txt').click()
      await page.locator('[data-tab-title="other.txt"]').waitFor({ state: 'visible', timeout: 5_000 })
      await page.waitForTimeout(300)

      // Step 4: Open recent-file.txt again
      await sendIPC(electronApp, 'menu:folder-open', tmpDir)
      await expect(sidebar.getByText('recent-file.txt')).toBeVisible({ timeout: 3_000 })
      await sidebar.getByText('recent-file.txt').click()
      await page.locator('[data-tab-title="recent-file.txt"]').waitFor({ state: 'visible', timeout: 5_000 })
      await page.waitForTimeout(300)

      // Record the recents list after the second open
      const recents2 = await page.evaluate(async () => {
        return await (window as Window & typeof globalThis & { api: { file: { getRecents: () => Promise<string[]> } } }).api.file.getRecents()
      })

      // recent-file.txt should be back at position 0
      expect(recents2[0]).toBe(path.join(tmpDir, 'recent-file.txt'))

      // The list length should be the same as after the first open (no duplicate added)
      // recents1 had recent-file.txt; recents2 after re-open should have same length
      // (other.txt was added in between, so recents2 should equal recents1.length + 1 with other.txt included,
      //  but re-opening recent-file.txt should move it to front without adding a duplicate)
      const recentFileCount2 = recents2.filter(
        (f: string) => f === path.join(tmpDir, 'recent-file.txt')
      ).length
      // Exactly one occurrence of recent-file.txt in the list (no duplicates)
      expect(recentFileCount2).toBe(1)
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true })
    }
  })

})
