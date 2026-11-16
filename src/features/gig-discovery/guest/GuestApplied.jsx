import { useState } from 'react';
import { FEATURES } from '../../../config/features';
import { Link } from 'react-router-dom';
import { KeepOffer, SaveDetailsCard, SAVE_DETAILS_COPY } from '../../keep-profile/KeepOffer';
import { GuestBrandHeader } from './GuestBrandHeader';

const DISMISS_KEY = 'guestAccountPromptDismissed';

function Tick({ size = 16 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" aria-hidden="true">
      <path d="M3.2 8.3 6.3 11.3 12.8 4.6" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function StepNumber({ n }) {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true">
      <text x="8" y="12" textAnchor="middle" fontSize="11" fontWeight="650" fill="currentColor">{n}</text>
    </svg>
  );
}

export function GuestApplied({ draft, dateLabel, bookerName, bookerPhoto, nightName, onClose, onCreateAccount, profileNote, venue }) {
  const [hidden, setHidden] = useState(() => {
    try { return localStorage.getItem(DISMISS_KEY) === '1'; } catch { return false; }
  });
  const channel = draft.phone && draft.whatsapp ? 'email or WhatsApp' : 'email';
  const night = String(nightName || '').trim();
  const lead = night
    ? `${bookerName} has your application for ${night} on ${dateLabel}.`
    : `${bookerName} has your application for ${dateLabel}.`;
  const dismiss = () => {
    try { localStorage.setItem(DISMISS_KEY, '1'); } catch { /* ignore */ }
    setHidden(true);
  };
  return (
    <>
    <GuestBrandHeader venue={venue} />
    <div className="ga-applied">
      <span className="ga-mark"><Tick size={22} /></span>
      <h2>Application sent</h2>
      <p className="ga-applied__lead">{lead}</p>
      <ol className="ga-next">
        <li>
          <span className="ga-step-mark is-done"><Tick /></span>
          <div><strong>You applied</strong><p>Today</p></div>
        </li>
        <li>
          <span className="ga-step-mark is-current"><StepNumber n="2" /></span>
          <div><strong>{bookerPhoto ? <img className="ga-booker-face" src={bookerPhoto} alt="" /> : null}{bookerName} listens and decides</strong><p>They usually reply within a few days.</p></div>
        </li>
        <li>
          <span className="ga-step-mark"><StepNumber n="3" /></span>
          <div><strong>We email you their answer</strong><p>{draft.email ? `At ${draft.email}` : `By ${channel}`}</p></div>
        </li>
        <li>
          <span className="ga-step-mark"><StepNumber n="4" /></span>
          <div><strong>If you&apos;re booked, send your promo</strong><p>A bio, photo and track so they can promote your set.</p></div>
        </li>
      </ol>
      {profileNote ? (
        <p className="ga-applied__note">{profileNote}{draft.profileSlug ? <> <Link to={`/artist/${draft.profileSlug}`}>Open</Link></> : null}</p>
      ) : FEATURES.keepProfile ? (
        <KeepOffer variant="sent" draft={draft} bookerName={bookerName} onLogin={() => onCreateAccount?.(draft.email)} />
      ) : !hidden && (
        <SaveDetailsCard
          onAction={() => onCreateAccount?.(draft.email)}
          onDismiss={dismiss}
        />
      )}
      <button type="button" className="ga-dark" onClick={onClose}>Back to the gig</button>
    </div>
    </>
  );
}
