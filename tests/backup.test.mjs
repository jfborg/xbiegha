import test from 'node:test';
import assert from 'node:assert/strict';
import { createBackup, isSupportedBackup } from '../src/backup.ts';

test('new backups preserve project data without duplicating the thumbnail', () => {
  const project = { name: 'Summer', photos: [{ src: 'data:image/png;base64,AA==' }], thumbnail: 'large-preview', mode: 'collage' };
  const backup = createBackup(project);
  assert.equal(backup.format, 'xbieha-project');
  assert.equal(backup.version, 1);
  assert.deepEqual(backup.project, { name: 'Summer', photos: project.photos, mode: 'collage' });
  assert.equal(project.thumbnail, 'large-preview');
});

test('both generations of project backups remain supported', () => {
  for (const format of ['xbieha-project', 'xbiegha-project']) assert.equal(isSupportedBackup({ format, version: 1 }), true);
  for (const value of [null, {}, { format: 'other', version: 1 }, { format: 'xbieha-project', version: 2 }, { format: 'xbiegha-project', version: '1' }]) assert.equal(isSupportedBackup(value), false);
});
