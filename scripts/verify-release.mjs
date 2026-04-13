#!/usr/bin/env node

import { access, readFile } from 'node:fs/promises'
import { constants, existsSync } from 'node:fs'
import { join } from 'node:path'
import { exit } from 'node:process'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'

const execFileAsync = promisify(execFile)
const workspaceRoot = process.cwd()
const distDir = join(workspaceRoot, 'dist')
const builderConfigPath = join(workspaceRoot, 'electron-builder.yml')

function fail(message) {
  console.error(`[verify-release] ${message}`)
  exit(1)
}

function pass(message) {
  console.log(`[verify-release] ${message}`)
}

async function fileExists(path) {
  try {
    await access(path, constants.F_OK)
    return true
  } catch {
    return false
  }
}

async function loadBuilderConfig() {
  if (!existsSync(builderConfigPath)) {
    fail('Cannot find electron-builder.yml in workspace root.')
  }
  const content = await readFile(builderConfigPath, 'utf8')
  const productName = content.match(/^productName:\s*(.+?)\s*$/m)?.[1]?.trim()
  const publishBlock = content.match(/^publish:\s*\n((?:[ \t]+.+\n?)+)/m)?.[1] ?? ''
  const owner = publishBlock.match(/owner:\s*(.+)/)?.[1]?.trim()
  const repo = publishBlock.match(/repo:\s*(.+)/)?.[1]?.trim()
  if (!productName || !owner || !repo) {
    fail('electron-builder.yml is missing productName, publish.owner, or publish.repo.')
  }
  return { productName, owner, repo }
}

async function viewRelease(tagName, owner, repo) {
  const { stdout } = await execFileAsync(
    'gh',
    [
      'release',
      'view',
      tagName,
      '--repo',
      `${owner}/${repo}`,
      '--json',
      'isDraft,url,assets,tagName'
    ],
    { cwd: workspaceRoot }
  )
  return JSON.parse(stdout)
}

async function editRelease(tagName, owner, repo, args) {
  await execFileAsync('gh', ['release', 'edit', tagName, '--repo', `${owner}/${repo}`, ...args], {
    cwd: workspaceRoot
  })
}

async function main() {
  const { productName, owner, repo } = await loadBuilderConfig()

  const packageJson = JSON.parse(await readFile(join(workspaceRoot, 'package.json'), 'utf8'))
  const version = packageJson.version
  const tagName = `v${version}`

  const expectedLocalFiles = [
    join(distDir, `${productName}.dmg`),
    join(distDir, `${productName}-${version}-mac.zip`),
    join(distDir, 'latest-mac.yml'),
    join(distDir, `${productName} Setup ${version}.exe`),
    join(distDir, `latest.yml`)
  ]

  for (const filePath of expectedLocalFiles) {
    if (!(await fileExists(filePath))) {
      fail(`Missing local artifact: ${filePath}`)
    }
  }
  pass('Local artifacts check passed.')

  const release = await viewRelease(tagName, owner, repo)
  if (release.tagName !== tagName) {
    fail(`Unexpected tag returned from GitHub release: ${release.tagName}`)
  }

  const assetNames = release.assets.map((asset) => asset.name)
  const requiredAssetPatterns = [
    new RegExp(`^${productName}\\.dmg$`),
    new RegExp(`^${productName}-${version}-mac\\.zip$`),
    /^latest-mac\.yml$/,
    new RegExp(`^${productName} Setup ${version}\\.exe$`),
    /^latest\.yml$/
  ]

  for (const pattern of requiredAssetPatterns) {
    const hasMatch = assetNames.some((name) => pattern.test(name))
    if (!hasMatch) {
      fail(`Release is missing asset matching pattern: ${pattern}`)
    }
  }
  pass('GitHub release assets check passed.')

  if (release.isDraft) {
    await editRelease(tagName, owner, repo, ['--draft=false'])
    pass(`Draft release published: ${tagName}`)
  } else {
    pass(`Release is already published: ${tagName}`)
  }

  pass(`Release URL: ${release.url}`)
}

main().catch((error) => {
  fail(error instanceof Error ? error.message : String(error))
})
