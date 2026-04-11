import { useState } from 'react';
import { useEditorStore } from '../../../stores/editor';
import { downloadScreenshot, copyToClipboard, exportAsPdf } from '../../../lib/export';
import { getSettings, resolveFilename } from '../../../lib/settings';
import { drawAnnotation } from '../../../lib/render';
import { blobToDataUrl } from '../../../lib/utils';
import type { ExportFormat } from '../../../lib/types';

const FORMATS: { id: ExportFormat; label: string; description: string }[] = [
  { id: 'png', label: 'PNG', description: 'Lossless, best quality' },
  { id: 'jpg', label: 'JPG', description: 'Smaller file, good quality' },
  { id: 'webp', label: 'WebP', description: 'Modern format, smallest size' },
  { id: 'pdf', label: 'PDF', description: 'Document format' },
];

interface ExportDialogProps {
  onClose: () => void;
}

export function ExportDialog({ onClose }: ExportDialogProps) {
  const {
    exportFormat, setExportFormat,
    exportQuality, setExportQuality,
    imageDataUrl, annotations, imageWidth, imageHeight,
    cropRect, captureUrl,
  } = useEditorStore();

  const [isExporting, setIsExporting] = useState(false);
  const [status, setStatus] = useState('');

  /**
   * Renders the final annotated screenshot to a PNG Blob asynchronously.
   * Uses canvas.toBlob() instead of the synchronous toDataURL() to avoid
   * freezing the UI thread on large (16k×16k) composites.
   */
  async function getRenderedBlob(): Promise<Blob> {
    const finalWidth = cropRect ? cropRect.width : imageWidth;
    const finalHeight = cropRect ? cropRect.height : imageHeight;

    // Load image
    const img = new Image();
    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve();
      img.onerror = () => reject(new Error('Failed to load image'));
      img.src = imageDataUrl!;
    });

    // Render image + annotations to a final canvas at full resolution
    const canvas = document.createElement('canvas');
    canvas.width = finalWidth;
    canvas.height = finalHeight;
    const ctx = canvas.getContext('2d')!;

    if (cropRect) {
      ctx.drawImage(
        img,
        cropRect.x, cropRect.y, cropRect.width, cropRect.height,
        0, 0, finalWidth, finalHeight,
      );
    } else {
      ctx.drawImage(img, 0, 0);
    }

    // Draw annotations with crop offset
    if (cropRect) {
      ctx.translate(-cropRect.x, -cropRect.y);
    }
    // Clear cached eraser masks — they were rasterized at the editor's zoom/pan
    // which differs from the export canvas's identity transform
    for (const ann of annotations) {
      if (ann.tool === 'eraser') {
        ann.scratchMask = undefined;
        ann.scratchOffset = undefined;
      }
    }
    for (const ann of annotations) {
      drawAnnotation(ctx, ann, img, imageWidth, imageHeight);
    }

    // Async blob encoding — does NOT block the UI thread
    return new Promise<Blob>((resolve, reject) => {
      canvas.toBlob(
        (blob) => blob ? resolve(blob) : reject(new Error('Canvas toBlob failed')),
        'image/png',
      );
    });
  }

  async function handleDownload() {
    setIsExporting(true);
    setStatus('Preparing export...');
    try {
      const blob = await getRenderedBlob();
      const settings = await getSettings();
      const filename = resolveFilename(
        settings.filenamePattern,
        exportFormat === 'pdf' ? 'pdf' : exportFormat,
        captureUrl,
      );
      if (exportFormat === 'pdf') {
        // PDF export still needs a data URL for jsPDF addImage
        const dataUrl = await blobToDataUrl(blob);
        await exportAsPdf(dataUrl, 'Elysium Screenshot', filename);
      } else {
        await downloadScreenshot(blob, exportFormat, exportQuality, filename);
      }
      setStatus('Exported successfully!');
      setTimeout(onClose, 800);
    } catch (err) {
      setStatus(`Error: ${err instanceof Error ? err.message : 'Unknown'}`);
    }
    setIsExporting(false);
  }

  async function handleCopy() {
    setIsExporting(true);
    setStatus('Copying to clipboard...');
    try {
      const blob = await getRenderedBlob();
      await copyToClipboard(blob);
      setStatus('Copied to clipboard!');
      setTimeout(onClose, 800);
    } catch (err) {
      setStatus(`Error: ${err instanceof Error ? err.message : 'Unknown'}`);
    }
    setIsExporting(false);
  }

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50" onClick={onClose}>
      <div
        className="relative bg-slate-900 border border-slate-700 rounded-xl shadow-2xl w-[420px] p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-lg font-semibold text-white mb-4">Export Screenshot</h2>

        {/* Format selector */}
        <div className="grid grid-cols-4 gap-2 mb-4">
          {FORMATS.map((fmt) => (
            <button
              key={fmt.id}
              onClick={() => setExportFormat(fmt.id)}
              className={`p-2 rounded-lg border text-center transition-all ${
                exportFormat === fmt.id
                  ? 'bg-indigo-600 border-indigo-500 text-white'
                  : 'bg-slate-800 border-slate-700 text-slate-400 hover:border-slate-500'
              }`}
            >
              <div className="text-sm font-medium">{fmt.label}</div>
              <div className="text-[10px] opacity-70">{fmt.description}</div>
            </button>
          ))}
        </div>

        {/* Quality slider (not for PNG) */}
        {exportFormat !== 'png' && exportFormat !== 'pdf' && (
          <div className="mb-4">
            <div className="flex justify-between text-xs text-slate-400 mb-1">
              <span>Quality</span>
              <span>{Math.round(exportQuality * 100)}%</span>
            </div>
            <input
              type="range"
              min={0.1}
              max={1}
              step={0.05}
              value={exportQuality}
              onChange={(e) => setExportQuality(Number(e.target.value))}
              className="w-full accent-indigo-500"
            />
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-3">
          <button
            onClick={handleCopy}
            disabled={isExporting}
            className="flex-1 py-2.5 rounded-lg bg-slate-700 hover:bg-slate-600 text-white text-sm font-medium transition-colors disabled:opacity-50"
          >
            📋 Copy to Clipboard
          </button>
          <button
            onClick={handleDownload}
            disabled={isExporting}
            className="flex-1 py-2.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-medium transition-colors disabled:opacity-50"
          >
            💾 Download
          </button>
        </div>

        {/* Status */}
        {status && (
          <div className="mt-3 text-xs text-center text-indigo-300 bg-indigo-950/50 rounded py-1.5">
            {status}
          </div>
        )}

        {/* Close */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-slate-500 hover:text-white text-lg"
        >
          ✕
        </button>
      </div>
    </div>
  );
}
