// Smoke test for SessionManager.normalize() behavior.
// Runs the normalization logic inline (no Electron runtime) against v1/v2/v3 + malformed fixtures.
// Run: node scripts/test-session-normalize.mjs

const KNOWN_VIRTUAL_KINDS = new Set(['settings', 'shortcuts'])

function normalize(raw) {
  if (!raw || typeof raw !== 'object') return null
  const obj = raw
  const files = obj.files
  if (!Array.isArray(files)) return null

  const normalizedFiles = files
    .filter((f) => !!f && typeof f === 'object' && typeof f.filePath === 'string')
    .map((f) => ({
      filePath: f.filePath,
      language: f.language || '',
      encoding: f.encoding || 'UTF-8',
      eol: f.eol || 'LF',
      viewState: (obj.version === 2 || obj.version === 3) ? (f.viewState ?? null) : null
    }))

  const activeIndex = typeof obj.activeIndex === 'number' ? obj.activeIndex : 0
  const workspaceFolder = typeof obj.workspaceFolder === 'string' ? obj.workspaceFolder : undefined

  const rawVirtual = obj.virtualTabs
  let virtualTabs = []
  let skipped = 0
  if (obj.version === 3) {
    if (Array.isArray(rawVirtual)) {
      const valid = rawVirtual
        .filter((v) => !!v && typeof v === 'object')
        .map((v) => v.kind)
        .filter((k) => typeof k === 'string' && KNOWN_VIRTUAL_KINDS.has(k))
        .map((kind) => ({ kind }))
      skipped = rawVirtual.length - valid.length
      virtualTabs = valid
    } else if (rawVirtual != null) {
      skipped = -1 // signal malformed (non-array)
    }
  }

  return { version: 3, files: normalizedFiles, virtualTabs, activeIndex, workspaceFolder, _skipped: skipped }
}

let failed = 0
function check(name, got, want) {
  const gotJson = JSON.stringify(got)
  const wantJson = JSON.stringify(want)
  if (gotJson !== wantJson) {
    console.error(`FAIL ${name}\n  got:  ${gotJson}\n  want: ${wantJson}`)
    failed++
  } else {
    console.log(`PASS ${name}`)
  }
}

// Test 1: v1 input migrates to v3 with virtualTabs=[]
{
  const v1 = { version: 1, files: [{ filePath: '/a.txt' }, { filePath: '/b.txt', language: 'js', encoding: 'UTF-8', eol: 'LF' }], activeIndex: 1 }
  const result = normalize(v1)
  check('v1 → v3 shape', { version: result.version, vtCount: result.virtualTabs.length, filesCount: result.files.length, active: result.activeIndex }, { version: 3, vtCount: 0, filesCount: 2, active: 1 })
  check('v1 file[0].viewState is null', result.files[0].viewState, null)
  check('v1 file defaults applied', { enc: result.files[0].encoding, eol: result.files[0].eol, lang: result.files[0].language }, { enc: 'UTF-8', eol: 'LF', lang: '' })
}

// Test 2: v2 input migrates to v3 preserving viewState, virtualTabs=[]
{
  const v2 = { version: 2, files: [{ filePath: '/c.txt', language: 'ts', encoding: 'UTF-8', eol: 'CRLF', viewState: { cursorState: [] } }], activeIndex: 0 }
  const result = normalize(v2)
  check('v2 → v3 preserves viewState', result.files[0].viewState, { cursorState: [] })
  check('v2 → v3 empty virtualTabs', result.virtualTabs, [])
}

// Test 3: v3 with valid virtualTabs passes through
{
  const v3 = { version: 3, files: [], virtualTabs: [{ kind: 'settings' }, { kind: 'shortcuts' }], activeIndex: 0 }
  const result = normalize(v3)
  check('v3 valid virtualTabs passthrough', result.virtualTabs, [{ kind: 'settings' }, { kind: 'shortcuts' }])
}

// Test 4: v3 with unknown kind — skipped
{
  const v3 = { version: 3, files: [], virtualTabs: [{ kind: 'settings' }, { kind: 'xyz' }], activeIndex: 0 }
  const result = normalize(v3)
  check('v3 unknown kind skipped', result.virtualTabs, [{ kind: 'settings' }])
  check('v3 skipped count reported', result._skipped, 1)
}

// Test 5: v3 with malformed (non-array) virtualTabs
{
  const v3 = { version: 3, files: [], virtualTabs: null, activeIndex: 0 }
  const result = normalize(v3)
  check('v3 null virtualTabs → []', result.virtualTabs, [])
}
{
  const v3 = { version: 3, files: [], virtualTabs: 'oops', activeIndex: 0 }
  const result = normalize(v3)
  check('v3 string virtualTabs → []', result.virtualTabs, [])
  check('v3 malformed signals skipped=-1', result._skipped, -1)
}

// Test 6: non-object raw returns null
{
  check('null raw → null', normalize(null), null)
  check('string raw → null', normalize('x'), null)
  check('files not array → null', normalize({ version: 2, files: 'x' }), null)
}

// Test 7: v3 with invalid entries (non-object, missing kind)
{
  const v3 = { version: 3, files: [], virtualTabs: [null, {}, { kind: 'settings' }, { kind: 42 }], activeIndex: 0 }
  const result = normalize(v3)
  check('v3 invalid entries filtered', result.virtualTabs, [{ kind: 'settings' }])
  check('v3 skipped count = 3', result._skipped, 3)
}

if (failed > 0) {
  console.error(`\n${failed} test(s) failed`)
  process.exit(1)
}
console.log('\nAll tests passed.')
