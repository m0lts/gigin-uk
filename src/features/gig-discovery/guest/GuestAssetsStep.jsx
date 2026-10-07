import { useRef, useState } from 'react';
import { compressGuestPhoto, uploadGuestFile } from '@services/client-side/guestApplications';

const LINKS = [
  ['spotify', 'Spotify', 'var(--gn-spotify-green, #1DB954)'],
  ['youtube', 'YouTube', 'var(--gn-youtube-red, #FF0033)'],
  ['instagram', 'Instagram', 'var(--gn-instagram-pink, #E56969)'],
  ['website', 'Website', '#111317'],
];
const PHOTO_LIMIT = 10 * 1024 * 1024;
const ASSET_LIMIT = 20 * 1024 * 1024;
const ASSET_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/heic',
  'image/heif',
  'application/pdf',
]);

function sizeLabel(bytes) {
  if (!bytes) return '';
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function GuestAssetsStep({ draft, patch, bookerName = 'the venue' }) {
  const photoRef = useRef(null);
  const filesRef = useRef(null);
  const [uploadError, setUploadError] = useState(null);
  const [fileError, setFileError] = useState(null);

  const takePhoto = async (file) => {
    if (!file) return;
    setUploadError(null);
    try {
      if (file.size > PHOTO_LIMIT && !file.type.startsWith('image/')) {
        throw Object.assign(new Error('too big'), { file });
      }
      const compressed = await compressGuestPhoto(file);
      if (compressed.size > PHOTO_LIMIT) {
        throw Object.assign(new Error('too big'), { file: compressed });
      }
      const uploaded = await uploadGuestFile({ applicationId: draft.applicationId, file: compressed, kind: 'photo' });
      patch({ photo: { ...uploaded, previewUrl: URL.createObjectURL(compressed) } });
    } catch (error) {
      const failed = error.file || file;
      setUploadError(`${failed.name} is ${sizeLabel(failed.size) || 'too large'}, and the limit is 10 MB. Nothing else you've added has been lost.`);
    }
  };

  const addFiles = async (list) => {
    const room = 5 - draft.assets.length;
    const files = Array.from(list || []).slice(0, room);
    if (!files.length) return;
    let nextError = null;
    for (const file of files) {
      const type = String(file.type || '').toLowerCase();
      if (!ASSET_TYPES.has(type)) {
        nextError = `${file.name} isn't supported. Use a PDF or image (up to 20 MB), or add a Spotify or YouTube link above.`;
        continue;
      }
      if (file.size > ASSET_LIMIT) {
        nextError = `${file.name} is ${sizeLabel(file.size)}, and the limit is 20 MB. Nothing else you've added has been lost.`;
        continue;
      }
      try {
        const uploaded = await uploadGuestFile({ applicationId: draft.applicationId, file, kind: 'asset' });
        patch({ assets: [...draft.assets, uploaded] });
      } catch {
        nextError = `${file.name} didn't upload. The rest of your application is still here.`;
      }
    }
    setFileError(nextError);
  };

  return (
    <div className="ga-step">
      <h2>Photo and links</h2>
      <p className="ga-sub">{bookerName} uses these to promote the night on the bar's socials. Optional.</p>
      {!draft.photo ? (
        <button type="button" className="ga-drop" onClick={() => photoRef.current?.click()}>
          <strong>Add a press photo</strong>
          <span>From your camera roll · JPG or PNG, up to 10 MB</span>
        </button>
      ) : (
        <div className="ga-file">
          <span className="ga-thumb" style={draft.photo.previewUrl ? { backgroundImage: `url(${draft.photo.previewUrl})` } : undefined} />
          <span>
            <strong>{draft.photo.name}</strong>
            <em>{sizeLabel(draft.photo.size)}</em>
          </span>
          <button type="button" onClick={() => photoRef.current?.click()}>Replace</button>
          <button type="button" onClick={() => patch({ photo: null })}>Remove</button>
        </div>
      )}
      <input ref={photoRef} hidden type="file" accept="image/jpeg,image/png,image/webp,image/heic" onChange={(event) => takePhoto(event.target.files?.[0])} />
      {uploadError && (
        <div className="ga-soft">
          <p>{uploadError}</p>
          <div className="ga-soft__actions">
            <button type="button" className="ga-dark" onClick={() => { setUploadError(null); photoRef.current?.click(); }}>Choose another photo</button>
            <button type="button" className="ga-ghost" onClick={() => setUploadError(null)}>Skip photo</button>
          </div>
        </div>
      )}
      <div className="ga-links">
        {LINKS.map(([key, label, color]) => (
          <label key={key}>
            <span className="ga-dot" style={{ background: color }} />
            <span>{label}</span>
            <input value={draft.links[key] || ''} placeholder="https://" onChange={(event) => patch({ links: { ...draft.links, [key]: event.target.value } })} />
          </label>
        ))}
      </div>
      <div className="ga-label">Other files</div>
      <p className="ga-fine">PDF or image, up to 20 MB</p>
      <ul className="ga-assets">
        {draft.assets.map((asset) => (
          <li key={asset.path}>
            <span>{asset.name}</span>
            <button type="button" aria-label={`Remove ${asset.name}`} onClick={() => patch({ assets: draft.assets.filter((item) => item.path !== asset.path) })}>×</button>
          </li>
        ))}
      </ul>
      {draft.assets.length < 5 && (
        <button type="button" className="ga-dashed" onClick={() => filesRef.current?.click()}>+ Add files</button>
      )}
      <input
        ref={filesRef}
        hidden
        type="file"
        multiple
        accept="image/jpeg,image/png,image/webp,image/heic,image/heif,application/pdf"
        onChange={(event) => {
          const chosen = Array.from(event.target.files || []);
          event.target.value = '';
          addFiles(chosen);
        }}
      />
      {fileError && (
        <div className="ga-soft">
          <p>{fileError}</p>
          <div className="ga-soft__actions">
            <button type="button" className="ga-dark" onClick={() => { setFileError(null); filesRef.current?.click(); }}>Choose another file</button>
          </div>
        </div>
      )}
    </div>
  );
}
