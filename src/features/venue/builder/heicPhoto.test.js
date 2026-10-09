import test from 'node:test';
import assert from 'node:assert/strict';
import { isHeicFile } from './heicPhoto.js';

test('a HEIC or HEIF file is recognised by type or extension', () => {
  assert.equal(isHeicFile({ name: 'IMG.heic', type: 'image/heic' }), true);
  assert.equal(isHeicFile({ name: 'IMG.heif', type: 'image/heif' }), true);
  assert.equal(isHeicFile({ name: 'IMG.heic', type: 'image/heic-sequence' }), true);
  assert.equal(isHeicFile({ name: 'IMG.HEIC', type: '' }), true);
  assert.equal(isHeicFile({ name: 'photo.Heif', type: '' }), true);
  assert.equal(isHeicFile({ name: 'photo.jpg', type: 'image/heic; charset=binary' }), true);
});

test('other photos are not treated as HEIC', () => {
  assert.equal(isHeicFile({ name: 'venue.jpg', type: 'image/jpeg' }), false);
  assert.equal(isHeicFile({ name: 'venue.png', type: 'image/png' }), false);
  assert.equal(isHeicFile({ name: 'venue.jpg', type: '' }), false);
  assert.equal(isHeicFile({ name: 'notes.txt', type: 'text/plain' }), false);
  assert.equal(isHeicFile({ name: 'clip.mp4', type: 'video/mp4' }), false);
});
