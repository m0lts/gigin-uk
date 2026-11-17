import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { doc, updateDoc } from 'firebase/firestore';
import { toast } from 'sonner';
import { firestore } from '@lib/firebase';
import { getGigInviteById, getGigById } from '@services/client-side/gigs';
import { calendarUrl, clipQuickPick, clipWindow, clock, offerDeadline, tonightRows } from './actNight';
import '../../venue/desk/venue-desk.css';

export function TonightHandbook({ gig, venue }) {
  const rows = tonightRows({
    ...gig,
    name: gig?.gigName || gig?.eventName,
    parking: venue?.parking || gig?.parking,
    contactPhone: venue?.phone || venue?.contactPhone,
    arrivalNote: venue?.actsShouldKnow?.loadIn || gig?.arrivalNote,
    soundcheck: venue?.actsShouldKnow?.pa,
  });
  const name = venue?.name || gig?.venueName || 'Tonight';
  return (
    <section className="p-card">
      <p className="p-muted">Tonight · {gig?.startTime || ''}</p>
      <h2>{name}</h2>
      <ul>
        {rows.map((row) => (
          <li key={row.id}><strong>{row.title}</strong><span>{row.detail}</span></li>
        ))}
      </ul>
      {!rows.length ? <p className="p-muted">The venue has not added arrival or parking notes yet.</p> : null}
      <a className="p-btn p-btn--dark" href={calendarUrl({ ...gig, name: gig?.gigName || gig?.eventName })}>Add to calendar</a>
    </section>
  );
}

export function ClipTrimmer({ duration = 384, fileName = 'Clip', onUse, onCancel }) {
  const [pick, setPick] = useState('loudest');
  const [window, setWindow] = useState(() => clipQuickPick(duration, 'loudest'));
  const choose = (next) => {
    setPick(next);
    setWindow(clipQuickPick(duration, next));
  };
  return (
    <section className="p-card">
      <header className="p-card__row">
        <button type="button" className="p-text" onClick={onCancel}>Cancel</button>
        <h2>Choose your clip</h2>
      </header>
      <p>{fileName} · {clock(duration)}</p>
      <p>Plays {clock(window.start)} to {clock(window.end)} · {window.length} seconds</p>
      <label>Start second
        <input type="number" min="0" value={Math.round(window.start)} onChange={(event) => setWindow(clipWindow(duration, Number(event.target.value), window.length))} />
      </label>
      <div className="p-tabs">
        {['start', 'loudest', 'ending'].map((id) => (
          <button type="button" key={id} className={pick === id ? 'is-on' : ''} onClick={() => choose(id)}>
            {id === 'start' ? 'Start' : id === 'loudest' ? 'Loudest part' : 'Ending'}
          </button>
        ))}
      </div>
      <p className="p-muted">Drag is a start time here. The original file still uploads, with this {window.length} second range saved on it.</p>
      <button type="button" className="p-btn p-btn--dark" onClick={() => onUse(window)}>Use this clip</button>
    </section>
  );
}

export function ClipPage() {
  const [file, setFile] = useState(null);
  const [duration, setDuration] = useState(0);
  const [saved, setSaved] = useState(null);
  if (saved) return <p className="p-desk">Using {clock(saved.start)} to {clock(saved.end)}.</p>;
  return (
    <div className="p-desk">
      <input type="file" accept="video/*,audio/*" onChange={(event) => {
        const next = event.target.files?.[0];
        if (!next) return;
        const url = URL.createObjectURL(next);
        const media = document.createElement(next.type.startsWith('audio') ? 'audio' : 'video');
        media.preload = 'metadata';
        media.onloadedmetadata = () => setDuration(media.duration || 0);
        media.src = url;
        setFile(next);
      }} />
      {file && duration ? <ClipTrimmer duration={duration} fileName={file.name} onCancel={() => setFile(null)} onUse={setSaved} /> : null}
    </div>
  );
}

export function PrivateOfferPage() {
  const { inviteId } = useParams();
  const navigate = useNavigate();
  const [offer, setOffer] = useState(null);

  useEffect(() => {
    let live = true;
    getGigInviteById(inviteId).then(async (invite) => {
      if (!live || !invite) return;
      const gig = invite.gigId ? await getGigById(invite.gigId) : null;
      if (live) setOffer({ invite, gig });
    }).catch((error) => console.error(error));
    return () => { live = false; };
  }, [inviteId]);

  if (!offer) return <p className="p-empty">Loading this offer.</p>;
  const { invite, gig } = offer;
  const due = offerDeadline(invite.createdAt?.toDate?.() || invite.createdAt || new Date());
  const decline = async () => {
    try {
      await updateDoc(doc(firestore, 'gigInvites', invite.inviteId), { status: 'declined' });
      toast.success('You have passed on this gig.');
    } catch (error) {
      console.error(error);
      toast.error('Could not update this offer.');
    }
  };

  return (
    <div className="p-desk">
      <p className="p-muted">{invite.venueName || 'A venue'} via Gigin</p>
      {invite.message ? <blockquote>{invite.message}</blockquote> : null}
      <p className="p-chip">Invited · just for you</p>
      <p>Reply by {due.label} · {due.left}</p>
      <h1>{gig?.gigName || gig?.eventName || invite.gigName || 'A gig'}</h1>
      <p>{invite.venueName}</p>
      <section className="p-card">
        <p>Your slot <strong>{gig?.startTime || ''}</strong></p>
        <p>Fee <strong>{gig?.budget || invite.fee || ''}</strong></p>
      </section>
      <p>Accepting books you straight away. If you do not reply by {due.label}, the slot goes back to the venue.</p>
      <button type="button" className="p-btn p-btn--dark" onClick={() => navigate(`/gig/${invite.gigId || ''}`)}>Accept the gig</button>
      <button type="button" className="p-btn" onClick={decline}>I can&apos;t make it</button>
    </div>
  );
}
