import type { CaptureResult } from './types';
import { blobToDataUrl, sendToTab, sleep } from './utils';

/** Capture the visible area of a specific window, optionally hiding scrollbars */
export async function captureVisibleTab(windowId: number, tabId?: number): Promise<CaptureResult> {
  // Hide scrollbar if we have a tab to message
  if (tabId) {
    try { await sendToTab(tabId, { type: 'HIDE_SCROLLBAR' }); } catch {}
    await sleep(50);
  }

  const dataUrl = await browser.tabs.captureVisibleTab(windowId, {
    format: 'png',
    quality: 100,
  });

  // Restore scrollbar
  if (tabId) {
    try { await sendToTab(tabId, { type: 'SHOW_SCROLLBAR' }); } catch {}
  }

  const dimensions = await getImageDimensions(dataUrl);

  return {
    dataUrl,
    width: dimensions.width,
    height: dimensions.height,
    timestamp: Date.now(),
    url: '',
    title: '',
    mode: 'visible',
  };
}

/** Capture full page by scrolling and stitching screenshots */
export async function captureFullPage(tabId: number, windowId: number): Promise<CaptureResult> {
  const dims = await sendToTab(tabId, { type: 'GET_PAGE_DIMENSIONS' }) as {
    scrollHeight: number;
    scrollWidth: number;
    viewportHeight: number;
    viewportWidth: number;
    devicePixelRatio: number;
  };

  if (!dims || !dims.scrollHeight) {
    throw new Error('Could not get page dimensions.');
  }

  const totalHeight = dims.scrollHeight;
  const viewportHeight = dims.viewportHeight;
  const dpr = dims.devicePixelRatio || 1;
  const steps = Math.ceil(totalHeight / viewportHeight);

  const captures: { dataUrl: string; scrollY: number }[] = [];

  // Hide scrollbar once for the entire capture session
  try { await sendToTab(tabId, { type: 'HIDE_SCROLLBAR' }); } catch {}
  await sleep(100);

  const MAX_STEPS = 50;
  let prevScrollY = -1;
  try {
    for (let i = 0; i < steps && i < MAX_STEPS; i++) {
      const requestedScrollY = i * viewportHeight;
      const scrollResult = await sendToTab(tabId, { type: 'SCROLL_CAPTURE_STEP', scrollY: requestedScrollY }) as any;
      const actualScrollY = scrollResult?.actualScrollY ?? requestedScrollY;

      // Skip duplicate captures BEFORE capturing (scroll clamped to same position)
      if (actualScrollY === prevScrollY) break;
      prevScrollY = actualScrollY;

      await sleep(500);

      let dataUrl: string;
      try {
        dataUrl = await browser.tabs.captureVisibleTab(windowId, { format: 'png' });
      } catch {
        await sleep(700);
        dataUrl = await browser.tabs.captureVisibleTab(windowId, { format: 'png' });
      }

      captures.push({ dataUrl, scrollY: actualScrollY });

      if (i < steps - 1) await sleep(500);
    }
  } finally {
    // ALWAYS restore scrollbar + scroll position, even if capture failed mid-loop
    try { await sendToTab(tabId, { type: 'SHOW_SCROLLBAR' }); } catch {}
    try { await sendToTab(tabId, { type: 'SCROLL_CAPTURE_STEP', scrollY: 0 }); } catch {}
  }

  // Get actual pixel dimensions from captured images
  const firstImg = await getImageDimensions(captures[0].dataUrl);
  const totalPixelWidth = firstImg.width;

  // Fix: Use the actual total content height (in px), not the last scroll + viewport,
  // which can include extra whitespace if the last viewport overshoots the page bottom.
  const maxScrollablePixels = Math.round(totalHeight * dpr);
  const totalPixelHeight = Math.min(
    Math.round((captures[captures.length - 1].scrollY + viewportHeight) * dpr),
    maxScrollablePixels,
  );

  const stitchedResult = await stitchImages(captures, totalPixelWidth, totalPixelHeight, viewportHeight, dpr);

  return {
    dataUrl: stitchedResult.dataUrl,
    width: stitchedResult.width,
    height: stitchedResult.height,
    timestamp: Date.now(),
    url: '',
    title: '',
    mode: 'fullpage',
  };
}

async function stitchImages(
  captures: { dataUrl: string; scrollY: number }[],
  totalWidth: number,
  totalHeight: number,
  viewportHeight: number,
  dpr: number,
): Promise<{ dataUrl: string; width: number; height: number }> {
  let finalWidth = totalWidth;
  let finalHeight = totalHeight;
  let scale = 1;

  // Max dimension for OffscreenCanvas on many GPUs is 16384px. Scale proportionally if taller.
  const MAX_CANVAS_SIZE = 16000; 
  if (totalHeight > MAX_CANVAS_SIZE) {
    scale = MAX_CANVAS_SIZE / totalHeight;
    finalHeight = MAX_CANVAS_SIZE;
    finalWidth = Math.floor(totalWidth * scale);
  }

  const canvas = new OffscreenCanvas(finalWidth, finalHeight);
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Cannot create canvas context');

  for (let i = 0; i < captures.length; i++) {
    const capture = captures[i];
    const response = await fetch(capture.dataUrl);
    const blob = await response.blob();
    const img = await createImageBitmap(blob);

    const yPos = Math.round(capture.scrollY * dpr);
    const remainingHeight = totalHeight - yPos;
    const drawHeight = Math.min(img.height, remainingHeight);

    if (drawHeight > 0) {
      ctx.drawImage(
        img,
        0, 0, img.width, drawHeight,
        0, Math.floor(yPos * scale), Math.floor(img.width * scale), Math.floor(drawHeight * scale)
      );
    }
    img.close();
  }

  const blob = await canvas.convertToBlob({ type: 'image/png' });
  return { 
    dataUrl: await blobToDataUrl(blob),
    width: finalWidth,
    height: finalHeight
  };
}

async function getImageDimensions(dataUrl: string): Promise<{ width: number; height: number }> {
  const response = await fetch(dataUrl);
  const blob = await response.blob();
  const bitmap = await createImageBitmap(blob);
  const { width, height } = bitmap;
  bitmap.close();
  return { width, height };
}