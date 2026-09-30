import { useState } from 'react';

const DISMISS_KEY = 'guestAccountPromptDismissed';

export function GuestApplied({ draft, dateLabel, bookerName, onClose, onCreateAccount }) {
  const [hidden, setHidden] = useState(() => {
    try { return localStorage.getItem(DISMISS_KEY) === '1'; } catch { return false; }
  });
  const channel = 'email';
  return (
    <div className="ga-applied">
      <span className="ga-check">✓</span>
      <h2>Application sent to {bookerName}</h2>
      <p>{bookerName} has your application{draft.slotGigIds.length ? ` for your chosen set` : ''} on {dateLabel}. {draft.email ? `We've emailed a copy to ${draft.email}.` : 'Keep this page if you need the private link.'}</p>
      <ol className="ga-next">
        <li><span>1</span><div><strong>{bookerName} reviews applications</strong><p>They'll look at who is playing and what you need.</p></div></li>
        <li><span>2</span><div><strong>You hear back either way</strong><p>By {channel}.</p></div></li>
        <li><span>3</span><div><strong>Change your mind any time</strong><p>The email has a private link.</p></div></li>
      </ol>
      {!hidden && (
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
