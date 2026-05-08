/**
 * macOS code-signing + notarization hook — called by electron-builder afterSign.
 *
 * Signing (Developer ID Application certificate) is handled automatically by
 * electron-builder before this hook runs. These env vars drive it:
 *
 *   CSC_LINK              – .p12 certificate file path  OR  base64-encoded .p12
 *                           (local: leave unset; Keychain is used automatically)
 *                           (CI:    base64 -i "Developer ID Application.p12")
 *   CSC_KEY_PASSWORD      – password that protects the .p12 file
 *
 * After signing, this hook submits the signed .app to Apple's notary service.
 * These env vars are required for notarization:
 *
 *   APPLE_ID                    – your Apple ID email (e.g. you@example.com)
 *   APPLE_APP_SPECIFIC_PASSWORD – app-specific password from appleid.apple.com
 *   APPLE_TEAM_ID               – 10-character Team ID from developer.apple.com
 *
 * The hook is a no-op on any platform other than macOS.
 * If any APPLE_* variable is absent the hook prints a warning and exits cleanly,
 * so local builds without notarization credentials are not blocked.
 */

const { notarize } = require('@electron/notarize')
const { execFileSync } = require('child_process')

exports.default = async function notarizing(context) {
  if (context.electronPlatformName !== 'darwin') return

  const appName = context.packager.appInfo.productFilename
  const appPath = `${context.appOutDir}/${appName}.app`

  // Guard: verify the binary is actually code-signed before trying to notarize.
  // If CSC_LINK / Keychain cert was missing, electron-builder skips signing and
  // Apple's notary service will reject an unsigned submission.
  try {
    execFileSync('codesign', ['--verify', '--deep', '--strict', appPath], { stdio: 'pipe' })
  } catch {
    console.warn(
      '[notarize] Skipping — app is not code-signed.\n' +
      '           Set CSC_LINK + CSC_KEY_PASSWORD (or install the "Developer ID\n' +
      '           Application" certificate in Keychain) before running publish:mac.',
    )
    return
  }

  const { APPLE_ID, APPLE_APP_SPECIFIC_PASSWORD, APPLE_TEAM_ID } = process.env

  if (!APPLE_ID || !APPLE_APP_SPECIFIC_PASSWORD || !APPLE_TEAM_ID) {
    console.warn(
      '[notarize] Skipping — APPLE_ID, APPLE_APP_SPECIFIC_PASSWORD and ' +
      'APPLE_TEAM_ID must all be set.',
    )
    return
  }

  console.log(`[notarize] Submitting ${appPath} to Apple notary service…`)

  await notarize({
    tool: 'notarytool',
    appPath,
    appleId: APPLE_ID,
    appleIdPassword: APPLE_APP_SPECIFIC_PASSWORD,
    teamId: APPLE_TEAM_ID,
  })

  console.log('[notarize] Notarization complete.')
}
