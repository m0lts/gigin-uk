import test from 'node:test';
import assert from 'node:assert/strict';
import {
  BOOKER_PHOTO_COPY,
  BOOKER_PHOTO_MAX_BYTES,
  bookerPhotoError,
  prepareBookerPhoto,
  publicBookerPhoto,
  venueIdsForBooker,
} from './bookerPhoto.js';

test('a booker photo is a face picture of at most 5 MB', () => {
  assert.equal(BOOKER_PHOTO_MAX_BYTES, 5 * 1024 * 1024);
  assert.equal(bookerPhotoError({ name: 'face.jpg', type: 'image/jpeg', size: 1024 }), '');
  assert.equal(bookerPhotoError({ name: 'IMG.HEIC', type: '', size: 1024 }), '');
  assert.equal(bookerPhotoError({ name: 'face.jpg', type: 'image/jpeg', size: BOOKER_PHOTO_MAX_BYTES + 1 }), 'That photo is larger than 5 MB.');
  assert.equal(bookerPhotoError({ name: 'notes.txt', type: 'text/plain', size: 20 }), 'Choose a photo.');
  assert.equal(bookerPhotoError(null), 'Choose a photo.');
});

test('the public photo is a URL and never an email address', () => {
  const url = 'https://firebasestorage.googleapis.com/v0/b/bucket/o/users%2Fuid%2Fbooker%2Fphoto.jpg?alt=media&token=abc';
  assert.equal(publicBookerPhoto(url), url);
  assert.equal(publicBookerPhoto('http://127.0.0.1:9199/v0/b/bucket/o/photo.jpg?alt=media&token=abc'), 'http://127.0.0.1:9199/v0/b/bucket/o/photo.jpg?alt=media&token=abc');
  assert.equal(publicBookerPhoto(''), '');
  assert.equal(publicBookerPhoto('users/uid/booker/photo.jpg'), '');
  assert.equal(publicBookerPhoto('http://example.com/photo.jpg'), '');
  assert.equal(publicBookerPhoto('https://example.com/toby.hart@venue.co.uk.jpg'), '');
});

test('venue ids come from the profiles linked to the account', () => {
  assert.deepEqual(venueIdsForBooker([{ id: 'a' }, { venueId: 'b' }, 'c', { id: 'a' }]), ['a', 'b', 'c']);
});

test('the sign-up and settings copy stays as written', () => {
  assert.equal(BOOKER_PHOTO_COPY.title, 'Add a photo of yourself');
  assert.equal(BOOKER_PHOTO_COPY.text, "Artists are more likely to get in touch when they can see who they're talking to. A friendly photo shows there's a real person reading their message.");
  assert.equal(BOOKER_PHOTO_COPY.hint, "A clear photo of your face works best: it's shown next to your name on your gigs and emails.");
});

test('a jpeg is ready to upload when the browser has no canvas', async () => {
  const file = new File([new Uint8Array([1, 2, 3])], 'face.jpg', { type: 'image/jpeg' });
  const ready = await prepareBookerPhoto(file);
  assert.equal(ready.type, 'image/jpeg');
  assert.equal(ready.size, 3);
});
