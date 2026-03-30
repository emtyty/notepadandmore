import { workerData, parentPort } from 'worker_threads'
import * as fs from 'fs'
import * as path from 'path'
import {
  FindInFilesOptions,
  FindResultFile,
  buildRegExp,
  parseFilter,
  collectFilesAsync,
  searchBuffer,
  FIND_IN_FILES_V2_CONCURRENCY
} from './findInFilesLogic'

interface WorkerInput {
  searchId: string
  opts: FindInFilesOptions
  progressEvery: number
}

type WorkerMessage =
  | { type: 'progress'; searchId: string; scanned: number }
  | { type: 'chunk'; searchId: string; file: FindResultFile }
  | { type: 'done'; searchId: string; totalHits: number; totalFiles: number; durationMs: number }
  | { type: 'error'; searchId: string; message: string }

function send(msg: WorkerMessage): void {
  parentPort!.postMessage(msg)
}

async function run(): Promise<void> {
  const { searchId, opts, progressEvery } = workerData as WorkerInput
  const t0 = Date.now()

  const re = buildRegExp(opts)
  if (!re) {
    send({ type: 'error', searchId, message: 'Invalid search pattern' })
    return
  }

  const filterRe = parseFilter(opts.fileFilter)

  let scanned = 0
  let totalHits = 0
  let totalFiles = 0

  // Feed files into a bounded queue so FIND_IN_FILES_V2_CONCURRENCY workers
  // process them in parallel without loading all paths into memory at once.
  const queue: string[] = []
  let done = false
  let resolveWaiter: (() => void) | null = null

  // Producer: iterate the async generator and push paths into the queue
  const producer = (async () => {
    for await (const fp of collectFilesAsync(opts.directory, filterRe, opts.isRecursive)) {
      queue.push(fp)
      resolveWaiter?.()
      resolveWaiter = null
    }
    done = true
    resolveWaiter?.()
    resolveWaiter = null
  })()

  // Consumer: pull from queue, read + search each file
  async function consumer(): Promise<void> {
    for (;;) {
      while (queue.length === 0 && !done) {
        await new Promise<void>((resolve) => { resolveWaiter = resolve })
      }
      if (queue.length === 0 && done) return

      const fp = queue.shift()!

      let raw: Buffer | null = null
      try {
        raw = await fs.promises.readFile(fp)
      } catch {
        // unreadable — skip
      }

      scanned++

      if (raw !== null) {
        re.lastIndex = 0
        const results = searchBuffer(raw, re)
        if (results.length > 0) {
          const file: FindResultFile = { filePath: fp, title: path.basename(fp), results }
          send({ type: 'chunk', searchId, file })
          totalHits += results.length
          totalFiles++
        }
      }

      if (scanned % progressEvery === 0) {
        send({ type: 'progress', searchId, scanned })
      }
    }
  }

  const consumers = Array.from({ length: FIND_IN_FILES_V2_CONCURRENCY }, () => consumer())
  await Promise.all([producer, ...consumers])

  send({ type: 'done', searchId, totalHits, totalFiles, durationMs: Date.now() - t0 })
}

run().catch((err: Error) => {
  const { searchId } = (workerData as WorkerInput) ?? { searchId: 'unknown' }
  send({ type: 'error', searchId, message: err.message })
})
