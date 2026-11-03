import test from 'node:test';
import assert from 'node:assert/strict';
import { fileName } from '../src/fileName.ts';

test('export filenames retain Arabic, Greek and accented letters with NFC normalization', () => {
  assert.equal(fileName('صيف ٢٠٢٦', 'image'), 'صيف-٢٠٢٦');
  assert.equal(fileName('Ġurnata sabiħa', 'image'), 'Ġurnata-sabiħa');
  assert.equal(fileName('Καλοκαίρι', 'image'), 'Καλοκαίρι');
  assert.equal(fileName('Cafe\u0301', 'image'), 'Café');
});
test('export filenames trim and collapse spaces while retaining underscores and hyphens', () => {
  assert.equal(fileName('  Summer   by the_sea-2026  ', 'image'), 'Summer-by-the_sea-2026');
});
test('export filenames remove path separators, quotes, emoji, dots and unsafe controls', () => {
  assert.equal(fileName('a/\\b:"<>|?*\u0000😀.jpg.', 'image'), 'abjpg');
  assert.equal(fileName('../Summer "trip" 📷', 'image'), 'Summer-trip');
});
test('empty or entirely unsafe names use the caller’s fallback', () => {
  for (const name of ['', '   ', '../😀']) assert.equal(fileName(name, 'xbieha-image'), 'xbieha-image');
  assert.equal(fileName('', 'My movie'), 'My movie');
});
test('export filenames are capped at seventy characters', () => {
  assert.equal(fileName('é'.repeat(80), 'image'), 'é'.repeat(70));
});
