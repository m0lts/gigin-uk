import { useEffect, useMemo, useRef, useState } from 'react';
import { compressGuestPhoto, releaseGuestUpload, uploadGuestFile } from '@services/client-side/guestApplications';
import { declaredContentType, guestFileProblem, isAudioAsset, sizeLabel, UPLOAD_ROW_ERROR } from './guestAssetFiles';
import { GuestAudioRow } from './GuestAudioRow';

const LINKS = [
  ['spotify', 'Spotify', 'var(--gn-spotify-green, #1DB954)'],
  ['youtube', 'YouTube', 'var(--gn-youtube-red, #FF0033)'],
  ['instagram', 'Instagram', 'var(--gn-instagram-pink, #E56969)'],
  ['website', 'Website', '#111317'],
];
const PHOTO_LIMIT = 10 * 1024 * 1024;

function uploadFailureMessage(file, error) {
  if (error?.message === 'too big') {
    const failed = error.file || file;
    return `${failed.name} is ${sizeLabel(failed.size) || 'too large'}, and the limit is 10 MB. Nothing else you've added has been lost.`;
  }
  return UPLOAD_ROW_ERROR;
}

function UploadStatus({ row }) {
  if (row.status === 'failed') {
    return <em className="ga-upload-fail">{row.message || UPLOAD_ROW_ERROR}</em>;
  }
  const progress = row.progress > 0 ? ` ${row.progress}%` : '';
  return (
    <em className="ga-uploading">
      <span className="ga-spin" aria-hidden="true" />
      {`Uploading…${progress}`}
    </em>
  );
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
  onUploadChange,
}) {
  const photoRef = useRef(null);
  const filesRef = useRef(null);
  const photoAttempt = useRef(0);
  const fileAttempts = useRef(new Map());
  const [fileError, setFileError] = useState(null);
  const [photoRow, setPhotoRow] = useState(null);
  const [fileRows, setFileRows] = useState([]);

  const activity = useMemo(() => [
    ...(photoRow ? [{ status: photoRow.status }] : []),
    ...fileRows.map((row) => ({ status: row.status })),
  ], [photoRow, fileRows]);
  const uploading = activity.some((row) => row.status === 'uploading');
  const filesUploading = fileRows.some((row) => row.status === 'uploading');

  const report = (photo, files) => {
    onUploadChange?.([
      ...(photo ? [{ status: photo.status }] : []),
      ...(files || []).map((row) => ({ status: row.status })),
    ]);
  };

  useEffect(() => {
    onUploadChange?.(activity);
  }, [activity, onUploadChange]);

  useEffect(() => () => onUploadChange?.([]), [onUploadChange]);

  const uploadPhoto = async (row) => {
    const attempt = photoAttempt.current + 1;
    photoAttempt.current = attempt;
    const live = () => photoAttempt.current === attempt;
    try {
      if (row.file.size > PHOTO_LIMIT && !String(row.file.type || '').startsWith('image/')) {
        throw Object.assign(new Error('too big'), { file: row.file });
      }
      const compressed = await compressGuestPhoto(row.file);
      if (!live()) return;
      if (compressed.size > PHOTO_LIMIT) {
        throw Object.assign(new Error('too big'), { file: compressed });
      }
      const uploaded = await uploadGuestFile({
        applicationId: draft.applicationId,
        file: compressed,
        kind: 'photo',
        onProgress: (progress) => {
          if (!live()) return;
          setPhotoRow((current) => (current?.status === 'uploading' ? { ...current, progress } : current));
        },
      });
      if (!live()) return;
      const previous = draft.photo?.previewUrl;
      patch({ photo: { ...uploaded, previewUrl: row.previewUrl } });
      if (previous && previous !== row.previewUrl) URL.revokeObjectURL(previous);
      setPhotoRow(null);
    } catch (error) {
      if (!live()) return;
      setPhotoRow((current) => (current ? {
        ...current,
        status: 'failed',
        progress: 0,
        message: uploadFailureMessage(row.file, error),
      } : current));
    }
  };

  const takePhoto = (file) => {
    if (!file || photoRow?.status === 'uploading') return;
    if (photoRow?.previewUrl) URL.revokeObjectURL(photoRow.previewUrl);
    const next = {
      name: file.name,
      size: file.size,
      previewUrl: URL.createObjectURL(file),
      progress: 0,
      status: 'uploading',
      file,
    };
    setPhotoRow(next);
    report(next, fileRows);
    uploadPhoto(next);
  };

  const dismissPhoto = () => {
    photoAttempt.current += 1;
    if (photoRow?.previewUrl && photoRow.previewUrl !== draft.photo?.previewUrl) URL.revokeObjectURL(photoRow.previewUrl);
    setPhotoRow(null);
    report(null, fileRows);
  };

  const retryPhoto = () => {
    if (!photoRow?.file || photoRow.status === 'uploading') return;
    const next = { ...photoRow, status: 'uploading', progress: 0, message: '' };
    setPhotoRow(next);
    report(next, fileRows);
    uploadPhoto(next);
  };

  const storeFile = async (row, assets) => {
    const attempt = (fileAttempts.current.get(row.id) || 0) + 1;
    fileAttempts.current.set(row.id, attempt);
    const live = () => fileAttempts.current.get(row.id) === attempt;
    const contentType = declaredContentType(row.file);
    const audioCount = assets.filter(isAudioAsset).length;
    const problem = guestFileProblem(row.file, { audioCount, assetCount: assets.length });
    if (problem) {
      if (!live()) return assets;
      setFileRows((current) => current.map((item) => (item.id === row.id ? { ...item, status: 'failed', message: problem, progress: 0 } : item)));
      return assets;
    }
    setFileRows((current) => current.map((item) => (item.id === row.id ? { ...item, status: 'uploading', progress: 0, message: '' } : item)));
    try {
      const uploaded = await uploadGuestFile({
        applicationId: draft.applicationId,
        file: row.file,
        kind: 'asset',
        contentType,
        gigId,
        manageToken,
        ignorePaths,
        onProgress: (progress) => {
          if (!live()) return;
          setFileRows((current) => current.map((item) => (
            item.id === row.id && item.status === 'uploading' ? { ...item, progress } : item
          )));
        },
      });
      if (!live()) return assets;
      const next = { ...uploaded, ...(row.previewUrl ? { previewUrl: row.previewUrl } : {}) };
      const saved = [...assets, next];
      patch({ assets: saved });
      onUploaded?.(next);
      setFileRows((current) => current.filter((item) => item.id !== row.id));
      fileAttempts.current.delete(row.id);
      return saved;
    } catch {
      if (!live()) return assets;
      setFileRows((current) => current.map((item) => (item.id === row.id ? { ...item, status: 'failed', progress: 0, message: UPLOAD_ROW_ERROR } : item)));
      return assets;
    }
  };

  const addFiles = async (list) => {
    if (filesUploading) return;
    const chosen = Array.from(list || []);
    if (!chosen.length) return;
    setFileError(null);
    const seeded = chosen.map((file) => {
      const contentType = declaredContentType(file);
      const audio = contentType.startsWith('audio/');
      return {
        id: `${file.name}-${file.size}-${Math.random().toString(36).slice(2)}`,
        name: file.name,
        file,
        progress: 0,
        status: 'uploading',
        audio,
        previewUrl: audio ? URL.createObjectURL(file) : '',
        message: '',
      };
    });
    const visible = [...fileRows, ...seeded];
    setFileRows(visible);
    report(photoRow, visible);
    let assets = draft.assets;
    for (const row of seeded) {
      assets = await storeFile(row, assets);
    }
  };

  const retryFile = (row) => {
    if (row.status === 'uploading') return;
    const visible = fileRows.map((item) => (item.id === row.id ? { ...item, status: 'uploading', progress: 0, message: '' } : item));
    setFileRows(visible);
    report(photoRow, visible);
    storeFile({ ...row, status: 'uploading' }, draft.assets);
  };

  const removeFileRow = (row) => {
    if (row.status === 'uploading') return;
    fileAttempts.current.set(row.id, (fileAttempts.current.get(row.id) || 0) + 1);
    if (row.previewUrl) URL.revokeObjectURL(row.previewUrl);
    const visible = fileRows.filter((item) => item.id !== row.id);
    setFileRows(visible);
    report(photoRow, visible);
  };

  const removeAsset = async (asset) => {
    if (uploading) return;
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
      <h2>Your music</h2>
      <p className="ga-sub">A link or a track. One is enough. {bookerName} can also use a photo.</p>
      {photoRow ? (
        <div className={`ga-file${photoRow.status === 'failed' ? ' is-failed' : ''}`} aria-busy={photoRow.status === 'uploading'}>
          <span className="ga-thumb" style={photoRow.previewUrl ? { backgroundImage: `url(${photoRow.previewUrl})` } : undefined} />
          <span className="ga-file__meta">
            <strong>{photoRow.name}</strong>
            <UploadStatus row={photoRow} />
          </span>
          {photoRow.status === 'failed' && (
            <span className="ga-upload-actions">
              <button type="button" onClick={retryPhoto}>Try again</button>
              <button type="button" onClick={dismissPhoto}>Remove</button>
            </span>
          )}
        </div>
      ) : !draft.photo ? (
        <button type="button" className="ga-drop" onClick={() => photoRef.current?.click()}>
          <strong>Add a press photo</strong>
          <span>From your camera roll · JPG or PNG, up to 10 MB</span>
        </button>
      ) : (
        <div className="ga-file">
          <span className="ga-thumb" style={draft.photo.previewUrl ? { backgroundImage: `url(${draft.photo.previewUrl})` } : undefined} />
          <span className="ga-file__meta">
            <strong>{draft.photo.name}</strong>
            <em>{sizeLabel(draft.photo.size)}</em>
          </span>
          <span className="ga-upload-actions">
            <button type="button" onClick={() => photoRef.current?.click()}>Replace</button>
            <button type="button" onClick={() => patch({ photo: null })}>Remove</button>
          </span>
        </div>
      )}
      <input
        ref={photoRef}
        hidden
        type="file"
        accept="image/jpeg,image/png,image/webp,image/heic"
        onChange={(event) => {
          const file = event.target.files?.[0];
          event.target.value = '';
          takePhoto(file);
        }}
      />
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
            <GuestAudioRow key={asset.path} asset={asset} showPlayer={showPlayer} onRemove={uploading ? undefined : () => removeAsset(asset)} />
          ) : (
            <li key={asset.path}>
              <span>{asset.name}</span>
              <button type="button" aria-label={`Remove ${asset.name}`} disabled={uploading} onClick={() => removeAsset(asset)}>×</button>
            </li>
          )
        ))}
        {fileRows.map((row) => (
          row.audio ? (
            <GuestAudioRow
              key={row.id}
              pending={{
                name: row.name,
                progress: row.progress,
                failed: row.status === 'failed',
                message: row.message,
              }}
              onRetry={row.status === 'failed' ? () => retryFile(row) : undefined}
              onRemove={row.status === 'failed' ? () => removeFileRow(row) : undefined}
            />
          ) : (
            <li key={row.id} className={`ga-file-pending${row.status === 'failed' ? ' is-failed' : ''}`} aria-busy={row.status === 'uploading'}>
              <span className="ga-file-pending__copy">
                <strong>{row.name}</strong>
                <UploadStatus row={row} />
              </span>
              {row.status === 'failed' && (
                <span className="ga-upload-actions">
                  <button type="button" onClick={() => retryFile(row)}>Try again</button>
                  <button type="button" onClick={() => removeFileRow(row)}>Remove</button>
                </span>
              )}
            </li>
          )
        ))}
      </ul>
      {draft.assets.length < 5 && (
        <button type="button" className="ga-dashed" disabled={filesUploading} onClick={() => filesRef.current?.click()}>
          {filesUploading ? 'Uploading…' : '+ Add files'}
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
        </div>
      )}
    </div>
  );
}
