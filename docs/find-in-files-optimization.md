# Find in Files — Optimization Report

## Benchmark

| | Before | After |
|---|---|---|
| Search "code" / 2315 files | ~10,200ms | **341ms** |
| Directory walk | ~713ms | ~272ms |
| Actual search | ~9,500ms | ~70ms |
| **Speedup** | — | **~30x** |

---

## Architecture (không đổi)

```
Renderer (React)
  └─ IPC: search:find-in-files-start
       └─ Main Process (searchHandlers.ts)
            └─ Worker Thread (searchWorker.ts)
                 ├─ Producer: collectFilesAsync() — walk directory
                 └─ N Consumers: readFile() → searchBuffer() → send chunk
                      └─ Main Process → IPC → Renderer
                           └─ Batch flush 200ms → Zustand store
                                └─ FindResultsPanel (virtual list)
```

---

## Flow trước khi optimize

### Worker (searchWorker.ts)

```
Producer: walk dir → push path vào queue[]
          yield mỗi 64 dir visits

Consumer (×6):
  1. Lấy file từ queue
  2. fs.readFile(fp)                        ← async I/O
  3. chardet.detect(raw)                    ← scan TOÀN BỘ buffer (bottleneck chính)
  4. iconv.decode(raw, encoding)
  5. content.slice(0,8192).includes('\0')   ← binary check SAU decode
  6. content.split(/\r?\n/)                 ← allocate array O(lines)
  7. for each line: regex.exec(line)
  8. send chunk nếu có kết quả

resolveWaiter: single slot
  → consumer sau ghi đè consumer trước
  → lost wakeup khi queue rỗng
```

### Renderer (useSearchEngine.ts + FindResultsPanel.tsx)

```
search:chunk event → appendFindResultFile(file) mỗi chunk
  → Zustand setState() mỗi chunk (840 lần)
  → React re-render mỗi lần (ngày càng nặng, O(n²))
  → Render toàn bộ 7582 DOM nodes cùng lúc (freeze)
```

---

## Flow sau khi optimize

### Worker

```
Producer: walk dir → push path vào queue[]
          notify waiters[] khi push

Consumer (×16):                             ← tăng từ 6
  1. Lấy file từ queue
  2. fs.readFile(fp)                        ← async I/O
  3. detectEncodingFast(raw):
     a. scan 4KB đầu → null byte? → skip (binary)
     b. scan 1KB đầu → toàn ASCII? → trả 'UTF-8' ngay
     c. có byte > 127 → chardet chỉ trên 4KB sample
  4. iconv.decode(raw, encoding)
  5. indexOf('\n') loop:                    ← không allocate array
     for each line: regex.exec(lineText)
  6. send chunk nếu có kết quả

waiters[]: array of resolve functions
  → mỗi item push wake đúng 1 consumer (FIFO)
  → done=true wake tất cả consumers
```

### Renderer

```
search:chunk event → chunkBufferRef.push(file)   ← không setState
setInterval(200ms) → flushBuffer():
  → appendFindResultFiles(batch[])               ← 1 setState cho N files
  → ~6-8 re-renders thay vì 840

FindResultsPanel:
  → useMemo: flatten files[] thành rows[] phẳng
  → useVirtualizer: chỉ render ~15-20 DOM nodes visible
  → collapse state: Set<filePath>
```

---

## Chi tiết từng optimization

### 1. `detectEncodingFast()` — impactful nhất

**Trước:**
```ts
const encoding = chardet.detect(raw) || 'UTF-8'  // O(fileSize)
```

**Sau:**
```ts
// Binary check: 4KB đầu có null byte → skip
// ASCII fast-path: 1KB đầu toàn byte ≤ 127 → UTF-8 ngay
// Fallback: chardet chỉ trên 4KB sample
```

File 2MB: chardet từ O(2MB) → O(4KB) = **~500x faster per file**.

---

### 2. Index-based line scanner

**Trước:**
```ts
const lines = content.split(/\r?\n/)   // N string allocations
for (let i = 0; i < lines.length; i++) { ... }
```

**Sau:**
```ts
let lineStart = 0
while (lineStart <= len) {
  const lineEnd = content.indexOf('\n', lineStart)
  const lineText = content.slice(lineStart, lineEnd)
  // search lineText
  lineStart = lineEnd + 1
}
```

Loại bỏ hoàn toàn array O(lines). File 50K dòng = 50K string allocations bị xóa.

---

### 3. `waiters[]` thay `resolveWaiter` single slot

**Trước:** 2 consumers đồng thời set `resolveWaiter` → consumer trước bị lost wakeup → stall.

**Sau:** Array FIFO — mỗi item push wake đúng 1 consumer, `done=true` wake tất cả.

---

### 4. Concurrency 6 → 16

Node.js worker thread: consumers không chạy song song CPU, nhưng xen kẽ nhau tại `await readFile()`. Concurrency cao hơn = nhiều I/O requests in-flight hơn = overlap disk latency tốt hơn.

---

### 5. Batch chunk flush (Renderer)

840 Zustand updates → ~6-8 updates (flush mỗi 200ms). Giảm React re-renders từ O(n²) → O(1) per flush.

---

### 6. Virtual list (Renderer)

7582 DOM nodes → ~15-20 DOM nodes visible tại bất kỳ thời điểm nào.
Flat row model: `file-header | result-line | result-line | file-header | ...`
Collapse state tách biệt → `useMemo` chỉ rebuild khi files hoặc collapsed thay đổi.

---

## Edge cases sẽ không handle được

### Encoding detection

| Case | Mô tả | Hậu quả |
|---|---|---|
| File ASCII đầu, non-ASCII giữa | 1KB đầu toàn ASCII → fast-path UTF-8, phần sau có byte > 127 | Decode sai encoding nếu thực ra là Windows-1252/Latin-1 → miss kết quả |
| File GB2312/Shift-JIS cần nhiều bytes để detect | chardet sample 4KB có thể không đủ context | Detect sai encoding → text lỗi trong kết quả |
| File UTF-16 (BOM ở byte 0-1) | BOM = `FF FE` hoặc `FE FF`, không phải null byte | Không bị skip, nhưng chardet trên 4KB thường detect đúng UTF-16 |

**Affected files:** Văn bản đa ngôn ngữ (tiếng Trung, Nhật, Hàn, hoặc file Windows legacy encoding). Source code tiếng Anh/ASCII không bị ảnh hưởng.

---

### Line endings

| Case | Mô tả | Hậu quả |
|---|---|---|
| `\r`-only (Mac Classic ≤ OS 9) | `indexOf('\n')` không tìm thấy line breaks | Toàn bộ file bị coi là 1 dòng dài — regex vẫn match nhưng lineNumber luôn = 1 |

**Xác suất gặp:** Cực thấp — format này đã lỗi thời từ năm 2001.

---

### File size

| Case | Mô tả | Hậu quả |
|---|---|---|
| File rất lớn (>50MB) | `fs.readFile()` load toàn bộ vào RAM | Memory spike trong worker; không có giới hạn kích thước |
| File có 1 dòng rất dài (>500 chars) | `lineText.slice(0, 500) + '…'` | Kết quả bị truncate — match có thể không hiển thị đầy đủ |

---

### Concurrency trên HDD

Concurrency 16 tối ưu cho SSD. Trên **HDD cơ**, nhiều concurrent reads gây disk head seek liên tục → có thể **chậm hơn** concurrency 4-6.

---

### Virtual list + Collapse

Khi user collapse 1 file group → `rows[]` rebuild toàn bộ từ đầu (useMemo). Với 840 files và 7582 rows, rebuild ~microseconds — không đáng kể. Nhưng nếu số files lên đến hàng chục nghìn thì có thể cảm nhận được.

---

## Kết luận

Optimization tập trung vào **happy path** (source code ASCII/UTF-8, SSD, file size vừa phải) — đây là 99%+ use case thực tế của Notepad++.

Trade-off chính là độ chính xác encoding detection giảm nhẹ cho các file văn bản legacy encoding. Nếu cần hỗ trợ tốt hơn, có thể tăng ASCII sample từ 1KB → 4KB mà vẫn nhanh hơn chardet full-buffer nhiều lần.
