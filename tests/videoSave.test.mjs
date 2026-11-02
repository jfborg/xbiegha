import test from 'node:test';
import assert from 'node:assert/strict';
import { saveVideoFile } from '../src/videoSave.ts';

for (const format of ['mp4', 'webm']) {
  test(`${format}: chooser opens during the click and writes the actual movie to the selected file`, async () => {
    const file = new File(['movie-bytes'], `My movie.${format}`, { type: `video/${format}` });
    const events = [];
    const result = saveVideoFile(file, {
      showSaveFilePicker(options) {
        events.push('picker');
        assert.equal(options.suggestedName, file.name);
        assert.deepEqual(options.types[0].accept, { [file.type]: [`.${format}`] });
        return Promise.resolve({ name: `Renamed.${format}`, createWritable: async () => ({
          write: async value => { assert.equal(value, file); assert.equal(await value.text(), 'movie-bytes'); events.push('write'); },
          close: async () => { events.push('close'); },
          abort: async () => { events.push('abort'); },
        }) });
      },
    }, { share: () => { throw Error('must not share when choosing a folder'); } });
    assert.deepEqual(events, ['picker']);
    assert.deepEqual(await result, { status: 'saved', name: `Renamed.${format}` });
    assert.deepEqual(events, ['picker', 'write', 'close']);
  });
}

const file = new File(['movie-bytes'], 'Movie.mp4', { type: 'video/mp4' });
test('cancelling the chooser leaves the movie ready without opening any fallback', async () => {
  assert.deepEqual(await saveVideoFile(file, {
    showSaveFilePicker: async () => { throw new DOMException('Cancelled', 'AbortError'); },
  }, { share: () => { throw Error('must not share after cancel'); } }), { status: 'cancelled' });
});
test('a failed write aborts the stream and does not report a successful save', async () => {
  let aborted = false, closed = false;
  await assert.rejects(saveVideoFile(file, { showSaveFilePicker: async () => ({
    name: file.name, createWritable: async () => ({
      write: async () => { throw Error('Disk full'); },
      close: async () => { closed = true; },
      abort: async () => { aborted = true; },
    }),
  }) }, {}), /Disk full/);
  assert.equal(aborted, true); assert.equal(closed, false);
});
test('permission failure is surfaced rather than silently downloading', async () => {
  await assert.rejects(saveVideoFile(file, { showSaveFilePicker: async () => {
    throw new DOMException('Denied', 'NotAllowedError');
  } }, {}), { name: 'NotAllowedError' });
});
test('devices without a folder picker open the native share menu within the tap', async () => {
  let called = false;
  const result = saveVideoFile(file, {}, {
    canShare: () => true,
    share: data => { called = true; assert.equal(data.files[0], file); return Promise.resolve(); },
  });
  assert.equal(called, true);
  assert.deepEqual(await result, { status: 'handed-off' });
});
test('unavailable and cancelled share menus never claim the file was saved', async () => {
  assert.deepEqual(await saveVideoFile(file, {}, {}), { status: 'unavailable' });
  assert.deepEqual(await saveVideoFile(file, {}, { canShare: () => true, share: async () => {
    throw new DOMException('Cancelled', 'AbortError');
  } }), { status: 'cancelled' });
});
