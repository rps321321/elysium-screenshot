export interface Settings {
  defaultFormat: 'png' | 'jpg' | 'webp';
  defaultQuality: number;
  autoCopyToClipboard: boolean;
  afterCapture: 'editor' | 'save' | 'both';
  filenamePattern: string;
}

const STORAGE_KEY = 'elysium_settings';

export const DEFAULT_SETTINGS: Settings = {
  defaultFormat: 'png',
  defaultQuality: 0.92,
  autoCopyToClipboard: true,
  afterCapture: 'editor',
  filenamePattern: 'elysium-{domain}-{timestamp}',
};

export async function getSettings(): Promise<Settings> {
  const result = await browser.storage.sync.get(STORAGE_KEY);
  const stored = result[STORAGE_KEY];
  return stored ? { ...DEFAULT_SETTINGS, ...stored } : { ...DEFAULT_SETTINGS };
}

export async function updateSettings(partial: Partial<Settings>): Promise<Settings> {
  const current = await getSettings();
  const updated = { ...current, ...partial };
  await browser.storage.sync.set({ [STORAGE_KEY]: updated });
  return updated;
}

/** Characters invalid in Windows/Mac/Linux filenames */
const INVALID_FILENAME_CHARS = /[<>:"|?*\\/]/g;

export function resolveFilename(
  pattern: string,
  format: string,
  pageUrl: string,
): string {
  if (!pattern.trim()) pattern = DEFAULT_SETTINGS.filenamePattern;
  let domain = 'page';
  try {
    domain = new URL(pageUrl).hostname.replace(/\./g, '-');
  } catch {}
  const now = new Date();
  const timestamp = now.toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const date = now.toISOString().slice(0, 10);
  const time = now.toTimeString().slice(0, 8).replace(/:/g, '-');

  const resolved = pattern
    .replace('{domain}', domain)
    .replace('{timestamp}', timestamp)
    .replace('{date}', date)
    .replace('{time}', time);

  // Sanitize: strip any characters invalid for filenames
  return resolved.replace(INVALID_FILENAME_CHARS, '_') + '.' + format;
}
