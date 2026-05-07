/**
 * @format
 */

import {uploadService} from '../src/services/uploadService';

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
  });

  describe('clearQueue', () => {
    it('removes all files from the queue', async () => {
      await uploadService.enqueueUpload('a.pdf', 'file:///a', 'application/pdf', 1);
      await uploadService.enqueueUpload('b.pdf', 'file:///b', 'application/pdf', 2);

      uploadService.clearQueue();
      const queue = uploadService.getQueue();
      expect(queue.length).toBe(0);
    });
  });

  describe('getQueue', () => {
    it('returns current queue snapshot', async () => {
      await uploadService.enqueueUpload('c.pdf', 'file:///c', 'application/pdf', 3);

      const queue = uploadService.getQueue();
      expect(Array.isArray(queue)).toBe(true);
      expect(queue.length).toBe(1);
    });
  });
});
