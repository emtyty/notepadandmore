// Smoke test for useNavigationStore behavior (pure logic, no React/Zustand runtime).
// Mirrors the push/pop rules in src/renderer/src/store/navigationStore.ts.
// Run: node scripts/test-navigation-store.mjs

const MAX_ENTRIES = 50

/**
 * Build a mock isLiveFileBuffer predicate from a Map of known buffers.
 * buffers is { [bufferId]: { kind: 'file' | 'settings' | 'shortcuts' } }
 */
function mkIsLive(buffers) {
  return (id) => {
    const b = buffers[id]
    return !!b && b.kind === 'file'
  }
}

/** Pure reimplementation of pushEntry / goBack / goForward / canGoBack / canGoForward. */
function createStore(buffers, initial = {}) {
  const state = {
    back: initial.back ?? [],
    forward: initial.forward ?? [],
    isNavigating: initial.isNavigating ?? false,
  }
  const isLive = mkIsLive(buffers)

  function pushEntry(entry) {
    if (state.isNavigating) return
    const buf = buffers[entry.bufferId]
    if (!buf || buf.kind !== 'file') return
    const top = state.back[state.back.length - 1]
    if (top && top.bufferId === entry.bufferId && top.line === entry.line) return
    const next = [...state.back, entry]
    if (next.length > MAX_ENTRIES) next.shift()
    state.back = next
    state.forward = []
  }

  function goBack(currentPosition) {
    const back = [...state.back]
    const forward = [...state.forward]
    if (currentPosition) forward.push(currentPosition)
    let destination = null
    while (back.length > 0) {
      const candidate = back.pop()
      if (isLive(candidate.bufferId)) { destination = candidate; break }
    }
    if (!destination && currentPosition) forward.pop()
    while (forward.length > MAX_ENTRIES) forward.shift()
    state.back = back
    state.forward = forward
    return destination
  }

  function goForward(currentPosition) {
    const back = [...state.back]
    const forward = [...state.forward]
    if (currentPosition) back.push(currentPosition)
    let destination = null
    while (forward.length > 0) {
      const candidate = forward.pop()
      if (isLive(candidate.bufferId)) { destination = candidate; break }
    }
    if (!destination && currentPosition) back.pop()
    while (back.length > MAX_ENTRIES) back.shift()
    state.back = back
    state.forward = forward
    return destination
  }

  function canGoBack() {
    for (let i = state.back.length - 1; i >= 0; i--) {
      if (isLive(state.back[i].bufferId)) return true
    }
    return false
  }

  function canGoForward() {
    for (let i = state.forward.length - 1; i >= 0; i--) {
      if (isLive(state.forward[i].bufferId)) return true
    }
    return false
  }

  return {
    state,
    pushEntry,
    goBack,
    goForward,
    canGoBack,
    canGoForward,
    begin: () => { state.isNavigating = true },
    end: () => { state.isNavigating = false },
  }
}

function entry(bufferId, line, column = 1) {
  return { bufferId, line, column, timestamp: 0 }
}

let failed = 0
function check(name, got, want) {
  const g = JSON.stringify(got)
  const w = JSON.stringify(want)
  if (g !== w) {
    console.error(`FAIL ${name}\n  got:  ${g}\n  want: ${w}`)
    failed++
  } else {
    console.log(`PASS ${name}`)
  }
}

// ---------------------------------------------------------------------------
// BR-003: dedupe consecutive {bufferId, line} (column ignored)
{
  const s = createStore({ b1: { kind: 'file' } })
  s.pushEntry(entry('b1', 20, 1))
  s.pushEntry(entry('b1', 20, 5))  // same line, different column — drop
  check('BR-003 dedupe same line', s.state.back.length, 1)
  s.pushEntry(entry('b1', 21, 1))
  check('BR-003 different line pushes', s.state.back.length, 2)
}

// BR-002: cap at 50 entries, oldest dropped
{
  const s = createStore({ b1: { kind: 'file' } })
  for (let i = 1; i <= 51; i++) s.pushEntry(entry('b1', i))
  check('BR-002 cap 50', s.state.back.length, 50)
  check('BR-002 oldest dropped (line 1 gone)', s.state.back[0].line, 2)
  check('BR-002 newest kept (line 51)', s.state.back[s.state.back.length - 1].line, 51)
}

// BR-004: new push truncates forward
{
  const s = createStore({ b1: { kind: 'file' } })
  s.pushEntry(entry('b1', 10))
  s.pushEntry(entry('b1', 25))  // two entries in back
  s.goBack(entry('b1', 99))     // back=[line 10], forward=[line 99] after popping line 25
  check('BR-004 setup: forward populated', s.state.forward.length, 1)
  s.pushEntry(entry('b1', 40))
  check('BR-004 new push clears forward', s.state.forward.length, 0)
}

// BR-006: virtual tabs are not recorded
{
  const s = createStore({ file1: { kind: 'file' }, vt: { kind: 'settings' } })
  s.pushEntry(entry('vt', 1))
  check('BR-006 virtual tab entry ignored', s.state.back.length, 0)
  s.pushEntry(entry('file1', 5))
  check('BR-006 file entry still recorded', s.state.back.length, 1)
}

// isNavigating blocks pushes
{
  const s = createStore({ b1: { kind: 'file' } })
  s.begin()
  s.pushEntry(entry('b1', 5))
  check('isNavigating blocks push', s.state.back.length, 0)
  s.end()
  s.pushEntry(entry('b1', 5))
  check('isNavigating cleared allows push', s.state.back.length, 1)
}

// goBack pops, pushes current to forward, returns destination
{
  const s = createStore({ b1: { kind: 'file' } })
  s.pushEntry(entry('b1', 10))
  const dest = s.goBack(entry('b1', 99))
  check('goBack returns popped entry', dest && dest.line, 10)
  check('goBack back is empty', s.state.back.length, 0)
  check('goBack forward has current', s.state.forward.length, 1)
  check('goBack forward holds passed current', s.state.forward[0].line, 99)
}

// goBack with no currentPosition still pops
{
  const s = createStore({ b1: { kind: 'file' } })
  s.pushEntry(entry('b1', 7))
  const dest = s.goBack()
  check('goBack without currentPos still navigates', dest && dest.line, 7)
  check('goBack without currentPos leaves forward empty', s.state.forward.length, 0)
}

// goBack on empty stack returns null, leaves forward untouched
{
  const s = createStore({ b1: { kind: 'file' } })
  const dest = s.goBack(entry('b1', 5))
  check('goBack empty stack returns null', dest, null)
  check('goBack empty stack does not orphan currentPosition in forward', s.state.forward.length, 0)
}

// BR-007: lazy skip — single stale entry, one live underneath
{
  const s = createStore({ live: { kind: 'file' }, dead: undefined }) // dead is missing
  s.state.back = [entry('live', 10), entry('dead', 5)]
  const dest = s.goBack(entry('live', 99))
  check('BR-007 skips stale top entry', dest && dest.bufferId, 'live')
  check('BR-007 skipped entry discarded', s.state.back.length, 0)
}

// BR-007 (T25): skip multiple consecutive stale entries in one action
{
  const s = createStore({ live: { kind: 'file' } })
  // dead entries at top, live below
  s.state.back = [entry('live', 3), entry('dead1', 1), entry('dead2', 2)]
  const dest = s.goBack(entry('live', 99))
  check('T25 lazy-loop finds live entry', dest && dest.line, 3)
  check('T25 all entries consumed', s.state.back.length, 0)
  check('T25 forward has current', s.state.forward.length, 1)
}

// BR-007: all stale → null, forward is NOT orphaned with currentPosition
{
  const s = createStore({ alive: { kind: 'file' } })
  s.state.back = [entry('dead1', 1), entry('dead2', 2)]
  const dest = s.goBack(entry('alive', 50))
  check('All stale returns null', dest, null)
  check('All stale: currentPosition not left in forward', s.state.forward.length, 0)
  check('All stale: back drained', s.state.back.length, 0)
}

// canGoBack / canGoForward selectors
{
  const s = createStore({ live: { kind: 'file' } })
  check('canGoBack false on empty', s.canGoBack(), false)
  s.state.back = [entry('dead', 1)]
  check('canGoBack false when all stale', s.canGoBack(), false)
  s.state.back = [entry('dead', 1), entry('live', 2)]
  check('canGoBack true when live exists', s.canGoBack(), true)

  s.state.forward = []
  check('canGoForward false on empty', s.canGoForward(), false)
  s.state.forward = [entry('live', 3)]
  check('canGoForward true when live exists', s.canGoForward(), true)
}

// goForward symmetric
{
  const s = createStore({ b1: { kind: 'file' } })
  s.pushEntry(entry('b1', 10))
  s.goBack(entry('b1', 99))  // back=[], forward=[line 99]
  const dest = s.goForward(entry('b1', 10))
  check('goForward returns popped', dest && dest.line, 99)
  check('goForward pushed current back to back', s.state.back.length, 1)
  check('goForward forward drained', s.state.forward.length, 0)
}

// Back then Forward round-trips
{
  const s = createStore({ a: { kind: 'file' }, b: { kind: 'file' } })
  s.pushEntry(entry('a', 50))
  // user now at b:1
  const back1 = s.goBack(entry('b', 1))
  check('Round-trip: back destination is a:50', back1 && `${back1.bufferId}:${back1.line}`, 'a:50')
  const fwd = s.goForward(entry('a', 50))
  check('Round-trip: forward destination is b:1', fwd && `${fwd.bufferId}:${fwd.line}`, 'b:1')
}

// Column-difference on same line: deduped (BR-003)
{
  const s = createStore({ b1: { kind: 'file' } })
  s.pushEntry({ bufferId: 'b1', line: 5, column: 1, timestamp: 0 })
  s.pushEntry({ bufferId: 'b1', line: 5, column: 99, timestamp: 0 })
  check('BR-003 column ignored for dedupe', s.state.back.length, 1)
  check('BR-003 first-pushed kept (no replace on dedupe)', s.state.back[0].column, 1)
}

// Cross-buffer same-line: NOT deduped
{
  const s = createStore({ a: { kind: 'file' }, b: { kind: 'file' } })
  s.pushEntry(entry('a', 10))
  s.pushEntry(entry('b', 10))
  check('Cross-buffer same line: both recorded', s.state.back.length, 2)
}

if (failed > 0) {
  console.error(`\n${failed} assertion(s) failed`)
  process.exit(1)
}
console.log('\nAll tests passed.')
