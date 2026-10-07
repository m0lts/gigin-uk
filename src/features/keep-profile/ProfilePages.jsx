import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import '@styles/artists/keep-profile.styles.css';
import { FEATURES } from '../../config/features';
import {
  claimProfileAccount,
  inspectConfirm,
  consumePrefill,
  deleteOwnProfile,
  getOwnProfile,
  getPendingProfile,
  hideOwnProfile,
  openEditSession,
  profileLink,
  redeemNudge,
  requestEditLink,
  resendConfirm,
  savePendingProfile,
  updateOwnProfile,
} from '@services/client-side/keepProfile';
import { GuestTechStep } from '../gig-discovery/guest/GuestTechStep';
import { buildGuestTechRider } from '@services/utils/techRiderCompatibility';
import { signInWithEmailAndPassword, signInWithPopup, signOut } from 'firebase/auth';
import { auth, googleProvider } from '@lib/firebase';
import { passwordStrength, passwordSubmitError } from './passwordStrength';
import { CopyButton, shareProfile, Sheet, Toggle } from './ui';
import { httpClient } from '@services/http/client';

function Shell({ children }) {
  return (
    <div className="kp">
      <header className="kp-top"><span className="kp-logo">gigin.</span></header>
      <div className="kp-wrap">{children}</div>
    </div>
  );
}

export function KeepChoicesPage() {
  const [params] = useSearchParams();
  const token = params.get('t') || '';
  const navigate = useNavigate();
  const [bio, setBio] = useState('');
  const [preview, setPreview] = useState(null);
  const [fields, setFields] = useState({ photo: true, bio: false, links: true, members: true, tech: true });
  const [error, setError] = useState('');
  useEffect(() => {
    if (!token) return undefined;
    getPendingProfile(token).then((data) => {
      setPreview(data);
      setBio(data.bio || '');
      setFields({
        photo: data.hasPhoto && data.publicFields?.photo !== false,
        bio: Boolean(data.bio) && data.publicFields?.bio !== false,
        links: data.links?.length > 0 && data.publicFields?.links !== false,
        members: data.memberNames?.length > 0 && data.publicFields?.members !== false,
        tech: Boolean(data.techLine) && data.publicFields?.tech !== false,
      });
    }).catch((err) => setError(err?.payload?.error === 'expired' ? 'This link has expired.' : (err?.message || 'This link is not valid.')));
    return undefined;
  }, [token]);
  const filled = {
    photo: Boolean(preview?.hasPhoto),
    bio: Boolean(bio.trim()),
    links: (preview?.links || []).length > 0,
    members: (preview?.memberNames || []).length > 0,
    tech: Boolean(preview?.techLine),
  };
  const details = {
    photo: filled.photo ? (preview.photoName || 'Press photo') : 'Not added yet',
    bio: filled.bio ? bio.trim() : "You didn't add one when you applied. Optional.",
    links: filled.links ? preview.links.join(', ') : 'Not added yet',
    members: filled.members ? preview.memberNames.join(', ') : 'Not added yet',
    tech: filled.tech ? preview.techLine : 'Not added yet',
  };
  const save = async (skip) => {
    try {
      await savePendingProfile(token, skip ? {} : { bio, publicFields: { ...fields, bio: filled.bio && fields.bio } });
      try { sessionStorage.setItem('gigin.choicesSaved', '1'); } catch { /* ignore */ }
      if (window.history.length > 1) navigate(-1);
      else navigate('/');
    } catch (err) {
      setError(err?.payload?.error === 'expired' ? 'This link has expired.' : (err?.message || 'Could not save.'));
    }
  };
  return (
    <Shell>
      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
        <h1>What we'll keep</h1>
        <button type="button" className="kp-text" onClick={() => save(true)}>Skip</button>
      </div>
      <p>Choose what goes on your public profile. You can change this any time.</p>
      <p className="kp-kicker">ON YOUR PUBLIC PROFILE</p>
      {[['photo', 'Press photo'], ['bio', 'Bio'], ['links', 'Music and video links'], ['members', 'Band members'], ['tech', 'Tech rider']].map(([key, label]) => (
        <div className="kp-row" key={key}>
          <div>
            <strong>{label}</strong>
            <small>{details[key]}</small>
          </div>
          <Toggle label={label} disabled={!filled[key]} on={filled[key] && fields[key]} onChange={(on) => setFields((current) => ({ ...current, [key]: on }))} />
        </div>
      ))}
      <label className="kp-field">
        Bio
        <textarea value={bio} onChange={(event) => {
          const next = event.target.value;
          setBio(next);
          if (next.trim()) setFields((current) => ({ ...current, bio: true }));
        }} placeholder="One or two lines about your act" />
      </label>
      <p className="kp-kicker">PRIVATE</p>
      <div className="kp-row"><div><strong>Email</strong><small className="kp-lock">Private</small></div><span aria-hidden="true">🔒</span></div>
      <div className="kp-row"><div><strong>Phone</strong><small className="kp-lock">Private</small></div><span aria-hidden="true">🔒</span></div>
      <p>Never shown on your profile. Venues reach you through a contact form, and you reply from your own email.</p>
      <p className="kp-kicker">NOT CARRIED OVER</p>
      <p>Your note to {preview?.venueName || 'the venue'}, your set preference and any extra files you sent. They stay with this application and only {preview?.venueName || 'the venue'} sees them.</p>
      {error && <p className="kp-error">{error}</p>}
      <button type="button" className="kp-btn" onClick={() => save(false)}>Save my choices</button>
      <button type="button" className="kp-ghost" onClick={() => save(true)}>Skip, use the defaults</button>
      <p className="kp-fine">Nothing is public until you tap the link in your email.</p>
    </Shell>
  );
}

export function ConfirmProfilePage({ user, setAuthModal, setAuthType }) {
  const { token } = useParams();
  const navigate = useNavigate();
  const [state, setState] = useState('working');
  const [directSignup, setDirectSignup] = useState(false);
  const [slug, setSlug] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [googleError, setGoogleError] = useState('');
  const [viaGoogle, setViaGoogle] = useState(false);
  const [masked, setMasked] = useState('');
  const [error, setError] = useState('');
  const [methods, setMethods] = useState({ hasPassword: true, hasGoogle: false });
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    inspectConfirm(token).then((result) => {
      setEmail(result.email || '');
      setSlug(result.slug || '');
      setDirectSignup(Boolean(result.directSignup));
      setMethods({ hasPassword: result.hasPassword !== false, hasGoogle: Boolean(result.hasGoogle) });
      setState(result.hasAccount ? 'login' : 'password');
    }).catch((err) => {
      const code = err?.payload?.error || err?.message;
      setSlug(err?.payload?.slug || '');
      setState(code === 'used' ? 'used' : code === 'expired' ? 'expired' : 'missing');
    });
  }, [token]);
  useEffect(() => {
    if (state !== 'login' || !user?.uid || !email) return undefined;
    if (String(user.email || '').toLowerCase() !== email.toLowerCase()) return undefined;
    let cancelled = false;
    claimProfileAccount(token, {}).then(async (result) => {
      if (cancelled) return;
      setSlug(result.slug || slug);
      setState('live');
    }).catch((err) => {
      if (cancelled) return;
      const code = err?.payload?.error;
      if (code === 'used') setState('live');
      else setError(err?.message || 'Log in with the email on this profile.');
    });
    return () => { cancelled = true; };
  }, [state, user, email, token, slug]);
  const createAccount = async (event) => {
    event.preventDefault();
    const problem = passwordSubmitError(password);
    if (problem) {
      setError(problem);
      return;
    }
    setBusy(true);
    setError('');
    try {
      const result = await claimProfileAccount(token, { password });
      await signInWithEmailAndPassword(auth, result.email || email, password);
      setSlug(result.slug || '');
      if (directSignup) {
        navigate('/home');
        return;
      }
      setState('live');
    } catch (err) {
      const code = err?.payload?.error || err?.code;
      if (code === 'account') {
        setMethods({ hasPassword: err?.payload?.hasPassword !== false, hasGoogle: Boolean(err?.payload?.hasGoogle) });
        setState('login');
      } else if (code === 'weak-password') {
        setError(password.length < 8 ? 'Use at least 8 characters.' : 'Choose a less common password.');
      } else if (code === 'used') {
        setState('used');
      } else {
        setError(err?.message || 'Could not create the account.');
      }
    } finally {
      setBusy(false);
    }
  };
  if (state === 'working') return <Shell><p>Opening your confirm link…</p></Shell>;
  if (state === 'expired') {
    return (
      <Shell>
        <h1>This link has expired</h1>
        <p>Confirm links last 7 days. Your application is still sent, and nothing has been made public.</p>
        <button type="button" className="kp-btn" onClick={async () => {
          const result = await resendConfirm(token);
          setMasked(result.maskedEmail || '');
          setState('resent');
        }}>Email me a new link</button>
      </Shell>
    );
  }
  if (state === 'resent') return <Shell><h1>Sent. Check {masked}.</h1></Shell>;
  if (state === 'password') {
    const hint = passwordStrength(password);
    return (
      <Shell>
        <p className="kp-kicker">✓ EMAIL CONFIRMED</p>
        <h1>Create a password</h1>
        <p>{directSignup
          ? 'This creates your Gigin login. Your profile stays private until you publish it. Next time, log in at giginmusic.com with this email and password.'
          : 'This puts your profile live and creates your Gigin login. Next time, log in at giginmusic.com with this email and password.'}</p>
        <form onSubmit={createAccount}>
          <label className="kp-field">Email<input value={email} readOnly /></label>
          <label className="kp-field">
            Password
            <span className="kp-password">
              <input type={showPassword ? 'text' : 'password'} value={password} onChange={(event) => setPassword(event.target.value)} autoComplete="new-password" />
              <button type="button" aria-pressed={showPassword} onClick={() => setShowPassword((current) => !current)}>{showPassword ? 'Hide' : 'Show'}</button>
            </span>
          </label>
          <div className={`kp-strength is-${hint.tone || 'empty'}`}>
            <span>{[0, 1, 2, 3].map((bar) => <i key={bar} className={bar < hint.level ? 'is-on' : ''} />)}</span>
            <p>{hint.title ? <strong>{hint.title} </strong> : null}{hint.body}</p>
          </div>
          {error && <p className="kp-error">{error}</p>}
          <button type="submit" className="kp-btn" disabled={busy}>{busy ? 'Saving…' : (directSignup ? 'Create my account' : 'Put my profile live')}</button>
        </form>
        <p className="kp-or">or</p>
        <button type="button" className="kp-ghost" onClick={async () => {
          setGoogleError('');
          try {
            const result = await signInWithPopup(auth, googleProvider);
            const googleEmail = String(result.user?.email || '').toLowerCase();
            if (googleEmail !== String(email || '').toLowerCase()) {
              await signOut(auth);
              setGoogleError(googleEmail);
              return;
            }
            const claimed = await claimProfileAccount(token, {});
            setSlug(claimed.slug || slug);
            if (directSignup) {
              navigate('/home');
              return;
            }
            setViaGoogle(true);
            setState('live');
          } catch (err) {
            setError(err?.message || 'Could not continue with Google.');
          }
        }}>Continue with Google</button>
        <p className="kp-fine">Use the Google account for {email}.</p>
        {googleError ? <p className="kp-error"><strong>That Google account is {googleError}.</strong> Your profile is for {email}. Choose that Google account, or create a password instead.</p> : null}
      </Shell>
    );
  }
  if (state === 'login') {
    return (
      <Shell>
        <h1>This email already has a Gigin account</h1>
        <p>Log in as {email} and we'll attach this profile to it. Your application is already sent.</p>
        {error && <p className="kp-error">{error}</p>}
        <button type="button" className="kp-btn" onClick={() => { setAuthType?.('login'); setAuthModal?.(true); }}>Log in</button>
        {methods.hasGoogle && <button type="button" className="kp-ghost" onClick={() => { setAuthType?.('login'); setAuthModal?.(true); }}>Continue with Google</button>}
        {methods.hasPassword && (
          <button type="button" className="kp-ghost" onClick={async () => {
            await httpClient.post('/auth/password-reset', { auth: false, body: { email } });
            setMasked(email);
            setState('reset');
          }}>Forgot password?</button>
        )}
        <button type="button" className="kp-text" onClick={() => requestEditLink(email)}>Email me a sign-in link</button>
      </Shell>
    );
  }
  if (state === 'reset') return <Shell><h1>Check {masked}</h1><p>We've sent the usual password reset email.</p></Shell>;
  if (state === 'used') {
    return (
      <Shell>
        <h1>This link has already been used</h1>
        <p>Your profile is already live. Log in with your email and password to make changes.</p>
        {slug && <Link to={`/artist/${slug}`}>Open my profile</Link>}
        <button type="button" className="kp-btn" onClick={() => { setAuthType?.('login'); setAuthModal?.(true); }}>Log in</button>
        <button type="button" className="kp-text" onClick={() => requestEditLink(email)}>Email me a sign-in link</button>
      </Shell>
    );
  }
  if (state !== 'live') return <Shell><h1>This link is not valid.</h1></Shell>;
  return <ProfileLive slug={slug} google={viaGoogle} />;
}

export function ProfileLive({ slug, google = false }) {
  const url = profileLink(slug);
  const [share, setShare] = useState(false);
  const showLink = FEATURES.publicProfile;
  return (
    <Shell>
      <span className="kp-check">✓</span>
      <h1>{showLink ? 'Your profile is live' : 'Your profile is saved'}</h1>
      <p>{showLink
        ? `Anyone with the link can see it. Your email and phone number stay private. You're signed in, so next time ${google ? 'log in with Google.' : 'log in at giginmusic.com with your email and password.'}`
        : 'Your details are saved for next time. Your email and phone number stay private.'}</p>
      {showLink && (
        <>
          <p className="kp-kicker">YOUR LINK</p>
          <div className="kp-url"><code>{url.replace('https://', '')}</code><CopyButton text={url} /></div>
          <button type="button" className="kp-ghost" onClick={() => {
            if (shareProfile(url, slug) === 'sheet') setShare(true);
          }}>Share to WhatsApp, Instagram…</button>
          <Link className="kp-card" to={`/artist/${slug}`} style={{ display: 'block' }}>Preview your page</Link>
        </>
      )}
      {FEATURES.venueFinder && (
        <div className="kp-next">
          <p className="kp-kicker">NEXT STEP</p>
          <h2>Find venues to send it to</h2>
          <p>See what each Cambridge venue has and wants, and send them your link.</p>
          <Link className="kp-btn" to="/find-venues" style={{ display: 'grid', placeItems: 'center' }}>Find venues</Link>
        </div>
      )}
      <Link className="kp-btn" to="/home">Go to my Gigin home</Link>
      {share && (
        <Sheet title="Share your profile" onClose={() => setShare(false)}>
          <a className="kp-ghost" style={{ display: 'grid', placeItems: 'center' }} href={`https://wa.me/?text=${encodeURIComponent(url)}`}>WhatsApp</a>
          <button type="button" className="kp-ghost" onClick={() => navigator.clipboard.writeText(url)}>Instagram — For Instagram we copy the link so you can paste it into your bio or a DM.</button>
          <a className="kp-ghost" style={{ display: 'grid', placeItems: 'center' }} href={`sms:?&body=${encodeURIComponent(url)}`}>Messages</a>
          <CopyButton text={url} label="Copy link" />
        </Sheet>
      )}
    </Shell>
  );
}

export function NudgePage() {
  const { token } = useParams();
  const [masked, setMasked] = useState('');
  const [done, setDone] = useState(false);
  return (
    <Shell>
      <h1>Keep your details for next time?</h1>
      <p>Turn this application into a Gigin profile with a link you can send to other venues. You'll create a password when you confirm.</p>
      {done ? <p>Sent. Check {masked}.</p> : (
        <button type="button" className="kp-btn" onClick={async () => {
          const result = await redeemNudge(token);
          setMasked(result.maskedEmail || 'your email');
          setDone(true);
        }}>Keep my profile</button>
      )}
    </Shell>
  );
}

export function PrefillPage() {
  const { token } = useParams();
  const navigate = useNavigate();
  useEffect(() => {
    consumePrefill(token).then(() => navigate(-1)).catch(() => navigate('/'));
  }, [token, navigate]);
  return <Shell><p>Opening your profile…</p></Shell>;
}

export function AddedToAccount() {
  return (
    <Shell>
      <h1>Application added to your account</h1>
      <p>Anything new you sent (photo, links, tech rider) is waiting for you to add to your profile, if you want it there.</p>
      <Link className="kp-btn" to="/profile/edit?review=1" style={{ display: 'grid', placeItems: 'center' }}>Review what to add</Link>
    </Shell>
  );
}

export function ProfileEditorPage() {
  const { token } = useParams();
  const [profile, setProfile] = useState(null);
  const [contact, setContact] = useState(null);
  const [error, setError] = useState('');
  const [saved, setSaved] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleted, setDeleted] = useState(false);
  const [editingTech, setEditingTech] = useState(false);
  useEffect(() => {
    const open = token ? openEditSession(token).then(() => getOwnProfile()) : getOwnProfile();
    open.then((data) => {
      setProfile(data.profile);
      setContact(data.contact);
    }).catch((err) => setError(err?.message || 'This link is not valid.'));
  }, [token]);
  if (deleted) {
    return (
      <Shell>
        <h1>Your profile is deleted</h1>
        <p>Your page and link have stopped working. Applications you've already sent stay with those venues until the gig date.</p>
      </Shell>
    );
  }
  if (!profile) return <Shell><p>{error || 'Loading your profile…'}</p></Shell>;
  const url = profileLink(profile.slug);
  const save = async () => {
    await updateOwnProfile({
      name: profile.name,
      bio: profile.bio || '',
      spotifyUrl: profile.spotifyUrl || '',
      youtubeUrl: profile.youtubeUrl || '',
      instagramUrl: profile.instagramUrl || '',
      websiteUrl: profile.websiteUrl || '',
      members: profile.members || [],
      publicFields: profile.publicFields,
      visibility: profile.status === 'hidden' ? 'hidden' : 'public',
    });
    setSaved(true);
  };
  return (
    <Shell>
      <h1>Edit your profile</h1>
      <div className="kp-url"><code>{url.replace('https://', '')}</code><Link to={`/artist/${profile.slug}`}>View</Link></div>
      <p className="kp-kicker">PHOTO</p>
      <div className="kp-asset">
        <span className="kp-thumb">{profile.heroMedia?.url ? <img alt="" src={profile.heroMedia.url} className="kp-thumb" /> : '—'}</span>
        <button type="button" className="kp-text" onClick={() => updateOwnProfile({ removePhoto: true }).then(() => setProfile({ ...profile, heroMedia: null }))}>Remove</button>
      </div>
      <label className="kp-field">BIO<textarea value={profile.bio || ''} onChange={(event) => setProfile({ ...profile, bio: event.target.value })} /></label>
      <p className="kp-kicker">LINKS</p>
      {['spotifyUrl', 'youtubeUrl', 'instagramUrl', 'websiteUrl'].map((key) => (
        <label className="kp-field" key={key}>{key.replace('Url', '')}<input value={profile[key] || ''} onChange={(event) => setProfile({ ...profile, [key]: event.target.value })} /></label>
      ))}
      <p className="kp-kicker">BAND</p>
      {(profile.members || []).map((member, index) => (
        <div className="kp-row" key={`${member.name}-${index}`}>
          <span>{member.name}</span>
          <button type="button" className="kp-text" onClick={() => setProfile({ ...profile, members: profile.members.filter((_, item) => item !== index) })}>×</button>
        </div>
      ))}
      <button type="button" className="kp-ghost" onClick={() => setProfile({ ...profile, members: [...(profile.members || []), { name: '', instruments: [] }] })}>+ Add a member</button>
      <p className="kp-kicker">TECH RIDER</p>
      <p>{[(profile.techRider?.guestNeeds || []).join(', '), (profile.techRider?.bringOwn || []).join(', ')].filter(Boolean).join(' · ') || 'Nothing added yet.'} <button type="button" className="kp-text" onClick={() => setEditingTech((open) => !open)}>{editingTech ? 'Done' : 'Edit'}</button></p>
      {editingTech && (
        <GuestTechStep
          hideVenueColumns
          draft={{
            members: profile.members?.length ? profile.members : [{ name: '', instruments: [] }],
            needs: profile.techRider?.guestNeeds || [],
            bringOwn: profile.techRider?.bringOwn || [],
          }}
          venue={{ techRider: null }}
          patch={(partial) => setProfile((current) => {
            const next = {
              members: partial.members !== undefined ? partial.members : (current.members || []),
              needs: partial.needs !== undefined ? partial.needs : (current.techRider?.guestNeeds || []),
              bringOwn: partial.bringOwn !== undefined ? partial.bringOwn : (current.techRider?.bringOwn || []),
            };
            return { ...current, members: next.members, techRider: buildGuestTechRider(next) };
          })}
        />
      )}
      <p className="kp-kicker">WHAT'S PUBLIC</p>
      {['photo', 'bio', 'links', 'members', 'tech'].map((key) => (
        <div className="kp-row" key={key}>
          <strong>{key}</strong>
          <Toggle label={key} on={profile.publicFields?.[key] !== false} onChange={(on) => setProfile({ ...profile, publicFields: { ...(profile.publicFields || {}), [key]: on } })} />
        </div>
      ))}
      <div className="kp-row"><div><strong>Email and phone</strong><small>Always private</small></div></div>
      <p className="kp-kicker">WHO CAN SEE YOUR PROFILE</p>
      <div className="kp-seg">
        <button type="button" className={profile.status !== 'hidden' ? 'is-on' : ''} onClick={() => setProfile({ ...profile, status: 'live' })}>Public</button>
        <button type="button" className={profile.status === 'hidden' ? 'is-on' : ''} onClick={() => setProfile({ ...profile, status: 'hidden' })}>Hidden</button>
      </div>
      <p>{profile.status === 'hidden' ? 'Your link shows "This profile isn\'t available". Venues you\'ve applied to still see your applications.' : 'Anyone with your link can see your profile.'}</p>
      {contact && <p className="kp-muted">{contact.email} · {contact.phone}{contact.whatsapp ? ' · WhatsApp ok' : ''}</p>}
      {saved && <p>Saved. Your profile is up to date.</p>}
      <button type="button" className="kp-btn" onClick={save}>Save changes</button>
      {FEATURES.pressKit && (
        <div className="kp-row">
          <div>
            <strong>PRESS KIT</strong>
            <small>Private. Only venues who've booked you can download what you switch on.</small>
          </div>
          <Link to="/profile/press-kit">Manage</Link>
        </div>
      )}
      <button type="button" className="kp-text" onClick={() => requestEditLink(contact?.email || '')}>Email me a sign-in link</button>
      <button type="button" className="kp-danger" onClick={() => setConfirmDelete(true)}>Delete my profile</button>
      <button type="button" className="kp-text" onClick={() => hideOwnProfile().then(() => setProfile({ ...profile, status: 'hidden' }))}>Hide it instead</button>
      {confirmDelete && (
        <Sheet title="Delete your profile?" onClose={() => setConfirmDelete(false)}>
          <p>Your page and link stop working straight away, and we delete your profile details. Applications you've already sent stay with those venues. If you only want a break, hide your profile instead.</p>
          <button type="button" className="kp-danger" onClick={() => deleteOwnProfile().then(() => setDeleted(true))}>Delete my profile</button>
          <button type="button" className="kp-ghost" onClick={() => hideOwnProfile().then(() => { setProfile({ ...profile, status: 'hidden' }); setConfirmDelete(false); })}>Hide it instead</button>
        </Sheet>
      )}
    </Shell>
  );
}
