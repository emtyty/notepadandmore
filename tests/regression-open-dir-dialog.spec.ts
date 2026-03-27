// Regression test: file:open-dir-dialog IPC must return string | null, not an object.
// Bug: openDirDialog returned { canceled, filePath } object, causing
//   "workspaceFolder.replace is not a function" crash in FileBrowserPanel.

import { test as base, expect } from './fixtures'
import { _electron as electron, ElectronApplication } from 'playwright'
import path from 'path'
import os from 'os'
import fs from 'fs'

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

test.describe('Regression: file:open-dir-dialog returns string, not object', () => {

  // Reproduces: Cmd+B → Open Folder → select folder → black screen + crash
  // Root cause: IPC handler returned { canceled, filePath } object; renderer
  // called workspaceFolder.replace() on the object → TypeError.
  test('menu:folder-open renders FileBrowserPanel without crash', async ({ electronApp, page }) => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'e2e-folderncrash-'))
    fs.writeFileSync(path.join(tmpDir, 'sample.txt'), 'hello')

    try {
      await sendIPC(electronApp, 'ui:toggle-sidebar', true)
      await page.locator('[data-testid="sidebar"]').waitFor({ state: 'visible', timeout: 3_000 })

      // Send a plain string path — same as what the fixed IPC and native menu do
      await sendIPC(electronApp, 'menu:folder-open', tmpDir)

      const sidebar = page.locator('[data-testid="sidebar"]')

      // Folder name header must be visible (crashes if workspaceFolder is not a string)
      await expect(sidebar.getByText(path.basename(tmpDir))).toBeVisible({ timeout: 3_000 })

      // File tree renders — no black screen or React error boundary
      await expect(sidebar.getByText('sample.txt')).toBeVisible({ timeout: 3_000 })

      // App root is still mounted (no crash / unmount)
      await expect(page.locator('[data-testid="app"]')).toBeVisible()
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true })
    }
  })

  test('openDirDialog IPC handler returns a string path, not an object', async ({ electronApp }) => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'e2e-ipc-retval-'))

    try {
      // Invoke the handler directly from the main process, bypassing the dialog
      // by patching dialog.showOpenDialog for this call only.
      const result = await electronApp.evaluate(async ({ ipcMain, dialog, BrowserWindow }, dir) => {
        const original = dialog.showOpenDialog.bind(dialog)
        // Temporarily stub to return the tmpDir as if user selected it
        ;(dialog as any).showOpenDialog = async () => ({
          canceled: false,
          filePaths: [dir],
        })
        const win = BrowserWindow.getAllWindows()[0]
        // Invoke the registered handler
        const res = await win.webContents.executeJavaScript(
          `window.api.file.openDirDialog()`
        )
        ;(dialog as any).showOpenDialog = original
        return res
      }, tmpDir)

      // Must be a string, not an object like { canceled: false, filePath: '...' }
      expect(typeof result).toBe('string')
      expect(result).toBe(tmpDir)
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true })
    }
  })

})
