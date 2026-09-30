import { useEffect, useMemo, useState } from 'react';
import { useBreakpoint } from '@hooks/useBreakpoint';
import { createGuestApplication, newGuestIds } from '@services/client-side/guestApplications';
import { GuestApplied } from './GuestApplied';
import { GuestAssetsStep } from './GuestAssetsStep';
import { GuestReviewStep } from './GuestReviewStep';
import { GuestTechStep } from './GuestTechStep';
import { GuestWhoStep } from './GuestWhoStep';
import { bookerLine, clearDraft, formatShortDay, readDraft, writeDraft } from './guestFormat';

const STEPS = [
  ['who', 'Who you are'],
  ['assets', 'Photo and links'],
  ['tech', 'Tech rider'],
  ['review', 'Note and review'],
];

function emptyDraft(gig, invite, ids) {
  return {
    ...ids,
    gigId: gig.gigId,
    actName: '',
    contactName: '',
    email: '',
    phone: '',
    whatsapp: true,
    instagram: '',
    slotGigIds: [],
    photo: null,
    assets: [],
    links: { spotify: '', youtube: '', instagram: '', website: '' },
    members: [{ name: '', instruments: [] }],
    needs: [],
    bringOwn: [],
    note: '',
    ignoreDuplicate: false,
    inviteId: invite?.inviteId || '',
  };
}

export function GuestApplyWizard({ gig, slots, venue, invite, onClose, onCreateAccount }) {
  const { isMdUp } = useBreakpoint();
  const booker = bookerLine(venue, gig);
  const saved = readDraft(gig.gigId, invite?.inviteId);
  const [draft, setDraft] = useState(() => saved || emptyDraft(gig, invite, newGuestIds()));
  const [step, setStep] = useState(saved?.step || 'who');
  const [editing, setEditing] = useState(false);
  const [showErrors, setShowErrors] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [offline, setOffline] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const [sent, setSent] = useState(false);
  const index = Math.max(0, STEPS.findIndex(([key]) => key === step));

  useEffect(() => {
    if (invite?.prefill && !saved) {
      setDraft((current) => ({
        ...current,
        contactName: invite.prefill.contactName || current.contactName,
        actName: invite.prefill.actName || current.actName,
        email: invite.prefill.email || current.email,
        slotGigIds: invite.prefill.slotGigIds?.length ? invite.prefill.slotGigIds : current.slotGigIds,
      }));
    }
  }, [invite, saved]);

  useEffect(() => {
    writeDraft(gig.gigId, invite?.inviteId, { ...draft, step });
  }, [draft, step, gig.gigId, invite?.inviteId]);

  const patch = (partial) => setDraft((current) => ({ ...current, ...partial }));
  const whoOk = draft.actName.trim() && draft.contactName.trim() && (draft.email.trim() || draft.phone.trim() || draft.instagram.trim()) && draft.slotGigIds.length > 0 && !draft.accountBlocked;

  const submit = async () => {
    if (!navigator.onLine) {
      setOffline(true);
      return;
    }
    setSubmitting(true);
    setSubmitError('');
    try {
      await createGuestApplication({
        applicationId: draft.applicationId,
        manageToken: draft.manageToken,
        gigId: gig.gigId,
        slotGigIds: draft.slotGigIds,
        inviteId: draft.inviteId || null,
        actName: draft.actName,
        contactName: draft.contactName,
        contacts: {
          email: draft.email,
          phone: draft.phone,
          whatsapp: false,
          instagram: draft.instagram,
        },
        photo: draft.photo ? { path: draft.photo.path, name: draft.photo.name, size: draft.photo.size } : null,
        assets: draft.assets.map((asset) => ({ path: asset.path, name: asset.name, size: asset.size })),
        links: draft.links,
        members: draft.members,
        needs: draft.needs,
        bringOwn: draft.bringOwn,
        note: draft.note,
      });
      clearDraft(gig.gigId, invite?.inviteId);
      try { sessionStorage.setItem('guestApplicationLink', `${gig.gigId}:${draft.manageToken}`); } catch { /* ignore */ }
      setSent(true);
      setOffline(false);
    } catch (error) {
      const network = !navigator.onLine || error?.name === 'AbortError' || error?.message === 'Failed to fetch';
      if (network) setOffline(true);
      else setSubmitError(error?.message || 'Could not send your application.');
    } finally {
      setSubmitting(false);
    }
  };

  useEffect(() => {
    if (!offline) return undefined;
    const retry = () => { if (navigator.onLine) submit(); };
    window.addEventListener('online', retry);
    return () => window.removeEventListener('online', retry);
  }, [offline, draft]);

  const goNext = () => {
    if (step === 'who' && !whoOk) {
      setShowErrors(true);
      return;
    }
    if (editing) {
      setEditing(false);
      setStep('review');
      return;
    }
    setStep(STEPS[Math.min(index + 1, STEPS.length - 1)][0]);
  };

  const primary = useMemo(() => {
    if (offline) return 'Waiting for connection…';
    if (editing) return 'Save';
    if (step === 'review') return 'Send application';
    if (step === 'who') return 'Continue';
    return 'Continue';
  }, [offline, editing, step]);

  if (sent) {
    return (
      <div className="ga-flow">
        <GuestApplied
          draft={draft}
          bookerName={booker.name}
          dateLabel={formatShortDay(slots.find((slot) => draft.slotGigIds.includes(slot.gigId)) || gig)}
          onClose={onClose}
          onCreateAccount={onCreateAccount}
        />
      </div>
    );
  }

  return (
    <div className="ga-flow">
      <header className="ga-flow__bar">
        <button type="button" className="ga-icon" aria-label="Back" onClick={() => {
          if (editing) { setEditing(false); setStep('review'); return; }
          if (index === 0) onClose();
          else setStep(STEPS[index - 1][0]);
        }}>‹</button>
        <div>
          <span className="ga-mono">{editing ? 'EDITING' : `STEP ${index + 1} OF 4`}</span>
          <strong>{STEPS[index][1]}</strong>
        </div>
        {(step === 'assets' || step === 'tech') && !editing ? (
          <button type="button" className="ga-text" onClick={() => setStep(STEPS[index + 1][0])}>Skip</button>
        ) : <span />}
      </header>
      <div className="ga-progress" aria-hidden>
        {STEPS.map(([key], stepIndex) => <span key={key} className={stepIndex < index ? 'is-done' : stepIndex === index ? 'is-current' : ''} />)}
      </div>
      <div className="ga-flow__body">
        {step === 'who' && (
          <GuestWhoStep
            draft={draft}
            patch={patch}
            slots={slots}
            bookerName={booker.name}
            showErrors={showErrors}
            inviteNote={invite?.prefill ? "Filled in from Jez's invite. Change anything that's out of date." : ''}
          />
        )}
        {step === 'assets' && <GuestAssetsStep draft={draft} patch={patch} />}
        {step === 'tech' && <GuestTechStep draft={draft} patch={patch} venue={{ ...venue, bookerDisplayName: booker.name }} />}
        {step === 'review' && <GuestReviewStep draft={draft} slots={slots} bookerName={booker.name} patch={patch} onJump={(next) => { setEditing(true); setStep(next); }} />}
        <div className={`ga-actions${isMdUp ? ' is-desktop' : ''}`}>
          <button type="button" className={step === 'review' && !editing ? 'ga-orange' : 'ga-dark'} disabled={submitting || offline} onClick={() => (step === 'review' && !editing ? submit() : goNext())}>
            {submitting ? 'Sending…' : primary}
          </button>
        </div>
      </div>
      {submitError && <p className="ga-error">{submitError}</p>}
      {offline && (
        <div className="ga-toast" role="status">
          <strong>No connection. Your application is saved.</strong>
          <p>Everything you've typed is kept on this phone. We'll send it when you're back online.</p>
          <button type="button" onClick={submit}>Retry</button>
        </div>
      )}
    </div>
  );
}
