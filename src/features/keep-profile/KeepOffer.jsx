import { useEffect, useState } from 'react';
import '@styles/artists/keep-profile.styles.css';
import { useNavigate } from 'react-router-dom';
import { FEATURES } from '../../config/features';
import { checkGuestEmailAccount } from '@services/client-side/guestApplications';
import { dismissKeepOffer, keepGuestProfile, previewSlug } from '@services/client-side/keepProfile';
import { LinkChips } from './ui';

function subLine(draft) {
  const members = (draft.members || []).filter((member) => member?.name);
  if (!members.length) return '';
  const instruments = [...new Set(members.flatMap((member) => member.instruments || []))].join(', ');
  const kind = members.length === 1 ? 'Solo' : members.length === 2 ? 'Duo' : members.length === 3 ? 'Trio' : `${members.length}-piece`;
  return instruments ? `${kind} · ${instruments}` : kind;
}

export function KeepOffer({ draft, bookerName, onLogin }) {
  const navigate = useNavigate();
  const [phase, setPhase] = useState(draft.keepProfileOffer === 'dismissed' ? 'dismissed' : 'offer');
  const [email, setEmail] = useState(draft.email || '');
  const [sentTo, setSentTo] = useState('');
  const [token, setToken] = useState('');
  const [savedChoices] = useState(() => {
    try { return sessionStorage.getItem('gigin.choicesSaved') === '1'; } catch { return false; }
  });
  const [hasAccount, setHasAccount] = useState(Boolean(draft.hasAccount));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const slug = previewSlug(draft.actName);
  const photo = draft.photo?.url || draft.photo?.preview || '';
  const hasLinks = Object.values(draft.links || {}).some((value) => String(value || '').trim()) || draft.instagram;
  const hasBand = (draft.members || []).some((member) => member?.name);
  const hasTech = (draft.needs || []).length > 0 || (draft.bringOwn || []).length > 0;
  const sparse = !photo && !hasLinks && !hasBand;
  const initials = String(draft.actName || 'A').split(/\s+/).map((part) => part[0]).join('').slice(0, 2).toUpperCase();

  useEffect(() => {
    const address = String(draft.email || '').trim();
    if (!address) return undefined;
    let cancelled = false;
    checkGuestEmailAccount(address).then((result) => {
      if (!cancelled) setHasAccount(Boolean(result?.hasAccount));
    }).catch(() => {});
    return () => { cancelled = true; };
  }, [draft.email]);

  const keep = async () => {
    setBusy(true);
    setError('');
    try {
      const result = await keepGuestProfile(draft.manageToken, { gigId: draft.gigId, email: email || draft.email });
      if (result?.status === 'live') {
        navigate(`/artist/${result.slug}`);
        return;
      }
      setSentTo(result?.email || email || draft.email);
      setToken(result?.confirmToken || '');
      setPhase('sent');
    } catch (err) {
      setError(err?.message || 'Could not send the link.');
    } finally {
      setBusy(false);
    }
  };

  if (phase === 'dismissed') {
    return (
      <div className="kp-dismiss">
        No problem. If you change your mind, there's a link in the emails we send about this application.
        <button type="button" className="kp-text" onClick={() => setPhase('offer')}>Undo</button>
      </div>
    );
  }

  if (phase === 'sent') {
    return (
      <aside className="kp-offer">
        <h3>Check your email</h3>
        <p>We've sent a link to {sentTo}. Tap it to put your profile live. Nothing is public until you do.</p>
        {savedChoices && <p>✓ Your choices are saved.</p>}
        <button type="button" className="kp-ghost" onClick={() => navigate(`/profile/keep?t=${encodeURIComponent(token)}`)}>
          Choose what's public <em className="kp-muted"> optional</em>
        </button>
        <div className="kp-links">
          <button type="button" onClick={keep}>Resend the link</button>
          <button type="button" onClick={() => setPhase('offer')}>Wrong email?</button>
        </div>
      </aside>
    );
  }

  if (hasAccount) {
    return (
      <aside className="kp-offer">
        <p className="kp-kicker">YOU'RE ALREADY ON GIGIN</p>
        <h3>{draft.email} has a Gigin account</h3>
        <p>Log in and we'll add this application to your account, so everything is in one place. Your application to {bookerName} is sent either way.</p>
        <button type="button" className="kp-btn" onClick={() => {
          try { sessionStorage.setItem('gigin.reviewAdd', '1'); } catch { /* ignore */ }
          onLogin?.();
        }}>Log in instead</button>
        <button type="button" className="kp-ghost" onClick={async () => {
          setPhase('dismissed');
          try { await dismissKeepOffer(draft.manageToken, draft.gigId); } catch { /* ignore */ }
        }}>Not now</button>
      </aside>
    );
  }

  return (
    <aside className="kp-offer">
      <p className="kp-kicker">FOR NEXT TIME · FREE</p>
      <h3>Keep this as your Gigin profile</h3>
      <p>Your bio, photos, links, band info and tech rider in one place, with a link you can send to any venue when you're looking for gigs.</p>
      <div className="kp-preview">
        {photo ? <img className="kp-photo" src={photo} alt="" /> : <span className="kp-initials">{initials}</span>}
        <div>
          <strong>{draft.actName || 'Your act'}</strong>
          <span>{sparse ? 'Just your act name so far' : (subLine(draft) || 'Your Gigin profile')}</span>
          <div className="kp-mono">giginmusic.com/artist/{slug}</div>
        </div>
        <div className="kp-chips">
          {sparse && (
            <>
              <span className="kp-chip-dash">+ Photo</span>
              <span className="kp-chip-dash">+ Music link</span>
              <span className="kp-chip-dash">+ Band</span>
            </>
          )}
          {!photo && !sparse && <span className="kp-chip-dash">+ Add a photo</span>}
          <LinkChips links={{ ...draft.links, instagram: draft.links?.instagram || draft.instagram }} />
          {hasTech && <span className="kp-chip-dark">Tech rider</span>}
        </div>
      </div>
      {sparse && <p>Add these any time after you confirm. Venues usually look for a photo and something to listen to.</p>}
      {!photo && !sparse && <p>You can add a photo after you confirm. Without one, your page uses your initials.</p>}
      {FEATURES.venueFinder && (
        <div className="kp-finder">
          <span className="kp-pin" aria-hidden="true">📍</span>
          <div>
            <strong>And unlock the venue finder</strong>
            <p>Find venues near you, see what each one wants (PA, door deal, capacity, how they book), and send them your profile link.</p>
          </div>
        </div>
      )}
      {!draft.email && (
        <label className="kp-field">
          Your email
          <input type="email" value={email} onChange={(event) => setEmail(event.target.value)} />
          <small className="kp-muted">You applied with your phone number. We need an email to send the confirm link.</small>
        </label>
      )}
      {error && <p className="kp-error">{error}</p>}
      <button type="button" className="kp-btn" disabled={busy} onClick={keep}>Keep my profile</button>
      <p className="kp-fine">We'll email you a link to confirm. Then you'll create a password.</p>
      <button type="button" className="kp-ghost" onClick={async () => {
        setPhase('dismissed');
        try { await dismissKeepOffer(draft.manageToken, draft.gigId); } catch { /* ignore */ }
      }}>Not now</button>
    </aside>
  );
}
