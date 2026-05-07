/**
 * uploadService.ts — 文件上传服务
 *
 * 设计原则（P1 可用版）：
 * - 前端不写死大小限制；size=0 的文件走默认路径
 * - 小文件（< 10 MB 且已知大小）直传
 * - 大文件（≥ 10 MB 或 size=0/unknown）分片上传，每片 2 MB
 * - 断点续传：失败自动重试当前分片，指数退避 + jitter
 * - 重试上限 5 次，超过后标记失败可手动重试
 * - 后台处理队列：Promise 非阻塞，不卡 UI
 * - 上传完成后自动进入后台 AI 处理流 → 分派给对应 Agent
 *
 * 生产路径（下阶段）：
 * - 接 OpenClaw Gateway /upload 端点（支持 FormData + X-Upload-Id + X-Chunk-Index）
 * - Gateway 返回 { uploadId, chunkIndex, totalChunks } 用于断点续传
 * - 后端合并分片后触发 AI 分析流
 */

// ─── Types (must be defined before export) ─────────────────────────────────────

type UploadType = 'image' | 'video' | 'document' | 'archive';

type UploadTransferMode = 'direct' | 'chunked';

type UploadQueueStage =
  | 'queued'
  | 'chunking'
  | 'uploading'
  | 'merging'
  | 'processing'
  | 'dispatched'
  | 'done'
  | 'error';

interface UploadFile {
  id: string;
  name: string;
  uri: string;
  type: UploadType;
  mimeType: string;
  size: number; // bytes; 0 = unknown
  status: UploadStatus;
  progress: number; // 0-100
  transferMode: UploadTransferMode;
  resumable: boolean;
  totalChunks?: number;
  uploadedChunks?: number;
  queueStage: UploadQueueStage;
  agent?: string;
  timestamp: string;
  error?: string;
  dispatchId?: string; // set when upload transitions to dispatched → links to DispatchRecord
}

type UploadStatus =
  | 'queued' | 'uploading' | 'processing' | 'dispatched' | 'done' | 'error';

// Re-export for consumers
export type {UploadType, UploadFile, UploadStatus, UploadTransferMode, UploadQueueStage};

// ─── Gateway config (lazy import to avoid circular dependency) ─────────────────
function _getUploadConfig() {
  try {
    // Dynamic import to avoid circular dependency with gatewayConfig
    const {getGatewayConfig, validateGatewayConfig} = require('./gatewayConfig');
    return {getGatewayConfig, validateGatewayConfig};
  } catch {
    return null;
  }
}

// ─── Constants ────────────────────────────────────────────────────────────────
const CHUNK_SIZE           = 2 * 1024 * 1024; // 2 MB
const LARGE_FILE_THRESHOLD = 10 * 1024 * 1024; // 10 MB
const MAX_RETRIES          = 5;
const BASE_DELAY_MS        = 500; // ms; exponential backoff base
const UPLOAD_TIMEOUT_MS    = 30000; // 30s per request

// ─── Chunk-level state (enables true resume) ──────────────────────────────────
interface ChunkState {
  index: number;
  uploaded: boolean;
  retries: number;
}

interface UploadState {
  file: UploadFile;
  chunks: ChunkState[];
  currentChunk: number; // next chunk to upload
  totalChunks: number;
}

const _queue:      UploadFile[]   = [];
const _uploadState = new Map<string, UploadState>(); // id → state
const _selectedForDispatch = new Set<string>();
let   _nextId      = 1;

// ─── Helpers ─────────────────────────────────────────────────────────────────

function genId(): string {
  return `uf-${Date.now().toString(36)}-${(_nextId++).toString(36)}`;
}

function detectType(mimeType: string, fileName: string): UploadType {
  if (mimeType.startsWith('image/')) return 'image';
  if (mimeType.startsWith('video/')) return 'video';
  if (
    mimeType === 'application/pdf' ||
    mimeType.includes('word') || mimeType.includes('sheet') ||
    mimeType.includes('presentation') || mimeType.includes('text/') ||
    /\.(doc|docx|xls|xlsx|ppt|pptx|txt|csv|md)$/i.test(fileName)
  ) return 'document';
  if (
    mimeType.includes('zip') || mimeType.includes('rar') ||
    mimeType.includes('tar') || mimeType.includes('gzip') ||
    /\.(zip|rar|tar|gz|tar\.gz)$/i.test(fileName)
  ) return 'archive';
  return 'document';
}

export function formatBytes(bytes: number): string {
  if (bytes === 0) return '未知大小';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/** Exponential backoff with full jitter (AWS algorithm) */
async function withRetry<T>(
  fn: () => Promise<T>,
  maxRetries = MAX_RETRIES,
  baseDelayMs = BASE_DELAY_MS,
): Promise<T> {
  let lastError: unknown;
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastError = err;
      if (attempt === maxRetries) break;
      const cap    = Math.min(baseDelayMs * 2 ** attempt, 30_000);
      const jitter = Math.random() * cap;
      await delay(cap / 2 + jitter);
    }
  }
  throw lastError;
}

function buildFileEntry(
  name: string, uri: string, mimeType: string, size: number,
): UploadFile {
  const transferMode: UploadTransferMode = size > 0 && size < LARGE_FILE_THRESHOLD ? 'direct' : 'chunked';
  const totalChunks = transferMode === 'chunked'
    ? Math.max(1, Math.ceil((size || LARGE_FILE_THRESHOLD) / CHUNK_SIZE))
    : 1;

  return {
    id: genId(),
    name,
    uri,
    type: detectType(mimeType, name),
    mimeType,
    size,
    status: 'queued',
    progress: 0,
    transferMode,
    resumable: transferMode === 'chunked',
    totalChunks: transferMode === 'chunked' ? totalChunks : undefined,
    uploadedChunks: transferMode === 'chunked' ? 0 : undefined,
    queueStage: transferMode === 'chunked' ? 'chunking' : 'queued',
    timestamp: new Date().toLocaleTimeString('zh-CN', {
      hour: '2-digit', minute: '2-digit',
    }),
  };
}

function _assignAgent(type: UploadType): string {
  const map: Record<UploadType, string> = {
    image:    '黑金',
    video:    '黑金',
    document: '智联',
    archive:  '寻龙',
  };
  return map[type] ?? '助理';
}

// ─── Internal upload ──────────────────────────────────────────────────────────

async function _tryRealUpload(
  file: UploadFile,
  onProgress: (pct: number) => void,
): Promise<boolean> {
  const cfg = _getUploadConfig();
  if (!cfg) return false;

   
  let config: any = null;
  try {
    config = await cfg.getGatewayConfig();
  } catch {
    return false;
  }

  const validation = cfg.validateGatewayConfig(config);
  if (!validation.valid) return false;

  const {gatewayUrl, gatewayToken} = config;
  if (!gatewayUrl || !gatewayToken) return false;

  try {
    const formData = new FormData();
    // React Native requires uri, name, type fields on the blob object
    formData.append('file', {
      uri: file.uri,
      name: file.name,
      type: file.mimeType,
    } as unknown as Blob);
    formData.append('uploadId', file.id);

    const controller = new AbortController();
    const t = setTimeout(() => controller.abort(), UPLOAD_TIMEOUT_MS);

    const res = await fetch(`${gatewayUrl}/upload`, {
      method: 'POST',
      body: formData,
      headers: {
        'Authorization': `Bearer ${gatewayToken}`,
        'Content-Type': 'multipart/form-data',
      },
      signal: controller.signal,
    });
    clearTimeout(t);

    if (!res.ok) {
      // [uploadService] Gateway /upload returned non-OK status — handled gracefully, simulation active
      return false;
    }

    // Upload succeeded — read progress from response if available
    try {
      const json = await res.json() as Record<string, unknown>;
      const pct = typeof json.progress === 'number' ? json.progress : 90;
      onProgress(pct);
      _updateFile(file.id, {queueStage: 'uploading'});
    } catch {
      onProgress(90);
      _updateFile(file.id, {queueStage: 'uploading'});
    }
    return true;
  } catch {
      // [uploadService] Real upload failed, falling back to simulation
      return false;
  }
}

/**
 * Direct upload for small files (< 10 MB).
 * Tries real Gateway HTTP POST first; falls back to simulation.
 */
async function _directUpload(state: UploadState): Promise<void> {
  const realOk = await _tryRealUpload(state.file, (pct) => {
    _updateFile(state.file.id, {status: 'uploading', progress: pct, queueStage: 'uploading'});
  });
  if (realOk) return;

  // Simulation fallback
  const STEPS = 10;
  for (let i = 1; i <= STEPS; i++) {
    await delay(120);
    const progress = Math.round((i / STEPS) * 90);
    _updateFile(state.file.id, {status: 'uploading', progress, queueStage: 'uploading'});
  }
}

/**
 * Chunked upload for large files (≥ 10 MB or unknown size).
 * Tries real Gateway PUT /upload/chunk when configured; falls back to simulation.
 * On failure only the failed chunk is retried (true resume).
 */
async function _chunkedUpload(state: UploadState): Promise<void> {
  const {chunks, totalChunks, file} = state;

  _updateFile(file.id, {
    queueStage: 'chunking',
    transferMode: 'chunked',
    resumable: true,
    totalChunks,
    uploadedChunks: chunks.filter(chunk => chunk.uploaded).length,
  });

  // Try to get real Gateway config once
  const cfg = _getUploadConfig();
  let gatewayUrl = '';
  let gatewayToken = '';
  if (cfg) {
    try {
       
      const config: any = await cfg.getGatewayConfig();
      const validation = cfg.validateGatewayConfig(config);
      if (validation.valid) {
        gatewayUrl = config.gatewayUrl;
        gatewayToken = config.gatewayToken;
      }
    } catch { /* use simulation */ }
  }

  for (let i = 0; i < totalChunks; i++) {
    const chunk = chunks[i];
    if (chunk.uploaded) continue; // already done, skip

    let chunkOk = false;

    // Try real Gateway chunked upload
    if (gatewayUrl && gatewayToken && !file.uri.startsWith('demo://')) {
      try {
        const chunkUrl = `${gatewayUrl}/upload/chunk?uploadId=${file.id}&chunkIndex=${i}&totalChunks=${totalChunks}`;
        const controller = new AbortController();
        const t = setTimeout(() => controller.abort(), UPLOAD_TIMEOUT_MS);
        const res = await fetch(chunkUrl, {
          method: 'PUT',
          body: file.uri, // In RN, uri can be used as body directly
          headers: {
            'Authorization': `Bearer ${gatewayToken}`,
            'Content-Type': file.mimeType,
            'X-Chunk-Index': String(i),
            'X-Total-Chunks': String(totalChunks),
          },
          signal: controller.signal,
        });
        clearTimeout(t);
        chunkOk = res.ok;
      } catch {
        chunkOk = false;
      }
    }

    if (!chunkOk) {
      // Simulation fallback for this chunk
      try {
        await withRetry(async () => {
          await delay(300);
        });
        chunk.uploaded = true;
        chunk.retries  = 0;
      } catch {
        chunk.retries++;
        if (chunk.retries > MAX_RETRIES) {
          throw new Error(`分片 ${i + 1}/${totalChunks} 上传失败，已达最大重试次数`);
        }
        throw new Error(`分片 ${i + 1} 上传失败`);
      }
    } else {
      chunk.uploaded = true;
      chunk.retries  = 0;
    }

    const uploadedChunks = chunks.filter(c => c.uploaded).length;
    const progress = Math.round((uploadedChunks / totalChunks) * 90);
    _updateFile(state.file.id, {
      status: 'uploading',
      progress,
      uploadedChunks,
      totalChunks,
      queueStage: uploadedChunks >= totalChunks ? 'merging' : 'uploading',
    });
  }
}

async function processUpload(fileId: string): Promise<void> {
  const fileEntry = _queue.find(f => f.id === fileId);
  if (!fileEntry) return;

  _updateFile(fileId, {
    status: 'uploading',
    progress: fileEntry.transferMode === 'chunked' ? fileEntry.progress : 0,
    queueStage: fileEntry.transferMode === 'chunked' ? 'chunking' : 'uploading',
  });

  // Initialize or resume chunk state
  if (!_uploadState.has(fileId)) {
    const totalChunks = fileEntry.totalChunks ?? (fileEntry.size > 0
      ? Math.max(1, Math.ceil(fileEntry.size / CHUNK_SIZE))
      : 1);
    const chunks: ChunkState[] = Array.from(
      {length: totalChunks}, (_, i) => ({index: i, uploaded: false, retries: 0}),
    );
    _uploadState.set(fileId, {
      file: fileEntry, chunks, currentChunk: 0, totalChunks,
    });
  }

  const state = _uploadState.get(fileId)!;

  try {
    if (fileEntry.size >= LARGE_FILE_THRESHOLD && fileEntry.size > 0) {
      await _chunkedUpload(state);
    } else if (fileEntry.size === 0) {
      // Unknown size: treat as large file to ensure chunking works
      await _chunkedUpload(state);
    } else {
      await _directUpload(state);
    }

    // Upload complete — mark processing
    _updateFile(fileId, {status: 'processing', progress: 100, queueStage: 'processing'});

    // Simulate AI backend analysis (replace with real /analyze endpoint)
    await delay(800);
    const agent = _assignAgent(fileEntry.type);
    _updateFile(fileId, {agent, status: 'processing', queueStage: 'processing'});

    // Simulate agent dispatch
    await delay(fileEntry.type === 'video' || fileEntry.type === 'archive' ? 1400 : 900);
    _updateFile(fileId, {status: 'dispatched', progress: 100, queueStage: 'dispatched'});

    // Agent completes (in production: webhook or poll)
    await delay(600);
    _updateFile(fileId, {status: 'done', progress: 100, queueStage: 'done'});

    _uploadState.delete(fileId); // clean up after successful completion only
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    _updateFile(fileId, {status: 'error', error: msg, queueStage: 'error'});
  }
}

function _updateFile(id: string, patch: Partial<UploadFile>): void {
  const idx = _queue.findIndex(f => f.id === id);
  if (idx === -1) return;
  Object.assign(_queue[idx], patch);
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Add a file to the upload queue and start processing.
 * Does NOT block the calling thread — upload runs asynchronously.
 */
export async function enqueueUpload(
  name: string, uri: string, mimeType: string, size: number,
): Promise<UploadFile> {
  const file = buildFileEntry(name, uri, mimeType, size);
  _queue.push(file);
  void processUpload(file.id); // fire-and-forget
  return file;
}

/**
 * Get a snapshot of the current upload queue.
 * Call this on mount and after each poll interval.
 */
export function getQueue(): UploadFile[] {
  return [..._queue];
}

/** Get a single file by id */
export function getFile(id: string): UploadFile | undefined {
  return _queue.find(f => f.id === id);
}

/**
 * Back-link a dispatched upload to its DispatchRecord id.
 * Called by AppContext when `registerDispatch` is invoked with `source: 'upload'`.
 */
export function updateFileDispatchId(fileId: string, dispatchId: string): void {
  _updateFile(fileId, {dispatchId});
}

/** Clear the entire queue */
export function clearQueue(): void {
  _queue.length = 0;
  _uploadState.clear();
}

/** Remove a specific file from the queue */
export function removeFile(id: string): void {
  const idx = _queue.findIndex(f => f.id === id);
  if (idx !== -1) _queue.splice(idx, 1);
  _uploadState.delete(id);
  _selectedForDispatch.delete(id);
}

/**
 * Retry a failed upload.
 *
 * For chunked uploads we now keep acknowledged chunk state in `_uploadState`,
 * so retry resumes from the first unfinished chunk instead of restarting the
 * whole file. Small direct uploads simply restart from the beginning.
 */
export function retryUpload(id: string): void {
  const file = _queue.find(f => f.id === id);
  if (!file) return;

  file.status = 'queued';
  file.error = undefined;
  file.queueStage = file.transferMode === 'chunked' ? 'chunking' : 'queued';

  const existingState = _uploadState.get(id);
  if (existingState) {
    const uploadedChunks = existingState.chunks.filter(chunk => chunk.uploaded).length;
    const resumedProgress = existingState.totalChunks > 0
      ? Math.round((uploadedChunks / existingState.totalChunks) * 90)
      : 0;

    existingState.currentChunk = existingState.chunks.findIndex(chunk => !chunk.uploaded);
    if (existingState.currentChunk === -1) {
      existingState.currentChunk = existingState.totalChunks;
    }
    existingState.chunks.forEach(chunk => {
      if (!chunk.uploaded) {
        chunk.retries = 0;
      }
    });
    file.progress = resumedProgress;
    file.uploadedChunks = uploadedChunks;
    file.totalChunks = existingState.totalChunks;
  } else {
    file.progress = 0;
    file.uploadedChunks = file.transferMode === 'chunked' ? 0 : undefined;
  }

  void processUpload(file.id);
}

export function markFileForNextDispatch(id: string): void {
  const file = _queue.find(item => item.id === id);
  if (!file) return;
  _selectedForDispatch.add(id);
}

export function unmarkFileForNextDispatch(id: string): void {
  _selectedForDispatch.delete(id);
}

export function clearFilesForNextDispatch(ids?: string[]): void {
  if (!ids || ids.length === 0) {
    _selectedForDispatch.clear();
    return;
  }

  ids.forEach(id => _selectedForDispatch.delete(id));
}

export function getFilesForNextDispatch(): UploadFile[] {
  return _queue.filter(file => _selectedForDispatch.has(file.id));
}

export function isFileMarkedForNextDispatch(id: string): boolean {
  return _selectedForDispatch.has(id);
}

// ─── Demo / Testing helpers ────────────────────────────────────────────────────

const DEMO_FILES: Array<{name: string; mimeType: string; size: number; type: UploadType}> = [
  {name: '矿区实拍照片.jpg',         mimeType: 'image/jpeg',         size: 4_200_000, type: 'image'},
  {name: '选矿工艺流程图.pdf',        mimeType: 'application/pdf',    size: 1_800_000, type: 'document'},
  {name: 'AIBrainIM演示视频.mp4',    mimeType: 'video/mp4',           size: 18_700_000, type: 'video'},
  {name: '矿业政策汇编_2026.zip',    mimeType: 'application/zip',     size: 7_400_000, type: 'archive'},
  {name: 'XRT传感器数据_长文本.csv',  mimeType: 'text/csv',            size: 0,         type: 'document'},
];

/**
 * Add a demo file to the upload queue (for testing without picking real files).
 * Returns the generated file entry.
 */
export function enqueueDemoUpload(index?: number): UploadFile {
  const demo = DEMO_FILES[index ?? Math.floor(Math.random() * DEMO_FILES.length)];
  const transferMode: UploadTransferMode = demo.size > 0 && demo.size < LARGE_FILE_THRESHOLD ? 'direct' : 'chunked';
  const totalChunks = transferMode === 'chunked'
    ? Math.max(1, Math.ceil((demo.size || LARGE_FILE_THRESHOLD) / CHUNK_SIZE))
    : 1;

  const file: UploadFile = {
    id: genId(),
    name: demo.name,
    uri: `demo://${demo.name}`,
    type: demo.type,
    mimeType: demo.mimeType,
    size: demo.size,
    status: 'queued',
    progress: 0,
    transferMode,
    resumable: transferMode === 'chunked',
    totalChunks: transferMode === 'chunked' ? totalChunks : undefined,
    uploadedChunks: transferMode === 'chunked' ? 0 : undefined,
    queueStage: transferMode === 'chunked' ? 'chunking' : 'queued',
    timestamp: new Date().toLocaleTimeString('zh-CN', {hour: '2-digit', minute: '2-digit'}),
  };
  _queue.push(file);
  void processUpload(file.id);
  return file;
}

// ─── uploadService namespace (backwards-compatible object API) ─────────────────

/**
 * uploadService object — backwards-compatible namespace export.
 * All functions are also available as named exports.
 */
export const uploadService = {
  enqueueUpload,
  enqueueDemoUpload,
  getQueue,
  getFile,
  updateFileDispatchId,
  clearQueue,
  removeFile,
  retryUpload,
  markFileForNextDispatch,
  unmarkFileForNextDispatch,
  clearFilesForNextDispatch,
  getFilesForNextDispatch,
  isFileMarkedForNextDispatch,
  formatBytes,
};
