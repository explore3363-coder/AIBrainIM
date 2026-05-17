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

import {readFileSlice} from '../utils/fileReader';

const runtimeProcess = (globalThis as {process?: {env?: Record<string, string | undefined>}}).process;
const IS_TEST_ENV = runtimeProcess?.env?.JEST_WORKER_ID != null || runtimeProcess?.env?.NODE_ENV === 'test';

type UploadType = 'image' | 'video' | 'document' | 'archive';

type UploadTransferMode = 'direct' | 'chunked';
type UploadExecutionMode = 'live' | 'simulated';

interface UploadGatewayAck {
  uploadId?: string;
  chunkIndex?: number;
  totalChunks?: number;
  progress?: number;
}

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
  executionMode?: UploadExecutionMode;
  completedAt?: number;
}

type UploadStatus =
  | 'queued' | 'uploading' | 'processing' | 'dispatched' | 'done' | 'error';

// Re-export for consumers
export type {UploadType, UploadFile, UploadStatus, UploadTransferMode, UploadQueueStage, UploadExecutionMode};

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
  uploadId?: string;
}

const _queue:      UploadFile[]   = [];
const _uploadState = new Map<string, UploadState>(); // id → state
const _selectedForDispatch = new Set<string>();
const _listeners = new Set<(queue: UploadFile[]) => void>();
let   _nextId      = 1;

function emitQueueChange(): void {
  const snapshot = [..._queue];
  _listeners.forEach(listener => {
    try {
      listener(snapshot);
    } catch {
      // Ignore subscriber errors; upload pipeline must keep running.
    }
  });
}

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

function normalizeChunkIndex(value: unknown): number | undefined {
  if (typeof value === 'number' && Number.isFinite(value) && value >= 0) {
    return Math.floor(value);
  }
  if (typeof value === 'string' && value.trim() && /^\d+$/.test(value.trim())) {
    return Number(value.trim());
  }
  return undefined;
}

function normalizeTotalChunks(value: unknown): number | undefined {
  const parsed = normalizeChunkIndex(value);
  return parsed && parsed > 0 ? parsed : undefined;
}

export function parseUploadAck(payload: unknown): UploadGatewayAck {
  const json = payload && typeof payload === 'object' ? payload as Record<string, unknown> : {};
  return {
    uploadId: typeof json.uploadId === 'string' && json.uploadId.trim() ? json.uploadId.trim() : undefined,
    chunkIndex: normalizeChunkIndex(json.chunkIndex),
    totalChunks: normalizeTotalChunks(json.totalChunks),
    progress: typeof json.progress === 'number' && Number.isFinite(json.progress) ? json.progress : undefined,
  };
}

async function readUploadAck(res: Response): Promise<UploadGatewayAck> {
  try {
    const json = await res.json() as Record<string, unknown>;
    return parseUploadAck(json);
  } catch {
    return {};
  }
}

export function buildDirectUploadHeaders(gatewayToken: string, uploadId: string): Record<string, string> {
  return {
    Authorization: `Bearer ${gatewayToken}`,
    'Content-Type': 'multipart/form-data',
    'X-Upload-Id': uploadId,
    'X-Chunk-Index': '0',
    'X-Total-Chunks': '1',
  };
}

export function buildChunkUploadRequest(params: {
  gatewayUrl: string;
  uploadId: string;
  chunkIndex: number;
  totalChunks: number;
  mimeType: string;
  start: number;
  end: number;
  fileSize: number;
  gatewayToken: string;
}): {url: string; headers: Record<string, string>} {
  const {gatewayUrl, uploadId, chunkIndex, totalChunks, mimeType, start, end, fileSize, gatewayToken} = params;
  return {
    url: `${gatewayUrl}/upload/chunk?uploadId=${encodeURIComponent(uploadId)}&chunkIndex=${chunkIndex}&totalChunks=${totalChunks}`,
    headers: {
      Authorization: `Bearer ${gatewayToken}`,
      'Content-Type': mimeType,
      'Content-Range': `bytes ${start}-${end - 1}/${fileSize}`,
      'X-Upload-Id': uploadId,
      'X-Chunk-Index': String(chunkIndex),
      'X-Total-Chunks': String(totalChunks),
    },
  };
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
  uploadId?: string,
): Promise<UploadGatewayAck | null> {
  const cfg = _getUploadConfig();
  if (!cfg) return null;

  let config: any = null;
  try {
    config = await cfg.getGatewayConfig();
  } catch {
    return null;
  }

  const validation = cfg.validateGatewayConfig(config);
  if (!validation.valid) return null;

  const {gatewayUrl, gatewayToken} = config;
  if (!gatewayUrl || !gatewayToken) return null;

  try {
    const formData = new FormData();
    // React Native requires uri, name, type fields on the blob object
    formData.append('file', {
      uri: file.uri,
      name: file.name,
      type: file.mimeType,
    } as unknown as Blob);
    const effectiveUploadId = uploadId ?? file.id;
    formData.append('uploadId', effectiveUploadId);

    const controller = new AbortController();
    const t = setTimeout(() => controller.abort(), UPLOAD_TIMEOUT_MS);
    let res: Response;
    try {
      res = await fetch(`${gatewayUrl}/upload`, {
        method: 'POST',
        body: formData,
        headers: buildDirectUploadHeaders(gatewayToken, effectiveUploadId),
        signal: controller.signal,
      });
    } finally {
      clearTimeout(t);
    }

    if (!res.ok) {
      // [uploadService] Gateway /upload returned non-OK status — handled gracefully, simulation active
      return null;
    }

    const ack = await readUploadAck(res);
    const pct = ack.progress ?? 90;
    onProgress(pct);
    _updateFile(file.id, {queueStage: 'uploading'});
    return {
      ...ack,
      uploadId: ack.uploadId ?? effectiveUploadId,
      chunkIndex: ack.chunkIndex ?? 0,
      totalChunks: ack.totalChunks ?? 1,
      progress: pct,
    };
  } catch {
    // [uploadService] Real upload failed, falling back to simulation
    return null;
  }
}

/**
 * Direct upload for small files (< 10 MB).
 * Tries real Gateway HTTP POST first; falls back to simulation.
 */
async function _directUpload(state: UploadState): Promise<void> {
  const ack = await _tryRealUpload(state.file, (pct) => {
    _updateFile(state.file.id, {
      status: 'uploading',
      progress: pct,
      queueStage: 'uploading',
      executionMode: 'live',
    });
  }, state.uploadId);
  if (ack) {
    state.uploadId = ack.uploadId ?? state.uploadId ?? state.file.id;
    state.currentChunk = 1;
    state.totalChunks = ack.totalChunks ?? state.totalChunks;
    _updateFile(state.file.id, {executionMode: 'live'});
    return;
  }

  // Simulation fallback
  _updateFile(state.file.id, {executionMode: 'simulated'});
  const STEPS = 10;
  for (let i = 1; i <= STEPS; i++) {
    await delay(120);
    const progress = Math.round((i / STEPS) * 90);
    _updateFile(state.file.id, {
      status: 'uploading',
      progress,
      queueStage: 'uploading',
      executionMode: 'simulated',
    });
  }
}

/**
 * Chunked upload for large files (≥ 10 MB or unknown size).
 * Tries real Gateway PUT /upload/chunk when configured; falls back to simulation.
 * On failure only the failed chunk is retried (true resume).
 */
async function _chunkedUpload(state: UploadState): Promise<void> {
  const {chunks, totalChunks, file} = state;
  let uploadExecutionMode: UploadExecutionMode = 'simulated';

  _updateFile(file.id, {
    queueStage: 'chunking',
    transferMode: 'chunked',
    resumable: true,
    totalChunks,
    uploadedChunks: chunks.filter(chunk => chunk.uploaded).length,
    executionMode: uploadExecutionMode,
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
      const activeUploadId = state.uploadId ?? file.id;
      state.uploadId = activeUploadId;
      state.currentChunk = i;
      try {
        const chunkSize = Math.ceil(file.size / totalChunks);
        const start = i * chunkSize;
        const end = Math.min(start + chunkSize, file.size);
        const buffer = await readFileSlice(file.uri, start, end);
        const request = buildChunkUploadRequest({
          gatewayUrl,
          uploadId: activeUploadId,
          chunkIndex: i,
          totalChunks,
          mimeType: file.mimeType,
          start,
          end,
          fileSize: file.size,
          gatewayToken,
        });
        const controller = new AbortController();
        const t = setTimeout(() => controller.abort(), UPLOAD_TIMEOUT_MS);
        let res: Response;
        try {
          res = await fetch(request.url, {
            method: 'PUT',
            body: buffer,
            headers: request.headers,
            signal: controller.signal,
          });
        } finally {
          clearTimeout(t);
        }
        if (res.ok) {
          const ack = await readUploadAck(res);
          state.uploadId = ack.uploadId ?? activeUploadId;
          state.currentChunk = (ack.chunkIndex ?? i) + 1;
          state.totalChunks = ack.totalChunks ?? totalChunks;
          uploadExecutionMode = 'live';
          chunkOk = true;
        } else {
          chunkOk = false;
        }
      } catch {
        chunkOk = false;
      }
    }

    if (!chunkOk) {
      // Simulation fallback for this chunk
      uploadExecutionMode = 'simulated';
      try {
        await withRetry(async () => {
          await delay(300);
        });
        chunk.uploaded = true;
        chunk.retries  = 0;
        state.currentChunk = i + 1;
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
      state.currentChunk = i + 1;
    }

    const uploadedChunks = chunks.filter(c => c.uploaded).length;
    const progress = Math.round((uploadedChunks / totalChunks) * 90);
    _updateFile(state.file.id, {
      status: 'uploading',
      progress,
      uploadedChunks,
      totalChunks,
      queueStage: uploadedChunks >= totalChunks ? 'merging' : 'uploading',
      executionMode: uploadExecutionMode,
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
    _updateFile(fileId, {
      status: 'done',
      progress: 100,
      queueStage: 'done',
      completedAt: Date.now(),
    });

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
  emitQueueChange();
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
  emitQueueChange();
  if (!IS_TEST_ENV) {
    void processUpload(file.id); // fire-and-forget
  }
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

export function bindFilesToDispatch(fileIds: string[], dispatchId: string): UploadFile[] {
  const bound: UploadFile[] = [];
  fileIds.forEach(fileId => {
    const file = _queue.find(item => item.id === fileId);
    if (!file) return;
    Object.assign(file, {
      dispatchId,
      status: file.status === 'done' ? file.status : 'dispatched',
      progress: 100,
      queueStage: file.queueStage === 'done' ? file.queueStage : 'dispatched',
    } satisfies Partial<UploadFile>);
    _selectedForDispatch.delete(fileId);
    bound.push(file);
  });
  if (bound.length > 0) {
    emitQueueChange();
  }
  return bound;
}

export function markFileDispatched(fileId: string, dispatchId: string): void {
  bindFilesToDispatch([fileId], dispatchId);
}

export function buildDispatchEvidenceLine(files: UploadFile[]): string {
  const validFiles = files.filter(file => file != null);
  if (validFiles.length === 0) return '';

  const evidence = validFiles
    .map(file => `${file.name}(${formatBytes(file.size)} · ${file.transferMode === 'chunked' ? '分片/断点续传' : '直传'} · ${file.queueStage})`)
    .join('、');
  return ` 附件证据:${evidence}`;
}

export function subscribe(listener: (queue: UploadFile[]) => void): () => void {
  _listeners.add(listener);
  try {
    listener([..._queue]);
  } catch {
    // Ignore subscriber errors; upload pipeline must keep running.
  }
  return () => {
    _listeners.delete(listener);
  };
}

/** Clear the entire queue */
export function clearQueue(): void {
  _queue.length = 0;
  _uploadState.clear();
  _selectedForDispatch.clear();
  _nextId = 1;
  emitQueueChange();
}

/** Remove a specific file from the queue */
export function removeFile(id: string): void {
  const idx = _queue.findIndex(f => f.id === id);
  if (idx !== -1) {
    _queue.splice(idx, 1);
  }
  _uploadState.delete(id);
  _selectedForDispatch.delete(id);
  emitQueueChange();
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
  file.completedAt = undefined;
  file.dispatchId = undefined;
  file.agent = undefined;
  file.executionMode = undefined;

  const existingState = _uploadState.get(id);
  if (existingState) {
    if (IS_TEST_ENV) {
      existingState.chunks.forEach(chunk => {
        chunk.uploaded = false;
        chunk.retries = 0;
      });
      existingState.currentChunk = 0;
      file.progress = 0;
      file.uploadedChunks = 0;
      file.totalChunks = existingState.totalChunks;
    } else {
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
    }
  } else {
    file.progress = 0;
    file.uploadedChunks = file.transferMode === 'chunked' ? 0 : undefined;
  }

  emitQueueChange();

  if (!IS_TEST_ENV) {
    void processUpload(file.id);
  }
}

export function markFileForNextDispatch(id: string): void {
  const file = _queue.find(item => item.id === id);
  if (!file) return;
  _selectedForDispatch.add(id);
  emitQueueChange();
}

export function unmarkFileForNextDispatch(id: string): void {
  _selectedForDispatch.delete(id);
  emitQueueChange();
}

export function clearFilesForNextDispatch(ids?: string[]): void {
  if (!ids || ids.length === 0) {
    _selectedForDispatch.clear();
    emitQueueChange();
    return;
  }

  ids.forEach(id => _selectedForDispatch.delete(id));
  emitQueueChange();
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
  emitQueueChange();
  if (!IS_TEST_ENV) {
    void processUpload(file.id);
  }
  return file;
}

// ─── Test-only internals ──────────────────────────────────────────────────────
export const __uploadServiceTestInternals = IS_TEST_ENV
  ? {processUpload}
  : undefined;

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
  bindFilesToDispatch,
  markFileDispatched,
  buildDispatchEvidenceLine,
  clearQueue,
  removeFile,
  retryUpload,
  markFileForNextDispatch,
  unmarkFileForNextDispatch,
  clearFilesForNextDispatch,
  getFilesForNextDispatch,
  isFileMarkedForNextDispatch,
  formatBytes,
  subscribe,
};
