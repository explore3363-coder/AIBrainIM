/**
 * @format
 */

import {
  uploadService,
  formatBytes,
  buildDirectUploadHeaders,
  buildChunkUploadRequest,
  parseUploadAck,
  __uploadServiceTestInternals,
} from '../src/services/uploadService';

jest.mock('../src/services/gatewayConfig', () => ({
  getGatewayConfig: jest.fn(async () => ({
    gatewayUrl: 'https://gateway.example.com',
    gatewayToken: 'token-token-token-token',
    directMode: true,
    sessionKey: 'agent:zhuli:test',
    channel: 'feishu',
    target: '',
  })),
  validateGatewayConfig: jest.fn(() => ({valid: true, errors: [], warnings: []})),
}));

describe('uploadService', () => {
  beforeEach(() => {
    uploadService.clearQueue();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('enqueueUpload', () => {
    it('adds a file to the queue and returns it', async () => {
      const file = await uploadService.enqueueUpload('test.pdf', 'file:///tmp/test.pdf', 'application/pdf', 1024);

      const queue = uploadService.getQueue();
      expect(queue.length).toBe(1);
      expect(queue[0].id).toBe(file.id);
      expect(queue[0].name).toBe('test.pdf');
    });

    it('accepts image mime type', async () => {
      const file = await uploadService.enqueueUpload('photo.png', 'file:///tmp/photo.png', 'image/png', 2048);
      expect(file.name).toBe('photo.png');
    });

    it('known-size direct-path file is queued and processed without crashing', async () => {
      const file = await uploadService.enqueueUpload('small.pdf', 'file:///tmp/small.pdf', 'application/pdf', 1024);
      // Status may be queued or uploading since processUpload runs async
      expect(['queued', 'uploading']).toContain(file.status);
      expect(file.size).toBe(1024);
    });

    it('unknown size (0 bytes) is queued without crashing', async () => {
      const file = await uploadService.enqueueUpload('unknown.bin', 'file:///tmp/unknown.bin', 'application/octet-stream', 0);
      expect(['queued', 'uploading']).toContain(file.status);
      expect(file.size).toBe(0);
    });

    it('chunked-path file is queued without crashing', async () => {
      const largeSize = 15 * 1024 * 1024; // 15 MB
      const file = await uploadService.enqueueUpload('large.zip', 'file:///tmp/large.zip', 'application/zip', largeSize);
      expect(['queued', 'uploading']).toContain(file.status);
      expect(file.size).toBe(largeSize);
    });

    it('multiple files are all queued', async () => {
      await uploadService.enqueueUpload('a.pdf', 'file:///a', 'application/pdf', 100);
      await uploadService.enqueueUpload('b.pdf', 'file:///b', 'application/pdf', 200);
      await uploadService.enqueueUpload('c.pdf', 'file:///c', 'application/pdf', 0);

      const queue = uploadService.getQueue();
      expect(queue.length).toBe(3);
    });

    it('returns file with mimeType set correctly', async () => {
      const file = await uploadService.enqueueUpload('doc.pdf', 'file:///doc.pdf', 'application/pdf', 500);
      expect(file.mimeType).toBe('application/pdf');
    });

    it('returns file with type field set (document for pdf)', async () => {
      const file = await uploadService.enqueueUpload('doc.pdf', 'file:///doc.pdf', 'application/pdf', 500);
      expect(file.type).toBe('document');
    });

    it('returns file with type field set (image for image/png)', async () => {
      const file = await uploadService.enqueueUpload('img.png', 'file:///img.png', 'image/png', 500);
      expect(file.type).toBe('image');
    });

    it('returns file with type field set (video for video/mp4)', async () => {
      const file = await uploadService.enqueueUpload('vid.mp4', 'file:///vid.mp4', 'video/mp4', 500);
      expect(file.type).toBe('video');
    });

    it('returns file with type field set (archive for application/zip)', async () => {
      const file = await uploadService.enqueueUpload('data.zip', 'file:///data.zip', 'application/zip', 500);
      expect(file.type).toBe('archive');
    });
  });

  describe('formatBytes', () => {
    it('formats 0 bytes as 未知大小', () => {
      expect(formatBytes(0)).toBe('未知大小');
    });

    it('formats bytes < 1 KB', () => {
      expect(formatBytes(512)).toBe('512 B');
    });

    it('formats KB range', () => {
      expect(formatBytes(512)).toBe('512 B');
      expect(formatBytes(1024)).toMatch(/^1\.0 KB$/);
      expect(formatBytes(2048)).toMatch(/^2\.0 KB$/);
    });

    it('formats MB range', () => {
      expect(formatBytes(1024 * 1024)).toMatch(/^1\.0 MB$/);
      expect(formatBytes(5 * 1024 * 1024)).toMatch(/^5\.0 MB$/);
    });

    it('formats GB range', () => {
      expect(formatBytes(1024 * 1024 * 1024)).toMatch(/^1\.00 GB$/);
      expect(formatBytes(2.5 * 1024 * 1024 * 1024)).toMatch(/^2\.50 GB$/);
    });
  });

  describe('Gateway timeout cleanup', () => {
    afterEach(() => {
      jest.useRealTimers();
      (globalThis.fetch as jest.Mock | undefined)?.mockRestore?.();
    });

    it('clears direct-upload timeout when Gateway fetch rejects', async () => {
      jest.useFakeTimers();
      const clearTimeoutSpy = jest.spyOn(globalThis, 'clearTimeout');
      jest.spyOn(globalThis, 'fetch' as never).mockRejectedValue(new Error('network down') as never);

      const file = await uploadService.enqueueUpload('timeout.pdf', 'file:///timeout.pdf', 'application/pdf', 1024);
      const retryPromise = __uploadServiceTestInternals!.processUpload(file.id);
      await Promise.resolve();
      await jest.advanceTimersByTimeAsync(120 * 10 + 800 + 900 + 600);
      await retryPromise;

      expect(clearTimeoutSpy).toHaveBeenCalled();
      expect(uploadService.getFile(file.id)?.executionMode).toBe('simulated');
      expect(uploadService.getFile(file.id)?.status).toBe('done');
    });
  });

  describe('clearQueue', () => {
    it('removes all files from the queue', async () => {
      await uploadService.enqueueUpload('a.pdf', 'file:///a', 'application/pdf', 1);
      await uploadService.enqueueUpload('b.pdf', 'file:///b', 'application/pdf', 2);

      uploadService.clearQueue();
      const queue = uploadService.getQueue();
      expect(queue.length).toBe(0);
    });

    it('clearing empty queue is safe', () => {
      uploadService.clearQueue();
      expect(uploadService.getQueue().length).toBe(0);
    });
  });

  describe('getQueue', () => {
    it('returns current queue snapshot', async () => {
      await uploadService.enqueueUpload('c.pdf', 'file:///c', 'application/pdf', 3);

      const queue = uploadService.getQueue();
      expect(Array.isArray(queue)).toBe(true);
      expect(queue.length).toBe(1);
    });

    it('getQueue returns a new array each time (snapshot)', async () => {
      await uploadService.enqueueUpload('s.pdf', 'file:///s', 'application/pdf', 1);
      const q1 = uploadService.getQueue();
      const q2 = uploadService.getQueue();
      expect(q1).not.toBe(q2); // different array references
      expect(q1).toEqual(q2);  // same contents
    });
  });

  describe('subscribe', () => {
    it('emits queue updates when files are added and removed', async () => {
      const listener = jest.fn();
      const unsubscribe = uploadService.subscribe(listener);

      expect(listener).toHaveBeenCalledWith([]);

      const file = await uploadService.enqueueUpload('watch.pdf', 'file:///watch', 'application/pdf', 2048);
      expect(listener).toHaveBeenCalled();
      expect(listener.mock.calls.at(-1)?.[0]?.some((item: {id: string}) => item.id === file.id)).toBe(true);

      uploadService.removeFile(file.id);
      expect(listener.mock.calls.at(-1)?.[0]).toEqual([]);

      unsubscribe();
    });

    it('stops emitting after unsubscribe', async () => {
      const listener = jest.fn();
      const unsubscribe = uploadService.subscribe(listener);
      unsubscribe();
      listener.mockClear();

      await uploadService.enqueueUpload('silent.pdf', 'file:///silent', 'application/pdf', 2048);

      expect(listener).not.toHaveBeenCalled();
    });

    it('keeps upload pipeline alive when a subscriber throws', async () => {
      const throwingListener = jest.fn(() => {
        throw new Error('subscriber failed');
      });
      const goodListener = jest.fn();
      const unsubscribeThrowing = uploadService.subscribe(throwingListener);
      const unsubscribeGood = uploadService.subscribe(goodListener);

      goodListener.mockClear();
      const file = await uploadService.enqueueUpload('safe.pdf', 'file:///safe', 'application/pdf', 2048);

      expect(uploadService.getQueue().some(item => item.id === file.id)).toBe(true);
      expect(goodListener.mock.calls.at(-1)?.[0]?.some((item: {id: string}) => item.id === file.id)).toBe(true);

      unsubscribeThrowing();
      unsubscribeGood();
    });
  });

  describe('getFile', () => {
    it('returns the file by id', async () => {
      const file = await uploadService.enqueueUpload('find.pdf', 'file:///find', 'application/pdf', 42);
      const found = uploadService.getFile(file.id);
      expect(found?.id).toBe(file.id);
      expect(found?.name).toBe('find.pdf');
    });

    it('returns undefined for unknown id', () => {
      expect(uploadService.getFile('nonexistent')).toBeUndefined();
    });
  });

  describe('removeFile', () => {
    it('removes a specific file by id', async () => {
      const file = await uploadService.enqueueUpload('remove.pdf', 'file:///remove', 'application/pdf', 1);
      expect(uploadService.getQueue().length).toBe(1);
      uploadService.removeFile(file.id);
      expect(uploadService.getQueue().length).toBe(0);
    });
  });

  describe('retryUpload', () => {
    it('resets a failed direct upload and emits a queue update', async () => {
      const listener = jest.fn();
      const file = await uploadService.enqueueUpload('retry.pdf', 'file:///retry', 'application/pdf', 1024);
      const unsubscribe = uploadService.subscribe(listener);

      file.status = 'error';
      file.error = 'network failed';
      file.progress = 37;

      uploadService.retryUpload(file.id);

      const updated = uploadService.getFile(file.id);
      expect(updated?.status).toBe('queued');
      expect(updated?.error).toBeUndefined();
      expect(updated?.progress).toBe(0);
      expect(listener.mock.calls.at(-1)?.[0]?.[0]?.status).toBe('queued');

      unsubscribe();
    });

    it('keeps chunked retry resumable without starting background work in tests', async () => {
      const largeSize = 15 * 1024 * 1024;
      const file = await uploadService.enqueueUpload('retry-large.zip', 'file:///retry-large', 'application/zip', largeSize);
      file.status = 'error';
      file.error = 'chunk failed';
      file.progress = 42;
      file.uploadedChunks = 2;
      file.executionMode = 'simulated';
      file.completedAt = Date.now();
      file.dispatchId = 'dispatch-old';
      file.agent = '黑金';

      uploadService.retryUpload(file.id);

      const updated = uploadService.getFile(file.id);
      expect(updated?.status).toBe('queued');
      expect(updated?.queueStage).toBe('chunking');
      expect(updated?.transferMode).toBe('chunked');
      expect(updated?.resumable).toBe(true);
      expect(updated?.uploadedChunks).toBe(0);
      expect(updated?.error).toBeUndefined();
      expect(updated?.executionMode).toBeUndefined();
      expect(updated?.completedAt).toBeUndefined();
      expect(updated?.dispatchId).toBeUndefined();
      expect(updated?.agent).toBeUndefined();
    });
  });

  describe('gateway upload protocol helpers', () => {
    it('builds direct upload headers with resumable identifiers', () => {
      expect(buildDirectUploadHeaders('1234567890abcdefTOKEN', 'upload-1')).toEqual({
        Authorization: 'Bearer 1234567890abcdefTOKEN',
        'Content-Type': 'multipart/form-data',
        'X-Upload-Id': 'upload-1',
        'X-Chunk-Index': '0',
        'X-Total-Chunks': '1',
      });
    });

    it('builds chunk upload request with query params and resumable headers', () => {
      const request = buildChunkUploadRequest({
        gatewayUrl: 'https://gateway.example.com',
        uploadId: 'upload-2',
        chunkIndex: 3,
        totalChunks: 9,
        mimeType: 'video/mp4',
        start: 6291456,
        end: 8388608,
        fileSize: 18874368,
        gatewayToken: '1234567890abcdefTOKEN',
      });

      expect(request.url).toBe('https://gateway.example.com/upload/chunk?uploadId=upload-2&chunkIndex=3&totalChunks=9');
      expect(request.headers).toEqual({
        Authorization: 'Bearer 1234567890abcdefTOKEN',
        'Content-Type': 'video/mp4',
        'Content-Range': 'bytes 6291456-8388607/18874368',
        'X-Upload-Id': 'upload-2',
        'X-Chunk-Index': '3',
        'X-Total-Chunks': '9',
      });
    });

    it('parses gateway ack payload into normalized resumable state', () => {
      expect(parseUploadAck({
        uploadId: 'server-upload-3',
        chunkIndex: '4',
        totalChunks: '12',
        progress: 73,
      })).toEqual({
        uploadId: 'server-upload-3',
        chunkIndex: 4,
        totalChunks: 12,
        progress: 73,
      });
    });
  });

  describe('enqueueDemoUpload', () => {
    it('adds a demo file to the queue', () => {
      uploadService.clearQueue();
      const file = uploadService.enqueueDemoUpload(0);
      expect(file.id).toBeTruthy();
      // Status may be queued or uploading depending on async timing
      expect(['queued', 'uploading']).toContain(file.status);
      expect(uploadService.getQueue().length).toBe(1);
    });

    it('demo file has demo:// URI', () => {
      const file = uploadService.enqueueDemoUpload(0);
      expect(file.uri).toMatch(/^demo:\/\//);
    });
  });
});
