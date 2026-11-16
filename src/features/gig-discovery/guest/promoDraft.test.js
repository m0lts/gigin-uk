import test from 'node:test';
import assert from 'node:assert/strict';
import { promoDraftFromApplication } from './promoDraft.js';

test('a new promo form starts from the application', () => {
  const draft = promoDraftFromApplication({
    note: 'Songs from the fens',
    photo: { path: 'guest-applications/app/photo.jpg', name: 'photo.jpg' },
    assets: [{ path: 'guest-applications/app/song.mp3', name: 'song.mp3', contentType: 'audio/mpeg' }],
    links: { youtube: 'https://youtu.be/clip' },
  });
  assert.equal(draft.bio, 'Songs from the fens');
  assert.equal(draft.photos.length, 1);
  assert.equal(draft.trackFile.name, 'song.mp3');
  assert.equal(draft.trackUrl, '');
  assert.equal(draft.permission, false);
});

test('a track link is used when the application has no audio file', () => {
  const draft = promoDraftFromApplication({
    note: '',
    links: { spotify: 'https://open.spotify.com/track/1' },
    assets: [],
  });
  assert.equal(draft.trackUrl, 'https://open.spotify.com/track/1');
  assert.equal(draft.trackFile, null);
});

test('a saved promo reopens with the permission already ticked', () => {
  const draft = promoDraftFromApplication({
    note: 'old',
    promo: {
      submittedAt: '2026-11-01T12:00:00.000Z',
      bio: 'New bio',
      photos: [{ path: 'a' }, { path: 'b' }],
      track: { url: 'https://example.com/song' },
      videoUrl: 'https://youtu.be/abc',
      played: 'Hidden Rooms, The Portland Arms',
    },
  });
  assert.equal(draft.bio, 'New bio');
  assert.equal(draft.photos.length, 2);
  assert.equal(draft.trackUrl, 'https://example.com/song');
  assert.equal(draft.videoUrl, 'https://youtu.be/abc');
  assert.equal(draft.played, 'Hidden Rooms, The Portland Arms');
  assert.equal(draft.permission, true);
});
