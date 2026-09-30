import { useState } from 'react';
import { lookupGuestApplication, sendGuestMagicLink } from '@services/client-side/guestApplications';
import { formatClock, slotEnd } from './guestFormat';

export function GuestWhoStep({ draft, patch, slots, bookerName, inviteNote, showErrors }) {
  const [duplicate, setDuplicate] = useState(null);
  const [linkSent, setLinkSent] = useState(false);
  const missingContact = showErrors && !draft.email && !draft.phone && !draft.instagram;

  const checkDuplicate = async () => {
    if (draft.ignoreDuplicate) return;
    if (!draft.email && !draft.phone) return;
    try {
      const result = await lookupGuestApplication({ gigId: draft.gigId, email: draft.email, phone: draft.phone });
      setDuplicate(result?.exists ? result : null);
    } catch {
      setDuplicate(null);
    }
  };

  return (
    <div className="ga-step">
      <h2>Who are you?</h2>
      <p className="ga-sub">Only your act name, your name and one way to reach you are needed.</p>
      {inviteNote && <p className="ga-note">{inviteNote}</p>}
      <label className="ga-field">
        <span>Act or band name</span>
        <input className={showErrors && !draft.actName.trim() ? 'is-invalid' : ''} value={draft.actName} onChange={(event) => patch({ actName: event.target.value })} />
      </label>
      <label className="ga-field">
        <span>Your name</span>
        <input className={showErrors && !draft.contactName.trim() ? 'is-invalid' : ''} value={draft.contactName} onChange={(event) => patch({ contactName: event.target.value })} />
      </label>
      <div className="ga-label">How can {bookerName} reach you?</div>
      {missingContact && <p className="ga-error">Add at least one so {bookerName} can get back to you.</p>}
      <div className={`ga-contact-rows${missingContact ? ' is-invalid' : ''}`}>
        <label><span>Email</span><input type="email" inputMode="email" value={draft.email} onChange={(event) => patch({ email: event.target.value })} onBlur={checkDuplicate} /></label>
        <label><span>Phone</span><input type="tel" inputMode="tel" value={draft.phone} onChange={(event) => patch({ phone: event.target.value, whatsapp: event.target.value ? draft.whatsapp : false })} onBlur={checkDuplicate} /></label>
        <label><span>Instagram</span><input value={draft.instagram} placeholder="@name" onChange={(event) => patch({ instagram: event.target.value })} /></label>
      </div>
      {draft.phone.trim() && (
        <label className="ga-check">
          <input type="checkbox" checked={draft.whatsapp} onChange={(event) => patch({ whatsapp: event.target.checked })} />
          <span>{bookerName} can message me on WhatsApp on this number</span>
        </label>
      )}
      {duplicate && !draft.ignoreDuplicate && (
        <div className="ga-soft">
          <strong>You've already applied with this email</strong>
          <p>{duplicate.dateLabel || 'Earlier'} · {duplicate.setLabel || 'a set'}.</p>
          {linkSent ? <p>We've emailed a private link to view it.</p> : (
            <div className="ga-soft__actions">
              <button type="button" className="ga-dark" onClick={async () => {
                await sendGuestMagicLink({ gigId: draft.gigId, email: draft.email, phone: draft.phone });
                setLinkSent(true);
              }}>View my application</button>
              <button type="button" className="ga-ghost" onClick={() => { setDuplicate(null); patch({ ignoreDuplicate: true }); }}>Apply as another act</button>
            </div>
          )}
        </div>
      )}
      <div className="ga-label">Which set would you like?</div>
      <div className="ga-sets">
        {slots.map((slot, index) => {
          const id = slot.gigId;
          const on = draft.slotGigIds.includes(id);
          return (
            <button key={id || index} type="button" className={on ? 'is-on' : ''} onClick={() => patch({
              slotGigIds: on ? draft.slotGigIds.filter((item) => item !== id) : [...draft.slotGigIds, id],
            })}>
              <span className={`ga-box${on ? ' is-on' : ''}`} />
              <span>
                <strong>Set {index + 1}</strong>
                <em className="ga-mono">{formatClock(slot.startTime)}{slotEnd(slot) ? `–${slotEnd(slot)}` : ''}</em>
                {slot.hint ? <small>{slot.hint}</small> : null}
              </span>
            </button>
          );
        })}
      </div>
      {showErrors && draft.slotGigIds.length === 0 && <p className="ga-error">Choose at least one set.</p>}
    </div>
  );
}
