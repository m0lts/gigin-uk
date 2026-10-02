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
      <h2>Application sent to {bookerName}</h2>
      <p>{bookerName} has your application for {dateLabel}{prefer}. {draft.email ? `We've emailed a copy to ${draft.email}.` : 'Keep this page if you need the private link.'}</p>
      <ol className="ga-next">
        <li><span>1</span><div><strong>{bookerName} reviews applications</strong><p>{bookerName} looks at everyone who applied for the night and picks the acts.</p></div></li>
        <li><span>2</span><div><strong>You hear back either way</strong><p>By {channel}. If you're in, {bookerName} confirms which set you're playing, straight away or a little later.</p></div></li>
        <li><span>3</span><div><strong>Change your mind any time</strong><p>Use the private link in your email to edit or withdraw.</p></div></li>
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
          <strong>Save your details for next time?</strong>
          <p>A free account keeps your act, photo and tech rider. Your application is sent either way.</p>
          <div>
            <button type="button" className="ga-dark" onClick={() => onCreateAccount?.(draft.email)}>Create a free account</button>
            <button type="button" className="ga-ghost" onClick={() => setHidden(true)}>Not now</button>
          </div>
        </aside>
      )}
      <button type="button" className="ga-dark" onClick={onClose}>Back to the gig</button>
    </div>
  );
}
