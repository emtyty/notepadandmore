# Logging Rules — CF Desktop

> Skill cho Claude Code và reference cho developers khi thêm logging vào features mới.
> Logger đã implement trong `packages/core/src/logger/`. Đây là cách dùng đúng.

---

## Quick reference

```typescript
import { createLogger, createCorrelationId, pii } from '@cf/core'

// Tạo child logger cho module
const log = logger.child('my-module')

// Log cơ bản
log.info('Something happened')
log.info('With data', { key: 'value', count: 42 })
log.error('Failed', { error: err.message })

// Critical — flush ngay, dùng cho events không được mất
log.critical('Force logout triggered')

// PII — file names, user info, emails
log.info('Upload started', { fileName: pii('client_shoot.psd'), userId: pii('user@studio.com') })

// Correlation — trace xuyên retry chain
const cid = createCorrelationId()
const log = logger.child('auth', cid)
log.info('Login started')      // cid tự gắn vào mọi entry
log.info('Token received')     // grep cid sẽ thấy cả chain
```

---

## Rules

### 1. Dùng child logger, không dùng root logger trực tiếp

```typescript
// ✅ Đúng — scoped, dễ filter
const log = logger.child('auth')
log.info('Login started')

// ❌ Sai — module name lặp lại, dễ typo
logger.info('auth', 'Login started')
logger.info('Auth', 'Token received')  // inconsistent casing
```

Mỗi file hoặc class tạo child logger 1 lần ở đầu, dùng xuyên suốt. Module name luôn lowercase, dùng `:` phân cấp: `auth`, `auth:refresh`, `network`, `dotnet:uploader`.

### 2. Log TRƯỚC khi execute, không phải sau

```typescript
// ✅ Đúng — nếu crash giữa upload, log vẫn có entry
log.info('Upload starting', { taskId, fileName: pii(name), fileSize })
await uploadFile(...)
log.info('Upload complete', { taskId, duration })

// ❌ Sai — crash giữa upload = không có log gì
await uploadFile(...)
log.info('Upload complete', { taskId })
```

Pattern "write-before-action" đảm bảo post-mortem debugging luôn có context. Đặc biệt quan trọng cho: auth flows, file transfer, .NET service spawn, IPC calls.

### 3. Structured data, không string interpolation

```typescript
// ✅ Đúng — grep được, parse được, filter được
log.info('Request failed', { status: 429, path: '/workflows', attempt: 2, willRetry: true })

// ❌ Sai — phải regex mới extract được thông tin
log.info(`Request to /workflows failed with 429 on attempt 2, will retry`)
```

Data fields phải là primitives hoặc plain objects. Không log Error objects trực tiếp — extract `.message` và `.code`.

### 4. Tag PII bằng `pii()`, không bao giờ log raw

```typescript
// ✅ Đúng — transport quyết định strip hay giữ
log.info('User logged in', { userId: pii(user.id), email: pii(user.email) })

// ❌ Sai — PII trong log file, vi phạm data policy
log.info('User logged in', { userId: user.id, email: user.email })
```

Những gì cần `pii()`:
- User ID, email, display name
- File paths chứa tên client/project (ví dụ `client_shoot.psd`)
- Project names, workspace names
- IP addresses
- Bất kỳ data nào identify được người dùng

Những gì KHÔNG cần `pii()`:
- Task IDs, correlation IDs
- File sizes, durations, status codes
- Module names, error codes
- Environment names (dev/uat/prod)

### 5. Correlation ID cho mọi user-initiated flow

```typescript
// ✅ Đúng — trace được toàn bộ login journey
export async function performLogin(config, logger) {
  const cid = createCorrelationId()
  const log = logger.child('auth', cid)
  
  log.info('Login started', { env: config.env })
  // ... mọi log.info/warn/error sau đều có cùng cid
}

// ❌ Sai — không biết log entry nào thuộc flow nào
export async function performLogin(config, logger) {
  logger.info('auth', 'Login started')
  // ... 
  logger.info('auth', 'Token received')  // cùng module nhưng từ flow nào?
}
```

Correlation ID cần cho: login, token refresh, API request chain (retry/fallback), file upload/download, .NET service lifecycle.

### 6. Chọn đúng log level

| Level | Khi nào | Ví dụ |
|-------|---------|-------|
| `debug` | Chi tiết kỹ thuật, chỉ cần khi debug | IPC message payload, response headers, cache hit/miss |
| `info` | Event quan trọng trong business flow | Login started, upload complete, service started |
| `warn` | Bất thường nhưng app vẫn hoạt động | Retry triggered, rate limit hit, fallback activated |
| `error` | Lỗi cần xử lý | API 500, refresh failed, .NET service crash |
| `critical` | Lỗi nghiêm trọng ảnh hưởng user | Force logout, data corruption, unrecoverable state |

**Quy tắc ngón cái**: Production chạy level `info`. Nếu log entry không cần thiết khi debug production issue → nó là `debug`. Nếu user bị ảnh hưởng → ít nhất `warn`.

### 7. `critical()` chỉ cho events không được mất

```typescript
// ✅ Đúng — force logout phải ghi xong trước khi clear session
log.critical('Force logout — 3 consecutive refresh failures')
clearSession()

// ❌ Sai — dùng critical cho event bình thường
log.critical('User clicked button')  // đây là info
```

`critical()` flush buffer ngay lập tức, đảm bảo entry ghi vào disk trước khi code tiếp tục. Dùng cho: force logout, unhandled exception, data integrity events, app crash recovery.

### 8. Error logging — extract, không throw vào log

```typescript
// ✅ Đúng — structured, searchable
try {
  await apiCall()
} catch (error) {
  log.error('API call failed', {
    error: (error as Error).message,
    code: (error as ApiError).status,
    path: '/workflows',
  })
}

// ❌ Sai — error object có circular refs, không serialize được
try {
  await apiCall()
} catch (error) {
  log.error('API call failed', { error })  // có thể crash logger
}
```

### 9. Retry chain — log mỗi attempt với attempt number

```typescript
// ✅ Đúng — thấy rõ retry journey
log.info('Request attempt', { correlationId: cid, attempt: 1, path })
// ... fail
log.warn('Request failed, retrying', { correlationId: cid, attempt: 1, status: 429, willRetry: true })
log.info('Request attempt', { correlationId: cid, attempt: 2, path })
// ... success
log.info('Request success', { correlationId: cid, attempt: 2, status: 200, duration: 234 })
```

Mỗi retry entry phải có: `correlationId`, `attempt`, lý do retry, và `willRetry` boolean.

### 10. Không log high-frequency events ở level info

```typescript
// ❌ Sai — file watcher có thể emit hàng trăm events/giây
fileWatcher.on('change', (path) => {
  log.info('File changed', { path })
})

// ✅ Đúng — debug level + module verbose gate
fileWatcher.on('change', (path) => {
  log.debug('File changed', { path })
})

// Hoặc: batch log
let changeCount = 0
fileWatcher.on('change', () => { changeCount++ })
setInterval(() => {
  if (changeCount > 0) {
    log.info('Files changed', { count: changeCount })
    changeCount = 0
  }
}, 5000)
```

High-frequency sources: file watcher events, WebSocket messages, progress updates, mouse/keyboard events. Dùng `debug` level hoặc batch.

### 11. .NET service logs — dùng `captureDotnetLogs`, không log manually

```typescript
// ✅ Đúng — tự parse level từ stdout, unified format
import { captureDotnetLogs } from '@cf/core'
const proc = spawn(binaryPath, args)
captureDotnetLogs(proc, 'uploader', logger)

// ❌ Sai — tự pipe stdout, mất level parsing
proc.stdout.on('data', (chunk) => {
  console.log('[uploader]', chunk.toString())
})
```

### 12. Renderer logs — luôn đi qua IPC transport

Renderer không ghi file trực tiếp. Mọi log entry gửi về main process qua IPC, main process ghi vào cùng log file. Điều này đảm bảo: ordering đúng giữa main/renderer, single write point, không race condition trên file.

```typescript
// Renderer setup — đã wire sẵn, chỉ cần import và dùng
import { logger } from '@/setup'  // hoặc từ app-level export
const log = logger.child('kanban')
log.info('Workflows loaded', { count: workflows.length })
```

### 13. Startup profiling — đặt checkpoint ở mọi phase quan trọng

```typescript
import { checkpoint } from '@cf/core'

// Đặt ở boundaries, không phải giữa function
checkpoint('electron_ready')      // ✅ Clear boundary
checkpoint('auth_restored')       // ✅ Clear boundary
checkpoint('step_3_substep_2')    // ❌ Quá chi tiết
```

Checkpoints chuẩn cho Electron app: `main_entry`, `imports_done`, `electron_ready`, `token_store_ready`, `dotnet_started`, `window_created`, `renderer_ready`, `first_paint`.

---

## Module name conventions

| Module | Dùng cho |
|--------|----------|
| `app` | App lifecycle: startup, shutdown, window management |
| `auth` | Login, logout, session restore |
| `auth:refresh` | Token refresh task |
| `network` | API requests, responses, retry |
| `network:queue` | Request queue, concurrency |
| `store` | State changes (qua Zustand middleware) |
| `ipc` | IPC messages giữa main/renderer |
| `dotnet:{service}` | .NET service logs (uploader, downloader, watcher, cleanup) |
| `task:{type}` | Task lifecycle (upload, download, export) |
| `startup` | Startup profiling report |
| `kanban` | Kanban page operations (renderer) |
| `workflow` | Workflow operations (renderer) |

---

## Env vars cho debugging

Bật khi cần, không ảnh hưởng production:

```bash
# Verbose toàn bộ
CF_LOG_LEVEL=debug pnpm dev:studio

# Verbose cho 1 module
CF_LOG_NETWORK=1 pnpm dev:studio
CF_LOG_AUTH=1 pnpm dev:studio
CF_LOG_IPC=1 pnpm dev:studio
CF_LOG_DOTNET=1 pnpm dev:studio

# Startup profiling
CF_PROFILE_STARTUP=1 pnpm dev:studio

# Custom log directory
CF_LOG_DIR=/tmp/cf-logs pnpm dev:studio
```

---

## Log output format

### File (JSONL) — production

```jsonl
{"ts":1712345678901,"level":"info","mod":"auth","msg":"Login started","cid":"a1b2c3d4","data":{"env":"dev"}}
{"ts":1712345679050,"level":"info","mod":"auth","msg":"Token received","cid":"a1b2c3d4"}
{"ts":1712345679200,"level":"info","mod":"auth","msg":"Login complete","cid":"a1b2c3d4","data":{"userId":"[redacted]"}}
```

Field names ngắn (`ts`, `mod`, `msg`, `cid`, `sid`, `proc`) để tiết kiệm disk. Mỗi dòng là một JSON object hoàn chỉnh — `grep` + `jq` friendly.

### Console — development

```
14:23:45.123 [INFO ] auth (a1b2c3d4) — Login started {"env":"dev"}
14:23:45.234 [INFO ] auth (a1b2c3d4) — Token received
14:23:45.345 [INFO ] auth (a1b2c3d4) — Login complete {"userId":"user@studio.com"}
```

PII được resolve (hiển thị raw) trong dev console. PII được strip trong production file logs.

### Log file location

```
~/.cf-studio/logs/
├── 2026/
│   └── 04/
│       ├── 2026-04-01.jsonl
│       ├── 2026-04-02.jsonl
│       └── 2026-04-03.jsonl    ← Today
```

Daily rotation, max 50MB per file (safety cap).

---

## Patterns by feature type

### Adding logging to a new API endpoint consumer

```typescript
import { logger, createCorrelationId, pii } from '@cf/core'

export function useWorkflows() {
  return useQuery({
    queryKey: ['workflows'],
    queryFn: async ({ signal }) => {
      const cid = createCorrelationId()
      const log = logger.child('workflow', cid)
      
      log.info('Fetching workflows')
      const result = await apiClient.get('/workflows', { schema, signal, priority: 5 })
      log.info('Workflows loaded', { count: result.items.length })
      
      return result
    },
  })
}
```

### Adding logging to a background task

```typescript
import { logger } from '@cf/core'

export function createSyncTask(logger: Logger) {
  const log = logger.child('sync')

  return {
    async tick() {
      log.debug('Sync tick started')
      
      try {
        const changes = await checkForChanges()
        if (changes.length === 0) {
          log.debug('No changes')  // debug, not info — runs every N seconds
          return
        }
        
        log.info('Syncing changes', { count: changes.length })
        await applyChanges(changes)
        log.info('Sync complete', { count: changes.length })
        
      } catch (error) {
        log.error('Sync failed', { error: (error as Error).message })
      }
    }
  }
}
```

### Adding logging to a .NET service integration

```typescript
import { captureDotnetLogs, logger } from '@cf/core'

function startUploaderService(): ChildProcess {
  const log = logger.child('dotnet:uploader')
  
  log.info('Starting uploader service', { binaryPath, args })
  const proc = spawn(binaryPath, args)
  captureDotnetLogs(proc, 'uploader', logger)
  
  proc.on('error', (error) => {
    log.error('Failed to start', { error: error.message })
  })
  
  return proc
}
```

### Adding logging to IPC handlers

```typescript
import { logger } from '@cf/core'

const log = logger.child('ipc')

ipcMain.handle('auth:login', async (_event) => {
  log.info('auth:login received')
  
  try {
    const result = await performLogin(config, logger)
    log.info('auth:login success')
    return { success: true, user: result.user }
  } catch (error) {
    log.error('auth:login failed', { error: (error as Error).message })
    return { success: false, error: (error as Error).message }
  }
})
```

---

## Checklist khi thêm logging vào feature mới

- [ ] Tạo child logger với module name đúng convention
- [ ] Log trước action (write-before-action)
- [ ] Structured data, không string interpolation
- [ ] PII tagged cho user data, file paths chứa tên client
- [ ] Correlation ID cho flows có retry/multi-step
- [ ] Error entries extract `.message` và `.code`, không log raw Error
- [ ] High-frequency events dùng `debug` level hoặc batch
- [ ] `critical()` chỉ cho events ảnh hưởng user nghiêm trọng
- [ ] Retry log có attempt number và willRetry flag
