import { get, set, del } from 'idb-keyval';

/**
 * Store a Blob object into IndexedDB using a unique identifier.
 * IndexedDB has a much larger quota than chrome.storage, resolving High DPI DataUrl crashes.
 */
export async function storeBlob(id: string, blob: Blob): Promise<void> {
  await set(id, blob);
}

/**
 * Retrieve a Blob from IndexedDB using its unique identifier.
 */
export async function retrieveBlob(id: string): Promise<Blob | undefined> {
  return await get<Blob>(id);
}

/**
 * Delete a Blob from IndexedDB.
 */
export async function deleteBlob(id: string): Promise<void> {
  await del(id);
}
