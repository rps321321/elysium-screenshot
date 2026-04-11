import type { ExportFormat } from './types';
import { blobToDataUrl } from './utils';

/**
 * Convert a source (Blob or data URL string) into a Blob.
 * If it's already a Blob, returns it directly — zero copy.
 */
async function ensureBlob(source: Blob | string): Promise<Blob> {
  if (source instanceof Blob) return source;
  return (await fetch(source)).blob();
}

export async function downloadScreenshot(
  source: Blob | string,
  format: ExportFormat,
  quality: number,
  filename: string,
): Promise<void> {
  const sourceBlob = await ensureBlob(source);
  const finalBlob = await convertBlobFormat(sourceBlob, format, quality);

  // Use a blob URL instead of a data URL — avoids massive base64 string allocation
  const blobUrl = URL.createObjectURL(finalBlob);
  try {
    await browser.downloads.download({
      url: blobUrl,
      filename,
      saveAs: true,
    });
  } finally {
    // Revoke after a short delay to give the browser time to start the download
    setTimeout(() => URL.revokeObjectURL(blobUrl), 60_000);
  }
}

export async function copyToClipboard(source: Blob | string): Promise<void> {
  // Guard: clipboard API is not available in service workers
  if (typeof navigator.clipboard?.write !== 'function') {
    throw new Error('Clipboard not available');
  }

  const sourceBlob = await ensureBlob(source);
  const pngBlob = sourceBlob.type === 'image/png'
    ? sourceBlob
    : await convertBlobFormat(sourceBlob, 'png', 1);

  await navigator.clipboard.write([
    new ClipboardItem({ 'image/png': pngBlob }),
  ]);
}

export async function exportAsPdf(dataUrl: string, title: string, filename: string): Promise<void> {
  if (typeof document === 'undefined') {
    throw new Error('exportAsPdf requires a browser document context (cannot run in service worker)');
  }
  const { jsPDF } = await import('jspdf');
  const blob = await (await fetch(dataUrl)).blob();
  const bitmap = await createImageBitmap(blob);

  const imgWidth = bitmap.width;
  const imgHeight = bitmap.height;
  bitmap.close(); // Free memory immediately — only needed for dimensions

  // A4 dimensions in mm
  const pageWidth = 210;
  const pageHeight = 297;
  const margin = 10;

  const availableWidth = pageWidth - 2 * margin;
  const scale = availableWidth / imgWidth;
  const scaledHeight = imgHeight * scale;

  const orientation = scaledHeight > pageHeight ? 'portrait' : imgWidth > imgHeight ? 'landscape' : 'portrait';
  const doc = new jsPDF({ orientation, unit: 'mm', format: 'a4' });

  // If image is taller than one page, split across pages
  let yOffset = 0;
  const pageContentHeight = pageHeight - 2 * margin;

  while (yOffset < scaledHeight) {
    if (yOffset > 0) doc.addPage();
    doc.addImage(dataUrl, 'PNG', margin, margin - yOffset, availableWidth, scaledHeight);
    yOffset += pageContentHeight;
  }

  doc.save(filename);
}

/**
 * Convert a Blob to a different image format via OffscreenCanvas.
 * Runs entirely off the main thread's pixel pipeline.
 */
async function convertBlobFormat(
  sourceBlob: Blob,
  format: ExportFormat,
  quality: number,
): Promise<Blob> {
  if (format === 'pdf') return sourceBlob;

  const mimeType = format === 'png' ? 'image/png' : format === 'jpg' ? 'image/jpeg' : 'image/webp';

  // If source is already the target format with lossless quality, skip re-encoding
  if (sourceBlob.type === mimeType && (format === 'png' || quality >= 1)) {
    return sourceBlob;
  }

  const bitmap = await createImageBitmap(sourceBlob);
  const canvas = new OffscreenCanvas(bitmap.width, bitmap.height);
  const ctx = canvas.getContext('2d')!;
  ctx.drawImage(bitmap, 0, 0);
  bitmap.close();
  return canvas.convertToBlob({ type: mimeType, quality });
}

