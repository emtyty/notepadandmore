import { build } from 'esbuild'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = resolve(__dirname, '..')

// Bundle chardet and iconv-lite INTO the worker (self-contained).
// Only externalize Node built-ins and electron — they are always available.
await build({
  entryPoints: [resolve(root, 'src/main/ipc/searchWorker.ts')],
  outfile: resolve(root, 'out/workers/searchWorker.js'),
  bundle: true,
  platform: 'node',
  format: 'cjs',
  external: [
    'electron',
    'worker_threads',
    'fs', 'path', 'os', 'crypto', 'stream', 'util',
    'events', 'buffer', 'url', 'net', 'child_process'
  ],
  target: 'node18'
})

console.log('searchWorker.js built.')
