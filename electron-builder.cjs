const yaml = require('js-yaml')
const fs = require('fs')
const path = require('path')

const base = yaml.load(fs.readFileSync(path.join(__dirname, 'electron-builder.yml'), 'utf8'))

const {
  AZURE_TRUSTED_SIGNING_ENDPOINT,
  AZURE_CODE_SIGNING_ACCOUNT_NAME,
  AZURE_CERT_PROFILE_NAME,
  AZURE_PUBLISHER_NAME,
  R2_RELEASES_ACCOUNT_ID,
  R2_RELEASES_BUCKET,
  GH_TOKEN,
} = process.env

const allAzureVarsSet = [
  AZURE_TRUSTED_SIGNING_ENDPOINT,
  AZURE_CODE_SIGNING_ACCOUNT_NAME,
  AZURE_CERT_PROFILE_NAME,
  AZURE_PUBLISHER_NAME,
].every(Boolean)

// magika/@tensorflow are excluded from the bundle so no included package needs
// a native rebuild. npmRebuild:false skips @electron/rebuild entirely, avoiding
// the VS Build Tools requirement on Windows.
const noRebuild = {
  nodeGypRebuild: false,
  npmRebuild: false,
}

// Build publish targets only when env vars are present — avoids URL parse errors
// when running locally without R2/GH credentials.
const publish = []
if (R2_RELEASES_ACCOUNT_ID && R2_RELEASES_BUCKET) {
  publish.push({
    provider: 's3',
    bucket: R2_RELEASES_BUCKET,
    region: 'auto',
    endpoint: `https://${R2_RELEASES_ACCOUNT_ID}.r2.cloudflarestorage.com`,
    acl: null,
  })
}
if (GH_TOKEN) {
  publish.push({ provider: 'github' })
}

const config = {
  ...base,
  ...noRebuild,
  ...(publish.length ? { publish } : {}),
}

module.exports = allAzureVarsSet
  ? {
      ...config,
      win: {
        ...base.win,
        azureSignOptions: {
          publisherName: AZURE_PUBLISHER_NAME,
          endpoint: AZURE_TRUSTED_SIGNING_ENDPOINT,
          codeSigningAccountName: AZURE_CODE_SIGNING_ACCOUNT_NAME,
          certificateProfileName: AZURE_CERT_PROFILE_NAME,
        },
      },
    }
  : config
