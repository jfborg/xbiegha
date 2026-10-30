import test from 'node:test';
import assert from 'node:assert/strict';
import { defaultAdjustments } from '../src/model.ts';
import { activeLook, lookCategories, looks, readAdjustments, scaleLook } from '../src/looks.ts';
import { adjustPixels, applyAdjustments } from '../src/color.ts';

test('the library has 30 distinct looks with five in every collection', () => {
  assert.equal(looks.length, 30);
  assert.equal(new Set(looks.map(item => item.id)).size, 30);
  assert.equal(new Set(looks.map(item => JSON.stringify(item.values))).size, 30);
  for (const category of lookCategories) assert.equal(looks.filter(item => item.category === category).length, 5);
  for (const item of looks) assert.deepEqual(readAdjustments(item.values), item.values);
});
test('zero intensity returns original colour and intermediate strength scales every effect', () => {
  const film = looks.find(item => item.id === 'analog');
  assert.deepEqual(scaleLook(film.values, 0), defaultAdjustments);
  assert.equal(scaleLook(film.values, 50).grain, 12);
  assert.equal(scaleLook(film.values, 50).warmth, 8);
  assert.deepEqual(scaleLook(film.values, 200), film.values);
  assert.deepEqual(scaleLook(film.values, -1), defaultAdjustments);
});
test('saved strength survives restoration and manual edits invalidate the selected look', () => {
  const film = looks.find(item => item.id === 'analog');
  const project = { adjustments: scaleLook(film.values, 35), look: { id: film.id, amount: 35 } };
  assert.equal(activeLook(JSON.parse(JSON.stringify(project))).amount, 35);
  assert.equal(activeLook({ ...project, adjustments: { ...project.adjustments, exposure: 19 } }).look, null);
  assert.equal(activeLook({ ...project, adjustments: scaleLook(film.values, 0), look: { id: film.id, amount: 0 } }).look.id, 'analog');
});
test('legacy projects retain their colour and remain recognisable without new fields', () => {
  const legacy = { exposure: 6, contrast: 8, saturation: 12, warmth: 18, fade: 2, vignette: 0 };
  assert.equal(readAdjustments(legacy).tint, 0);
  assert.equal(readAdjustments(legacy).grain, 0);
  assert.equal(activeLook({ adjustments: legacy }).look.id, 'mediterranean');
  assert.throws(() => readAdjustments({ ...legacy, grain: -4 }));
  assert.throws(() => readAdjustments({ ...legacy, tint: Infinity }));
  assert.throws(() => readAdjustments({ ...legacy, contrast: '10' }));
});
test('colour processing preserves alpha, leaves original pixels intact and creates neutral monochrome', () => {
  const pixels = new Uint8ClampedArray([100, 100, 100, 85, 255, 0, 0, 255]);
  const original = pixels.slice();
  adjustPixels(pixels, 2, 1, defaultAdjustments);
  assert.deepEqual(pixels, original);
  adjustPixels(pixels, 2, 1, { ...defaultAdjustments, saturation: -100 });
  assert.deepEqual([...pixels], [100, 100, 100, 85, 54, 54, 54, 255]);
  const doubled = new Uint8ClampedArray([100, 100, 100, 255]);
  adjustPixels(doubled, 1, 1, { ...defaultAdjustments, exposure: 70 });
  assert.deepEqual([...doubled], [200, 200, 200, 255]);
});
test('film grain is repeatable and passport or original rendering never applies effects', () => {
  const a = new Uint8ClampedArray(64).fill(128), b = a.slice();
  const settings = { ...defaultAdjustments, grain: 40 };
  adjustPixels(a, 4, 4, settings); adjustPixels(b, 4, 4, settings);
  assert.deepEqual(a, b);
  assert.ok(a.some((value, i) => i % 4 !== 3 && value !== 128));
  const canvas = { getContext() { throw new Error('must not touch passport/original pixels'); } };
  applyAdjustments(canvas, settings, 'passport');
  applyAdjustments(canvas, settings, 'editor', true);
});
