import { useRef, useState } from 'react';
import { releaseGuestUpload, submitGuestPromo, uploadGuestFile } from '@services/client-side/guestApplications';
import { guestFileProblem, isAudioAsset } from './guestAssetFiles';
import { actTypeLine } from './guestFormat';
import { GuestTechStep } from './GuestTechStep';
import { promoDraftFromApplication } from './promoDraft';
import { KeepOffer } from '../../keep-profile/KeepOffer';
import { FEATURES } from '../../../config/features';

function fileBits(file) {
  return { path: file.path, name: file.name, size: file.size, contentType: file.contentType };
}

export function GuestPromo({ application, venueName, gigId, token, onSaved }) {
  const venue = venueName || 'the venue';
  const [editing, setEditing] = useState(!application?.promo?.submittedAt);
  const [draft, setDraft] = useState(() => promoDraftFromApplication(application));
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');
  const photoRef = useRef(null);
  const trackRef = useRef(null);
  const sent = application?.promo;
  const open = application?.promoOpen !== false;

  const uploadPhoto = async (file) => {
    if (!file || draft.photos.length >= 4) return;
    const problem = guestFileProblem(file, { audioCount: 0, assetCount: 0 });
    if (problem) {
      setError(problem);
      return;
    }
    setBusy('photo');
    setError('');
    try {
      const uploaded = await uploadGuestFile({
        applicationId: application.applicationId,
        file,
        kind: 'asset',
        gigId,
        manageToken: token,
      });
      setDraft((current) => ({ ...current, photos: [...current.photos, uploaded].slice(0, 4) }));
    } catch (err) {
      setError(err?.message || 'That photo did not upload.');
    } finally {
      setBusy('');
    }
  };

  const uploadTrack = async (file) => {
    if (!file) return;
    if (!isAudioAsset({ name: file.name, contentType: file.type })) {
      setError('Use an MP3, M4A or WAV, up to 15 MB.');
      return;
    }
    const problem = guestFileProblem(file, { audioCount: 0, assetCount: 0 });
    if (problem) {
      setError(problem);
      return;
    }
    setBusy('track');
    setError('');
    try {
      const uploaded = await uploadGuestFile({
        applicationId: application.applicationId,
        file,
        kind: 'asset',
        gigId,
        manageToken: token,
      });
      setDraft((current) => ({ ...current, trackFile: uploaded, trackUrl: '' }));
    } catch (err) {
      setError(err?.message || 'That track did not upload.');
    } finally {
      setBusy('');
    }
  };

  const removePhoto = async (photo) => {
    setDraft((current) => ({ ...current, photos: current.photos.filter((item) => item.path !== photo.path) }));
    const saved = (application.promo?.photos || []).some((item) => item.path === photo.path) || application.photo?.path === photo.path;
    if (!saved && photo.path) {
      releaseGuestUpload({ applicationId: application.applicationId, path: photo.path, gigId, manageToken: token }).catch(() => {});
    }
  };

  const send = async () => {
    if (!draft.permission || busy) return;
    setBusy('send');
    setError('');
    try {
      const next = await submitGuestPromo(token, {
        gigId,
        permission: true,
        bio: draft.bio,
        photos: draft.photos.map(fileBits),
        track: draft.trackFile?.path ? fileBits(draft.trackFile) : { url: draft.trackUrl },
        videoUrl: draft.videoUrl,
        played: draft.played,
        members: draft.members,
        soundNote: draft.soundNote,
      });
      onSaved(next);
      setEditing(false);
    } catch (err) {
      setError(err?.message || 'Could not send your promo.');
    } finally {
      setBusy('');
    }
  };

  if (!editing && sent?.submittedAt) {
    const track = sent.track?.name || sent.track?.url || '';
    return (
      <section className="ga-promo ga-promo--sent">
        <h2>{venue} has your promo</h2>
        <p className="ga-promo__lead">See you on {(application.dateLabel || 'the night').trim()}. We&apos;ll send a reminder the day before.</p>
        <ul className="ga-promo__sent">
          <li><span>Bio</span><strong>{sent.bio}</strong></li>
          <li><span>Photos</span><strong>{(sent.photos || []).length} added</strong></li>
          {track ? <li><span>Track</span><strong>{track}</strong></li> : null}
          {sent.videoUrl ? <li><span>Video</span><strong>{sent.videoUrl}</strong></li> : null}
          {sent.played ? <li><span>Where you&apos;ve played</span><strong>{sent.played}</strong></li> : null}
          <li><span>Line-up</span><strong>{actTypeLine(application.members) || 'Not added'}</strong></li>
          {application.soundNote ? <li><span>Sound</span><strong>{application.soundNote}</strong></li> : null}
        </ul>
        {open ? <button type="button" className="ga-text" onClick={() => { setDraft(promoDraftFromApplication(application)); setEditing(true); }}>Edit</button> : null}
        {FEATURES.keepProfile && !application.artistProfileId && application.keepProfileOffer !== 'confirmed' ? (
          <KeepOffer
            draft={{ ...application, manageToken: token, gigId, email: application.contacts?.email || '', actName: application.actName }}
            bookerName={venue}
            onLogin={() => {}}
          />
        ) : null}
      </section>
    );
  }

  return (
    <section className="ga-promo">
      <p className="ga-promo__booked">Booked</p>
      <h2>Send your promo</h2>
      <p className="ga-promo__lead">{venue} uses this to promote your set.{application.promoDue ? ` Due by ${application.promoDue}.` : ''}</p>
      <div className="ga-promo__lineup">
        <div className="ga-label">Who&apos;s playing</div>
        <GuestTechStep
          lineupOnly
          draft={{ members: draft.members, links: {}, needs: [], bringOwn: [] }}
          patch={(partial) => {
            if (partial.members) setDraft((current) => ({ ...current, members: partial.members }));
          }}
        />
        <label className="ga-field">
          <span>Anything you need for sound?</span>
          <input type="text" maxLength={300} placeholder="Optional" value={draft.soundNote || ''} onChange={(event) => setDraft((current) => ({ ...current, soundNote: event.target.value }))} />
        </label>
      </div>
      <div className="ga-promo__card">
        <label className="ga-promo__row">
          <span><b>Bio</b><small>A few lines about you and your music</small></span>
          <textarea rows={3} maxLength={600} value={draft.bio} onChange={(event) => setDraft((current) => ({ ...current, bio: event.target.value }))} />
        </label>
        <div className="ga-promo__row">
          <span><b>Photo</b><small>{draft.photos.length ? `${draft.photos.length} added · add more if you like` : 'Up to 4'}</small></span>
          <ul>
            {draft.photos.map((photo) => (
              <li key={photo.path || photo.name}>
                {photo.name || 'Photo'}
                <button type="button" onClick={() => removePhoto(photo)}>Remove</button>
              </li>
            ))}
          </ul>
          {draft.photos.length < 4 ? (
            <button type="button" className="ga-promo__add" disabled={busy === 'photo'} onClick={() => photoRef.current?.click()}>{busy === 'photo' ? 'Uploading…' : 'Add'}</button>
          ) : null}
          <input ref={photoRef} type="file" accept="image/jpeg,image/png,image/webp,image/heic,image/heif" hidden onChange={(event) => { uploadPhoto(event.target.files?.[0]); event.target.value = ''; }} />
        </div>
        <div className="ga-promo__row">
          <span><b>A track</b><small>{draft.trackFile?.name || 'Audio, or a link'}</small></span>
          {draft.trackFile ? <button type="button" className="ga-text" onClick={() => setDraft((current) => ({ ...current, trackFile: null }))}>Remove file</button> : null}
          <button type="button" className="ga-promo__add" disabled={busy === 'track'} onClick={() => trackRef.current?.click()}>{busy === 'track' ? 'Uploading…' : 'Upload'}</button>
          <input ref={trackRef} type="file" accept="audio/mpeg,audio/mp4,audio/x-m4a,audio/wav,.mp3,.m4a,.wav" hidden onChange={(event) => { uploadTrack(event.target.files?.[0]); event.target.value = ''; }} />
          <input type="url" placeholder="Or paste a Spotify or YouTube link" value={draft.trackUrl} onChange={(event) => setDraft((current) => ({ ...current, trackUrl: event.target.value, trackFile: null }))} />
        </div>
        <label className="ga-promo__row">
          <span><b>Video</b><small>Optional. A live clip helps a lot</small></span>
          <input type="url" placeholder="https://" value={draft.videoUrl} onChange={(event) => setDraft((current) => ({ ...current, videoUrl: event.target.value }))} />
        </label>
        <label className="ga-promo__row">
          <span><b>Where you&apos;ve played</b><small>Optional. Shows next to your bio</small></span>
          <input type="text" maxLength={300} placeholder="Hidden Rooms, The Portland Arms" value={draft.played} onChange={(event) => setDraft((current) => ({ ...current, played: event.target.value }))} />
        </label>
        <label className="ga-promo__permit">
          <input type="checkbox" checked={draft.permission} onChange={(event) => setDraft((current) => ({ ...current, permission: event.target.checked }))} />
          <span>I own or have permission to share these, and {venue} can use them to promote the gig on its website and social media.</span>
        </label>
      </div>
      {error ? <p className="ga-error">{error}</p> : null}
      <button type="button" className="ga-dark" disabled={!draft.permission || Boolean(busy)} onClick={send}>{busy === 'send' ? 'Sending…' : `Send to ${venue}`}</button>
      {sent?.submittedAt ? <button type="button" className="ga-text" onClick={() => setEditing(false)}>Cancel</button> : null}
    </section>
  );
}
