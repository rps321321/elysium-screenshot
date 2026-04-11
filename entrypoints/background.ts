import { captureVisibleTab, captureFullPage } from '../lib/capture';
import { getSettings, resolveFilename } from '../lib/settings';
import { saveToHistory } from '../lib/history';
import { blobToDataUrl, sendToTab, sleep } from '../lib/utils';
import { storeBlob } from '../lib/storage/db';
import type { CaptureResult, CaptureMode } from '../lib/types';

export default defineBackground(() => {
  // ─── Helpers ───

  /** Show a user-facing error notification when capture fails. */
  async function showErrorNotification(message: string): Promise<void> {
    try {
      await browser.notifications.create({
        type: 'basic',
        iconUrl: browser.runtime.getURL('/icons/icon-128.png'),
        title: 'Elysium Screenshot',
        message,
      });
    } catch {
      // Notification API itself failed — nothing we can do
    }
  }

  async function getPageTab(): Promise<chrome.tabs.Tab> {
    // Try current window first
    let tabs = await browser.tabs.query({ active: true, lastFocusedWindow: true });
    for (const tab of tabs) {
      if (tab.id && tab.url && !tab.url.startsWith('chrome://') && !tab.url.startsWith('chrome-extension://') && !tab.url.startsWith('about')) {
        return tab;
      }
    }
    // Fallback: all windows
    tabs = await browser.tabs.query({ active: true });
    for (const tab of tabs) {
      if (tab.id && tab.url && !tab.url.startsWith('chrome://') && !tab.url.startsWith('chrome-extension://') && !tab.url.startsWith('about')) {
        return tab;
      }
    }
    throw new Error('No page tab found');
  }

  async function injectContentScript(tabId: number): Promise<boolean> {
    try {
      // Try a ping first
      await browser.tabs.sendMessage(tabId, { type: 'PING' });
      return true;
    } catch {
      try {
        await browser.scripting.executeScript({
          target: { tabId },
          files: ['content-scripts/content.js'],
        });
        await sleep(300);
        return true;
      } catch (err) {
        console.warn('Elysium: Cannot inject into this tab:', err);
        return false;
      }
    }
  }

  async function handleCaptureDone(capture: CaptureResult) {
    const settings = await getSettings();

    // Auto-save to downloads
    if (settings.afterCapture === 'save' || settings.afterCapture === 'both') {
      try {
        const filename = resolveFilename(settings.filenamePattern, settings.defaultFormat, capture.url);
        let downloadUrl = capture.dataUrl;

        // Convert format if not PNG
        if (settings.defaultFormat !== 'png') {
          const blob = await (await fetch(capture.dataUrl)).blob();
          const bitmap = await createImageBitmap(blob);
          const canvas = new OffscreenCanvas(bitmap.width, bitmap.height);
          canvas.getContext('2d')!.drawImage(bitmap, 0, 0);
          bitmap.close();
          const mime = settings.defaultFormat === 'jpg' ? 'image/jpeg' : 'image/webp';
          const converted = await canvas.convertToBlob({ type: mime, quality: settings.defaultQuality });
          downloadUrl = await blobToDataUrl(converted);
        }

        await browser.downloads.download({ url: downloadUrl, filename, saveAs: false });

        // Show notification
        try {
          await browser.notifications.create({
            type: 'basic',
            iconUrl: browser.runtime.getURL('/icons/icon-128.png'),
            title: 'Elysium Screenshot',
            message: `Saved: ${filename}`,
          });
        } catch {}
      } catch (err) {
        console.error('Elysium: auto-save failed', err);
      }
    }

    // Save to history (thumbnails only) — pass actual capture mode
    try {
      await saveToHistory(capture.dataUrl, capture.width, capture.height, capture.url, capture.title, capture.mode);
    } catch (err) {
      console.warn('Elysium: failed to save to history', err);
    }

    // Open editor
    if (settings.afterCapture === 'editor' || settings.afterCapture === 'both') {
      try {
        const blob = await (await fetch(capture.dataUrl)).blob();
        const blobId = crypto.randomUUID();
        await storeBlob(blobId, blob);
        
        await browser.storage.local.remove('elysium_pending_capture');
        await browser.storage.local.set({ elysium_pending_capture: { ...capture, dataUrl: '', blobId } });
        
        await browser.tabs.create({ url: browser.runtime.getURL('/editor.html'), active: true });
      } catch (err) {
        console.error('Elysium: failed to open editor tab or save blob', err);
        try { await browser.storage.local.remove('elysium_pending_capture'); } catch {}
      }
    }
  }

  // ─── Core captures ───

  async function doVisible() {
    const tab = await getPageTab();
    await injectContentScript(tab.id!);
    const capture = await captureVisibleTab(tab.windowId!, tab.id!);
    capture.url = tab.url ?? '';
    capture.title = tab.title ?? '';
    await handleCaptureDone(capture);
  }

  async function doFullPage() {
    const tab = await getPageTab();
    const injected = await injectContentScript(tab.id!);
    if (!injected) throw new Error('Cannot capture this page (content script injection failed)');
    const capture = await captureFullPage(tab.id!, tab.windowId!);
    capture.url = tab.url ?? '';
    capture.title = tab.title ?? '';
    await handleCaptureDone(capture);
  }

  async function doRegion() {
    const tab = await getPageTab();
    const injected = await injectContentScript(tab.id!);
    if (!injected) throw new Error('Cannot use region select on this page');
    await sendToTab(tab.id!, { type: 'START_REGION_SELECT' });
  }

  async function doElement() {
    const tab = await getPageTab();
    const injected = await injectContentScript(tab.id!);
    if (!injected) throw new Error('Cannot use element picker on this page');
    await sendToTab(tab.id!, { type: 'START_ELEMENT_SELECT' });
  }

  async function doDelayed(delay: number) {
    const tab = await getPageTab();
    const injected = await injectContentScript(tab.id!);
    if (injected) {
      await sendToTab(tab.id!, { type: 'SHOW_COUNTDOWN', seconds: delay });
    }
    await sleep(delay * 1000 + 300);
    const capture = await captureVisibleTab(tab.windowId!, injected ? tab.id! : undefined);
    capture.url = tab.url ?? '';
    capture.title = tab.title ?? '';
    capture.mode = 'delayed';
    await handleCaptureDone(capture);
  }

  async function doCropCapture(senderTab: chrome.tabs.Tab, rect: any, mode: CaptureMode) {
    let dpr = 1;
    try {
      const dims = await sendToTab(senderTab.id!, { type: 'GET_PAGE_DIMENSIONS' }) as any;
      dpr = dims?.devicePixelRatio || 1;
    } catch { /* use default dpr */ }

    // Hide scrollbar + small delay to ensure overlay is gone
    try { await sendToTab(senderTab.id!, { type: 'HIDE_SCROLLBAR' }); } catch {}
    await sleep(100);

    let screenshotUrl: string;
    try {
      screenshotUrl = await browser.tabs.captureVisibleTab(senderTab.windowId!, {
        format: 'png', quality: 100,
      });
    } finally {
      try { await sendToTab(senderTab.id!, { type: 'SHOW_SCROLLBAR' }); } catch {}
    }

    const blob = await (await fetch(screenshotUrl)).blob();
    const bitmap = await createImageBitmap(blob);
    const sx = Math.round(rect.x * dpr);
    const sy = Math.round(rect.y * dpr);
    const sw = Math.max(1, Math.min(Math.round(rect.width * dpr), bitmap.width - sx));
    const sh = Math.max(1, Math.min(Math.round(rect.height * dpr), bitmap.height - sy));
    const canvas = new OffscreenCanvas(sw, sh);
    canvas.getContext('2d')!.drawImage(bitmap, sx, sy, sw, sh, 0, 0, sw, sh);
    bitmap.close();
    const cropBlob = await canvas.convertToBlob({ type: 'image/png' });
    const dataUrl = await blobToDataUrl(cropBlob);

    await handleCaptureDone({
      dataUrl,
      width: sw, height: sh, timestamp: Date.now(),
      url: senderTab.url ?? '', title: senderTab.title ?? '',
      mode,
    });
  }

  // ─── Message handler ───

  browser.runtime.onMessage.addListener((message: any, sender, sendResponse) => {
    (async () => {
      // Wait for popup to close
      await sleep(100);

      switch (message.type) {
        case 'CAPTURE_VISIBLE': await doVisible(); break;
        case 'CAPTURE_FULLPAGE': await doFullPage(); break;
        case 'CAPTURE_REGION': await doRegion(); break;
        case 'CAPTURE_ELEMENT': await doElement(); break;
        case 'CAPTURE_DELAYED': await doDelayed(message.delay); break;
        case 'REGION_SELECTED':
          if (sender.tab) await doCropCapture(sender.tab, message.rect, 'region');
          break;
        case 'ELEMENT_SELECTED':
          if (sender.tab) await doCropCapture(sender.tab, message.rect, 'element');
          break;
        default: return null;
      }
      return { status: 'ok' };
    })().then(sendResponse).catch(err => {
      console.error('Elysium error:', err);
      const msg = err instanceof Error ? err.message : String(err);
      showErrorNotification(msg.includes('inject') || msg.includes('No page tab')
        ? 'Cannot capture this page. Browser internal pages are restricted.'
        : `Capture failed: ${msg}`);
      sendResponse({ error: String(err) });
    });
    return true;
  });

  // ─── Context Menu ───

  browser.runtime.onInstalled.addListener(async () => {
    await browser.contextMenus?.removeAll();
    browser.contextMenus?.create({ id: 'elysium-visible', title: 'Capture visible area', contexts: ['page'] });
    browser.contextMenus?.create({ id: 'elysium-fullpage', title: 'Capture full page', contexts: ['page'] });
    browser.contextMenus?.create({ id: 'elysium-region', title: 'Capture region', contexts: ['page'] });
    browser.contextMenus?.create({ id: 'elysium-element', title: 'Capture element', contexts: ['page'] });
  });

  browser.contextMenus?.onClicked.addListener(async (info, tab) => {
    if (!tab?.id) return;
    try {
      switch (info.menuItemId) {
        case 'elysium-visible': {
          await injectContentScript(tab.id);
          const capture = await captureVisibleTab(tab.windowId!, tab.id);
          capture.url = tab.url ?? ''; capture.title = tab.title ?? '';
          await handleCaptureDone(capture);
          break;
        }
        case 'elysium-fullpage': {
          const ok = await injectContentScript(tab.id);
          if (!ok) return;
          const capture = await captureFullPage(tab.id, tab.windowId!);
          capture.url = tab.url ?? ''; capture.title = tab.title ?? '';
          await handleCaptureDone(capture);
          break;
        }
        case 'elysium-region': {
          const ok = await injectContentScript(tab.id);
          if (ok) await sendToTab(tab.id, { type: 'START_REGION_SELECT' });
          break;
        }
        case 'elysium-element': {
          const ok = await injectContentScript(tab.id);
          if (ok) await sendToTab(tab.id, { type: 'START_ELEMENT_SELECT' });
          break;
        }
      }
    } catch (err) {
      console.error('Elysium ctx error:', err);
      const msg = err instanceof Error ? err.message : String(err);
      showErrorNotification(msg.includes('inject')
        ? 'Cannot capture this page. Browser internal pages are restricted.'
        : `Capture failed: ${msg}`);
    }
  });

  // ─── Keyboard Shortcuts ───

  browser.commands.onCommand.addListener(async (command) => {
    try {
      const tab = await getPageTab();
      switch (command) {
        case 'capture-visible': {
          await injectContentScript(tab.id!);
          const capture = await captureVisibleTab(tab.windowId!, tab.id!);
          capture.url = tab.url ?? ''; capture.title = tab.title ?? '';
          await handleCaptureDone(capture);
          break;
        }
        case 'capture-fullpage': {
          const ok = await injectContentScript(tab.id!);
          if (!ok) return;
          const capture = await captureFullPage(tab.id!, tab.windowId!);
          capture.url = tab.url ?? ''; capture.title = tab.title ?? '';
          await handleCaptureDone(capture);
          break;
        }
        case 'capture-region': {
          const ok = await injectContentScript(tab.id!);
          if (ok) await sendToTab(tab.id!, { type: 'START_REGION_SELECT' });
          break;
        }
        case 'capture-element': {
          const ok = await injectContentScript(tab.id!);
          if (ok) await sendToTab(tab.id!, { type: 'START_ELEMENT_SELECT' });
          break;
        }
      }
    } catch (err) {
      console.error('Elysium cmd error:', err);
      const msg = err instanceof Error ? err.message : String(err);
      showErrorNotification(msg.includes('inject') || msg.includes('No page tab')
        ? 'Cannot capture this page. Browser internal pages are restricted.'
        : `Capture failed: ${msg}`);
    }
  });
});
