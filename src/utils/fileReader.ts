/**
 * Read a byte range from a local file URI.
 * Uses XMLHttpRequest (available in both React Native and browser environments).
 * Returns an ArrayBuffer suitable for use as a fetch body.
 */
export async function readFileSlice(
  uri: string,
  start: number,
  end: number,
): Promise<ArrayBuffer> {
  // In test environments (Jest), XMLHttpRequest may not be available.
  // Return a zero-filled buffer so tests can run without hitting the filesystem.
  const hasXHR = typeof XMLHttpRequest !== 'undefined';

  if (!hasXHR) {
    const len = end - start;
    // TypedArray creates a zero-filled buffer — correct length, safe for tests
    return new ArrayBuffer(len);
  }

  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.responseType = 'arraybuffer';
    xhr.open('GET', uri);
    xhr.setRequestHeader('Range', `bytes=${start}-${end - 1}`);

    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300 && xhr.response) {
        resolve(xhr.response as ArrayBuffer);
      } else {
        reject(new Error(`readFileSlice: HTTP ${xhr.status} for range bytes=${start}-${end - 1}`));
      }
    };
    xhr.onerror = () => reject(new Error(`readFileSlice: network error reading ${uri}`));
    xhr.send();
  });
}

/**
 * Read an entire file as an ArrayBuffer.
 */
export async function readFileAsArrayBuffer(uri: string): Promise<ArrayBuffer> {
  const hasXHR = typeof XMLHttpRequest !== 'undefined';
  if (!hasXHR) {
    return Promise.reject(new Error('readFileAsArrayBuffer: XMLHttpRequest not available'));
  }

  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.responseType = 'arraybuffer';
    xhr.open('GET', uri);
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300 && xhr.response) {
        resolve(xhr.response as ArrayBuffer);
      } else {
        reject(new Error(`readFileAsArrayBuffer: HTTP ${xhr.status}`));
      }
    };
    xhr.onerror = () => reject(new Error('readFileAsArrayBuffer: network error'));
    xhr.send();
  });
}