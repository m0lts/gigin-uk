import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { collection, doc, getDocs, updateDoc } from 'firebase/firestore';
import { updateEmail, updatePassword, updateProfile } from 'firebase/auth';
import { toast } from 'sonner';
import { auth, firestore } from '@lib/firebase';
import { useAuth } from '@hooks/useAuth';
import { hasVenuePerm } from '../../../services/utils/permissions';
import { updateGigDocument } from '@services/api/gigs';
import { FEATURES } from '../../../config/features';
import { GiveStaffAccess } from '../dashboard/GiveStaffAccess';
import { groupUpcomingNights } from '../home/nights';
import {
  durationFromRange,
  gigEditDraft,
  initials,
  settingsDraft,
  settingsPatch,
  staffLabel,
  timesChanged,
} from './venueDesk';
import './venue-desk.css';

function useDisplayedVenue(venues) {
  const [searchParams] = useSearchParams();
  const selected = searchParams.get('venue') || '';
  return (venues || []).find((venue) => venue.venueId === selected)
    || ((venues || []).length === 1 ? venues[0] : null);
}

export function VenueSettingsPage({ user, venues }) {
  const venue = useDisplayedVenue(venues);
  const [draft, setDraft] = useState(() => settingsDraft(venue));
  const [staff, setStaff] = useState([]);
  const [saving, setSaving] = useState(false);
  const canSave = venue && hasVenuePerm(venues, venue.venueId, 'venue.update');

  useEffect(() => { setDraft(settingsDraft(venue)); }, [venue]);

  useEffect(() => {
    if (!venue?.venueId) return undefined;
    let live = true;
    getDocs(collection(firestore, 'venueProfiles', venue.venueId, 'members'))
      .then((snap) => {
        if (!live) return;
        setStaff(snap.docs.map((item) => ({ id: item.id, ...item.data() })));
      })
      .catch(() => { if (live) setStaff([]); });
    return () => { live = false; };
  }, [venue?.venueId]);

  const set = (key) => (event) => setDraft((prev) => ({ ...prev, [key]: event.target.value }));
  const photo = venue?.photos?.[0]?.url || venue?.photos?.[0] || venue?.photoUrl || '';

  const save = async () => {
    if (!venue?.venueId || !canSave) return;
    setSaving(true);
    try {
      await updateDoc(doc(firestore, 'venueProfiles', venue.venueId), settingsPatch(draft));
      toast.success('Settings saved.');
    } catch (error) {
      console.error(error);
      toast.error('Could not save settings.');
    } finally {
      setSaving(false);
    }
  };

  if (!venue) return <p className="p-empty">Choose a venue to edit its settings.</p>;

  return (
    <div className="p-desk">
      <h1>Settings</h1>
      <section className="p-card">
        <h2>Your venue</h2>
        <div className="p-photo-row">
          {photo ? <img src={typeof photo === 'string' ? photo : ''} alt="" /> : <span className="p-photo">Photo</span>}
          <Link className="p-btn" to="/venues/dashboard/my-venues">Change photo</Link>
          {FEATURES.venuePage && venue?.venueId ? <Link className="p-btn" to={`/venues/${venue.venueId}/poster`}>QR poster</Link> : null}
        </div>
        <label>Venue name<input value={draft.name} onChange={set('name')} /></label>
        <label>Capacity<input value={draft.capacity} onChange={set('capacity')} /></label>
        <label className="is-wide">Address<input value={draft.address} onChange={set('address')} /></label>
      </section>
      <section className="p-card">
        <h2>What acts should know</h2>
        <p className="p-muted">Shown before they apply, so the right acts get in touch. Shown as text; Gigin takes no payment.</p>
        <label>PA and mics<input value={draft.pa} onChange={set('pa')} /></label>
        <label>Sound engineer<input value={draft.soundEngineer} onChange={set('soundEngineer')} /></label>
        <label>Backline<input value={draft.backline} onChange={set('backline')} /></label>
        <label>Usual fee<input value={draft.fee} onChange={set('fee')} /></label>
        <label>Load-in<input value={draft.loadIn} onChange={set('loadIn')} /></label>
        <label className="is-wide">About the venue<textarea value={draft.about} onChange={set('about')} /></label>
      </section>
      <section className="p-card">
        <header className="p-card__row">
          <h2>Staff</h2>
          <GiveStaffAccess user={user} venues={venues} />
        </header>
        <p className="p-muted">New staff are view-only until you change it.</p>
        <ul>
          <li>
            <span className="p-avatar">{initials(user?.name)}</span>
            <span><strong>{user?.name || 'You'} (you)</strong><span>Owner</span></span>
          </li>
          {staff.filter((member) => member.id !== user?.uid).map((member) => (
            <li key={member.id}>
              <span className="p-avatar">{initials(member.name || member.email)}</span>
              <span>
                <strong>{member.name || member.email || 'Staff'}</strong>
                <span>{staffLabel(member, venue.createdBy || venue.userId)}</span>
              </span>
            </li>
          ))}
        </ul>
      </section>
      <section className="p-card">
        <h2>Emails</h2>
        <label className="p-switch">
          <span><strong>New applications</strong><span>Batched within the hour</span></span>
          <input type="checkbox" checked={draft.emailApplications} onChange={(event) => setDraft((prev) => ({ ...prev, emailApplications: event.target.checked }))} />
        </label>
        <label className="p-switch">
          <span><strong>Promo arrives</strong><span>When an act sends their promo</span></span>
          <input type="checkbox" checked={draft.emailPromo} onChange={(event) => setDraft((prev) => ({ ...prev, emailPromo: event.target.checked }))} />
        </label>
      </section>
      <div className="p-savebar">
        <button type="button" className="p-btn p-btn--dark" disabled={!canSave || saving} onClick={save}>{saving ? 'Saving' : 'Save changes'}</button>
      </div>
    </div>
  );
}

export function VenueAccountPage({ user }) {
  const { logout } = useAuth();
  const [name, setName] = useState(user?.name || '');
  const [password, setPassword] = useState('');
  const [updates, setUpdates] = useState(() => localStorage.getItem('gigin.productUpdates') === 'on');

  const saveName = async () => {
    const next = name.trim();
    if (!next || !auth.currentUser) return;
    try {
      await updateProfile(auth.currentUser, { displayName: next });
      await updateDoc(doc(firestore, 'users', auth.currentUser.uid), { name: next });
      toast.success('Name saved.');
    } catch (error) {
      console.error(error);
      toast.error('Could not save your name.');
    }
  };

  const changeEmail = async () => {
    const next = window.prompt('New email address');
    if (!next || !auth.currentUser) return;
    try {
      await updateEmail(auth.currentUser, next.trim());
      toast.success('Email updated.');
    } catch (error) {
      toast.error(error?.message || 'Sign in again, then change your email from Account.');
    }
  };

  const changePassword = async () => {
    if (password.length < 8 || !auth.currentUser) {
      toast.error('Use at least 8 characters.');
      return;
    }
    try {
      await updatePassword(auth.currentUser, password);
      setPassword('');
      toast.success('Password updated.');
    } catch (error) {
      toast.error(error?.message || 'Sign in again, then change your password.');
    }
  };

  return (
    <div className="p-desk">
      <h1>Account</h1>
      <section className="p-card">
        <h2>Your details</h2>
        <label>Name<input value={name} onChange={(event) => setName(event.target.value)} onBlur={saveName} /></label>
        <div className="p-inline">
          <label>Email<input value={user?.email || ''} readOnly /></label>
          <button type="button" className="p-btn" onClick={changeEmail}>Change email</button>
        </div>
      </section>
      <section className="p-card">
        <h2>Password</h2>
        <div className="p-inline">
          <input type="password" value={password} placeholder="New password" onChange={(event) => setPassword(event.target.value)} />
          <button type="button" className="p-btn" onClick={changePassword}>Change password</button>
        </div>
      </section>
      <section className="p-card">
        <h2>Email updates</h2>
        <label className="p-switch">
          <span><strong>Product updates from Gigin</strong><span>A few a year</span></span>
          <input type="checkbox" checked={updates} onChange={(event) => {
            setUpdates(event.target.checked);
            localStorage.setItem('gigin.productUpdates', event.target.checked ? 'on' : 'off');
          }} />
        </label>
      </section>
      <section className="p-card">
        <h2>Leave Gigin</h2>
        <button type="button" className="p-btn" onClick={() => logout()}>Log out</button>
        <Link className="p-text" to="/account">Delete account</Link>
      </section>
    </div>
  );
}

export function EditGigPage({ gigs, venues, refreshGigs }) {
  const { gigId } = useParams();
  const navigate = useNavigate();
  const venue = useDisplayedVenue(venues);
  const night = useMemo(() => groupUpcomingNights(gigs || []).find((item) => item.gigIds?.includes(gigId) || item.gigId === gigId), [gigs, gigId]);
  const gig = (gigs || []).find((item) => item.gigId === gigId) || night?.primary;
  const [draft, setDraft] = useState(null);
  const [saving, setSaving] = useState(false);
  const original = useMemo(() => (gig ? gigEditDraft(gig, night?.slots) : null), [gig, night]);

  useEffect(() => { if (original) setDraft(original); }, [original]);

  if (!gig || !draft) return <p className="p-empty">This gig is not on the list.</p>;
  const uniqueBooked = new Set();
  (night?.slots || [gig]).forEach((slot) => {
    (slot.applicants || []).forEach((applicant) => {
      if (['accepted', 'confirmed', 'paid', 'booked'].includes(String(applicant?.status || '').toLowerCase())) {
        uniqueBooked.add(applicant.id || applicant.name);
      }
    });
  });
  const warn = timesChanged(original, draft) && uniqueBooked.size > 0;

  const save = async () => {
    if (!hasVenuePerm(venues, gig.venueId, 'gigs.update')) {
      toast.error('You do not have permission to update this gig.');
      return;
    }
    setSaving(true);
    try {
      await Promise.all(draft.sets.map((set) => updateGigDocument({
        gigId: set.gigId,
        action: 'gigs.update',
        updates: {
          eventName: draft.name,
          gigName: draft.name,
          budget: draft.fee,
          genre: draft.genre,
          description: draft.notes,
          applicationsOpen: draft.open,
          private: draft.offersOnly,
          startTime: set.start,
          duration: durationFromRange(set.start, set.end),
        },
      })));
      toast.success('Gig saved.');
      refreshGigs?.();
      navigate('/venues/dashboard/gigs');
    } catch (error) {
      console.error(error);
      toast.error('Could not save this gig.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="p-desk">
      <header className="p-card__row">
        <p className="p-muted">{venue?.name || 'Gigs'} · {draft.name || 'Edit'}</p>
        <span>
          <button type="button" className="p-btn" onClick={() => navigate(-1)}>Cancel</button>
          <button type="button" className="p-btn p-btn--dark" disabled={saving} onClick={save}>{saving ? 'Saving' : 'Save changes'}</button>
        </span>
      </header>
      {warn ? <p className="p-warn">{uniqueBooked.size} booked {uniqueBooked.size === 1 ? 'act is' : 'acts are'} on this night. Saving new times does not email them from here.</p> : null}
      <section className="p-card">
        <label>Gig name<input value={draft.name} onChange={(event) => setDraft({ ...draft, name: event.target.value })} /></label>
        {draft.sets.map((set, index) => (
          <div className="p-inline" key={set.gigId || index}>
            <label>Set {index + 1} starts<input value={set.start} onChange={(event) => {
              const sets = draft.sets.slice();
              sets[index] = { ...set, start: event.target.value };
              setDraft({ ...draft, sets });
            }} /></label>
            <label>Ends<input value={set.end} onChange={(event) => {
              const sets = draft.sets.slice();
              sets[index] = { ...set, end: event.target.value };
              setDraft({ ...draft, sets });
            }} /></label>
          </div>
        ))}
        <label>Fee<input value={draft.fee} onChange={(event) => setDraft({ ...draft, fee: event.target.value })} /></label>
        <label>Genre or style<input value={draft.genre} onChange={(event) => setDraft({ ...draft, genre: event.target.value })} /></label>
        <label className="is-wide">Notes for acts<textarea value={draft.notes} onChange={(event) => setDraft({ ...draft, notes: event.target.value })} /></label>
        <label className="p-switch">
          <span><strong>Applications open</strong><span>Anyone with the link can apply</span></span>
          <input type="checkbox" checked={draft.open} onChange={(event) => setDraft({ ...draft, open: event.target.checked })} />
        </label>
        <label className="p-switch">
          <span><strong>Offers only</strong><span>Only acts you send a private link to can apply</span></span>
          <input type="checkbox" checked={draft.offersOnly} onChange={(event) => setDraft({ ...draft, offersOnly: event.target.checked })} />
        </label>
      </section>
      <aside className="p-card">
        <p className="p-muted">Listing preview</p>
        <h2>{draft.name || 'Gig'}</h2>
        <p>{draft.sets.length} {draft.sets.length === 1 ? 'set' : 'sets'}{draft.sets[0]?.start ? ` from ${draft.sets[0].start}` : ''}</p>
        {draft.fee ? <p>{draft.fee} per act</p> : null}
        {draft.notes ? <p>{draft.notes}</p> : null}
      </aside>
    </div>
  );
}
