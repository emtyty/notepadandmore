import { test as base, Page } from '@playwright/test'
import { _electron as electron, ElectronApplication } from 'playwright'
import path from 'path'

export interface AppFixtures {
  electronApp: ElectronApplication
  page: Page
}

export const test = base.extend<AppFixtures>({
  page: async ({}, use) => {
    const app = await electron.launch({
      args: [path.resolve(__dirname, '../out/main/index.js')],
      env: { ...process.env, E2E_TEST: '1', NODE_ENV: 'test' },
      timeout: 15_000,
    })
    const page = await app.firstWindow()
    await page.waitForLoadState('domcontentloaded')
    await page.waitForSelector('[data-testid="app"]', { timeout: 10_000 })
    await page.waitForSelector('.monaco-editor textarea', { timeout: 10_000 })
    await page.waitForSelector('[data-testid="tabbar"] [data-tab-title]', { timeout: 5_000 })
    await use(page)
    await app.close()
  },
  electronApp: async ({}, use) => {
    const app = await electron.launch({
      args: [path.resolve(__dirname, '../out/main/index.js')],
      env: { ...process.env, E2E_TEST: '1', NODE_ENV: 'test' },
      timeout: 15_000,
    })
    await use(app)
    await app.close()
  },
})

export { expect } from '@playwright/test'
