const yaml = require('js-yaml')
const fs = require('fs')
const path = require('path')

const base = yaml.load(fs.readFileSync(path.join(__dirname, 'electron-builder.yml'), 'utf8'))

const {
  AZURE_TRUSTED_SIGNING_ENDPOINT,
  AZURE_CODE_SIGNING_ACCOUNT_NAME,
  AZURE_CERT_PROFILE_NAME,
  AZURE_PUBLISHER_NAME,
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

module.exports = allAzureVarsSet
  ? {
      ...base,
      ...noRebuild,
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
  : { ...base, ...noRebuild }
