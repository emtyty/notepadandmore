// E2E coverage for the new "tab bar double-click → new doc" UX, the
// Ctrl+Alt+Shift+M JSON beautify shortcut, and post-paste language autodetect
// (the Magika refinement that runs in the renderer after a paste).
//
// Strategy: drive the editor via the OS clipboard + real Ctrl+V so Monaco's
// own paste pipeline fires (that's what `editor.onDidPaste` listens to in the
// production code). We avoid `keyboard.type()` for JSON because Monaco's
// auto-closing brackets/quotes would mangle the input.

import { test as base, expect } from './fixtures'
import { _electron as electron, ElectronApplication } from 'playwright'
import path from 'path'

function makeEnv(): NodeJS.ProcessEnv {
  const env = { ...process.env, E2E_TEST: '1', NODE_ENV: 'test' }
  delete env.ELECTRON_RUN_AS_NODE
  return env
}

const test = base.extend<{ electronApp: ElectronApplication }>({
  electronApp: async ({}, use) => {
    const app = await electron.launch({
      args: [path.resolve(__dirname, '../out/main/index.js')],
      env: makeEnv(),
      timeout: 15_000,
    })
    await use(app)
    await app.close()
  },
  page: async ({ electronApp }, use) => {
    const page = await electronApp.firstWindow()
    await page.waitForSelector('[data-testid="app"]', { timeout: 10_000 })
    // E2E mode skips session restore — seed an initial untitled buffer so
    // there's a Monaco editor to interact with (matches base fixtures.ts).
    await electronApp.evaluate(({ BrowserWindow }) => {
      const win = BrowserWindow.getAllWindows()[0]
      if (win) win.webContents.send('menu:file-new')
    })
    await page.waitForSelector('.monaco-editor textarea', { timeout: 10_000 })
    await page.waitForSelector('[data-testid="tabbar"] [data-tab-title]', { timeout: 5_000 })
    await use(page)
  },
})

async function setClipboard(electronApp: ElectronApplication, text: string): Promise<void> {
  await electronApp.evaluate(({ clipboard }, t) => clipboard.writeText(t as string), text)
}

async function pasteIntoEditor(
  page: import('@playwright/test').Page,
  electronApp: ElectronApplication,
  text: string,
): Promise<void> {
  await setClipboard(electronApp, text)
  await page.locator('.monaco-editor textarea').first().click({ force: true })
  // Select-all + paste replaces the current document so each test starts clean.
  await page.keyboard.press('Control+A')
  await page.keyboard.press('Control+V')
}

async function getEditorText(page: import('@playwright/test').Page): Promise<string> {
  // Concatenate visible Monaco view-lines. Good enough for short documents we
  // control in tests, and avoids depending on a window.monaco global.
  return page.evaluate(() => {
    const lines = Array.from(document.querySelectorAll('.monaco-editor .view-line'))
    return lines.map((l) => (l.textContent ?? '').replace(/ /g, ' ')).join('\n')
  })
}

async function getStatusLanguage(page: import('@playwright/test').Page): Promise<string> {
  // The status bar shows the active buffer's language label
  // (e.g. "Plain Text", "JSON") — see getLanguageLabel().
  const el = page.locator('[data-testid="statusbar-language"]')
  if ((await el.count()) === 0) return ''
  return (await el.first().textContent())?.trim() ?? ''
}

test.describe('Tab bar double-click new doc', () => {
  test('double-click on tab bar empty area opens a new untitled tab', async ({ page }) => {
    await expect(page.locator('[data-tab-title="new 1"]')).toBeVisible()
    await page.locator('[data-testid="tabbar-filler"]').dblclick()
    await expect(page.locator('[data-tab-title="new 2"]')).toBeVisible()
  })

  test('single click on tab bar empty area does NOT create a new tab', async ({ page }) => {
    await expect(page.locator('[data-tab-title="new 1"]')).toBeVisible()
    await page.locator('[data-testid="tabbar-filler"]').click()
    await page.waitForTimeout(200)
    await expect(page.locator('[data-tab-title="new 2"]')).toHaveCount(0)
  })

  test('double-click directly on an existing tab does NOT create a new one', async ({ page }) => {
    const tab = page.locator('[data-tab-title="new 1"]')
    await expect(tab).toBeVisible()
    await tab.dblclick()
    await page.waitForTimeout(200)
    await expect(page.locator('[data-tab-title="new 2"]')).toHaveCount(0)
  })
})

test.describe('JSON beautify (Ctrl+Alt+Shift+M)', () => {
  test('reformats minified JSON in the active buffer', async ({ page, electronApp }) => {
    const minified = '{"a":1,"b":[2,3],"c":{"d":"e"}}'
    await pasteIntoEditor(page, electronApp, minified)
    await page.keyboard.press('Control+Alt+Shift+M')

    const result = await getEditorText(page)
    // Whitespace-tolerant comparison — what matters is that the JSON
    // structure was preserved AND that the output is multi-line (i.e. it was
    // actually reformatted).
    expect(JSON.parse(result)).toEqual(JSON.parse(minified))
    expect(result.split('\n').length).toBeGreaterThan(1)
  })

  test('shows a warning toast when content is not valid JSON', async ({ page, electronApp }) => {
    // Starts with `{` so the format is detected as JSON, but the JSON parser
    // will reject it — surfacing the format-specific "Not valid JSON" toast.
    await pasteIntoEditor(page, electronApp, '{"broken": ')
    await page.keyboard.press('Control+Alt+Shift+M')
    await expect(page.getByText(/Not valid JSON/i)).toBeVisible({ timeout: 3_000 })
  })

  test('reformats a single-line SQL query', async ({ page, electronApp }) => {
    const oneLine = 'SELECT a, b FROM users WHERE id = 1 AND active = true'
    await pasteIntoEditor(page, electronApp, oneLine)
    await page.keyboard.press('Control+Alt+Shift+M')

    const result = await getEditorText(page)
    expect(result.split('\n').length).toBeGreaterThan(1)
    expect(result).toMatch(/^SELECT\b/m)
    expect(result).toMatch(/^FROM\b/m)
    expect(result).toMatch(/^WHERE\b/m)
  })

  test('reformats a single-line XML document', async ({ page, electronApp }) => {
    const oneLine = '<root><a>1</a><b><c>2</c></b></root>'
    await pasteIntoEditor(page, electronApp, oneLine)
    await page.keyboard.press('Control+Alt+Shift+M')

    const result = await getEditorText(page)
    expect(result.split('\n').length).toBeGreaterThan(1)
    expect(result).toMatch(/^<root>/m)
    expect(result).toMatch(/^<\/root>/m)
  })
})

test.describe('Autodetect on paste', () => {
  test('pasting JSON into a plaintext buffer reclassifies it as json', async ({ page, electronApp }) => {
    await expect(page.locator('[data-tab-title="new 1"]')).toBeVisible()
    // Sanity: the fresh untitled buffer starts as plain text.
    expect(await getStatusLanguage(page)).toBe('Plain Text')

    const sample = JSON.stringify({ name: 'novapad', version: '1.1.0', values: [1, 2, 3] }, null, 2)
    await pasteIntoEditor(page, electronApp, sample)

    // Magika init + WebGL detect can take a moment on first run, especially
    // on CI machines that haven't warmed the model.
    await expect.poll(() => getStatusLanguage(page), { timeout: 30_000 }).toBe('JSON')
  })
})
