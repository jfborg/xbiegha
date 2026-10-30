import test from 'node:test';
import assert from 'node:assert/strict';
import { photosFormat, shareImageFile } from '../src/photoShare.ts';
const image = new File(['image-bytes'], 'photo.jpg', { type: 'image/jpeg' });
test('photo-library sharing preserves the actual file and starts synchronously within the tap', async () => {
  let called = false;
  const result = shareImageFile(image, {
    canShare(data) { assert.deepEqual(Object.keys(data), ['files']); return true; },
    share(data) { called = true; assert.equal(data.files[0], image); assert.equal(data.files[0].type, 'image/jpeg'); return Promise.resolve(); },
  });
  assert.equal(called, true);
  assert.equal(await result, 'handed-off');
});
test('unsupported browsers and unshareable files return a preview fallback without opening share', async () => {
  assert.equal(await shareImageFile(image, {}), 'unavailable');
  assert.equal(await shareImageFile(image, { canShare: () => false, share: () => { throw Error('must not run'); } }), 'unavailable');
});
test('cancelling the share sheet does not trigger the save fallback', async () => {
  assert.equal(await shareImageFile(image, { canShare: () => true, share: () => Promise.reject(new DOMException('Cancelled', 'AbortError')) }), 'cancelled');
});
test('permission failures and throwing capability checks degrade to local saving', async () => {
  assert.equal(await shareImageFile(image, { canShare: () => true, share: () => Promise.reject(new DOMException('Blocked', 'NotAllowedError')) }), 'unavailable');
  assert.equal(await shareImageFile(image, { canShare: () => { throw Error('policy'); }, share: () => Promise.resolve() }), 'unavailable');
});
test('Photos uses a widely supported image format and always preserves document JPEG format', () => {
  assert.equal(photosFormat('webp', false), 'jpeg');
  assert.equal(photosFormat('png', false), 'png');
  assert.equal(photosFormat('png', true), 'jpeg');
});
