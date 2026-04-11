import React, { useEffect } from 'react';
import { useEditorStore } from '../../stores/editor';
import { EditorCanvas } from './components/EditorCanvas';
import { Toolbar } from './components/Toolbar';
import { ExportDialog } from './components/ExportDialog';
import { ErrorBoundary } from './components/ErrorBoundary';
import { getSettings } from '../../lib/settings';
import type { CaptureResult } from '../../lib/types';

export default function EditorApp() {
  const { setImage, setCaptureUrl, imageDataUrl, undo, redo } = useEditorStore();
  const [showExport, setShowExport] = React.useState(false);

  const [copiedToast, setCopiedToast] = React.useState(false);
  const [loadError, setLoadError] = React.useState('');
  const blobUrlRef = React.useRef<string | null>(null);

  // Revoke the Object URL when the editor unmounts to free RAM
  useEffect(() => {
    return () => {
      if (blobUrlRef.current) {
        URL.revokeObjectURL(blobUrlRef.current);
        blobUrlRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    async function loadCapture() {
      const result = await browser.storage.local.get('elysium_pending_capture');
      const capture = result.elysium_pending_capture as CaptureResult | undefined;
      if (capture) {
        if (capture.blobId) {
          const { retrieveBlob, deleteBlob } = await import('../../lib/storage/db');
          const blob = await retrieveBlob(capture.blobId);
          if (blob) {
            const blobUrl = URL.createObjectURL(blob);
            blobUrlRef.current = blobUrl;
            capture.dataUrl = blobUrl;
            // Free IndexedDB disk space immediately — the blob is now in memory via the Object URL
            await deleteBlob(capture.blobId);
          } else {
            setLoadError('Failed to load image from database. It might be corrupt.');
            await browser.storage.local.remove('elysium_pending_capture');
            return;
          }
        } else if (!capture.dataUrl) {
          setLoadError('Screenshot data was too large to store. Please try again with a smaller capture.');
          await browser.storage.local.remove('elysium_pending_capture');
          return;
        }

        setImage(capture.dataUrl, capture.width, capture.height);
        setCaptureUrl(capture.url ?? '');
        await browser.storage.local.remove('elysium_pending_capture');

        // Auto-copy to clipboard (if enabled in settings)
        try {
          const settings = await getSettings();
          if (settings.autoCopyToClipboard) {
            const resp = await fetch(capture.dataUrl);
            const blob = await resp.blob();
            const pngBlob = blob.type === 'image/png' ? blob : await convertToPng(blob);
            await navigator.clipboard.write([new ClipboardItem({ 'image/png': pngBlob })])
            setCopiedToast(true);
            setTimeout(() => setCopiedToast(false), 2000);
          }

          // Load default format/quality into editor store
          if (settings.defaultFormat) {
            useEditorStore.getState().setExportFormat(settings.defaultFormat);
          }
          if (settings.defaultQuality) {
            useEditorStore.getState().setExportQuality(settings.defaultQuality);
          }
        } catch (err) {
          console.warn('Elysium: auto-copy to clipboard failed', err);
        }
      }
    }
    loadCapture();
  }, [setImage, setCaptureUrl]);

  async function convertToPng(blob: Blob): Promise<Blob> {
    const bitmap = await createImageBitmap(blob);
    const canvas = document.createElement('canvas');
    canvas.width = bitmap.width;
    canvas.height = bitmap.height;
    canvas.getContext('2d')!.drawImage(bitmap, 0, 0);
    bitmap.close();
    return new Promise((resolve, reject) =>
      canvas.toBlob((b) => b ? resolve(b) : reject(new Error('PNG conversion failed')), 'image/png'),
    );
  }

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey) {
        e.preventDefault();
        undo();
      } else if ((e.ctrlKey || e.metaKey) && (e.key === 'y' || (e.key === 'z' && e.shiftKey))) {
        e.preventDefault();
        redo();
      } else if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault();
        setShowExport(true);
      }
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [undo, redo]);

  if (!imageDataUrl) {
    return (
      <div className="h-screen flex items-center justify-center bg-slate-950 text-slate-400">
        <div className="text-center">
          <div className="text-4xl mb-4">📷</div>
          {loadError ? (
            <>
              <p className="text-lg text-red-400">Error</p>
              <p className="text-sm mt-2 max-w-md">{loadError}</p>
            </>
          ) : (
            <>
              <p className="text-lg">Loading screenshot...</p>
              <p className="text-sm mt-2">If nothing loads, take a new screenshot from the extension popup.</p>
            </>
          )}
        </div>
      </div>
    );
  }

  return (
    <ErrorBoundary>
      <div className="h-screen relative bg-slate-950 select-none overflow-hidden">
        {/* Canvas takes full screen */}
        <EditorCanvas />

        {/* Floating toolbar — centered at top */}
        <Toolbar onExport={() => setShowExport(true)} />

        {showExport && <ExportDialog onClose={() => setShowExport(false)} />}

        {/* Copied toast */}
        {copiedToast && (
          <div className="absolute bottom-16 left-1/2 -translate-x-1/2 z-50 px-4 py-2 bg-slate-900/80 backdrop-blur-xl border border-white/10 rounded-xl text-sm text-emerald-400 shadow-2xl animate-fade-in">
            Copied to clipboard
          </div>
        )}
      </div>
    </ErrorBoundary>
  );
}
