# Release Checklist (macOS + Windows)

## Environment
- [ ] Run on macOS machine.
- [ ] Confirm `electron-builder.yml` has the correct `publish.owner` / `publish.repo` for the release artifacts repository.
- [ ] Optional: export `RELEASE_BRANCH` (defaults to `main`).
- [ ] Ensure `gh auth login` is done and has write access to the `publish.owner/publish.repo` from `electron-builder.yml`.
- [ ] Ensure macOS signing/notarization vars are set: `APPLE_ID`, `APPLE_APP_PASSWORD`, `APPLE_TEAM_ID`.

## Preflight
- [ ] Confirm clean git state: no uncommitted changes.
- [ ] Confirm current branch matches `RELEASE_BRANCH`.
- [ ] Run: `npm run release:preflight -- all`.

## Build and publish
- [ ] Publish macOS artifacts: `npm run release:mac`.
- [ ] Publish Windows artifacts: `npm run release:win`.

## Verify release
- [ ] Run: `npm run release:verify`.
- [ ] Confirm tag format is `v<package.json.version>`.
- [ ] Confirm release is not draft.
- [ ] Confirm assets include:
  - `${productName}.dmg`
  - `${productName}-${version}-mac.zip`
  - `latest-mac.yml`
  - `${productName} Setup ${version}.exe`
  - `latest.yml`

## One-command flow
- [ ] Run end-to-end release flow: `npm run release:all`.
