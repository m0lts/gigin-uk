import { useEffect, useState } from 'react';
import '@styles/artists/gig-page.styles.css';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { getGuestApplication, markSetChangeSeen, updateGuestApplication, withdrawGuestApplication } from '@services/client-side/guestApplications';
import { KeepOffer } from '../../keep-profile/KeepOffer';
import { getGigById, getGigsByIds } from '@services/client-side/gigs';
import { sortSlots } from '@services/utils/nightApplications';
import { getVenueProfileById } from '@services/client-side/venues';
import { useBreakpoint } from '@hooks/useBreakpoint';
import { GuestAssetsStep } from './GuestAssetsStep';
import { GuestReviewStep } from './GuestReviewStep';
import { GuestTechStep } from './GuestTechStep';
import { GuestWhoStep } from './GuestWhoStep';
import { FEATURES } from '../../../config/features';
import { bookerLine, firstName, formatClock, formatGigDay, formatShortDay, icsForSet, preferenceReview, slotDate, slotEnd } from './guestFormat';

const STATUS = {
  sent: ['Sent · Jez hasn\'t decided yet', 'is-wait'],
  accepted: ['Accepted', 'is-ok'],
  declined: ['Not this time', 'is-muted'],
  withdrawn: ['Withdrawn', 'is-muted'],
};

function fromApplication(application) {
  const contacts = application.contacts || {};
  return {
    ...application,
    email: contacts.email || '',
    phone: contacts.phone || '',
    whatsapp: !!contacts.whatsapp,
    instagram: contacts.instagram || '',
    links: { spotify: '', youtube: '', instagram: '', website: '', ...(application.links || {}) },
    members: application.members?.length ? application.members : [{ name: '', instruments: [] }],
    needs: application.needs || [],
    bringOwn: application.bringOwn || [],
    assets: application.assets || [],
    note: application.note || '',
    slotGigIds: Array.isArray(application.preferredSlotGigIds)
      ? application.preferredSlotGigIds
      : (application.slotGigIds || []),
    preferredSlotGigIds: Array.isArray(application.preferredSlotGigIds)
      ? application.preferredSlotGigIds
      : (application.slotGigIds || []),
    assignedSlotGigId: application.assignedSlotGigId || null,
    actName: application.actName || '',
    contactName: application.contactName || '',
    ignoreDuplicate: true,
  };
}

export function ManageGuestApplication() {
  const { gigId, token } = useParams();
  const navigate = useNavigate();
  const { isMdUp } = useBreakpoint();
  const [application, setApplication] = useState(null);
  const [draft, setDraft] = useState(null);
  const [gig, setGig] = useState(null);
  const [slots, setSlots] = useState([]);
  const [venue, setVenue] = useState(null);
  const [error, setError] = useState('');
  const [editing, setEditing] = useState('');
  const [confirmWithdraw, setConfirmWithdraw] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');
  const [toast, setToast] = useState('');
  const [linkEmail, setLinkEmail] = useState('');
  const [linkError, setLinkError] = useState('');
  const [linkSent, setLinkSent] = useState('');
  const [errorStatus, setErrorStatus] = useState(0);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const loaded = await getGuestApplication(gigId, token);
        if (cancelled) return;
        setApplication(loaded);
        setDraft(fromApplication(loaded));
        const gigDoc = await getGigById(gigId);
        if (cancelled) return;
        setGig(gigDoc);
        const publicSlots = Array.isArray(loaded.slots) ? loaded.slots : [];
        const anchorId = gigDoc?.gigId || gigDoc?.id || gigId;
        const ids = publicSlots.map((slot) => slot.gigId).filter(Boolean);
        const fallback = loaded.preferredSlotGigIds || loaded.slotGigIds || [];
        const extra = (ids.length ? ids : fallback).filter((id) => id !== anchorId);
        const others = extra.length ? await getGigsByIds(extra) : [];
        const takenById = new Map(publicSlots.map((slot) => [slot.gigId, slot]));
        setSlots(sortSlots([gigDoc, ...others].filter(Boolean).map((doc) => {
          const id = doc.gigId || doc.id;
          const pub = takenById.get(id);
          if (!pub) return { ...doc, gigId: id };
          return {
            ...doc,
            gigId: id,
            taken: pub.taken,
            hint: doc.hint || pub.hint || '',
            applicationsRootGigId: loaded.applicationsRootGigId || null,
          };
        })));
        if (gigDoc?.venueId) setVenue(await getVenueProfileById(gigDoc.venueId));
      } catch (err) {
        if (!cancelled) {
          setErrorStatus(err?.status || 0);
          setError(err?.message || 'This link is not valid.');
        }
      }
    })();
    return () => { cancelled = true; };
  }, [gigId, token]);

  useEffect(() => {
    if (!application?.setChangedFrom || application.setChangeSeenAt) return;
    markSetChangeSeen(gigId, token).catch(() => {});
  }, [application, gigId, token]);

  const save = async () => {
    if (!draft) return;
    setSaving(true);
    setSaveError('');
    try {
      const next = await updateGuestApplication(token, {
        gigId,
        actName: draft.actName,
        contactName: draft.contactName,
        contacts: { email: draft.email, phone: draft.phone, instagram: draft.instagram },
        links: draft.links,
        members: draft.members,
        needs: draft.needs,
        bringOwn: draft.bringOwn,
        note: draft.note,
        slotGigIds: draft.preferredSlotGigIds || draft.slotGigIds || [],
        preferredSlotGigIds: draft.preferredSlotGigIds || draft.slotGigIds || [],
      });
      setApplication(next);
      setEditing('');
      setToast(`Saved. ${bookerLine(venue, gig).name} can see your changes.`);
    } catch {
      if (editing === 'note') setSaveError('note');
      else setError('Couldn\'t save your changes. Check your connection and try again.');
    } finally {
      setSaving(false);
    }
  };

  const withdraw = async () => {
    setSaving(true);
    try {
      const next = await withdrawGuestApplication(gigId, token);
      setApplication(next);
      setConfirmWithdraw(false);
    } catch (err) {
      setError(err?.message || 'Could not withdraw.');
    } finally {
      setSaving(false);
    }
  };

  if (error && !application && (errorStatus === 404 || errorStatus === 410)) {
    const sendFresh = async (event) => {
      event.preventDefault();
      const value = linkEmail.trim();
      if (!value) {
        setLinkError('Enter the email you applied with.');
        return;
      }
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
        setLinkError('Enter an email address like name@example.com.');
        return;
      }
      try {
        const { sendGuestMagicLink } = await import('@services/client-side/guestApplications');
        await sendGuestMagicLink({ gigId, email: value });
      } catch { /* same answer either way */ }
      setLinkSent(value);
    };
    return (
      <div className="ga-page">
        <header className="ga-top"><span className="ga-logo">gigin.</span></header>
        <main className="ga-manage">
          <p className="ga-mono">YOUR APPLICATION</p>
          {linkSent ? (
            <>
              <h1>Check your inbox</h1>
              <p>If {linkSent} applied to this gig, we&apos;ve sent a fresh link. It can take a minute to arrive.</p>
            </>
          ) : (
            <>
              <h1>This link has stopped working</h1>
              <p>Private links stop working when we send you a newer one, and 7 days after the gig. Enter the email you applied with and we&apos;ll send a fresh link.</p>
              <form onSubmit={sendFresh}>
                <label className="ga-field">Email you applied with<input type="email" value={linkEmail} onChange={(event) => { setLinkEmail(event.target.value); setLinkError(''); }} /></label>
                {linkError ? <p className="ga-error">{linkError}</p> : null}
                <button type="submit" className="ga-dark">Email me a fresh link</button>
              </form>
            </>
          )}
        </main>
      </div>
    );
  }
  if (!application || !draft) {
    if (error) {
      return (
        <div className="ga-page">
          <header className="ga-top"><span className="ga-logo">gigin.</span></header>
          <p className="ga-banner">{error}</p>
        </div>
      );
    }
    return <div className="ga-page"><p className="ga-quiet">Loading your application…</p></div>;
  }

  const accepted = application.status === 'accepted' || application.status === 'confirmed';
  const assigned = slots.find((slot) => (slot.gigId || slot.id) === application.assignedSlotGigId) || null;
  const assignedIndex = assigned ? slots.findIndex((slot) => (slot.gigId || slot.id) === (assigned.gigId || assigned.id)) : -1;
  const setWhen = assigned
    ? `Set ${assignedIndex + 1}, ${formatClock(assigned.startTime)}${slotEnd(assigned) ? `–${slotEnd(assigned)}` : ''}`
    : '';
  const cancelledGig = application.gigStatus === 'cancelled' || application.gigStatus === 'closed' || gig?.status === 'cancelled' || gig?.status === 'closed';
  const statusBits = cancelledGig
    ? ['Gig cancelled', 'is-muted']
    : accepted
    ? [`Accepted · ${assigned ? setWhen : 'set time to be confirmed'}`, 'is-ok']
    : application.status === 'sent' || application.status === 'pending'
      ? [`Sent · ${bookerLine(venue, gig).name} hasn't decided yet`, 'is-wait']
      : (STATUS[application.status] || STATUS.sent);
  const [statusLabel, statusClass] = statusBits;
  const editable = !cancelledGig && application.editable !== false && (application.status === 'sent' || application.status === 'pending');
  const booker = bookerLine(venue, gig);
  const dateLabel = gig ? formatShortDay(gig) : (application.dateLabel || 'this night');
  const preferred = preferenceReview(slots, draft.preferredSlotGigIds || []).replace(/^Prefers /, '');
  const heading = accepted
    ? (assigned ? `You're playing Set ${assignedIndex + 1}` : "You're in")
    : 'Your application';
  const address = [venue?.address?.line1 || venue?.address?.addressLine1, venue?.address?.city].filter(Boolean).join(', ')
    || (typeof venue?.address === 'string' ? venue.address : '');

  const addToCalendar = () => {
    if (!assigned) return;
    const start = slotDate(assigned) || slotDate(gig);
    if (!start) return;
    const end = new Date(start.getTime() + (Number(assigned.duration) || 60) * 60000);
    const body = icsForSet({
      title: `${draft.actName || 'Set'} at ${venue?.name || 'the venue'}`,
      start,
      end,
      location: address,
      description: assignedIndex >= 0 ? `Set ${assignedIndex + 1}` : '',
      uid: `gigin-${application.applicationsRootGigId || gigId}-${application.applicantId || application.id}@giginmusic.com`,
      sequence: Number(application.calendarSequence) || 0,
    });
    const blob = new Blob([body], { type: 'text/calendar' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'gigin-set.ics';
    link.click();
    URL.revokeObjectURL(url);
    setToast('Added to your calendar.');
  };

  return (
    <div className="ga-page">
      <header className="ga-top">
        <span className="ga-logo">gigin.</span>
        <span>Private link for {firstName(application.contactName)}</span>
      </header>
      <main className="ga-manage">
        <p className="ga-mono">{gig ? formatGigDay(gig) : application.dateLabel}</p>
        <h1>{heading}</h1>
        <span className={`ga-pill ${statusClass}`}>{statusLabel}</span>
        {cancelledGig && (
          <div className="ga-banner is-cancel">
            <strong>This gig has been cancelled</strong>
            <p>{venue?.name || 'The venue'} has cancelled this gig. Your application is closed and there&apos;s nothing you need to do.</p>
          </div>
        )}
        {application.setChangedFrom && !application.setChangeSeenAt && (
          <div className="ga-banner is-amber">
            <strong>Your set time has changed</strong>
            <p>It was {application.setChangedFrom.label || application.setChangedFrom.range}. It&apos;s now {setWhen || 'to be confirmed'}.</p>
          </div>
        )}
        {FEATURES.keepProfile && application.artistProfileId && application.profileSlug && (
          <article className="ga-account">
            <strong>Your Gigin profile</strong>
            <p className="ga-mono">giginmusic.com/artist/{application.profileSlug}</p>
            <Link to={`/artist/${application.profileSlug}`}>Open</Link>
            <Link to="/profile/edit">Edit</Link>
          </article>
        )}
        {FEATURES.keepProfile && !application.artistProfileId && application.keepProfileOffer !== 'confirmed' && (application.status === 'sent' || application.status === 'pending' || accepted) && (
          <KeepOffer
            draft={{ ...draft, manageToken: token, gigId, email: draft.email, keepProfileOffer: application.keepProfileOffer }}
            bookerName={booker.name}
            onLogin={() => {}}
          />
        )}
        {application.status === 'declined' && (
          <>
            <p className="ga-about">{booker.name} has picked the line-up for {dateLabel} and couldn't fit {draft.actName || 'you'} in this time. Thanks for applying. The bar has your details for future nights.</p>
            {venue?.venueId && <Link to={`/venues/${venue.venueId}`}>See upcoming gigs at the bar</Link>}
          </>
        )}
        {application.status === 'withdrawn' && (
          <p className="ga-about">
            {application.withdrawnAfterAccept
              ? `We've told ${booker.name} ${draft.actName || 'you'} can't play on ${dateLabel}, so the set can go to someone else. Thanks for letting the bar know.`
              : `${booker.name} has been told you can't make this gig. You can apply again while it is still open.`}
          </p>
        )}
        {accepted && (
          <article className="ga-booking">
            <header>
              <span>YOUR SET</span>
              {assigned ? (
                <>
                  <strong>Set {assignedIndex + 1}</strong>
                  <em className="ga-mono">{formatClock(assigned.startTime)}{slotEnd(assigned) ? `–${slotEnd(assigned)}` : ''}{assigned.duration ? ` · ${assigned.duration} minutes` : ''}</em>
                </>
              ) : (
                <>
                  <strong className="is-tbc">To be confirmed</strong>
                  <p>{booker.name} will choose which set you're playing and we'll email you as soon as it's set.{(draft.preferredSlotGigIds || []).length ? ` You said you'd prefer ${preferred}.` : ''}</p>
                </>
              )}
            </header>
            {!assigned && slots.length > 1 && (
              <ul className="ga-booking__sets">
                <li>The night's sets</li>
                {slots.map((slot, index) => {
                  const id = slot.gigId || slot.id;
                  const mine = (draft.preferredSlotGigIds || []).includes(id);
                  return (
                    <li key={id || index}>
                      <span>Set {index + 1}</span>
                      <em className="ga-mono">{formatClock(slot.startTime)}{slotEnd(slot) ? `–${slotEnd(slot)}` : ''}</em>
                      {mine && <b>Your preference</b>}
                    </li>
                  );
                })}
              </ul>
            )}
            <dl>
              <div><dt>Doors</dt><dd className="ga-mono">{formatClock(gig?.doors || gig?.doorTime || slots[0]?.startTime) || 'TBC'}</dd></div>
              <div><dt>Where</dt><dd>{address || venue?.name || 'The venue'}{venue?.arrivalNotes ? `. ${venue.arrivalNotes}` : ''}</dd></div>
              <div><dt>Booked by</dt><dd>{booker.name}{booker.role ? `, ${booker.role}` : ''}</dd></div>
            </dl>
            {assigned && <button type="button" className="ga-text" onClick={addToCalendar}>Add to calendar</button>}
          </article>
        )}
        {editing ? (
          <div className="ga-step">
            {editing === 'who' && <GuestWhoStep draft={draft} patch={(partial) => setDraft((current) => ({ ...current, ...partial }))} slots={slots.length ? slots : [gig].filter(Boolean)} bookerName={booker.name} showErrors={false} />}
            {editing === 'assets' && <GuestAssetsStep draft={draft} patch={(partial) => setDraft((current) => ({ ...current, ...partial }))} />}
            {editing === 'tech' && <GuestTechStep draft={draft} patch={(partial) => setDraft((current) => ({ ...current, ...partial }))} venue={venue} />}
            {editing === 'note' && (
              <label className="ga-field">
                <span>Note to {booker.name}</span>
                <textarea rows={4} maxLength={500} value={draft.note} onChange={(event) => setDraft((current) => ({ ...current, note: event.target.value.slice(0, 500) }))} />
              </label>
            )}
            {saveError === 'note' && editing === 'note' && (
              <div className="ga-error-box">
                <strong>Couldn&apos;t save your changes</strong>
                <p>Check your connection and try again. Your note is still here.</p>
              </div>
            )}
            <div className="ga-actions">
              <button type="button" className="ga-dark" disabled={saving} onClick={save}>{saving ? 'Saving…' : 'Save'}</button>
              <button type="button" className="ga-ghost" onClick={() => { setDraft(fromApplication(application)); setEditing(''); }}>Cancel</button>
            </div>
          </div>
        ) : !accepted && application.status !== 'declined' && (
          <GuestReviewStep
            draft={draft}
            slots={slots.length ? slots : [gig].filter(Boolean)}
            bookerName={booker.name}
            patch={() => {}}
            summary
            readOnly={!editable}
            onJump={(step) => editable && setEditing(step === 'review' ? 'note' : step)}
          />
        )}
        {!editing && !accepted && application.status !== 'declined' && (
          <div className="ga-review">
            <div className="ga-review__row">
              <span>Note to {booker.name}</span>
              <strong className={draft.note ? '' : 'is-muted'}>{draft.note || 'None'}</strong>
              {editable && <button type="button" onClick={() => setEditing('note')}>Edit</button>}
            </div>
          </div>
        )}
        {editable && !editing && (
          <button type="button" className="ga-danger" onClick={() => setConfirmWithdraw(true)}>Withdraw my application</button>
        )}
        {accepted && !cancelledGig && !editing && (
          <div className="ga-cant">
            <strong>Plans changed?</strong>
            <p>Let {booker.name} know as soon as you can, so the set can go to someone else.</p>
            <button type="button" className="ga-danger" onClick={() => setConfirmWithdraw(true)}>I can't play any more</button>
          </div>
        )}
        {application.status === 'withdrawn' && <Link to={`/gig/${gigId}`}>Back to the gig</Link>}
        {error && <p className="ga-error">{error}</p>}
        {toast && <p className="ga-toast" role="status">{toast}</p>}
      </main>
      {confirmWithdraw && (
        <div className="ga-sheet-backdrop" onClick={() => setConfirmWithdraw(false)}>
          <div className={`ga-sheet${isMdUp ? ' is-dialog' : ''}`} onClick={(event) => event.stopPropagation()}>
            {accepted ? (
              <>
                <h2>Tell {booker.name} you can't play?</h2>
                <p>{booker.name} will be told {draft.actName || 'you'} can't make {dateLabel}, and the set will be offered to someone else. This can't be undone.</p>
                <button type="button" className="ga-danger-btn" disabled={saving} onClick={withdraw}>Yes, I can't play</button>
                <button type="button" className="ga-ghost" onClick={() => setConfirmWithdraw(false)}>Keep my booking</button>
              </>
            ) : (
              <>
                <h2>Withdraw your application?</h2>
                <p>{booker.name} will be told you can't make {dateLabel}. You can apply again while the gig is still open.</p>
                <button type="button" className="ga-danger-btn" disabled={saving} onClick={withdraw}>Yes, withdraw</button>
                <button type="button" className="ga-ghost" onClick={() => setConfirmWithdraw(false)}>Keep my application</button>
              </>
            )}
          </div>
        </div>
      )}
      <button type="button" className="ga-text" onClick={() => navigate(`/gig/${gigId}`)}>Back to the gig</button>
    </div>
  );
}
