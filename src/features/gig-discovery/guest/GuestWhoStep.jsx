import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react';
import { FEATURES } from '../../../config/features';
import { checkGuestEmailAccount, checkReturningGuest, lookupGuestApplication, sendGuestMagicLink } from '@services/client-side/guestApplications';
import { prefillHint, sendPrefillLink } from '@services/client-side/keepProfile';
import { formatClock, slotEnd, slotTaken } from './guestFormat';

function sameEmail(left, right) {
  return String(left || '').trim().toLowerCase() === String(right || '').trim().toLowerCase();
}

export const GuestWhoStep = forwardRef(function GuestWhoStep({
  draft,
  patch,
  slots,
  bookerName,
  venueName,
  inviteNote,
  showErrors,
  onLogin,
  mode,
  onBlocked,
}, ref) {
  const editing = mode === 'edit';
  const [emailGate, setEmailGate] = useState(null);
  const [phoneMatch, setPhoneMatch] = useState(false);
  const [profileHint, setProfileHint] = useState(false);
  const [linkSent, setLinkSent] = useState(false);
  const [signInSent, setSignInSent] = useState(false);
  const [asGuest, setAsGuest] = useState(false);
  const [rateLimited, setRateLimited] = useState(false);
  const [resendIn, setResendIn] = useState(0);
  const checkedEmail = useRef('');
  const inviteChecked = useRef(false);
  const draftRef = useRef(draft);
  draftRef.current = draft;
  const missingContact = showErrors && !draft.email && !draft.phone && !draft.instagram;

  useEffect(() => {
    onBlocked?.(Boolean(emailGate || phoneMatch));
  }, [emailGate, phoneMatch, onBlocked]);

  useEffect(() => {
    if (resendIn <= 0) return undefined;
    const timer = setTimeout(() => setResendIn((current) => current - 1), 1000);
    return () => clearTimeout(timer);
  }, [resendIn]);

  const checkEmail = async (emailValue) => {
    const current = draftRef.current;
    if (editing || current.artistProfileId) return true;
    const email = String(emailValue ?? current.email ?? '').trim();
    if (current.emailVerified && sameEmail(current.verifiedEmail, email)) {
      setEmailGate(null);
      setRateLimited(false);
      return true;
    }
    if (!email || !email.includes('@')) return true;
    const key = email.toLowerCase();
    if (checkedEmail.current === key && emailGate) return false;
    checkedEmail.current = key;
    try {
      const account = await checkGuestEmailAccount(email);
      const hasAccount = Boolean(account?.hasAccount);
      patch({ accountBlocked: false, hasAccount });
      if (hasAccount) {
        setEmailGate(null);
        setRateLimited(false);
        setProfileHint(false);
        return true;
      }
      if (FEATURES.keepProfile) {
        const hint = await prefillHint(email);
        setProfileHint(Boolean(hint?.hasProfile));
      }
      const result = await checkReturningGuest({ email, gigId: current.gigId });
      if (result?.known) {
        setEmailGate({ email, sameGig: result.sameGig === true });
        setRateLimited(false);
        setResendIn(60);
        return false;
      }
      setEmailGate(null);
      setRateLimited(false);
      return true;
    } catch (error) {
      setEmailGate(null);
      if (error?.status === 429) setRateLimited(true);
      return false;
    }
  };

  useImperativeHandle(ref, () => ({
    checkBeforeLeave: async () => {
      if (editing) return true;
      if (emailGate || phoneMatch) return false;
      const current = draftRef.current;
      const phone = String(current.phone || '').trim();
      if (phone && !current.artistProfileId) {
        try {
          const result = await lookupGuestApplication({ gigId: current.gigId, phone });
          if (result?.exists) {
            setPhoneMatch(true);
            return false;
          }
        } catch {
          setPhoneMatch(false);
        }
      }
      if (rateLimited) checkedEmail.current = '';
      return checkEmail(current.email);
    },
  }));

  useEffect(() => {
    if (editing || inviteChecked.current || draft.emailVerified || draft.artistProfileId) return;
    const email = String(draft.email || '').trim();
    if (!inviteNote || !email) return;
    inviteChecked.current = true;
    checkEmail(email);
  }, [draft.email, draft.emailVerified, draft.artistProfileId, inviteNote, editing]);

  const checkPhone = async (phoneValue) => {
    const current = draftRef.current;
    const phone = String(phoneValue ?? current.phone ?? '').trim();
    if (editing || !phone || emailGate) return;
    try {
      const result = await lookupGuestApplication({ gigId: current.gigId, phone });
      setPhoneMatch(Boolean(result?.exists));
      setLinkSent(false);
    } catch {
      setPhoneMatch(false);
    }
  };

  const clearEmail = () => {
    setEmailGate(null);
    setRateLimited(false);
    checkedEmail.current = '';
    patch({ email: '', emailVerified: false, verifiedEmail: '', returnToken: '', priorManageToken: '' });
  };

  const resend = async () => {
    if (resendIn > 0 || !emailGate) return;
    checkedEmail.current = '';
    await checkEmail(emailGate.email);
  };

  if (emailGate) {
    return (
      <div className="ga-step">
        <h2>{emailGate.sameGig ? "You've already applied" : 'Welcome back'}</h2>
        <p className="ga-sub">
          {emailGate.sameGig
            ? `We've emailed the private link for your application to ${emailGate.email}.`
            : `We've sent a link to ${emailGate.email} so you can apply with your details filled in. Check your inbox (and spam).`}
        </p>
        <div className="ga-soft__actions">
          <button type="button" className="ga-dark" disabled={resendIn > 0} onClick={resend}>
            {resendIn > 0 ? `Resend in ${resendIn}s` : 'Resend the link'}
          </button>
          <button type="button" className="ga-ghost" onClick={clearEmail}>Wrong email? Use a different one</button>
        </div>
      </div>
    );
  }

  return (
    <div className="ga-step">
      <h2>Apply to play</h2>
      <p className="ga-sub">Takes about a minute. {venueName || bookerName} will see this, plus your music.</p>
      {inviteNote && <p className="ga-note">{inviteNote}</p>}
      <label className="ga-field">
        <span>Act or artist name</span>
        <input className={showErrors && !draft.actName.trim() ? 'is-invalid' : ''} value={draft.actName} onChange={(event) => patch({ actName: event.target.value })} />
      </label>
      <label className="ga-field">
        <span>Your name</span>
        <input className={showErrors && !draft.contactName.trim() ? 'is-invalid' : ''} value={draft.contactName} onChange={(event) => patch({ contactName: event.target.value })} />
      </label>
      <div className="ga-label">How can {bookerName} reach you?</div>
      {missingContact && <p className="ga-error">Add at least one so {bookerName} can get back to you.</p>}
      <div className={`ga-contact-rows${missingContact ? ' is-invalid' : ''}`}>
        <label>
          <span>Email</span>
          <input
            type="email"
            inputMode="email"
            value={draft.email}
            onChange={(event) => {
              const email = event.target.value;
              const dropProof = draft.emailVerified && !sameEmail(draft.verifiedEmail, email);
              patch({
                email,
                accountBlocked: false,
                hasAccount: false,
                ...(dropProof ? { emailVerified: false, verifiedEmail: '', returnToken: '', priorManageToken: '' } : {}),
              });
              setAsGuest(false);
              setEmailGate(null);
              setRateLimited(false);
              checkedEmail.current = '';
            }}
            onBlur={(event) => checkEmail(event.target.value)}
          />
        </label>
        <label>
          <span>Phone</span>
          <input
            type="tel"
            inputMode="tel"
            value={draft.phone}
            onChange={(event) => { patch({ phone: event.target.value }); setPhoneMatch(false); setLinkSent(false); }}
            onBlur={(event) => checkPhone(event.target.value)}
          />
        </label>
        <label><span>Instagram</span><input value={draft.instagram} placeholder="@name" onChange={(event) => patch({ instagram: event.target.value })} /></label>
      </div>
      {rateLimited && <p className="ga-error">Please wait a few minutes and try again.</p>}
      {draft.hasAccount && !asGuest && (
        <aside className="ga-account-card">
          <p className="ga-mono">YOU&apos;RE ALREADY ON GIGIN</p>
          <strong>{draft.email} has a Gigin account</strong>
          <p>Sign in and we&apos;ll fill this in from your profile and keep the application with your account. You can also carry on as a guest.</p>
          <button type="button" className="ga-dark" onClick={() => onLogin?.(draft.email)}>Sign in</button>
          <button type="button" className="ga-ghost" onClick={() => { setAsGuest(true); patch({ accountBlocked: false }); }}>Carry on as a guest</button>
        </aside>
      )}
      {draft.hasAccount && asGuest && (
        <p className="ga-note">Sending as a guest. Next time you sign in, we&apos;ll add this application to your account.</p>
      )}
      {profileHint && FEATURES.keepProfile && !draft.hasAccount && (
        <p className="ga-note">You have a Gigin profile. Sign in with your password to fill this in from it. {signInSent ? 'Sign-in link sent.' : <button type="button" className="ga-text" onClick={() => sendPrefillLink(draft.email).then(() => setSignInSent(true))}>Email me a sign-in link</button>}</p>
      )}
      {phoneMatch && (
        <div className="ga-soft">
          <strong>You&apos;ve already applied to this gig</strong>
          <p>We can email you the private link.</p>
          {linkSent ? <p>We&apos;ve emailed a private link to view it.</p> : (
            <div className="ga-soft__actions">
              <button type="button" className="ga-dark" onClick={async () => {
                await sendGuestMagicLink({ gigId: draft.gigId, phone: draft.phone });
                setLinkSent(true);
              }}>Email me the private link</button>
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
});
