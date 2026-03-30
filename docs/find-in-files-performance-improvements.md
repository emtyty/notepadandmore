# Find in Files — Performance Improvements

## Tổng quan

Toàn bộ engine Find in Files được viết lại từ **Pull model** (request → block → response) sang **Push model** (Worker Thread + IPC streaming). Kết quả: không giới hạn số file, không block UI, kết quả hiện ra ngay khi tìm thấy.

---

## 1. Kiến trúc: Pull → Push (Streaming)

### Issue
`searchHandlers.ts` xử lý toàn bộ search **đồng bộ trong main process**, block IPC cho đến khi có kết quả. Renderer phải chờ response hoàn toàn mới cập nhật UI.

```
Renderer ──invoke──▶ Main (block ~seconds) ──response──▶ Renderer render
```

### Solution
Tách search ra **Worker Thread** riêng. Main process chỉ relay message. Renderer nhận kết quả theo từng chunk ngay khi tìm thấy.

```
Renderer ──start──▶ Main ──spawn──▶ Worker Thread
                                        │ chunk (mỗi file có match)
                                        │ progress (mỗi 50 files)
                     Main ◀────────────┘
Renderer ◀──push── Main (IPC push, non-blocking)
```

### Files thay đổi
| File | Thay đổi |
|---|---|
| `src/main/ipc/searchHandlers.ts` | Rewrite: bỏ toàn bộ logic search, chỉ quản lý Worker lifecycle |
| `src/main/ipc/searchWorker.ts` | **Mới** — toàn bộ search logic chạy trong Worker Thread |
| `src/main/ipc/findInFilesLogic.ts` | **Mới** — shared types + utilities (`buildRegExp`, `searchBuffer`, `parseFilter`, `collectFilesAsync`) |
| `src/renderer/src/hooks/useSearchEngine.ts` | Rewrite `findInFiles()`: từ `invoke` một lần sang lắng nghe `search:chunk` / `search:progress` / `search:done` |

### IPC channels mới
| Channel | Hướng | Mô tả |
|---|---|---|
| `search:find-in-files-start` | Renderer → Main | Bắt đầu search, trả về `searchId` |
| `search:cancel` | Renderer → Main | Hủy search đang chạy |
| `search:chunk` | Main → Renderer | Một file có kết quả (`FindResultFile`) |
| `search:progress` | Main → Renderer | Số file đã scan |
| `search:done` | Main → Renderer | Kết thúc, kèm stats |

---

## 2. Bỏ giới hạn 2000 files

### Issue
`searchHandlers.ts` hard-code `MAX_FILES = 2000`, slice array trước khi search. Với repo lớn, kết quả bị thiếu mà không có cảnh báo.

```ts
// Trước
const MAX_FILES = 2000
const limited = filePaths.slice(0, MAX_FILES)  // bỏ hết file từ 2001 trở đi
```

### Solution
Giới hạn này chỉ cần thiết để tránh timeout của pull model. Với push model không có timeout → xóa hoàn toàn.

```ts
// Sau — không còn slice, không còn constant
export const FIND_IN_FILES_MAX_FILES = 2000  // ← đã xóa
```

### Files thay đổi
| File | Thay đổi |
|---|---|
| `src/main/ipc/findInFilesLogic.ts` | Xóa `FIND_IN_FILES_MAX_FILES` |
| `src/main/ipc/searchWorker.ts` | Xóa `filePaths.slice(0, FIND_IN_FILES_MAX_FILES)` |

---

## 3. File collection: Sync → Async Generator (zero RAM overhead)

### Issue
`collectFiles()` dùng `readdirSync` — blocking, load **toàn bộ file path** vào một mảng trong RAM trước khi bắt đầu search. Với 50k+ files, mảng này có thể chiếm hàng chục MB.

```ts
// Trước — load hết rồi mới search
function collectFiles(dir, filterRe, recursive): string[] {
  const results: string[] = []  // tất cả paths nằm đây
  function walk(current) { /* readdirSync */ }
  walk(dir)
  return results  // return xong mới search
}
```

### Solution
Đổi thành **async generator** — yield từng path ngay khi tìm thấy, kết hợp producer/consumer pattern. Không cần lưu toàn bộ path vào RAM.

```ts
// Sau — yield từng path, search song song ngay lập tức
async function* collectFilesAsync(dir, filterRe, recursive): AsyncGenerator<string> {
  async function* walk(current) {
    const entries = await fs.promises.readdir(current, { withFileTypes: true })
    for (const entry of entries) {
      if (entry.isFile()) yield path.join(current, entry.name)
      if (entry.isDirectory() && recursive) yield* walk(full)
    }
  }
  yield* walk(dir)
}
```

Worker dùng **producer/consumer** với bounded queue để 6 consumer đọc file song song:

```
Generator (producer) ──push──▶ queue ──pull──▶ consumer × 6 (concurrent reads)
```

### Files thay đổi
| File | Thay đổi |
|---|---|
| `src/main/ipc/findInFilesLogic.ts` | `collectFiles()` sync → `collectFilesAsync()` async generator |
| `src/main/ipc/searchWorker.ts` | Producer/consumer pattern thay vì `for...of` array |

---

## 4. Build system: Worker tách riêng khỏi electron-vite

### Issue
`searchWorker.ts` không được build thành file riêng. `electron-vite dev` xóa `out/main/` mỗi lần rebuild, nếu worker build trước thì bị mất.

```
npm run dev:
  build-worker.mjs → out/main/searchWorker.js  ✓
  electron-vite dev → xóa out/main/ → rebuild index.js  ✗  (worker gone)
```

### Solution
Đưa worker vào **thư mục riêng** `out/workers/` — electron-vite không bao giờ quản lý thư mục này. Build worker bằng `esbuild` qua `scripts/build-worker.mjs` (bundle `chardet` + `iconv-lite` vào trong worker, tự chứa).

```
dev:   build-worker → out/workers/searchWorker.js
       electron-vite dev → out/main/index.js   (không đụng out/workers/)

build: electron-vite build → out/main/index.js
       build-worker → out/workers/searchWorker.js
```

### Files thay đổi
| File | Thay đổi |
|---|---|
| `scripts/build-worker.mjs` | **Mới** — esbuild script, output `out/workers/searchWorker.js` |
| `src/main/ipc/searchHandlers.ts` | Worker path: `../workers/searchWorker.js` |
| `electron-vite.config.ts` | Bỏ rollupOptions.input phức tạp, về config đơn giản |
| `package.json` | `dev`: build-worker trước; `build`: build-worker sau electron-vite |

---

## Tóm tắt so sánh

| Tiêu chí | Trước | Sau |
|---|---|---|
| Model | Pull (request-response) | Push (streaming) |
| Giới hạn files | **2000** | **Không giới hạn** |
| Block main process | Có (suốt thời gian search) | Không (Worker Thread) |
| Kết quả hiển thị | Sau khi search xong | **Ngay khi tìm thấy** (per-file) |
| RAM (file paths) | Load toàn bộ vào array | **Async generator**, O(1) |
| Concurrent reads | 1 (sequential) | **6 concurrent** |
| Có thể hủy | Không | Có (`search:cancel` → `worker.terminate()`) |
| Worker build | Trong electron-vite bundle | **Tách riêng** `out/workers/` |
