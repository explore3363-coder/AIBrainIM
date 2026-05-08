/**
 * @format
 */

import {readFileSlice, readFileAsArrayBuffer} from '../src/utils/fileReader';

describe('fileReader', () => {
  // Simulate XMLHttpRequest being unavailable (Jest test environment)
  const originalXHR = (globalThis as any).XMLHttpRequest;

  afterEach(() => {
    // Restore XHR after each test
    (globalThis as any).XMLHttpRequest = originalXHR;
  });

  describe('readFileSlice', () => {
    it('returns zero-filled buffer when XMLHttpRequest is unavailable', async () => {
      // Simulate no XHR (test environment)
      delete (globalThis as any).XMLHttpRequest;

      const buffer = await readFileSlice('file:///tmp/test.pdf', 0, 1024);
      expect(buffer).toBeInstanceOf(ArrayBuffer);
      expect(buffer.byteLength).toBe(1024);

      // Zero-filled means all bytes are 0
      const view = new Uint8Array(buffer);
      for (let i = 0; i < view.length; i++) {
        expect(view[i]).toBe(0);
      }
    });

    it('returns correct length for partial slice', async () => {
      delete (globalThis as any).XMLHttpRequest;

      // Slice in the middle of a hypothetical 1MB file
      const buffer = await readFileSlice('file:///tmp/test.pdf', 500, 1500);
      expect(buffer.byteLength).toBe(1000);
    });

    it('returns empty buffer for zero-length slice', async () => {
      delete (globalThis as any).XMLHttpRequest;

      const buffer = await readFileSlice('file:///tmp/test.pdf', 100, 100);
      expect(buffer.byteLength).toBe(0);
    });

    it('uses XMLHttpRequest when available and resolves on 200 status', async () => {
      const mockXHR: Record<string, any> = {
        responseType: '',
        open: jest.fn(),
        setRequestHeader: jest.fn(),
        send: jest.fn(),
        onload: null as ((() => void) | null),
        onerror: null as ((() => void) | null),
        status: 206,
        response: new ArrayBuffer(256) as ArrayBuffer,
      };

      (globalThis as any).XMLHttpRequest = jest.fn(() => mockXHR) as any;

      let resolvePromise: (val: ArrayBuffer) => void;
      const promise = new Promise<ArrayBuffer>((resolve) => {
        resolvePromise = resolve;
        mockXHR.onload = () => resolvePromise(mockXHR.response as ArrayBuffer);
      });

      const resultPromise = readFileSlice('file:///tmp/test.pdf', 0, 256);

      // Trigger the mocked onload
      mockXHR.onload!();

      const result = await resultPromise;
      expect(result.byteLength).toBe(256);
    });

    it('rejects when XMLHttpRequest returns non-2xx status', async () => {
      const mockXHR = {
        responseType: '',
        open: jest.fn(),
        setRequestHeader: jest.fn(),
        send: jest.fn(),
        onload: null as ((() => void) | null),
        onerror: null as ((() => void) | null),
        status: 404,
        response: null,
      };

      (globalThis as any).XMLHttpRequest = jest.fn(() => mockXHR) as any;

      mockXHR.onload = () => {
        // status 404 triggers rejection path
      };

      const resultPromise = readFileSlice('file:///tmp/missing.pdf', 0, 256);
      mockXHR.onload!();

      await expect(resultPromise).rejects.toThrow('HTTP 404');
    });

    it('rejects when XMLHttpRequest fires onerror', async () => {
      const mockXHR: Record<string, any> = {
        responseType: '',
        open: jest.fn(),
        setRequestHeader: jest.fn(),
        send: jest.fn(),
        onload: null,
        onerror: jest.fn(),
        status: 0,
        response: null,
      };

      (globalThis as any).XMLHttpRequest = jest.fn(() => mockXHR) as any;

      mockXHR.onerror = () => {};

      const resultPromise = readFileSlice('file:///tmp/test.pdf', 0, 256);
      mockXHR.onerror!();

      await expect(resultPromise).rejects.toThrow('network error');
    });

    it('sets correct Range header on XMLHttpRequest', async () => {
      const mockXHR: Record<string, any> = {
        responseType: '',
        open: jest.fn(),
        setRequestHeader: jest.fn(),
        send: jest.fn(),
        onload: null,
        onerror: null,
        status: 206,
        response: new ArrayBuffer(100) as ArrayBuffer,
      };

      (globalThis as any).XMLHttpRequest = jest.fn(() => mockXHR) as any;

      mockXHR.onload = () => {};

      readFileSlice('file:///tmp/test.pdf', 500, 600).catch(() => {});
      mockXHR.onload!();

      expect(mockXHR.open).toHaveBeenCalledWith('GET', 'file:///tmp/test.pdf');
      expect(mockXHR.setRequestHeader).toHaveBeenCalledWith('Range', 'bytes=500-599');
      expect(mockXHR.responseType).toBe('arraybuffer');
    });
  });

  describe('readFileAsArrayBuffer', () => {
    it('rejects when XMLHttpRequest is unavailable', async () => {
      delete (globalThis as any).XMLHttpRequest;

      await expect(readFileAsArrayBuffer('file:///tmp/test.pdf')).rejects.toThrow(
        'XMLHttpRequest not available',
      );
    });

    it('resolves with ArrayBuffer on 200 status', async () => {
      const fakeBuffer = new ArrayBuffer(512);
      const mockXHR: Record<string, any> = {
        responseType: '',
        open: jest.fn(),
        send: jest.fn(),
        onload: null,
        onerror: null,
        status: 200,
        response: fakeBuffer,
      };

      (globalThis as any).XMLHttpRequest = jest.fn(() => mockXHR) as any;

      mockXHR.onload = () => {};

      const resultPromise = readFileAsArrayBuffer('file:///tmp/test.pdf');
      mockXHR.onload!();

      const result = await resultPromise;
      expect(result).toBe(fakeBuffer);
    });

    it('rejects on non-2xx status', async () => {
      const mockXHR: Record<string, any> = {
        responseType: '',
        open: jest.fn(),
        send: jest.fn(),
        onload: null,
        onerror: null,
        status: 500,
        response: null,
      };

      (globalThis as any).XMLHttpRequest = jest.fn(() => mockXHR) as any;
      mockXHR.onload = () => {};

      const resultPromise = readFileAsArrayBuffer('file:///tmp/error.pdf');
      mockXHR.onload!();

      await expect(resultPromise).rejects.toThrow('HTTP 500');
    });

    it('opens correct URL without Range header', async () => {
      const mockXHR: Record<string, any> = {
        responseType: '',
        open: jest.fn(),
        send: jest.fn(),
        onload: null,
        onerror: null,
        status: 200,
        response: new ArrayBuffer(128) as ArrayBuffer,
      };

      (globalThis as any).XMLHttpRequest = jest.fn(() => mockXHR) as any;
      mockXHR.onload = () => {};

      readFileAsArrayBuffer('file:///tmp/full.pdf').catch(() => {});
      mockXHR.onload!();

      expect(mockXHR.open).toHaveBeenCalledWith('GET', 'file:///tmp/full.pdf');
      expect(mockXHR.responseType).toBe('arraybuffer');
    });
  });
});
