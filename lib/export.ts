import type { ExportFormat } from './types';
import { blobToDataUrl } from './utils';

export async function downloadScreenshot(
  dataUrl: string,
  format: ExportFormat,
  quality: number,
  filename: string,
): Promise<void> {
  const finalDataUrl = await convertFormat(dataUrl, format, quality);

  await browser.downloads.download({
    url: finalDataUrl,
    filename,
    saveAs: true,
  });
}

export async function copyToClipboard(dataUrl: string): Promise<void> {
  // Guard: clipboard API is not available in service workers
  if (typeof navigator.clipboard?.write !== 'function') {
    throw new Error('Clipboard not available');
  }

  const blob = await (await fetch(dataUrl)).blob();
  const pngBlob = blob.type === 'image/png'
    ? blob
    : await convertToBlob(dataUrl, 'png', 1);

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

async function convertFormat(
  dataUrl: string,
  format: ExportFormat,
  quality: number,
): Promise<string> {
  if (format === 'pdf') return dataUrl;

  const blob = await convertToBlob(dataUrl, format, quality);
  return blobToDataUrl(blob);
}

async function convertToBlob(
  dataUrl: string,
  format: ExportFormat,
  quality: number,
): Promise<Blob> {
  const mimeType = format === 'png' ? 'image/png' : format === 'jpg' ? 'image/jpeg' : 'image/webp';
  const blob = await (await fetch(dataUrl)).blob();
  const bitmap = await createImageBitmap(blob);
  const canvas = new OffscreenCanvas(bitmap.width, bitmap.height);
  const ctx = canvas.getContext('2d')!;
  ctx.drawImage(bitmap, 0, 0);
  bitmap.close();
  return canvas.convertToBlob({ type: mimeType, quality });
}
