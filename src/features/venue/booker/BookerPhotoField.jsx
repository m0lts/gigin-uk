import { useEffect, useState } from 'react';
import { uploadFileToStorage } from '../../../services/storage';
import { updateUserDocument } from '../../../services/client-side/users';
import { setVenueBookerPhotos } from '../../../services/client-side/venues';
import { BOOKER_PHOTO_COPY, bookerPhotoError, prepareBookerPhoto, publicBookerPhoto, venueIdsForBooker } from './bookerPhoto';
import './booker-photo.css';

const READ_ERROR = "We couldn't read that photo. Try a JPG or PNG.";

export async function storeBookerPhoto(user, file) {
  const jpeg = await prepareBookerPhoto(file);
  const path = `users/${user.uid}/booker/photo.jpg`;
  const url = publicBookerPhoto(await uploadFileToStorage(jpeg, path));
  if (!url) throw new Error(READ_ERROR);
  await updateUserDocument(user.uid, {
    bookerPhoto: url,
    bookerPhotoPath: path,
    lastUpdatedAt: Date.now(),
  });
  await setVenueBookerPhotos(venueIdsForBooker(user.venueProfiles), url);
  return url;
}

export function BookerPhotoField({ user, onUploaded, onSkip, onContinue, finishLabel }) {
  const saved = publicBookerPhoto(user?.bookerPhoto);
  const [preview, setPreview] = useState(saved);
  const [file, setFile] = useState(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!file) setPreview(publicBookerPhoto(user?.bookerPhoto));
  }, [user?.bookerPhoto, file]);

  useEffect(() => () => {
    if (preview && preview.startsWith('blob:')) URL.revokeObjectURL(preview);
  }, [preview]);

  const choose = (event) => {
    const picked = event.target.files?.[0];
    event.target.value = '';
    if (!picked) return;
    const problem = bookerPhotoError(picked);
    if (problem) {
      setError(problem);
      return;
    }
    setError('');
    setFile(picked);
    setPreview((current) => {
      if (current && current.startsWith('blob:')) URL.revokeObjectURL(current);
      return URL.createObjectURL(picked);
    });
  };

  const upload = async () => {
    if (!file || !user?.uid) return saved;
    setBusy(true);
    setError('');
    try {
      const url = await storeBookerPhoto(user, file);
      setFile(null);
      setPreview(url);
      onUploaded?.(url);
      return url;
    } catch (uploadError) {
      const message = String(uploadError?.message || '');
      setError(message.includes('5 MB') ? message : READ_ERROR);
      return '';
    } finally {
      setBusy(false);
    }
  };

  const finish = async () => {
    let url = saved;
    if (file) {
      url = await upload();
      if (!url) return;
    }
    onContinue?.(url);
  };

  return (
    <div className="booker-photo">
      <h2 className="booker-photo__title">{BOOKER_PHOTO_COPY.title}</h2>
      <p className="booker-photo__text">{BOOKER_PHOTO_COPY.text}</p>
      <label className="booker-photo__pick">
        {preview ? <img src={preview} alt="" /> : <span className="booker-photo__empty">Add photo</span>}
        <input
          type="file"
          accept="image/*,.heic,.heif"
          aria-label={BOOKER_PHOTO_COPY.title}
          onChange={choose}
          disabled={busy}
        />
      </label>
      <p className="booker-photo__hint">{BOOKER_PHOTO_COPY.hint}</p>
      {error ? <p className="error-text">{error}</p> : null}
      {onSkip ? (
        <div className="stage-controls">
          <button type="button" className="btn secondary" disabled={busy} onClick={onSkip}>Skip</button>
          <button type="button" className="btn primary" disabled={busy} onClick={finish}>
            {busy ? 'Saving…' : (finishLabel || 'Continue')}
          </button>
        </div>
      ) : (
        <button type="button" className="btn primary" disabled={busy || !file} onClick={upload}>
          {busy ? 'Saving…' : 'Save photo'}
        </button>
      )}
    </div>
  );
}
