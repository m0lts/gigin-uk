import { sizeLabel, UPLOAD_ROW_ERROR } from './guestAssetFiles';
import './guest-audio.css';

function AudioMark() {
  return (
    <svg className="ga-audio__icon" viewBox="0 0 24 24" width="22" height="22" aria-hidden="true">
      <path fill="currentColor" d="M12 3v10.55A4 4 0 1 0 14 17V7h4V3h-6z" />
    </svg>
  );
}

export function GuestAudioRow({ asset, onRemove, onRetry, showPlayer = false, pending = null }) {
  const src = asset?.playUrl || asset?.previewUrl || '';
  const download = asset?.downloadUrl || asset?.previewUrl || '';
  const progress = pending?.progress > 0 ? ` ${pending.progress}%` : '';
  return (
    <li className={`ga-audio${pending?.failed ? ' is-failed' : ''}${pending ? ' is-pending' : ''}`} aria-busy={pending && !pending.failed}>
      <span className="ga-audio__mark" aria-hidden="true"><AudioMark /></span>
      <span className="ga-audio__meta">
        <strong>{pending?.name || asset?.name}</strong>
        {pending?.failed ? (
          <em className="ga-upload-fail">{pending.message || UPLOAD_ROW_ERROR}</em>
        ) : pending ? (
          <em className="ga-uploading"><span className="ga-spin" aria-hidden="true" />{`Uploading…${progress}`}</em>
        ) : (
          <em>{sizeLabel(asset?.size)}</em>
        )}
      </span>
      {showPlayer && src ? <audio controls preload="none" src={src} /> : null}
      {showPlayer && download ? <a href={download} download={asset?.name || 'audio'}>Download</a> : null}
      {pending?.failed && onRetry ? <button type="button" onClick={onRetry}>Try again</button> : null}
      {onRemove ? <button type="button" onClick={onRemove}>Remove</button> : null}
    </li>
  );
}
