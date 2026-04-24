import type { CaptureMode, ScreenshotHistoryItem } from './types';
import { blobToDataUrl } from './utils';

const STORAGE_KEY = 'elysium_history';
const MAX_HISTORY = 50;
const THUMBNAIL_SIZE = 200;

// Mutex lock to prevent race conditions when saving history concurrently
let historyLock = Promise.resolve();

export async function saveToHistory(
  dataUrl: string,
  width: number,
  height: number,
  url: string,
  title: string,
  mode: CaptureMode,
): Promise<void> {
  const thumbnail = await createThumbnail(dataUrl);
  const item: ScreenshotHistoryItem = {
    id: crypto.randomUUID(),
    thumbnail,
    width,
    height,
    timestamp: Date.now(),
    url,
    title,
    mode,
  };

  // Chain on the previous lock but don't let one failure poison future writes —
  // reset the lock to a resolved promise after this write finishes (success or fail).
  const writePromise = historyLock.catch(() => {}).then(async () => {
    const history = await getHistory();
    history.unshift(item);

    if (history.length > MAX_HISTORY) {
      history.length = MAX_HISTORY;
    }

    await browser.storage.local.set({ [STORAGE_KEY]: history });
  });

  historyLock = writePromise.catch(() => {});
  await writePromise;
}

async function getHistory(): Promise<ScreenshotHistoryItem[]> {
  const result = await browser.storage.local.get(STORAGE_KEY);
  return result[STORAGE_KEY] ?? [];
}

async function createThumbnail(dataUrl: string): Promise<string> {
  const blob = await (await fetch(dataUrl)).blob();
  const bitmap = await createImageBitmap(blob);

  const scale = THUMBNAIL_SIZE / Math.max(bitmap.width, bitmap.height);
  const width = Math.round(bitmap.width * scale);
  const height = Math.round(bitmap.height * scale);

  const canvas = new OffscreenCanvas(width, height);
  const ctx = canvas.getContext('2d')!;
  ctx.drawImage(bitmap, 0, 0, width, height);
  bitmap.close();

  const thumbBlob = await canvas.convertToBlob({ type: 'image/jpeg', quality: 0.7 });
  return blobToDataUrl(thumbBlob);
}

