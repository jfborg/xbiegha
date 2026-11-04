import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, writeFile, readdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';
const { DiskLibrary, safeId } = createRequire(import.meta.url)('../desktop/library.cjs');

async function fixture(t) {
  const root = await mkdtemp(path.join(tmpdir(), 'xbieha-disk-test-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const library = new DiskLibrary(root); await library.init(); return library;
}
const project = (id = 'fictional-project') => ({ id, name: 'صيف ٢٠٢٦', mode: 'slideshow', photos: [{ id: 'photo', src: 'data:image/png;base64,fictional' }], slideshow: { audio: { src: 'fictional-music' } }, updated: 10, thumbnail: 'fictional-thumbnail' });

test('Mac project files survive a fresh library instance and retain editable media', async t => {
  const library = await fixture(t), original = project(); await library.saveProject(original);
  const restarted = new DiskLibrary(library.root); await restarted.init();
  assert.deepEqual(await restarted.loadProject(original.id), original);
  const file = JSON.parse(await readFile(library.projectPath(original.id), 'utf8'));
  assert.equal(file.format, 'xbieha-project'); assert.equal(file.version, 1);
  const { projects } = await restarted.listProjects();
  assert.equal(projects[0].photoCount, 1); assert.equal(projects[0].photos, undefined); assert.equal(projects[0].slideshow, undefined);
});
test('ordered atomic saves retain a previous copy, with no temporary files', async t => {
  const library = await fixture(t), p = project();
  await Promise.all([library.saveProject(p), library.saveProject({ ...p, name: 'Second' }), library.saveProject({ ...p, name: 'Third' })]);
  assert.equal((await library.loadProject(p.id)).name, 'Third');
  assert.equal(JSON.parse(await readFile(`${library.projectPath(p.id)}.previous`, 'utf8')).project.name, 'Second');
  assert.equal((await readdir(path.join(library.root, 'Projects'))).some(name => name.endsWith('.tmp')), false);
});
test('corrupt project files do not hide the rest of the gallery or get deleted', async t => {
  const library = await fixture(t); await library.saveProject(project());
  await writeFile(library.projectPath('broken'), '{broken');
  const listing = await library.listProjects(); assert.equal(listing.projects.length, 1); assert.equal(listing.warnings.length, 1);
  assert.equal(await readFile(library.projectPath('broken'), 'utf8'), '{broken');
});
test('unreadable current file recovers the previous saved copy', async t => {
  const library = await fixture(t), p = project(); await library.saveProject(p); await library.saveProject({ ...p, name: 'New' });
  await writeFile(library.projectPath(p.id), '{broken');
  assert.deepEqual(await library.loadProject(p.id), p);
  assert.equal((await library.listProjects()).warnings.length, 1);
});
test('deleting a project moves recoverable files into the library Trash', async t => {
  const library = await fixture(t), p = project(); await library.saveProject(p); await library.deleteProject(p.id);
  assert.equal(await library.loadProject(p.id), undefined);
  const names = await readdir(path.join(library.root, 'Trash'));
  assert.equal(JSON.parse(await readFile(path.join(library.root, 'Trash', names[0]), 'utf8')).project.id, p.id);
});
test('invalid ids cannot escape the project or media folders', () => {
  for (const id of ['../secret', '/tmp/test', '', '..', 'a/b', 'a\\b', 'x'.repeat(81), null]) assert.throws(() => safeId(id));
  assert.equal(safeId('abc-123'), 'abc-123');
});
test('movie files and edits survive restart, and incomplete transfers never replace a source', async t => {
  const library = await fixture(t), bytes = new Uint8Array([1, 2, 3, 4]);
  const token = await library.beginTransfer(library.mediaPath('video-1'), bytes.length);
  await library.appendTransfer(token, bytes.slice(0, 2));
  await assert.rejects(library.finishTransfer(token), /incomplete/);
  assert.equal(await library.hasMedia('video-1', 4), false);
  await library.appendTransfer(token, bytes.slice(2)); await library.finishTransfer(token);
  const manifest = { edit: { name: 'Fictional movie', clips: [{ assetId: 'video-1' }] }, assets: [{ id: 'video-1', size: 4 }] };
  await library.saveVideo(manifest);
  const restarted = new DiskLibrary(library.root); await restarted.init();
  assert.deepEqual(await restarted.loadVideo(), manifest);
  assert.deepEqual(new Uint8Array(await readFile(restarted.mediaPath('video-1'))), bytes);
  const failed = await restarted.beginTransfer(restarted.mediaPath('video-1'), 8);
  await restarted.appendTransfer(failed, bytes); await assert.rejects(restarted.finishTransfer(failed)); await restarted.abortTransfer(failed);
  assert.deepEqual(new Uint8Array(await readFile(restarted.mediaPath('video-1'))), bytes);
});
test('missing media cannot replace a working draft; previous draft sources remain recoverable', async t => {
  const library = await fixture(t), token = await library.beginTransfer(library.mediaPath('video-1'), 1);
  await library.appendTransfer(token, new Uint8Array([7])); await library.finishTransfer(token);
  const saved = { edit: { name: 'Keep me' }, assets: [{ id: 'video-1', size: 1 }] }; await library.saveVideo(saved);
  await assert.rejects(library.saveVideo({ edit: { name: 'Missing' }, assets: [{ id: 'absent', size: 1 }] }));
  assert.deepEqual(await library.loadVideo(), saved);
  await library.saveVideo({ edit: { name: 'New movie' }, assets: [] });
  assert.equal(await library.hasMedia('video-1', 1), true);
});
