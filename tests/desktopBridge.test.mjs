import test from 'node:test';
import assert from 'node:assert/strict';

// A fictional bridge lets the Node runner prove the desktop branch never opens
// IndexedDB and that large media is transferred in bounded, ordered pieces.
const calls = [], projects = new Map();
let onClose, movie = null;
globalThis.window = { xbiehaDesktop: {
  onBeforeClose: callback => { onClose = callback; return () => {}; },
  saveProject: async p => { projects.set(p.id, p); },
  loadProject: async id => projects.get(id),
  listProjects: async () => ({ projects: [...projects.values()].map(({ photos, ...p }) => ({ ...p, photoCount: photos.length })), warnings: [] }),
  deleteProject: async id => projects.delete(id),
  hasMedia: async () => false,
  beginMedia: async () => 'fictional-token',
  appendTransfer: async (_token, bytes) => calls.push(bytes.byteLength),
  finishTransfer: async () => calls.push('finished'),
  abortTransfer: async () => calls.push('aborted'),
  saveVideo: async value => { movie = value; },
  chooseExport: async () => null,
} };
globalThis.document = { documentElement: { inert: false } };
Object.defineProperty(globalThis, 'indexedDB', { configurable: true, get() { throw new Error('Desktop must never use IndexedDB'); } });
const storage = await import('../src/storage.ts');
const native = await import('../src/desktop.ts');

test('desktop project save/list/open/delete bypass browser storage', async () => {
  const p = { id: 'fictional', name: 'Local test', photos: [], updated: 1 };
  await storage.saveProject(p); assert.deepEqual(await storage.loadProject(p.id), p);
  assert.equal((await storage.listProjects())[0].photoCount, 0);
  await storage.deleteProject(p.id); assert.equal(await storage.loadProject(p.id), undefined);
});
test('video originals cross the bridge in at most four-megabyte chunks before the draft is committed', async () => {
  const file = new File([new Uint8Array(9 * 1024 ** 2)], 'fictional.mp4', { type: 'video/mp4' });
  await native.saveDesktopVideo({ name: 'Fictional', clips: [] }, [{ id: 'source', name: file.name, file, url: 'blob:fictional' }]);
  assert.deepEqual(calls, [4 * 1024 ** 2, 4 * 1024 ** 2, 1024 ** 2, 'finished']);
  assert.equal(movie.assets[0].size, file.size); assert.equal(movie.assets[0].file, undefined); assert.equal(movie.assets[0].url, undefined);
});
test('cancelled native export does not transfer any bytes', async () => {
  const before = calls.length;
  assert.deepEqual(await native.saveDesktopFile(new Blob(['fictional']), 'test.txt'), { status: 'cancelled' });
  assert.equal(calls.length, before);
});
test('quitting flushes current editors and failed saves release the interface', async () => {
  const saved = [];
  const unregister = native.registerDesktopSave('photo', async () => { saved.push('photo'); });
  await onClose(); assert.deepEqual(saved, ['photo']); assert.equal(document.documentElement.inert, false);
  unregister();
  const removeFailure = native.registerDesktopSave('video', async () => { throw new Error('Disk full'); });
  await assert.rejects(onClose(), /Disk full/); assert.equal(document.documentElement.inert, false); removeFailure();
});
