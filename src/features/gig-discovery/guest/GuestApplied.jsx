import { useState } from 'react';
import { FEATURES } from '../../../config/features';
import { Link } from 'react-router-dom';
import { KeepOffer } from '../../keep-profile/KeepOffer';
import { preferenceReview } from './guestFormat';

const DISMISS_KEY = 'guestAccountPromptDismissed';

export function GuestApplied({ draft, dateLabel, bookerName, onClose, onCreateAccount, profileNote }) {
  const [hidden, setHidden] = useState(() => {
    try { return localStorage.getItem(DISMISS_KEY) === '1'; } catch { return false; }
  });
  const pref = preferenceReview(draft.slots || [], draft.preferredSlotGigIds || []);
  const prefer = draft.slots?.length > 1 && (draft.preferredSlotGigIds || []).length
    ? `, and knows you'd prefer ${pref.replace(/^Prefers /, '')}`
    : '';
  const channel = draft.phone && draft.whatsapp ? 'email or WhatsApp' : 'email';
  return (
    <div className="ga-applied">
      <span className="ga-check">✓</span>
      <h2>Application sent</h2>
      <p>{bookerName} has your application for {dateLabel}{prefer}.</p>
      <ol className="ga-next ga-panel">
        <li><span className="is-done">✓</span><div><strong>You applied</strong><p>Today</p></div></li>
        <li><span>2</span><div><strong>{bookerName} listens and decides</strong><p>They usually reply within a few days.</p></div></li>
        <li><span>3</span><div><strong>We email you their answer</strong><p>{draft.email ? `At ${draft.email}` : `By ${channel}`}</p></div></li>
        <li><span>4</span><div><strong>If you&apos;re booked, send your promo</strong><p>A bio, photo and track so they can promote your set.</p></div></li>
      </ol>
      {profileNote ? (
        <p>{profileNote}{draft.profileSlug ? <> <Link to={`/artist/${draft.profileSlug}`}>Open</Link></> : null}</p>
      ) : FEATURES.keepProfile ? (
        <KeepOffer draft={draft} bookerName={bookerName} onLogin={() => onCreateAccount?.(draft.email)} />
      ) : !hidden && (
        <aside className="ga-account">
          <button type="button" className="ga-icon" aria-label="Dismiss" onClick={() => {
            try { localStorage.setItem(DISMISS_KEY, '1'); } catch { /* ignore */ }
            setHidden(true);
          }}>×</button>
          <strong>Save your details for next time</strong>
          <p>Apply to the next gig in one tap and see all your applications in one place. It&apos;s free, and there&apos;s no password: we email you a link.</p>
          <div>
            <button type="button" className="ga-dark" onClick={() => onCreateAccount?.(draft.email)}>Save my details</button>
            <button type="button" className="ga-text" onClick={() => setHidden(true)}>Not now</button>
          </div>
        </aside>
      )}
      <button type="button" className="ga-dark" onClick={onClose}>Back to the gig</button>
    </div>
  );
}
