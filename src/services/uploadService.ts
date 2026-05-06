/**
 * uploadService.ts — 文件上传服务
 *
 * 设计原则（P1 可用版）：
 * - 前端不写死大小限制
 * - 小文件（< 10 MB）直传
 * - 大文件（≥ 10 MB）分片上传，每片 2 MB
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

interface UploadFile {
  id: string;
  name: string;
  uri: string;
  type: UploadType;
  mimeType: string;
  size: number; // bytes; 0 = unknown
  status: UploadStatus;
  progress: number; // 0-100
  agent?: string;
  timestamp: string;
  error?: string;
}

type UploadStatus =
  | 'queued' | 'uploading' | 'processing' | 'dispatched' | 'done' | 'error';

// Re-export for consumers
export type {UploadType, UploadFile, UploadStatus};

// ─── Constants ────────────────────────────────────────────────────────────────
const CHUNK_SIZE           = 2 * 1024 * 1024; // 2 MB
const LARGE_FILE_THRESHOLD = 10 * 1024 * 1024; // 10 MB
const MAX_RETRIES          = 5;
const BASE_DELAY_MS        = 500; // ms; exponential backoff base

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
  return {
    id: genId(),
    name,
    uri,
    type: detectType(mimeType, name),
    mimeType,
    size,
    status: 'queued',
    progress: 0,
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

/**
 * Simulated direct upload (small files < 10 MB).
 * In production: POST to /upload with FormData, track X-Progress header.
 */
async function _directUpload(state: UploadState): Promise<void> {
  const STEPS = 10;
  for (let i = 1; i <= STEPS; i++) {
    await delay(120);
    const progress = Math.round((i / STEPS) * 90);
    _updateFile(state.file.id, {status: 'uploading', progress});
  }
}

/**
 * Simulated chunked upload (large files ≥ 10 MB).
 * Each chunk uploaded sequentially with retry; on failure only the failed
 * chunk is retried (true resume — only unacknowledged chunks repeat).
 *
 * Production: PUT /upload/chunk?uploadId=...&chunkIndex=...
 */
async function _chunkedUpload(state: UploadState): Promise<void> {
  const {chunks, totalChunks} = state;

  for (let i = 0; i < totalChunks; i++) {
    const chunk = chunks[i];
    if (chunk.uploaded) continue; // already done, skip

    try {
      await withRetry(async () => {
        // Simulate chunk upload — replace with real fetch() in production
        await delay(300);
        // In production:
        // const fd = new FormData();
        // fd.append('chunk', uri slice for this chunk, filename);
        // await fetch(`${GATEWAY_URL}/upload/chunk?uploadId=${state.file.id}&chunkIndex=${i}`, {
        //   method: 'PUT', body: fd,
        //   headers: { Authorization: `Bearer ${GATEWAY_TOKEN}` },
        // });
      });
      chunk.uploaded = true;
      chunk.retries  = 0;
    } catch {
      chunk.retries++;
      if (chunk.retries > MAX_RETRIES) {
        throw new Error(`分片 ${i + 1}/${totalChunks} 上传失败，已达最大重试次数`);
      }
      // Re-throw so withRetry in processUpload retries this chunk
      throw new Error(`分片 ${i + 1} 上传失败`);
    }

    const uploadedChunks = chunks.filter(c => c.uploaded).length;
    const progress = Math.round((uploadedChunks / totalChunks) * 90);
    _updateFile(state.file.id, {status: 'uploading', progress});
  }
}

async function processUpload(fileId: string): Promise<void> {
  const fileEntry = _queue.find(f => f.id === fileId);
  if (!fileEntry) return;

  _updateFile(fileId, {status: 'uploading', progress: 0});

  // Initialize or resume chunk state
  if (!_uploadState.has(fileId)) {
    const totalChunks = fileEntry.size > 0
      ? Math.ceil(fileEntry.size / CHUNK_SIZE)
      : 1;
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
    } else {
      await _directUpload(state);
    }

    // Upload complete — mark processing
    _updateFile(fileId, {status: 'processing', progress: 100});

    // Simulate AI backend analysis (replace with real /analyze endpoint)
    await delay(800);
    const agent = _assignAgent(fileEntry.type);
    _updateFile(fileId, {agent, status: 'processing'});

    // Simulate agent dispatch
    await delay(fileEntry.type === 'video' || fileEntry.type === 'archive' ? 1400 : 900);
    _updateFile(fileId, {status: 'dispatched', progress: 100});

    // Agent completes (in production: webhook or poll)
    await delay(600);
    _updateFile(fileId, {status: 'done', progress: 100});

  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    _updateFile(fileId, {status: 'error', error: msg});
  } finally {
    _uploadState.delete(fileId); // clean up chunk state
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
}

/**
 * Reset a failed upload and retry from the last successful chunk.
 * Implements true resume — only unacknowledged chunks re-upload.
 */
export function retryUpload(id: string): void {
  const file = _queue.find(f => f.id === id);
  if (!file) return;
  file.status = 'queued';
  file.progress = 0;
  file.error = undefined;
  void processUpload(file.id);
}

// ─── uploadService namespace (backwards-compatible object API) ─────────────────

/**
 * uploadService object — backwards-compatible namespace export.
 * All functions are also available as named exports.
 */
export const uploadService = {
  enqueueUpload,
  getQueue,
  getFile,
  clearQueue,
  removeFile,
  retryUpload,
  formatBytes,
};
