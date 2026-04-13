import { test, expect, Page } from '@playwright/test'
import { _electron as electron, ElectronApplication } from 'playwright'
import path from 'path'
import fs from 'fs'
import os from 'os'

async function launchApp(): Promise<{ app: ElectronApplication; page: Page }> {
  const app = await electron.launch({
    args: [path.resolve(__dirname, '../out/main/index.js')],
    env: { ...process.env, E2E_TEST: '1', NODE_ENV: 'test' },
    timeout: 15_000,
  })
  const page = await app.firstWindow()
  await page.waitForLoadState('domcontentloaded')
  await page.waitForSelector('[data-testid="app"]', { timeout: 10_000 })
  return { app, page }
}

/** Write temp files and open them via the main-process file-open IPC. */
async function seedFiles(app: ElectronApplication, page: Page, specs: Array<{ name: string; lines: number }>) {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'gbf-'))
  const paths = specs.map((s) => {
    const p = path.join(tmp, s.name)
    const content = Array.from({ length: s.lines }, (_, i) => `${s.name}-line-${i + 1}`).join('\n')
    fs.writeFileSync(p, content)
    return p
  })
  await app.evaluate(async ({ BrowserWindow }, ps) => {
    const win = BrowserWindow.getAllWindows()[0]
    win.webContents.send('menu:file-open', ps)
  }, paths)
  for (const s of specs) {
    await page.waitForSelector(`[data-tab-title="${s.name}"]`, { timeout: 5_000 })
  }
  await page.waitForSelector('.monaco-editor textarea', { timeout: 5_000 })
  // Small settle — EditorPane's model-swap effect runs asynchronously.
  await page.waitForTimeout(200)
  return { tmp, paths }
}

/** Dispatch a Monaco cursor movement via editor.setPosition for deterministic jumps. */
async function moveCursor(page: Page, line: number, column = 1) {
  await page.evaluate(
    ({ line: l, column: c }) => {
      // `editorRegistry` is not on window; instead trigger the Monaco instance
      // via its internal API by dispatching a custom event the editor doesn't
      // listen for is useless. Use the goToLine action by calling Monaco's
      // command registry if accessible. Fallback: click the editor and use
      // keyboard to move. Simplest: dispatch a custom go-to-line event the app listens to.
      window.dispatchEvent(new CustomEvent('editor:goto-line', { detail: { line: l, column: c } }))
    },
    { line, column }
  )
  await page.waitForTimeout(100)
}

const isMac = process.platform === 'darwin'

test.describe('Go Back / Forward', () => {
  // ------------------------------------------------------------
  // T1 — toolbar icons render in expected order
  // ------------------------------------------------------------
  test('Back/Forward icons are visible in the top strip', async () => {
    const { app, page } = await launchApp()
    try {
      await expect(page.locator('[data-testid="nav-back"]')).toBeVisible()
      await expect(page.locator('[data-testid="nav-forward"]')).toBeVisible()
      await expect(page.locator('[data-testid="settings-menu-trigger"]')).toBeVisible()
    } finally {
      await app.close()
    }
  })

  // ------------------------------------------------------------
  // T2 — disabled when stacks empty
  // ------------------------------------------------------------
  test('Back and Forward are disabled at launch (empty stacks)', async () => {
    const { app, page } = await launchApp()
    try {
      await expect(page.locator('[data-testid="nav-back"]')).toBeDisabled()
      await expect(page.locator('[data-testid="nav-forward"]')).toBeDisabled()
    } finally {
      await app.close()
    }
  })

  // ------------------------------------------------------------
  // T3 — tab-switch between two files enables Back
  // ------------------------------------------------------------
  test('Switching tabs enables Back and navigating returns to the previous file', async () => {
    const { app, page } = await launchApp()
    try {
      const seeded = await seedFiles(app, page, [
        { name: 'a.txt', lines: 50 },
        { name: 'b.txt', lines: 50 },
      ])
      try {
        // a.txt opened first, b.txt opened second and active. Click a to switch, then b again.
        await page.locator('[data-tab-title="a.txt"]').click()
        await page.waitForTimeout(200)
        await page.locator('[data-tab-title="b.txt"]').click()
        await page.waitForTimeout(200)

        // Back is now enabled (tab-switch pushed an entry for a.txt).
        await expect(page.locator('[data-testid="nav-back"]')).toBeEnabled()

        // Click Back → should return to a.txt.
        await page.locator('[data-testid="nav-back"]').click()
        await page.waitForTimeout(300)

        const active = await page.locator('[data-testid="active-tab"]').getAttribute('data-tab-title')
        expect(active).toBe('a.txt')
        await expect(page.locator('[data-testid="nav-forward"]')).toBeEnabled()
      } finally {
        fs.rmSync(seeded.tmp, { recursive: true, force: true })
      }
    } finally {
      await app.close()
    }
  })

  // ------------------------------------------------------------
  // T4 — Forward returns after Back
  // ------------------------------------------------------------
  test('Forward returns to the location Back came from', async () => {
    const { app, page } = await launchApp()
    try {
      const seeded = await seedFiles(app, page, [
        { name: 'a.txt', lines: 50 },
        { name: 'b.txt', lines: 50 },
      ])
      try {
        await page.locator('[data-tab-title="a.txt"]').click()
        await page.waitForTimeout(200)
        await page.locator('[data-tab-title="b.txt"]').click()
        await page.waitForTimeout(200)
        await page.locator('[data-testid="nav-back"]').click()
        await page.waitForTimeout(300)
        await page.locator('[data-testid="nav-forward"]').click()
        await page.waitForTimeout(300)

        const active = await page.locator('[data-testid="active-tab"]').getAttribute('data-tab-title')
        expect(active).toBe('b.txt')
        await expect(page.locator('[data-testid="nav-forward"]')).toBeDisabled()
      } finally {
        fs.rmSync(seeded.tmp, { recursive: true, force: true })
      }
    } finally {
      await app.close()
    }
  })

  // ------------------------------------------------------------
  // T5/T6 — keyboard shortcut (platform-appropriate)
  // ------------------------------------------------------------
  test('Keyboard shortcut triggers Back and Forward', async () => {
    const { app, page } = await launchApp()
    try {
      const seeded = await seedFiles(app, page, [
        { name: 'a.txt', lines: 50 },
        { name: 'b.txt', lines: 50 },
      ])
      try {
        await page.locator('[data-tab-title="a.txt"]').click()
        await page.waitForTimeout(200)
        await page.locator('[data-tab-title="b.txt"]').click()
        await page.waitForTimeout(200)
        // Focus Monaco.
        await page.locator('.monaco-editor textarea').first().focus()

        const backKey = isMac ? 'Control+-' : 'Alt+ArrowLeft'
        const forwardKey = isMac ? 'Control+Shift+-' : 'Alt+ArrowRight'

        await page.keyboard.press(backKey)
        await page.waitForTimeout(300)
        let active = await page.locator('[data-testid="active-tab"]').getAttribute('data-tab-title')
        expect(active).toBe('a.txt')

        await page.keyboard.press(forwardKey)
        await page.waitForTimeout(300)
        active = await page.locator('[data-testid="active-tab"]').getAttribute('data-tab-title')
        expect(active).toBe('b.txt')
      } finally {
        fs.rmSync(seeded.tmp, { recursive: true, force: true })
      }
    } finally {
      await app.close()
    }
  })

  // ------------------------------------------------------------
  // T7/T8 — mouse side buttons
  // ------------------------------------------------------------
  test('Mouse side buttons (button 3/4) trigger Back/Forward', async () => {
    const { app, page } = await launchApp()
    try {
      const seeded = await seedFiles(app, page, [
        { name: 'a.txt', lines: 50 },
        { name: 'b.txt', lines: 50 },
      ])
      try {
        await page.locator('[data-tab-title="a.txt"]').click()
        await page.waitForTimeout(200)
        await page.locator('[data-tab-title="b.txt"]').click()
        await page.waitForTimeout(200)

        // Dispatch a mouseup with button 3 on documentElement.
        await page.evaluate(() => {
          const ev = new MouseEvent('mouseup', { bubbles: true, cancelable: true, button: 3 })
          document.documentElement.dispatchEvent(ev)
        })
        await page.waitForTimeout(300)
        let active = await page.locator('[data-testid="active-tab"]').getAttribute('data-tab-title')
        expect(active).toBe('a.txt')

        await page.evaluate(() => {
          const ev = new MouseEvent('mouseup', { bubbles: true, cancelable: true, button: 4 })
          document.documentElement.dispatchEvent(ev)
        })
        await page.waitForTimeout(300)
        active = await page.locator('[data-testid="active-tab"]').getAttribute('data-tab-title')
        expect(active).toBe('b.txt')
      } finally {
        fs.rmSync(seeded.tmp, { recursive: true, force: true })
      }
    } finally {
      await app.close()
    }
  })

  // ------------------------------------------------------------
  // T14 — Settings tab does not pollute history
  // ------------------------------------------------------------
  test('Opening and closing Settings does not add back entries', async () => {
    const { app, page } = await launchApp()
    try {
      const seeded = await seedFiles(app, page, [{ name: 'only.txt', lines: 20 }])
      try {
        // Back must be disabled — only one file, never switched away from it.
        await expect(page.locator('[data-testid="nav-back"]')).toBeDisabled()

        // Open Settings.
        await page.locator('[data-testid="settings-menu-trigger"]').click()
        await page.locator('[data-testid="settings-menu-settings"]').click()
        await page.waitForTimeout(200)
        await expect(page.locator('[data-testid="settings-tab"]')).toBeVisible()

        // Settings is active; nav-back should remain disabled because the
        // tab-switch push guards on kind === 'file' for BOTH source and dest.
        await expect(page.locator('[data-testid="nav-back"]')).toBeDisabled()

        // Switch back to the file.
        await page.locator('[data-tab-title="only.txt"]').click()
        await page.waitForTimeout(200)

        // Still disabled: switching FROM a virtual tab doesn't push either.
        await expect(page.locator('[data-testid="nav-back"]')).toBeDisabled()
      } finally {
        fs.rmSync(seeded.tmp, { recursive: true, force: true })
      }
    } finally {
      await app.close()
    }
  })

  // ------------------------------------------------------------
  // T15 — closed-buffer skip
  // ------------------------------------------------------------
  test('Closed-tab entries are skipped during Back', async () => {
    const { app, page } = await launchApp()
    try {
      const seeded = await seedFiles(app, page, [
        { name: 'a.txt', lines: 50 },
        { name: 'b.txt', lines: 50 },
        { name: 'c.txt', lines: 50 },
      ])
      try {
        // Cycle through tabs to produce two back entries (b and a).
        await page.locator('[data-tab-title="a.txt"]').click()
        await page.waitForTimeout(150)
        await page.locator('[data-tab-title="b.txt"]').click()
        await page.waitForTimeout(150)
        await page.locator('[data-tab-title="c.txt"]').click()
        await page.waitForTimeout(150)

        // Close b.txt via its close button.
        const bTab = page.locator('[data-tab-title="b.txt"]').first()
        await bTab.hover()
        await bTab.locator('button').click()
        await page.waitForTimeout(150)

        // Now click Back — should skip the stale b entry and land on a.
        await page.locator('[data-testid="nav-back"]').click()
        await page.waitForTimeout(300)
        const active = await page.locator('[data-testid="active-tab"]').getAttribute('data-tab-title')
        expect(active).toBe('a.txt')
      } finally {
        fs.rmSync(seeded.tmp, { recursive: true, force: true })
      }
    } finally {
      await app.close()
    }
  })

  // ------------------------------------------------------------
  // T18 — tooltip text per platform
  // ------------------------------------------------------------
  test('Back/Forward tooltips use the platform modifier', async () => {
    const { app, page } = await launchApp()
    try {
      const back = page.locator('[data-testid="nav-back"]')
      const forward = page.locator('[data-testid="nav-forward"]')
      const backTitle = (await back.getAttribute('title')) ?? ''
      const forwardTitle = (await forward.getAttribute('title')) ?? ''

      if (isMac) {
        expect(backTitle).toContain('⌃')
        expect(forwardTitle).toContain('⌃⇧')
        expect(backTitle).not.toContain('Alt')
      } else {
        expect(backTitle).toContain('Alt+Left')
        expect(forwardTitle).toContain('Alt+Right')
        expect(backTitle).not.toContain('⌃')
      }
    } finally {
      await app.close()
    }
  })

  // ------------------------------------------------------------
  // T23 — no persistence across restart (trivially true under E2E_TEST=1,
  // but we explicitly assert the state at launch)
  // ------------------------------------------------------------
  test('Stacks are empty on fresh launch', async () => {
    const { app, page } = await launchApp()
    try {
      await expect(page.locator('[data-testid="nav-back"]')).toBeDisabled()
      await expect(page.locator('[data-testid="nav-forward"]')).toBeDisabled()
    } finally {
      await app.close()
    }
  })
})
