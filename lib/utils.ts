/**
 * Shared utility functions used across background, capture, history, and export modules.
 */

/**
 * Convert a Blob to a data URL using arrayBuffer + chunked btoa.
 * Service-worker compatible (no FileReader).
 */
export async function blobToDataUrl(blob: Blob): Promise<string> {
  const ab = await blob.arrayBuffer();
  const bytes = new Uint8Array(ab);
  const chunks: string[] = [];
  for (let i = 0; i < bytes.length; i += 8192) {
    chunks.push(String.fromCharCode(...bytes.subarray(i, i + 8192)));
  }
  return `data:${blob.type};base64,${btoa(chunks.join(''))}`;
}

/**
 * Send a message to a content script tab, with automatic injection retry.
 * Used by both capture.ts and background.ts.
 */
export async function sendToTab(tabId: number, message: Record<string, unknown>): Promise<unknown> {
  try {
    return await browser.tabs.sendMessage(tabId, message);
  } catch {
    // Inject content script and retry once
    try {
      await browser.scripting.executeScript({
        target: { tabId },
        files: ['content-scripts/content.js'],
      });
    } catch {
      throw new Error('Cannot inject content script into this page.');
    }
    await new Promise((r) => setTimeout(r, 250));
    return await browser.tabs.sendMessage(tabId, message);
  }
}

/** Promise-based delay — used across capture and background modules. */
export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
