import { describe, it, expect } from 'vitest';
import { blobToDataUrl, sleep } from '../utils';

describe('blobToDataUrl', () => {
  it('converts a text blob to a valid data URL', async () => {
    const blob = new Blob(['hello world'], { type: 'text/plain' });
    const dataUrl = await blobToDataUrl(blob);
    expect(dataUrl).toMatch(/^data:text\/plain;base64,/);
    // Decode and verify content
    const base64 = dataUrl.split(',')[1];
    const decoded = atob(base64);
    expect(decoded).toBe('hello world');
  });

  it('preserves MIME type for image/png', async () => {
    // Create a tiny 1x1 PNG-like blob
    const blob = new Blob([new Uint8Array([0x89, 0x50, 0x4e, 0x47])], { type: 'image/png' });
    const dataUrl = await blobToDataUrl(blob);
    expect(dataUrl).toMatch(/^data:image\/png;base64,/);
  });

  it('preserves MIME type for image/jpeg', async () => {
    const blob = new Blob([new Uint8Array([0xff, 0xd8, 0xff])], { type: 'image/jpeg' });
    const dataUrl = await blobToDataUrl(blob);
    expect(dataUrl).toMatch(/^data:image\/jpeg;base64,/);
  });

  it('handles empty blobs', async () => {
    const blob = new Blob([], { type: 'application/octet-stream' });
    const dataUrl = await blobToDataUrl(blob);
    expect(dataUrl).toBe('data:application/octet-stream;base64,');
  });

  it('handles large blobs (> 8192 bytes chunk boundary)', async () => {
    const size = 8192 * 3 + 100; // Crosses multiple chunk boundaries
    const data = new Uint8Array(size);
    for (let i = 0; i < size; i++) data[i] = i % 256;
    const blob = new Blob([data], { type: 'application/octet-stream' });
    const dataUrl = await blobToDataUrl(blob);
    // Decode and verify round-trip
    const base64 = dataUrl.split(',')[1];
    const decoded = atob(base64);
    expect(decoded.length).toBe(size);
    for (let i = 0; i < size; i++) {
      expect(decoded.charCodeAt(i)).toBe(i % 256);
    }
  });
});

describe('sleep', () => {
  it('resolves after the specified delay', async () => {
    const start = Date.now();
    await sleep(50);
    const elapsed = Date.now() - start;
    // Allow some timing tolerance
    expect(elapsed).toBeGreaterThanOrEqual(40);
    expect(elapsed).toBeLessThan(200);
  });

  it('resolves with undefined', async () => {
    const result = await sleep(10);
    expect(result).toBeUndefined();
  });
});
