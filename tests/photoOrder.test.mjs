import test from 'node:test';
import assert from 'node:assert/strict';
import { moveItem } from '../src/reorder.ts';
test('moving a photo preserves its crop, all other photos and the source array', () => {
  const photos = [{ id: 'a', zoom: 1.7, x: .3 }, { id: 'b', zoom: 2, x: -.2 }, { id: 'c', zoom: 1, x: 0 }];
  const moved = moveItem(photos, 0, 2);
  assert.deepEqual(moved.map(p => p.id), ['b', 'c', 'a']);
  assert.equal(moved[2], photos[0]);
  assert.deepEqual(photos.map(p => p.id), ['a', 'b', 'c']);
  assert.deepEqual(moveItem(moved, 2, 0), photos);
});
test('reordering ignores invalid, boundary and unchanged positions', () => {
  const photos = ['a', 'b', 'c'];
  for (const [from, to] of [[0, -1], [2, 3], [1, 1], [-1, 0], [0, 1.5]]) assert.equal(moveItem(photos, from, to), photos);
});
