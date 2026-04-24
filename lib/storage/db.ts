import { get, set, del, entries, delMany } from 'idb-keyval';

interface StoredBlob {
  blob: Blob;
  createdAt: number;
}

function isStoredBlob(v: unknown): v is StoredBlob {
  return !!v && typeof v === 'object' && 'blob' in v && 'createdAt' in v;
}

/**
 * Store a Blob object into IndexedDB using a unique identifier.
 * IndexedDB has a much larger quota than chrome.storage, resolving High DPI DataUrl crashes.
 */
export async function storeBlob(id: string, blob: Blob): Promise<void> {
  const record: StoredBlob = { blob, createdAt: Date.now() };
  await set(id, record);
}

/**
 * Retrieve a Blob from IndexedDB using its unique identifier.
 */
export async function retrieveBlob(id: string): Promise<Blob | undefined> {
  const v = await get(id);
  if (isStoredBlob(v)) return v.blob;
  // Legacy record written before the wrapper format was introduced
  if (v instanceof Blob) return v;
  return undefined;
}

/**
 * Delete a Blob from IndexedDB.
 */
export async function deleteBlob(id: string): Promise<void> {
  await del(id);
}

/**
 * Remove stale blobs except the ones listed in `keepIds`. Only blobs older than
 * `minAgeMs` are pruned so concurrent editor loads that haven't yet consumed
 * their blob cannot be wiped by a startup cleanup in another context.
 */
export async function pruneOrphanBlobs(keepIds: string[], minAgeMs = 60_000): Promise<void> {
  const all = await entries();
  const keep = new Set(keepIds);
  const now = Date.now();
  const stale: string[] = [];
  for (const [k, v] of all) {
    if (typeof k !== 'string' || keep.has(k)) continue;
    if (isStoredBlob(v)) {
      if (now - v.createdAt >= minAgeMs) stale.push(k);
    } else {
      // Legacy (unwrapped Blob) or unknown entries — safe to prune
      stale.push(k);
    }
  }
  if (stale.length) await delMany(stale);
}
