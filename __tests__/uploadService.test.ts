/**
 * @format
 */

import {uploadService, formatBytes} from '../src/services/uploadService';

describe('uploadService', () => {
  beforeEach(() => {
    uploadService.clearQueue();
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

    it('small file (< 10 MB) is queued and processed without crashing', async () => {
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

    it('large file (>= 10 MB) is queued without crashing', async () => {
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
