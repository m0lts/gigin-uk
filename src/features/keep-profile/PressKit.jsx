import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import '@styles/artists/keep-profile.styles.css';
import { FEATURES } from '../../config/features';
import {
  deletePressAsset,
  downloadPressZip,
  getOwnPressKit,
  getPressKit,
  requestPressKit,
  savePressAsset,
  updateOwnProfile,
  uploadPressFile,
} from '@services/client-side/keepProfile';
import { Sheet, Toggle } from './ui';

function formatSize(size) {
  const n = Number(size) || 0;
  if (n > 1024 * 1024) return `${(n / (1024 * 1024)).toFixed(1)} MB`;
  if (n > 1024) return `${Math.round(n / 1024)} KB`;
  return `${n} B`;
}

export function PressKitPage() {
  const [files, setFiles] = useState([]);
  const [rights, setRights] = useState(false);
  const [saved, setSaved] = useState('');
  const [invalid, setInvalid] = useState(false);
  const [progress, setProgress] = useState(null);
  useEffect(() => {
    getOwnPressKit().then((data) => {
      setFiles(data.files || []);
      setRights(Boolean(data.pressKitRightsConfirmedAt));
    }).catch(() => {});
  }, []);
  const shared = files.filter((file) => file.shareWithBookedVenues !== false).length;
  const add = async (kind, file) => {
    setProgress(10);
    const uploaded = file ? await uploadPressFile(file, kind) : {};
    setProgress(80);
    const id = await savePressAsset({
      kind,
      name: file?.name || 'Press bio',
      size: file?.size || 0,
      contentType: file?.type || 'text/plain',
      path: uploaded.path,
      bioText: kind === 'bio' ? 'Press bio' : '',
      shareWithBookedVenues: true,
    });
    setFiles((current) => [...current, { id, kind, name: file?.name || 'Press bio', size: file?.size || 0, shareWithBookedVenues: true }]);
    setProgress(null);
  };
  const save = async () => {
    const switched = files.some((file) => file.shareWithBookedVenues !== false);
    if (switched && !rights) {
      setInvalid(true);
      return;
    }
    if (rights) await updateOwnProfile({ pressKitRights: true });
    setSaved(`Saved. Venues who've booked you can download ${shared} files.`);
  };
  const section = (kind, title, addLabel, limit) => {
    const rows = files.filter((file) => file.kind === kind);
    return (
      <section className="kp-section">
        <h2>{title}</h2>
        {rows.map((file) => (
          <article className="kp-asset" key={file.id}>
            <span className="kp-thumb">{file.url && file.kind !== 'video' ? <img alt="" src={file.url} className="kp-thumb" /> : kind.slice(0, 3).toUpperCase()}</span>
            <div style={{ flex: 1 }}>
              <strong>{file.name}</strong>
              <small>{file.credit ? `${file.credit} · ` : ''}{formatSize(file.size)}</small>
            </div>
            <button type="button" className="kp-text" onClick={() => deletePressAsset(file.id).then(() => setFiles(files.filter((item) => item.id !== file.id)))}>×</button>
            <div className="kp-row">
              <span>Venues who book me can download this</span>
              <Toggle label="Share" on={file.shareWithBookedVenues !== false} onChange={(on) => setFiles(files.map((item) => item.id === file.id ? { ...item, shareWithBookedVenues: on } : item))} />
            </div>
          </article>
        ))}
        {progress != null && <div className="kp-progress"><span style={{ width: `${progress}%` }} /></div>}
        {progress != null && <p>Uploading… {progress}%</p>}
        {rows.length < limit && (
          kind === 'bio' ? <button type="button" className="kp-ghost" onClick={() => add('bio')}>{addLabel}</button> : (
            <label className="kp-ghost" style={{ display: 'grid', placeItems: 'center' }}>
              {addLabel}
              <input hidden type="file" onChange={(event) => { const file = event.target.files?.[0]; if (file) add(kind, file); }} />
            </label>
          )
        )}
      </section>
    );
  };
  return (
    <div className="kp"><div className="kp-wrap">
      <h1>Press kit</h1>
      <p>Files a venue can use to promote your gig. They're stored privately and aren't on your public profile. Only venues with a confirmed gig with you can download the ones you switch on.</p>
      {section('bio', 'BIO', '+ Add a press bio', 1)}
      {section('logo', 'LOGO', '+ Add a logo', 1)}
      {section('photo', 'HIGH-RESOLUTION PRESS PHOTOS', '+ Add a photo', 8)}
      {section('video', 'VIDEOS', '+ Add a video', 4)}
      <label className={`kp-card kp-rights${invalid ? ' is-invalid' : ''}`}>
        <input type="checkbox" checked={rights} onChange={(event) => { setRights(event.target.checked); setInvalid(false); }} />
        I have the right to share these so a venue can promote my gig.
        {invalid && <p>Tick the box above to share your press kit.</p>}
      </label>
      {saved && <p>{saved}</p>}
      <button type="button" className="kp-btn" onClick={save}>Save press kit</button>
      <p>Nothing here is public. Venues see a "Download press kit" button on your profile, and it only works for venues who've booked you.</p>
      <Link to="/profile/edit">Back to your profile</Link>
    </div></div>
  );
}

export function DownloadPressKit({ profileId, actName, venueId, cancelledDate }) {
  const [access, setAccess] = useState(null);
  const [open, setOpen] = useState(false);
  const [explain, setExplain] = useState(false);
  const [phase, setPhase] = useState('idle');
  const [progress, setProgress] = useState(0);
  const [asked, setAsked] = useState(false);
  useEffect(() => {
    if (!FEATURES.pressKit || !profileId || !venueId) return undefined;
    getPressKit(profileId, venueId).then((data) => setAccess({ ...data, state: data.state || 'active' })).catch((err) => {
      const reason = err?.payload?.reason || 'not_booked';
      setAccess({ state: reason === 'cancelled' ? 'ended' : reason === 'empty' ? 'empty' : 'locked', cancelledDate: err?.payload?.cancelledDate, reason });
    });
    return undefined;
  }, [profileId, venueId]);
  if (!FEATURES.pressKit) return null;
  const active = access?.state === 'active';
  const download = async () => {
    setPhase('downloading');
    try {
      const blob = await downloadPressZip(profileId, venueId, setProgress);
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = `${access?.slug || 'artist'}-press-kit.zip`;
      link.click();
      setPhase('done');
    } catch {
      setPhase('error');
    }
  };
  return (
    <div>
      <button
        type="button"
        className={`kp-dl${active ? ' is-active' : ''}`}
        aria-disabled={active ? undefined : 'true'}
        onClick={() => {
          if (active) setOpen(true);
          else setExplain(true);
        }}
        onMouseEnter={() => { if (!active) setExplain(true); }}
        onFocus={() => { if (!active) setExplain(true); }}
      >
        Download press kit
      </button>
      {explain && !active && access?.state === 'ended' && <p>Press kit access ended when the booking for {cancelledDate || access.cancelledDate || 'that date'} was cancelled.</p>}
      {explain && !active && access?.state !== 'ended' && access?.state !== 'empty' && (
        <p className="kp-tip">You can download this artist's bio and media once you've booked them.</p>
      )}
      {access?.state === 'empty' && (
        <p>This artist hasn't added a press kit yet. <button type="button" className="kp-text" onClick={async () => { await requestPressKit(profileId, venueId); setAsked(true); }}>{asked ? 'Asked ✓' : 'Ask them for one'}</button></p>
      )}
      {open && (
        <Sheet title={`Press kit · ${actName}`} onClose={() => setOpen(false)}>
          <p>What {actName} shares with venues who've booked them, to promote the gig.</p>
          {(access?.files || []).map((file) => (
            <p key={file.id}>{file.kind} · {file.name} · {file.credit} · {formatSize(file.size)}</p>
          ))}
          {phase === 'downloading' && <div><p>Preparing {access?.slug || 'artist'}-press-kit.zip {Math.round(progress * 100)}%</p><div className="kp-progress"><span style={{ width: `${progress * 100}%` }} /></div></div>}
          {phase === 'done' && <p>Downloaded {access?.slug || 'artist'}-press-kit.zip</p>}
          {phase === 'error' && (
            <div className="kp-error">
              <strong>The download didn't finish.</strong>
              <p>The connection dropped while we were building the zip. The files are fine, so try again.</p>
              <button type="button" className="kp-btn" onClick={download}>Try again</button>
            </div>
          )}
          {phase === 'idle' && <button type="button" className="kp-btn" onClick={download}>Download zip · {formatSize((access?.files || []).reduce((sum, file) => sum + (Number(file.size) || 0), 0))}</button>}
          {phase === 'done' && <button type="button" className="kp-ghost" onClick={download}>Download again</button>}
          <p>For promoting your gig with the act. Credit photos as shown.</p>
        </Sheet>
      )}
    </div>
  );
}

export function PressKitGigBlock({ profileId, actName, venueId, dateLabel }) {
  const [access, setAccess] = useState(null);
  const [phase, setPhase] = useState('idle');
  const [progress, setProgress] = useState(0);
  const [asked, setAsked] = useState(false);
  useEffect(() => {
    if (!FEATURES.pressKit || !profileId || !venueId) return undefined;
    getPressKit(profileId, venueId).then(setAccess).catch((err) => setAccess({ state: err?.payload?.reason === 'cancelled' ? 'ended' : 'empty', reason: err?.payload?.reason }));
    return undefined;
  }, [profileId, venueId]);
  if (!FEATURES.pressKit || !profileId) return null;
  const files = access?.files || [];
  const summary = files.length ? files.map((file) => file.kind).join(', ') : '';
  const download = async () => {
    setPhase('downloading');
    try {
      const blob = await downloadPressZip(profileId, venueId, setProgress);
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = `${access?.slug || actName || 'act'}-press-kit.zip`;
      link.click();
      setPhase('done');
    } catch {
      setPhase('error');
    }
  };
  return (
    <div className="kp-press">
      <strong>Press kit</strong>
      {access?.state === 'ended' && <p>Press kit access ended when the booking for {dateLabel || 'that date'} was cancelled.</p>}
      {(!files.length || access?.reason === 'empty') && access?.state !== 'ended' && (
        <p>{actName} hasn't added a press kit yet. <button type="button" className="kp-text" onClick={async () => { await requestPressKit(profileId, venueId); setAsked(true); }}>{asked ? 'Asked ✓' : 'Ask for one'}</button></p>
      )}
      {files.length > 0 && (
        <>
          <p>{summary} · {formatSize(files.reduce((sum, file) => sum + (Number(file.size) || 0), 0))}</p>
          <button type="button" className="kp-btn" style={{ minHeight: 40 }} onClick={download}>Download press kit</button>
          <div className="kp-chips">{files.map((file) => <span className="kp-chip" key={file.id}>{file.kind} · {file.name} · {formatSize(file.size)}</span>)}</div>
          {phase === 'downloading' && <p>Preparing zip {Math.round(progress * 100)}%</p>}
          {phase === 'done' && <p>Downloaded.</p>}
          {phase === 'error' && <div className="kp-error"><strong>The download didn't finish.</strong><button type="button" className="kp-text" onClick={download}>Try again</button></div>}
        </>
      )}
    </div>
  );
}
