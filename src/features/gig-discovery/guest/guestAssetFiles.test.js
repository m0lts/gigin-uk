import test from 'node:test';
import assert from 'node:assert/strict';
import { AUDIO_LIMIT, ASSET_LIMIT, declaredContentType, guestFileProblem } from './guestAssetFiles.js';

const room = { audioCount: 0, assetCount: 0 };

test('audio is allowed only when the mime type and extension agree', () => {
  assert.equal(guestFileProblem({ name: 'demo.mp3', type: 'audio/mpeg', size: 1200 }, room), '');
  assert.equal(guestFileProblem({ name: 'demo.m4a', type: 'audio/mp4', size: 1200 }, room), '');
  assert.equal(guestFileProblem({ name: 'demo.m4a', type: 'audio/x-m4a', size: 1200 }, room), '');
  assert.equal(guestFileProblem({ name: 'demo.wav', type: 'audio/wav', size: 1200 }, room), '');
  assert.equal(guestFileProblem({ name: 'demo.wav', type: 'audio/x-wav', size: 1200 }, room), '');
  assert.equal(declaredContentType({ name: 'demo.mp3', type: '' }), 'audio/mpeg');
  assert.equal(guestFileProblem({ name: 'demo.mp3', type: '', size: 1200 }, room), '');
});

test('an unsupported file says what is supported', () => {
  const problem = guestFileProblem({ name: 'notes.txt', type: 'text/plain', size: 20 }, room);
  assert.match(problem, /isn't supported/);
  assert.match(problem, /photo or PDF \(up to 20 MB\)/);
  assert.match(problem, /MP3, M4A, WAV, up to 15 MB/);
  assert.match(problem, /Spotify or YouTube/);
  assert.match(guestFileProblem({ name: 'demo.mp3', type: 'audio/wav', size: 20 }, room), /isn't supported/);
  assert.match(guestFileProblem({ name: 'demo.wav', type: 'audio/mpeg', size: 20 }, room), /isn't supported/);
  assert.match(guestFileProblem({ name: 'demo.jpg', type: 'audio/mpeg', size: 20 }, room), /isn't supported/);
});

test('audio is capped at 15 MB and 3 files, and photos and PDFs stay at 20 MB', () => {
  assert.equal(guestFileProblem({ name: 'demo.mp3', type: 'audio/mpeg', size: AUDIO_LIMIT }, room), '');
  assert.match(guestFileProblem({ name: 'demo.mp3', type: 'audio/mpeg', size: AUDIO_LIMIT + 1 }, room), /15 MB/);
  assert.match(guestFileProblem({ name: 'demo.mp3', type: 'audio/mpeg', size: 1000 }, { audioCount: 3, assetCount: 3 }), /3 audio files/);
  assert.equal(guestFileProblem({ name: 'rider.pdf', type: 'application/pdf', size: ASSET_LIMIT }, room), '');
  assert.match(guestFileProblem({ name: 'rider.pdf', type: 'application/pdf', size: ASSET_LIMIT + 1 }, room), /20 MB/);
  assert.equal(guestFileProblem({ name: 'press.jpg', type: 'image/jpeg', size: 1000 }, room), '');
});
