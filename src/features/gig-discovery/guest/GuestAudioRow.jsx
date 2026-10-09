import { sizeLabel } from './guestAssetFiles';
import './guest-audio.css';

function AudioMark() {
  return (
    <svg className="ga-audio__icon" viewBox="0 0 24 24" width="22" height="22" aria-hidden="true">
      <path fill="currentColor" d="M12 3v10.55A4 4 0 1 0 14 17V7h4V3h-6z" />
    </svg>
  );
}

export function GuestAudioRow({ asset, onRemove, showPlayer = false, pending = null }) {
  const src = asset?.playUrl || asset?.previewUrl || '';
  const download = asset?.downloadUrl || asset?.previewUrl || '';
  return (
    <li className={`ga-audio${pending?.failed ? ' is-failed' : ''}${pending ? ' is-pending' : ''}`}>
      <span className="ga-audio__mark" aria-hidden="true"><AudioMark /></span>
      <span className="ga-audio__meta">
        <strong>{pending?.name || asset?.name}</strong>
        <em>{pending ? (pending.failed ? "Didn't upload" : `Uploading… ${pending.progress}%`) : sizeLabel(asset?.size)}</em>
      </span>
      {showPlayer && src ? <audio controls preload="none" src={src} /> : null}
      {showPlayer && download ? <a href={download} download={asset?.name || 'audio'}>Download</a> : null}
      {onRemove ? <button type="button" onClick={onRemove}>Remove</button> : null}
    </li>
  );
}
