import { useRef, useState } from 'react';
import { compressGuestPhoto, releaseGuestUpload, uploadGuestFile } from '@services/client-side/guestApplications';
import { declaredContentType, guestFileProblem, isAudioAsset } from './guestAssetFiles';
import { GuestAudioRow } from './GuestAudioRow';

const LINKS = [
  ['spotify', 'Spotify', 'var(--gn-spotify-green, #1DB954)'],
  ['youtube', 'YouTube', 'var(--gn-youtube-red, #FF0033)'],
  ['instagram', 'Instagram', 'var(--gn-instagram-pink, #E56969)'],
  ['website', 'Website', '#111317'],
];
const PHOTO_LIMIT = 10 * 1024 * 1024;

function sizeLabel(bytes) {
  if (!bytes) return '';
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function uploadFailureMessage(file, error) {
  const message = String(error?.message || '');
  const generic = !message || message === 'Failed to fetch' || message === 'Upload failed' || message === 'Request failed' || error?.name === 'AbortError';
  if (generic) {
    return `${file.name} didn't upload. Check your connection and try again. The rest of your application is still here.`;
  }
  return message;
}

export function GuestAssetsStep({
  draft,
  patch,
  bookerName = 'the venue',
  showPlayer = false,
  gigId = '',
  manageToken = '',
  ignorePaths = [],
  releaseOnRemove = true,
  onRemoved,
  onUploaded,
}) {
  const photoRef = useRef(null);
  const filesRef = useRef(null);
  const [uploadError, setUploadError] = useState(null);
  const [fileError, setFileError] = useState(null);
  const [pending, setPending] = useState(null);
  const [busy, setBusy] = useState(false);

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
    if (busy) return;
    const chosen = Array.from(list || []);
    if (!chosen.length) return;
    setBusy(true);
    setFileError(null);
    let assets = draft.assets;
    let nextError = null;
    try {
      for (const file of chosen) {
        if (assets.length >= 5) {
          nextError = `You can add up to 5 files. ${file.name} wasn't added. Nothing else you've added has been lost.`;
          break;
        }
        const audioCount = assets.filter(isAudioAsset).length;
        const problem = guestFileProblem(file, { audioCount, assetCount: assets.length });
        if (problem) {
          nextError = problem;
          continue;
        }
        const contentType = declaredContentType(file);
        const audio = contentType.startsWith('audio/');
        setPending({ name: file.name, progress: 0, failed: false, audio });
        try {
          const uploaded = await uploadGuestFile({
            applicationId: draft.applicationId,
            file,
            kind: 'asset',
            contentType,
            gigId,
            manageToken,
            ignorePaths,
            onProgress: (progress) => setPending({ name: file.name, progress, failed: false, audio }),
          });
          const previewUrl = contentType.startsWith('audio/') ? URL.createObjectURL(file) : '';
          const next = { ...uploaded, ...(previewUrl ? { previewUrl } : {}) };
          assets = [...assets, next];
          patch({ assets });
          onUploaded?.(next);
          setPending(null);
        } catch (error) {
          setPending({ name: file.name, progress: 0, failed: true, audio });
          nextError = uploadFailureMessage(file, error);
        }
      }
    } finally {
      setFileError(nextError);
      setBusy(false);
    }
  };

  const removeAsset = async (asset) => {
    if (busy) return;
    if (asset.previewUrl) URL.revokeObjectURL(asset.previewUrl);
    patch({ assets: draft.assets.filter((item) => item.path !== asset.path) });
    onRemoved?.(asset);
    if (!releaseOnRemove) return;
    try {
      await releaseGuestUpload({ applicationId: draft.applicationId, path: asset.path, gigId, manageToken });
    } catch {
      setFileError(`${asset.name} was removed from this application, but the file couldn't be deleted. If you can't add another audio file, try again.`);
    }
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
      <p className="ga-fine">Photos and PDFs up to 20 MB, audio (MP3, M4A, WAV) up to 15 MB, or add a Spotify or YouTube link above.</p>
      <ul className="ga-assets" aria-live="polite">
        {draft.assets.map((asset) => (
          isAudioAsset(asset) ? (
            <GuestAudioRow key={asset.path} asset={asset} showPlayer={showPlayer} onRemove={busy ? undefined : () => removeAsset(asset)} />
          ) : (
            <li key={asset.path}>
              <span>{asset.name}</span>
              <button type="button" aria-label={`Remove ${asset.name}`} disabled={busy} onClick={() => removeAsset(asset)}>×</button>
            </li>
          )
        ))}
        {pending?.audio ? <GuestAudioRow key="uploading" pending={pending} /> : null}
        {pending && !pending.audio ? (
          <li key="uploading" className={`ga-file-pending${pending.failed ? ' is-failed' : ''}`}>
            <span>{pending.name}</span>
            <em>{pending.failed ? "Didn't upload" : `Uploading… ${pending.progress}%`}</em>
          </li>
        ) : null}
      </ul>
      {draft.assets.length < 5 && (
        <button type="button" className="ga-dashed" disabled={busy} onClick={() => filesRef.current?.click()}>
          {busy ? 'Uploading…' : '+ Add files'}
        </button>
      )}
      <input
        ref={filesRef}
        hidden
        type="file"
        multiple
        accept="image/jpeg,image/png,image/webp,image/heic,image/heif,application/pdf,.pdf,audio/mpeg,audio/mp4,audio/x-m4a,audio/wav,audio/x-wav,.mp3,.m4a,.wav"
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
            <button type="button" className="ga-dark" onClick={() => { setFileError(null); setPending(null); filesRef.current?.click(); }}>Choose another file</button>
          </div>
        </div>
      )}
    </div>
  );
}
