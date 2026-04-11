import { useEffect, useRef, useState, useCallback } from 'react';
import { useEditorStore } from '../../../stores/editor';
import { drawAnnotation } from '../../../lib/render';
import type { Annotation, Point } from '../../../lib/types';

export function EditorCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const imageRef = useRef<HTMLImageElement | null>(null);
  const rafRef = useRef<number>(0);

  const {
    imageDataUrl, imageWidth, imageHeight,
    activeTool, color, lineWidth, fontSize, blurRadius,
    annotations, addAnnotation, nextNumber,
    zoom, panOffset, setZoom, setPanOffset, setView,
    cropRect, setCropRect, isCropping,
  } = useEditorStore();

  const [isDrawing, setIsDrawing] = useState(false);
  const currentPointsRef = useRef<Point[]>([]);
  const [startPoint, setStartPoint] = useState<Point | null>(null);
  const [textInput, setTextInput] = useState<{ point: Point; visible: boolean }>({
    point: { x: 0, y: 0 },
    visible: false,
  });
  const [textValue, setTextValue] = useState('');
  const textInputRef = useRef<HTMLInputElement>(null);

  // Auto-fit image to container and center it.
  // Reads dimensions from the store to avoid stale closure values.
  const fitToContainer = useCallback(() => {
    const container = containerRef.current;
    if (!container) return;

    // Read fresh values from the store — avoids stale closure issues
    const { imageWidth: iw, imageHeight: ih } = useEditorStore.getState();
    if (!iw || !ih) return;

    const cw = container.clientWidth;
    const ch = container.clientHeight;
    if (cw === 0 || ch === 0) return; // container not laid out yet
    const padding = 40;

    const scaleX = (cw - padding * 2) / iw;
    const scaleY = (ch - padding * 2) / ih;
    const fitZoom = Math.max(0.01, Math.min(scaleX, scaleY, 1)); // never zoom beyond 100%, never below 1%

    // Render pipeline: ctx.scale(zoom) -> ctx.translate(pan) -> drawImage(0,0)
    // Screen position of image pixel (ix,iy) = (pan.x + ix) * zoom, (pan.y + iy) * zoom
    // To center image: (pan.x + iw/2) * zoom = cw/2
    // => pan.x = cw / (2*zoom) - iw/2
    const newPan = {
      x: cw / (2 * fitZoom) - iw / 2,
      y: ch / (2 * fitZoom) - ih / 2,
    };

    // Set both atomically to avoid intermediate render with mismatched zoom/pan
    useEditorStore.getState().setView(fitZoom, newPan);
  }, []);

  // Load image and auto-fit to container once loaded
  useEffect(() => {
    if (!imageDataUrl) return;
    let fitFrameId: number | null = null;   // track the tryFit polling rAF
    let cancelled = false;                  // guard against post-unmount work

    const img = new Image();
    img.onload = () => {
      if (cancelled) return;                // component already unmounted
      imageRef.current = img;
      
      // Update store with intrinsic image dimensions.
      // This fixes the layout bug where capture dimensions (e.g. from DPR scaling or crop bounds) 
      // do not match the actual dataUrl blob dimensions, causing right-offsets and incorrect fit.
      useEditorStore.setState({ 
        imageWidth: img.naturalWidth, 
        imageHeight: img.naturalHeight 
      });

      // Fit and center the image once it's loaded.
      // The DOM container might not have its layout dimensions computed yet,
      // so we use a robust rAF loop waiting for non-zero dimensions.
      const tryFit = () => {
        if (cancelled) return;              // stop polling if unmounted
        const container = containerRef.current;
        if (container && container.clientWidth > 0 && container.clientHeight > 0) {
          fitToContainer();
          requestRender();
        } else {
          fitFrameId = requestAnimationFrame(tryFit);
        }
      };
      fitFrameId = requestAnimationFrame(tryFit);
    };
    img.src = imageDataUrl;

    // Cleanup: cancel any in-flight tryFit polling and prevent late onload work
    return () => {
      cancelled = true;
      if (fitFrameId !== null) cancelAnimationFrame(fitFrameId);
    };
  }, [imageDataUrl, fitToContainer]);

  // Handle container resize with ResizeObserver
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const observer = new ResizeObserver(() => {
      requestRender();
    });
    observer.observe(container);
    return () => {
      observer.disconnect();
      // Cancel any pending render frame triggered by the last resize event
      cancelAnimationFrame(rafRef.current);
    };
  }, []);

  // Re-render when state changes
  useEffect(() => {
    requestRender();
    // Cancel the pending frame on cleanup to avoid rendering on unmounted canvas
    return () => cancelAnimationFrame(rafRef.current);
  }, [annotations, zoom, panOffset, cropRect, isCropping]);

  // Invalidate cached eraser masks when zoom/pan changes — they're rasterized
  // at a specific transform and become visually corrupted at a different one.
  useEffect(() => {
    const { annotations: anns } = useEditorStore.getState();
    let dirty = false;
    for (const ann of anns) {
      if (ann.tool === 'eraser' && ann.scratchMask) {
        ann.scratchMask = undefined;
        ann.scratchOffset = undefined;
        dirty = true;
      }
    }
    if (dirty) requestRender();
  }, [zoom, panOffset]);

  function requestRender() {
    cancelAnimationFrame(rafRef.current);
    rafRef.current = requestAnimationFrame(renderCanvas);
  }

  const getCanvasPoint = useCallback(
    (e: React.MouseEvent): Point => {
      const canvas = canvasRef.current;
      if (!canvas) return { x: 0, y: 0 };
      const rect = canvas.getBoundingClientRect();
      return {
        x: (e.clientX - rect.left) / zoom - panOffset.x,
        y: (e.clientY - rect.top) / zoom - panOffset.y,
      };
    },
    [zoom, panOffset],
  );

  function renderCanvas() {
    const canvas = canvasRef.current;
    const img = imageRef.current;
    if (!canvas || !img) return;

    const container = containerRef.current;
    if (!container) return;

    // Read fresh state from the store — avoids stale closure values
    const state = useEditorStore.getState();
    const { zoom: z, panOffset: pan, imageWidth: iw, imageHeight: ih,
            annotations: anns, isCropping: cropping, cropRect: crop } = state;

    // Match canvas pixel buffer to actual container pixel size (DPR-aware)
    const dpr = window.devicePixelRatio || 1;
    const displayWidth = container.clientWidth;
    const displayHeight = container.clientHeight;

    canvas.width = displayWidth * dpr;
    canvas.height = displayHeight * dpr;

    // CSS size stays fixed to container — no stretching
    canvas.style.width = `${displayWidth}px`;
    canvas.style.height = `${displayHeight}px`;

    const ctx = canvas.getContext('2d')!;
    ctx.scale(dpr, dpr);

    // Fill background
    ctx.fillStyle = '#0f172a';
    ctx.fillRect(0, 0, displayWidth, displayHeight);

    ctx.save();
    ctx.scale(z, z);
    ctx.translate(pan.x, pan.y);

    // Apply a floating drop-shadow / glow to the screenshot
    ctx.shadowColor = 'rgba(0, 0, 0, 0.5)';
    // Scale the blur and offset inversely with zoom so the glow maintains a consistent physical screen size
    ctx.shadowBlur = 100 / z; 
    ctx.shadowOffsetY = 40 / z;
    ctx.shadowOffsetX = 0;

    // Draw image at its natural size — zoom + panOffset handle fitting
    ctx.drawImage(img, 0, 0, iw, ih);

    // Turn off shadow so subsequent annotations do not glow
    ctx.shadowColor = 'transparent';
    ctx.shadowBlur = 0;
    ctx.shadowOffsetY = 0;

    // Draw annotations
    for (const ann of anns) {
      drawAnnotation(ctx, ann, imageRef.current, iw, ih);
    }

    // Draw crop overlay
    if (cropping && crop) {
      ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
      ctx.fillRect(0, 0, iw, ih);
      ctx.clearRect(crop.x, crop.y, crop.width, crop.height);
      ctx.drawImage(
        img,
        crop.x, crop.y, crop.width, crop.height,
        crop.x, crop.y, crop.width, crop.height,
      );
      ctx.save();
      ctx.beginPath();
      ctx.rect(crop.x, crop.y, crop.width, crop.height);
      ctx.clip();
      for (const ann of anns) {
        drawAnnotation(ctx, ann, imageRef.current, iw, ih);
      }
      ctx.restore();

      ctx.strokeStyle = '#4f46e5';
      ctx.lineWidth = 2 / z;
      ctx.setLineDash([6 / z, 4 / z]);
      ctx.strokeRect(crop.x, crop.y, crop.width, crop.height);
      ctx.setLineDash([]);
    }

    ctx.restore();
  }

  function handleMouseDown(e: React.MouseEvent) {
    // Middle click or no tool = start panning
    if (e.button === 1 || (e.button === 0 && !activeTool)) {
      setIsDrawing(true);
      setStartPoint({ x: e.clientX, y: e.clientY });
      return;
    }
    if (!activeTool) return;

    const point = getCanvasPoint(e);

    if (activeTool === 'text') {
      setTextInput({ point, visible: true });
      setTextValue('');
      setTimeout(() => textInputRef.current?.focus(), 50);
      return;
    }

    if (activeTool === 'number') {
      addAnnotation({
        id: crypto.randomUUID(),
        tool: 'number',
        color,
        lineWidth,
        startPoint: point,
        number: nextNumber,
      });
      requestRender();
      return;
    }

    setIsDrawing(true);
    setStartPoint(point);

    if (activeTool === 'pen' || activeTool === 'highlight' || activeTool === 'eraser') {
      currentPointsRef.current = [point];
    }
  }

  function handleMouseMove(e: React.MouseEvent) {
    if (!isDrawing || !startPoint) return;

    // Pan mode (no tool selected or middle-click)
    if (!activeTool || e.buttons === 4) {
      const dx = (e.clientX - startPoint.x) / zoom;
      const dy = (e.clientY - startPoint.y) / zoom;
      setPanOffset({ x: panOffset.x + dx, y: panOffset.y + dy });
      setStartPoint({ x: e.clientX, y: e.clientY });
      return;
    }

    const point = getCanvasPoint(e);

    if (activeTool === 'pen' || activeTool === 'highlight' || activeTool === 'eraser') {
      currentPointsRef.current.push(point);
      drawLivePreview();
    } else if (activeTool === 'crop') {
      const x = Math.min(startPoint.x, point.x);
      const y = Math.min(startPoint.y, point.y);
      const width = Math.abs(point.x - startPoint.x);
      const height = Math.abs(point.y - startPoint.y);
      setCropRect({ x, y, width, height });
    } else {
      drawLivePreview(point);
    }
  }

  function drawLivePreview(currentPoint?: Point) {
    renderCanvas();
    const canvas = canvasRef.current;
    if (!canvas || !startPoint) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const dpr = window.devicePixelRatio || 1;

    const { zoom: z, panOffset: pan } = useEditorStore.getState();

    ctx.save();
    ctx.scale(dpr, dpr);
    ctx.scale(z, z);
    ctx.translate(pan.x, pan.y);

    const isFreehand = activeTool === 'pen' || activeTool === 'highlight' || activeTool === 'eraser';

    const previewAnnotation: Annotation = {
      id: 'preview',
      tool: activeTool!,
      color: activeTool === 'eraser' ? '#ffffff' : color,
      lineWidth,
      fontSize,
      blurRadius,
      startPoint,
      endPoint: currentPoint ?? startPoint,
      points: isFreehand ? currentPointsRef.current : undefined,
    };

    drawAnnotation(ctx, previewAnnotation, imageRef.current, imageWidth, imageHeight);
    ctx.restore();
  }

  function handleMouseUp(e: React.MouseEvent) {
    if (!isDrawing) return;

    // Pan mode — just stop
    if (!activeTool || e.button === 1) {
      setIsDrawing(false);
      setStartPoint(null);
      return;
    }

    if (!startPoint) return;
    setIsDrawing(false);

    const endPoint = getCanvasPoint(e);

    if (activeTool === 'crop') {
      setStartPoint(null);
      return;
    }

    if (activeTool === 'pen' || activeTool === 'highlight' || activeTool === 'eraser') {
      const points = [...currentPointsRef.current, endPoint];
      if (points.length > 1) {
        addAnnotation({
          id: crypto.randomUUID(),
          tool: activeTool,
          color: activeTool === 'eraser' ? '#ffffff' : color,
          lineWidth,
          points,
        });
      }
    } else if (activeTool !== 'text' && activeTool !== 'number') {
      const dx = Math.abs(endPoint.x - startPoint.x);
      const dy = Math.abs(endPoint.y - startPoint.y);
      if (dx > 3 || dy > 3) {
        addAnnotation({
          id: crypto.randomUUID(),
          tool: activeTool,
          color,
          lineWidth,
          blurRadius,
          startPoint,
          endPoint,
        });
      }
    }

    setStartPoint(null);
    currentPointsRef.current = [];
    requestRender();
  }

  function handleTextSubmit() {
    if (textValue.trim()) {
      addAnnotation({
        id: crypto.randomUUID(),
        tool: 'text',
        color,
        lineWidth,
        fontSize,
        text: textValue.trim(),
        startPoint: textInput.point,
      });
    }
    setTextInput({ ...textInput, visible: false });
    setTextValue('');
    requestRender();
  }

  // Zoom toward a focal point (in screen/client coords relative to canvas)
  function zoomToward(newZoom: number, focalScreenX: number, focalScreenY: number) {
    const clampedZoom = Math.max(0.01, Math.min(5, newZoom));
    // The focal point in image coords before zoom: (focalScreen / oldZoom) - panOffset
    // After zoom, we want the same image point to be at the same screen position:
    // focalScreen / newZoom = imagePoint + newPan
    // newPan = focalScreen / newZoom - imagePoint
    // newPan = focalScreen / newZoom - (focalScreen / oldZoom - oldPan)
    // newPan = focalScreen * (1/newZoom - 1/oldZoom) + oldPan
    const newPan = {
      x: focalScreenX * (1 / clampedZoom - 1 / zoom) + panOffset.x,
      y: focalScreenY * (1 / clampedZoom - 1 / zoom) + panOffset.y,
    };
    setView(clampedZoom, newPan);
  }

  // Zoom toward center of the viewport (for +/- buttons)
  function zoomTowardCenter(delta: number) {
    const container = containerRef.current;
    if (!container) return;
    const cx = container.clientWidth / 2;
    const cy = container.clientHeight / 2;
    zoomToward(zoom + delta, cx, cy);
  }

  // Use native wheel listener with { passive: false } to allow preventDefault
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    function onWheel(e: WheelEvent) {
      e.preventDefault();
      const { zoom, panOffset, setView, setPanOffset } = useEditorStore.getState();
      if (e.ctrlKey || e.metaKey) {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const rect = canvas.getBoundingClientRect();
        const mx = e.clientX - rect.left;
        const my = e.clientY - rect.top;
        const delta = e.deltaY > 0 ? -0.05 : 0.05;
        const newZoom = Math.max(0.01, Math.min(5, zoom + delta));
        setView(newZoom, {
          x: mx * (1 / newZoom - 1 / zoom) + panOffset.x,
          y: my * (1 / newZoom - 1 / zoom) + panOffset.y,
        });
      } else {
        setPanOffset({
          x: panOffset.x - e.deltaX / zoom,
          y: panOffset.y - e.deltaY / zoom,
        });
      }
    }

    container.addEventListener('wheel', onWheel, { passive: false });
    return () => container.removeEventListener('wheel', onWheel);
  }, []);

  return (
    <div
      ref={containerRef}
      className="w-full h-full relative overflow-hidden"
    >
      <canvas
        ref={canvasRef}
        className={`absolute top-0 left-0 ${
          !activeTool
            ? 'cursor-grab active:cursor-grabbing'
            : activeTool === 'text'
              ? 'cursor-text'
              : 'cursor-crosshair'
        }`}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={() => {
          if (isDrawing) {
            setIsDrawing(false);
            setStartPoint(null);
            currentPointsRef.current = [];
          }
        }}
      />

      {/* Zoom controls — bottom left, frosted glass */}
      <div className="absolute bottom-6 left-6 z-50 flex items-center gap-1 bg-slate-900/60 backdrop-blur-xl border border-white/10 shadow-2xl shadow-black/40 rounded-2xl px-2 py-1.5 scale-[1.4] origin-bottom-left">
        <button
          onClick={() => zoomTowardCenter(-0.1)}
          className="w-7 h-7 rounded-xl flex items-center justify-center text-slate-300 hover:bg-white/10 text-sm transition-all"
          title="Zoom out"
        >
          −
        </button>
        <span className="text-[11px] text-slate-400 w-10 text-center select-none">
          {Math.round(zoom * 100)}%
        </span>
        <button
          onClick={() => zoomTowardCenter(0.1)}
          className="w-7 h-7 rounded-xl flex items-center justify-center text-slate-300 hover:bg-white/10 text-sm transition-all"
          title="Zoom in"
        >
          +
        </button>
        <div className="w-px h-4 bg-white/10 mx-0.5" />
        <button
          onClick={fitToContainer}
          className="h-7 px-2.5 rounded-xl text-slate-300 hover:bg-white/10 text-[11px] transition-all"
          title="Fit to window"
        >
          Fit to window
        </button>
      </div>

      {/* Floating text input */}
      {textInput.visible && (
        <div
          className="absolute pointer-events-auto"
          style={{
            left: textInput.point.x * zoom + panOffset.x * zoom,
            top: textInput.point.y * zoom + panOffset.y * zoom,
          }}
        >
          <input
            ref={textInputRef}
            type="text"
            value={textValue}
            onChange={(e) => setTextValue(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleTextSubmit();
              if (e.key === 'Escape') {
                setTextInput({ ...textInput, visible: false });
                setTextValue('');
              }
            }}
            onBlur={handleTextSubmit}
            className="bg-black/70 text-white border border-indigo-500 rounded px-2 py-1 outline-none min-w-[120px]"
            style={{ 
              fontSize: `${fontSize}px`, 
              color,
              transform: `scale(${zoom})`,
              transformOrigin: 'top left'
            }}
            placeholder="Type here..."
          />
        </div>
      )}
    </div>
  );
}
