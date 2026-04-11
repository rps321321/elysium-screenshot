import type { Annotation } from './types';

/**
 * Shared annotation drawing logic used by both EditorCanvas (live preview)
 * and ExportDialog (final export). For tools that reference the original image
 * (blur, eraser), pass imageRef/imageWidth/imageHeight.
 */
export function drawAnnotation(
  ctx: CanvasRenderingContext2D,
  ann: Annotation,
  imageRef?: HTMLImageElement | null,
  imageWidth?: number,
  imageHeight?: number,
): void {
  ctx.strokeStyle = ann.color;
  ctx.fillStyle = ann.color;
  ctx.lineWidth = ann.lineWidth;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  switch (ann.tool) {
    case 'pen': {
      if (!ann.points || ann.points.length < 2) return;
      ctx.beginPath();
      ctx.moveTo(ann.points[0].x, ann.points[0].y);
      for (let i = 1; i < ann.points.length; i++) {
        ctx.lineTo(ann.points[i].x, ann.points[i].y);
      }
      ctx.stroke();
      break;
    }
    case 'eraser': {
      if (!ann.points || ann.points.length < 2) return;
      // For export: render the original image through the eraser path onto a scratch
      // canvas, then composite only those pixels over the main canvas.
      // This avoids the destination-over approach which would undo annotations
      // drawn between multiple eraser strokes.
      if (imageRef && imageWidth && imageHeight) {
        // Compute bounding box of the eraser stroke to minimize scratch canvas size
        const strokeW = ann.lineWidth * 3;
        let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
        if (ann.bounds) {
          ({ minX, minY, maxX, maxY } = ann.bounds);
        } else {
          for (const p of ann.points) {
            if (p.x < minX) minX = p.x;
            if (p.y < minY) minY = p.y;
            if (p.x > maxX) maxX = p.x;
            if (p.y > maxY) maxY = p.y;
          }
          if (ann.id !== 'preview') {
            ann.bounds = { minX, minY, maxX, maxY };
          }
        }

        // For preview strokes (still being drawn), always recompute — don't cache
        if (ann.id === 'preview') {
          const transform = ctx.getTransform();
          const scale = Math.max(Math.abs(transform.a), Math.abs(transform.d));
          const pad = strokeW * scale + 2;
          const bx = Math.floor(minX * transform.a + transform.e - pad);
          const by = Math.floor(minY * transform.d + transform.f - pad);
          const bw = Math.ceil((maxX - minX) * scale + pad * 2);
          const bh = Math.ceil((maxY - minY) * scale + pad * 2);

          const scratch = document.createElement('canvas');
          scratch.width = Math.max(bw, 1);
          scratch.height = Math.max(bh, 1);
          const sctx = scratch.getContext('2d');
          if (!sctx) break;

          sctx.setTransform(transform.a, transform.b, transform.c, transform.d, transform.e - bx, transform.f - by);
          sctx.lineWidth = strokeW;
          sctx.lineCap = 'round';
          sctx.lineJoin = 'round';
          sctx.strokeStyle = '#ffffff';
          sctx.beginPath();
          sctx.moveTo(ann.points[0].x, ann.points[0].y);
          for (let i = 1; i < ann.points.length; i++) {
            sctx.lineTo(ann.points[i].x, ann.points[i].y);
          }
          sctx.stroke();
          sctx.globalCompositeOperation = 'source-in';
          sctx.drawImage(imageRef, 0, 0, imageWidth, imageHeight);

          ctx.save();
          ctx.setTransform(1, 0, 0, 1, 0, 0);
          ctx.drawImage(scratch, bx, by);
          ctx.restore();
        } else {
          // Finalized annotation — cache the scratch canvas for reuse across frames
          if (!ann.scratchMask) {
            const transform = ctx.getTransform();
            const scale = Math.max(Math.abs(transform.a), Math.abs(transform.d));
            const pad = strokeW * scale + 2;
            const bx = Math.floor(minX * transform.a + transform.e - pad);
            const by = Math.floor(minY * transform.d + transform.f - pad);
            const bw = Math.ceil((maxX - minX) * scale + pad * 2);
            const bh = Math.ceil((maxY - minY) * scale + pad * 2);

            const scratch = document.createElement('canvas');
            scratch.width = Math.max(bw, 1);
            scratch.height = Math.max(bh, 1);
            const sctx = scratch.getContext('2d');
            if (!sctx) break;

            sctx.setTransform(transform.a, transform.b, transform.c, transform.d, transform.e - bx, transform.f - by);
            sctx.lineWidth = strokeW;
            sctx.lineCap = 'round';
            sctx.lineJoin = 'round';
            sctx.strokeStyle = '#ffffff';
            sctx.beginPath();
            sctx.moveTo(ann.points[0].x, ann.points[0].y);
            for (let i = 1; i < ann.points.length; i++) {
              sctx.lineTo(ann.points[i].x, ann.points[i].y);
            }
            sctx.stroke();
            sctx.globalCompositeOperation = 'source-in';
            sctx.drawImage(imageRef, 0, 0, imageWidth, imageHeight);

            ann.scratchMask = scratch;
            ann.scratchOffset = { x: bx, y: by };
          }

          // Blit the cached scratch mask — zero allocation, zero compositing
          ctx.save();
          ctx.setTransform(1, 0, 0, 1, 0, 0);
          ctx.drawImage(ann.scratchMask, ann.scratchOffset!.x, ann.scratchOffset!.y);
          ctx.restore();
        }
      } else {
        // Live preview (in-editor): use simple destination-out
        ctx.save();
        ctx.globalCompositeOperation = 'destination-out';
        ctx.lineWidth = ann.lineWidth * 3;
        ctx.beginPath();
        ctx.moveTo(ann.points[0].x, ann.points[0].y);
        for (let i = 1; i < ann.points.length; i++) {
          ctx.lineTo(ann.points[i].x, ann.points[i].y);
        }
        ctx.stroke();
        ctx.restore();
      }
      break;
    }
    case 'arrow': {
      if (!ann.startPoint || !ann.endPoint) return;
      const { startPoint: sp, endPoint: ep } = ann;
      const angle = Math.atan2(ep.y - sp.y, ep.x - sp.x);
      const headLen = 15 + ann.lineWidth * 2;

      ctx.beginPath();
      ctx.moveTo(sp.x, sp.y);
      ctx.lineTo(ep.x, ep.y);
      ctx.stroke();

      ctx.beginPath();
      ctx.moveTo(ep.x, ep.y);
      ctx.lineTo(
        ep.x - headLen * Math.cos(angle - Math.PI / 6),
        ep.y - headLen * Math.sin(angle - Math.PI / 6),
      );
      ctx.lineTo(
        ep.x - headLen * Math.cos(angle + Math.PI / 6),
        ep.y - headLen * Math.sin(angle + Math.PI / 6),
      );
      ctx.closePath();
      ctx.fill();
      break;
    }
    case 'rect': {
      if (!ann.startPoint || !ann.endPoint) return;
      const x = Math.min(ann.startPoint.x, ann.endPoint.x);
      const y = Math.min(ann.startPoint.y, ann.endPoint.y);
      const w = Math.abs(ann.endPoint.x - ann.startPoint.x);
      const h = Math.abs(ann.endPoint.y - ann.startPoint.y);
      ctx.strokeRect(x, y, w, h);
      break;
    }
    case 'circle': {
      if (!ann.startPoint || !ann.endPoint) return;
      const cx = (ann.startPoint.x + ann.endPoint.x) / 2;
      const cy = (ann.startPoint.y + ann.endPoint.y) / 2;
      const rx = Math.abs(ann.endPoint.x - ann.startPoint.x) / 2;
      const ry = Math.abs(ann.endPoint.y - ann.startPoint.y) / 2;
      ctx.beginPath();
      ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
      ctx.stroke();
      break;
    }
    case 'line': {
      if (!ann.startPoint || !ann.endPoint) return;
      ctx.beginPath();
      ctx.moveTo(ann.startPoint.x, ann.startPoint.y);
      ctx.lineTo(ann.endPoint.x, ann.endPoint.y);
      ctx.stroke();
      break;
    }
    case 'text': {
      if (!ann.startPoint || !ann.text) return;
      ctx.font = `bold ${ann.fontSize ?? 20}px system-ui, -apple-system, sans-serif`;
      ctx.fillStyle = ann.color;

      const metrics = ctx.measureText(ann.text);
      const textHeight = (ann.fontSize ?? 20) * 1.2;
      ctx.fillStyle = 'rgba(0,0,0,0.6)';
      ctx.fillRect(
        ann.startPoint.x - 4,
        ann.startPoint.y - textHeight + 4,
        metrics.width + 8,
        textHeight + 4,
      );
      ctx.fillStyle = ann.color;
      ctx.fillText(ann.text, ann.startPoint.x, ann.startPoint.y);
      break;
    }
    case 'highlight': {
      if (!ann.points || ann.points.length < 2) return;
      ctx.save();
      ctx.globalAlpha = 0.35;
      ctx.strokeStyle = ann.color;
      ctx.lineWidth = ann.lineWidth * 4;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(ann.points[0].x, ann.points[0].y);
      for (let i = 1; i < ann.points.length; i++) {
        ctx.lineTo(ann.points[i].x, ann.points[i].y);
      }
      ctx.stroke();
      ctx.restore();
      break;
    }
    case 'blur': {
      if (!ann.startPoint || !ann.endPoint) return;
      const bx = Math.min(ann.startPoint.x, ann.endPoint.x);
      const by = Math.min(ann.startPoint.y, ann.endPoint.y);
      const bw = Math.abs(ann.endPoint.x - ann.startPoint.x);
      const bh = Math.abs(ann.endPoint.y - ann.startPoint.y);

      if (bw < 2 || bh < 2) return;

      ctx.save();
      ctx.filter = `blur(${ann.blurRadius ?? 10}px)`;
      ctx.beginPath();
      ctx.rect(bx, by, bw, bh);
      ctx.clip();
      if (imageRef && imageWidth && imageHeight) {
        ctx.drawImage(imageRef, 0, 0, imageWidth, imageHeight);
      }
      ctx.restore();
      break;
    }
    case 'number': {
      if (!ann.startPoint || ann.number == null) return;
      const radius = 14 + ann.lineWidth;
      ctx.beginPath();
      ctx.arc(ann.startPoint.x, ann.startPoint.y, radius, 0, Math.PI * 2);
      ctx.fillStyle = ann.color;
      ctx.fill();
      ctx.strokeStyle = '#fff';
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.fillStyle = '#fff';
      ctx.font = `bold ${radius}px system-ui, -apple-system, sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(String(ann.number), ann.startPoint.x, ann.startPoint.y);
      ctx.textAlign = 'start';
      ctx.textBaseline = 'alphabetic';
      break;
    }
  }
}
