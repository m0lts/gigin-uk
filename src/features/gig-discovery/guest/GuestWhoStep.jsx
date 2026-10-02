import { useState } from 'react';
import { FEATURES } from '../../../config/features';
import { lookupGuestApplication, sendGuestMagicLink, checkGuestEmailAccount } from '@services/client-side/guestApplications';
import { prefillHint, sendPrefillLink } from '@services/client-side/keepProfile';
import { formatClock, slotEnd, slotTaken } from './guestFormat';

export function GuestWhoStep({ draft, patch, slots, bookerName, venueName, inviteNote, showErrors, onLogin }) {
  const [duplicate, setDuplicate] = useState(null);
  const [profileHint, setProfileHint] = useState(false);
  const [linkSent, setLinkSent] = useState(false);
  const [signInSent, setSignInSent] = useState(false);
  const [asGuest, setAsGuest] = useState(false);
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
    const email = String(draft.email || '').trim();
    if (!email) {
      patch({ accountBlocked: false, hasAccount: false });
      return;
    }
    try {
      const account = await checkGuestEmailAccount(email);
      const blocked = Boolean(account?.hasAccount);
      patch({ accountBlocked: false, hasAccount: blocked });
      if (FEATURES.keepProfile && !blocked) {
        const hint = await prefillHint(email);
        setProfileHint(Boolean(hint?.hasProfile));
      }
    } catch {
      patch({ accountBlocked: false });
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
        <label><span>Email</span><input type="email" inputMode="email" value={draft.email} onChange={(event) => { patch({ email: event.target.value, accountBlocked: false, hasAccount: false }); setAsGuest(false); }} onBlur={checkDuplicate} /></label>
        <label><span>Phone</span><input type="tel" inputMode="tel" value={draft.phone} onChange={(event) => patch({ phone: event.target.value })} onBlur={checkDuplicate} /></label>
        <label><span>Instagram</span><input value={draft.instagram} placeholder="@name" onChange={(event) => patch({ instagram: event.target.value })} /></label>
      </div>
      {draft.hasAccount && !asGuest && (
        <aside className="ga-account-card">
          <p className="ga-mono">YOU&apos;RE ALREADY ON GIGIN</p>
          <strong>{draft.email} has a Gigin account</strong>
          <p>Log in and we&apos;ll fill this in from your profile and keep the application with your account. You can also carry on as a guest.</p>
          <button type="button" className="ga-dark" onClick={() => onLogin?.(draft.email)}>Log in</button>
          <button type="button" className="ga-ghost" onClick={() => { setAsGuest(true); patch({ accountBlocked: false }); }}>Carry on as a guest</button>
        </aside>
      )}
      {draft.hasAccount && asGuest && (
        <p className="ga-note">Sending as a guest. Next time you log in, we&apos;ll add this application to your account.</p>
      )}
      {profileHint && FEATURES.keepProfile && !draft.hasAccount && (
        <p className="ga-note">You have a Gigin profile. Log in with your password to fill this in from it. {signInSent ? 'Sign-in link sent.' : <button type="button" className="ga-text" onClick={() => sendPrefillLink(draft.email).then(() => setSignInSent(true))}>Email me a sign-in link</button>}</p>
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
      {slots.length > 1 && (
        <>
          <div className="ga-label">Which set would you prefer? <em className="ga-optional">optional</em></div>
          <p className="ga-sub">{bookerName} will confirm which set you're playing.</p>
          <div className="ga-sets">
            <button
              type="button"
              className={draft.noPreference !== false && !(draft.preferredSlotGigIds || draft.slotGigIds || []).length ? 'is-on' : ''}
              onClick={() => patch({ preferredSlotGigIds: [], slotGigIds: [], noPreference: true })}
            >
              <span className={`ga-box${draft.noPreference !== false && !(draft.preferredSlotGigIds || draft.slotGigIds || []).length ? ' is-on' : ''}`} />
              <span>
                <strong>No preference</strong>
                <small>Happy to play whichever set {bookerName} picks</small>
              </span>
            </button>
            {slots.map((slot, index) => {
              const id = slot.gigId || slot.id;
              const taken = slotTaken(slot);
              const selected = (draft.preferredSlotGigIds || draft.slotGigIds || []).includes(id);
              return (
                <button
                  key={id || index}
                  type="button"
                  className={`${selected ? 'is-on' : ''}${taken ? ' is-taken' : ''}`}
                  disabled={taken}
                  onClick={() => {
                    if (taken) return;
                    const current = draft.preferredSlotGigIds || [];
                    const next = selected ? current.filter((item) => item !== id) : [...current, id];
                    patch({ preferredSlotGigIds: next, slotGigIds: next, noPreference: next.length === 0 });
                  }}
                >
                  <span className={`ga-box${selected ? ' is-on' : ''}${taken ? ' is-taken' : ''}`} />
                  <span>
                    <strong>Set {index + 1}</strong>
                    <em className="ga-mono">{formatClock(slot.startTime)}{slotEnd(slot) ? `–${slotEnd(slot)}` : ''}</em>
                    <small>{taken ? 'Already booked' : (slot.hint || '')}</small>
                  </span>
                  {taken && <b>Taken</b>}
                </button>
              );
            })}
          </div>
        </>
      )}
      <aside className="ga-privacy">
        Your email and phone number only go to {bookerName} and the bookers at {venueName || 'the venue'}. We only email you about this application, and never show your details publicly. <a href="/privacy-policy">Privacy policy</a>
      </aside>
    </div>
  );
}
