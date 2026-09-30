import { useEffect, useState } from 'react';
import '@styles/artists/gig-page.styles.css';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { getGuestApplication, updateGuestApplication, withdrawGuestApplication } from '@services/client-side/guestApplications';
import { getGigById, getGigsByIds } from '@services/client-side/gigs';
import { getVenueProfileById } from '@services/client-side/venues';
import { useBreakpoint } from '@hooks/useBreakpoint';
import { GuestAssetsStep } from './GuestAssetsStep';
import { GuestReviewStep } from './GuestReviewStep';
import { GuestTechStep } from './GuestTechStep';
import { GuestWhoStep } from './GuestWhoStep';
import { firstName, formatGigDay } from './guestFormat';

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
    slotGigIds: application.slotGigIds || [],
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

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const loaded = await getGuestApplication(token);
        if (cancelled) return;
        setApplication(loaded);
        setDraft(fromApplication(loaded));
        const gigDoc = await getGigById(gigId);
        if (cancelled) return;
        setGig(gigDoc);
        const ids = loaded.slotGigIds || [];
        const extra = ids.filter((id) => id !== gigId);
        const others = extra.length ? await getGigsByIds(extra) : [];
        setSlots([gigDoc, ...others].filter(Boolean));
        if (gigDoc?.venueId) setVenue(await getVenueProfileById(gigDoc.venueId));
      } catch (err) {
        if (!cancelled) setError(err?.message || 'This link is not valid.');
      }
    })();
    return () => { cancelled = true; };
  }, [gigId, token]);

  const save = async () => {
    if (!draft) return;
    setSaving(true);
    try {
      const next = await updateGuestApplication(token, {
        actName: draft.actName,
        contactName: draft.contactName,
        contacts: { email: draft.email, phone: draft.phone, whatsapp: draft.whatsapp, instagram: draft.instagram },
        links: draft.links,
        members: draft.members,
        needs: draft.needs,
        bringOwn: draft.bringOwn,
        note: draft.note,
        slotGigIds: draft.slotGigIds,
      });
      setApplication(next);
      setEditing('');
    } catch (err) {
      setError(err?.message || 'Could not save.');
    } finally {
      setSaving(false);
    }
  };

  const withdraw = async () => {
    setSaving(true);
    try {
      const next = await withdrawGuestApplication(token);
      setApplication(next);
      setConfirmWithdraw(false);
    } catch (err) {
      setError(err?.message || 'Could not withdraw.');
    } finally {
      setSaving(false);
    }
  };

  if (error && !application) {
    return <div className="ga-page"><p className="ga-banner">{error}</p></div>;
  }
  if (!application || !draft) {
    return <div className="ga-page"><p className="ga-quiet">Loading your application…</p></div>;
  }

  const [statusLabel, statusClass] = STATUS[application.status] || STATUS.sent;
  const editable = application.editable !== false && application.status === 'sent';

  return (
    <div className="ga-page">
      <header className="ga-top">
        <span className="ga-logo">gigin.</span>
        <span>Private link for {firstName(application.contactName)}</span>
      </header>
      <main className="ga-manage">
        <p className="ga-mono">{gig ? formatGigDay(gig) : application.dateLabel}</p>
        <h1>Your application</h1>
        <span className={`ga-pill ${statusClass}`}>{statusLabel}</span>
        {application.status === 'withdrawn' && (
          <p className="ga-about">Jez has been told you can't make this gig. You can apply again while it is still open.</p>
        )}
        {editing ? (
          <div className="ga-step">
            {editing === 'who' && <GuestWhoStep draft={draft} patch={(partial) => setDraft((current) => ({ ...current, ...partial }))} slots={slots.length ? slots : [gig].filter(Boolean)} bookerName="Jez" showErrors={false} />}
            {editing === 'assets' && <GuestAssetsStep draft={draft} patch={(partial) => setDraft((current) => ({ ...current, ...partial }))} />}
            {editing === 'tech' && <GuestTechStep draft={draft} patch={(partial) => setDraft((current) => ({ ...current, ...partial }))} venue={venue} />}
            {editing === 'note' && (
              <label className="ga-field">
                <span>Note to Jez</span>
                <textarea rows={4} maxLength={500} value={draft.note} onChange={(event) => setDraft((current) => ({ ...current, note: event.target.value.slice(0, 500) }))} />
              </label>
            )}
            <div className="ga-actions">
              <button type="button" className="ga-dark" disabled={saving} onClick={save}>{saving ? 'Saving…' : 'Save'}</button>
              <button type="button" className="ga-ghost" onClick={() => { setDraft(fromApplication(application)); setEditing(''); }}>Cancel</button>
            </div>
          </div>
        ) : (
          <GuestReviewStep
            draft={draft}
            slots={slots.length ? slots : [gig].filter(Boolean)}
            bookerName="Jez"
            patch={() => {}}
            summary
            readOnly={!editable}
            onJump={(step) => editable && setEditing(step === 'review' ? 'note' : step)}
          />
        )}
        {!editing && (
          <div className="ga-review">
            <div className="ga-review__row">
              <span>Note to Jez</span>
              <strong className={draft.note ? '' : 'is-muted'}>{draft.note || 'None'}</strong>
              {editable && <button type="button" onClick={() => setEditing('note')}>Edit</button>}
            </div>
          </div>
        )}
        {editable && !editing && (
          <button type="button" className="ga-danger" onClick={() => setConfirmWithdraw(true)}>Withdraw my application</button>
        )}
        {application.status === 'withdrawn' && <Link to={`/gig/${gigId}`}>Back to the gig</Link>}
        {error && <p className="ga-error">{error}</p>}
      </main>
      {confirmWithdraw && (
        <div className="ga-sheet-backdrop" onClick={() => setConfirmWithdraw(false)}>
          <div className={`ga-sheet${isMdUp ? ' is-dialog' : ''}`} onClick={(event) => event.stopPropagation()}>
            <h2>Withdraw your application?</h2>
            <p>Jez will be told you can't make {application.dateLabel || 'this date'}. You can apply again while the gig is still open.</p>
            <button type="button" className="ga-danger-btn" disabled={saving} onClick={withdraw}>Yes, withdraw</button>
            <button type="button" className="ga-ghost" onClick={() => setConfirmWithdraw(false)}>Keep my application</button>
          </div>
        </div>
      )}
      <button type="button" className="ga-text" onClick={() => navigate(`/gig/${gigId}`)}>Back to the gig</button>
    </div>
  );
}
