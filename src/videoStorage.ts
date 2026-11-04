import { desktop, loadDesktopVideo, saveDesktopVideo } from './desktop.ts';
import type { VideoAsset, VideoEdit } from './videoModel';
type StoredAsset = Omit<VideoAsset, 'url'>;
function database(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('xbieha-video', 1);
    request.onupgradeneeded = () => { request.result.createObjectStore('draft'); request.result.createObjectStore('media', { keyPath: 'id' }); };
    request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error);
  });
}
export async function loadVideoDraft(): Promise<{ edit: VideoEdit; assets: VideoAsset[] } | null> {
  if (desktop) return loadDesktopVideo();
  const db = await database();
  try { return await new Promise((resolve, reject) => {
    const tx = db.transaction(['draft', 'media'], 'readonly'), draft = tx.objectStore('draft').get('current'), media = tx.objectStore('media').getAll();
    tx.oncomplete = () => resolve(draft.result ? { edit: draft.result, assets: (media.result as StoredAsset[]).map(a => ({ ...a, url: URL.createObjectURL(a.file) })) } : null);
    tx.onerror = () => reject(tx.error);
  }); } finally { db.close(); }
}
export async function saveVideoDraft(edit: VideoEdit, assets: VideoAsset[]) {
  if (desktop) return saveDesktopVideo(edit, assets);
  const db = await database();
  try { await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(['draft', 'media'], 'readwrite'), media = tx.objectStore('media');
    tx.objectStore('draft').put(edit, 'current');
    for (const asset of assets) {
      const lookup = media.getKey(asset.id);
      lookup.onsuccess = () => { if (!lookup.result) { const { url: _url, ...stored } = asset; media.put(stored); } };
    }
    const keys = media.getAllKeys(); keys.onsuccess = () => { for (const key of keys.result) if (!assets.some(a => a.id === key)) media.delete(key); };
    tx.oncomplete = () => resolve(); tx.onerror = () => reject(tx.error); tx.onabort = () => reject(tx.error);
  }); } finally { db.close(); }
}
