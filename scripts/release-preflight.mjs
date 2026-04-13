#!/usr/bin/env node

import { existsSync } from 'node:fs'
import { readFile } from 'node:fs/promises'
import { platform } from 'node:os'
import { join } from 'node:path'
import { exit } from 'node:process'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'

const execFileAsync = promisify(execFile)

const workspaceRoot = process.cwd()
const packageJsonPath = join(workspaceRoot, 'package.json')
const builderConfigPath = join(workspaceRoot, 'electron-builder.yml')
const target = process.argv[2] ?? 'all'
const releaseBranch = process.env.RELEASE_BRANCH ?? 'main'

function fail(message) {
  console.error(`[preflight] ${message}`)
  exit(1)
}

function pass(message) {
  console.log(`[preflight] ${message}`)
}

async function runGit(args) {
  const { stdout } = await execFileAsync('git', args, { cwd: workspaceRoot })
  return stdout.trim()
}

async function runGh(args) {
  const { stdout } = await execFileAsync('gh', args, { cwd: workspaceRoot })
  return stdout.trim()
}

async function loadBuilderConfig() {
  if (!existsSync(builderConfigPath)) {
    fail('Cannot find electron-builder.yml in workspace root.')
  }
  const content = await readFile(builderConfigPath, 'utf8')
  const publishBlock = content.match(/^publish:\s*\n((?:[ \t]+.+\n?)+)/m)?.[1] ?? ''
  const owner = publishBlock.match(/owner:\s*(.+)/)?.[1]?.trim()
  const repo = publishBlock.match(/repo:\s*(.+)/)?.[1]?.trim()
  if (!owner || !repo) {
    fail('electron-builder.yml is missing publish.owner or publish.repo.')
  }
  return { owner, repo }
}

async function main() {
  if (!existsSync(packageJsonPath)) {
    fail('Cannot find package.json in workspace root.')
  }

  const { owner, repo } = await loadBuilderConfig()

  const packageJson = JSON.parse(await readFile(packageJsonPath, 'utf8'))
  if (!packageJson.version) {
    fail('Missing version in package.json.')
  }
  pass(`Version detected: ${packageJson.version}`)

  if (target === 'all' && platform() !== 'darwin') {
    fail('Full release flow is only supported on macOS.')
  }

  if (target === 'mac' && platform() !== 'darwin') {
    fail('macOS release must run on macOS.')
  }

  const gitStatus = await runGit(['status', '--porcelain'])
  if (gitStatus.length > 0) {
    fail('Working tree is not clean. Commit or stash changes before release.')
  }
  pass('Git working tree is clean.')

  const currentBranch = await runGit(['rev-parse', '--abbrev-ref', 'HEAD'])
  if (currentBranch !== releaseBranch) {
    fail(`Expected branch "${releaseBranch}" but found "${currentBranch}".`)
  }
  pass(`Branch check passed: ${currentBranch}`)

  await runGh(['auth', 'status'])
  pass('GitHub CLI auth check passed.')

  await runGh(['repo', 'view', `${owner}/${repo}`, '--json', 'nameWithOwner'])
  pass(`Release repository access verified: ${owner}/${repo}`)

  const requiredMacEnv = ['APPLE_ID', 'APPLE_APP_PASSWORD', 'APPLE_TEAM_ID']
  if (target === 'all' || target === 'mac') {
    const missingMacEnv = requiredMacEnv.filter((key) => !process.env[key])
    if (missingMacEnv.length > 0) {
      fail(`Missing macOS signing/notarization env vars: ${missingMacEnv.join(', ')}`)
    }
    pass('macOS signing/notarization env checks passed.')
  }

  pass(`Preflight checks passed for target: ${target}`)
}

main().catch((error) => {
  fail(error instanceof Error ? error.message : String(error))
})
