import { useEffect, useMemo, useRef, useState } from 'react';
import { useBreakpoint } from '@hooks/useBreakpoint';
import { FEATURES } from '../../../config/features';
import { createGuestApplication, newGuestIds } from '@services/client-side/guestApplications';
import { forgetProfileSession, getProfileSession, updateOwnProfile } from '@services/client-side/keepProfile';
import { buildGuestTechRider, computeCompatibility } from '@services/utils/techRiderCompatibility';
import { GuestApplied } from './GuestApplied';
import { GuestAssetsStep } from './GuestAssetsStep';
import { GuestReviewStep } from './GuestReviewStep';
import { GuestTechStep } from './GuestTechStep';
import { GuestWhoStep } from './GuestWhoStep';
import { bookerLine, clearDraft, formatShortDay, readDraft, rememberApplication, writeDraft } from './guestFormat';

function sectionSnapshot(draft) {
  return {
    who: JSON.stringify([draft.actName, draft.contactName, draft.email, draft.phone, draft.instagram]),
    assets: JSON.stringify([draft.photo?.path || draft.photo?.url || '', draft.links || {}]),
    tech: JSON.stringify([draft.members, draft.needs, draft.bringOwn]),
  };
}

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
    preferredSlotGigIds: [],
    noPreference: true,
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
  const [returning, setReturning] = useState(null);
  const [profileNote, setProfileNote] = useState('');
  const baselineRef = useRef(null);
  const index = Math.max(0, STEPS.findIndex(([key]) => key === step));

  useEffect(() => {
    if (invite?.prefill && !saved) {
      const invitedSlot = invite.prefill.slotGigIds?.[0];
      const stillOpen = invitedSlot && slots.some((slot) => (slot.gigId || slot.id) === invitedSlot && !slot.taken && slot.applicationsOpen !== false);
      setDraft((current) => ({
        ...current,
        contactName: invite.prefill.contactName || current.contactName,
        actName: invite.prefill.actName || current.actName,
        email: invite.prefill.email || current.email,
        preferredSlotGigIds: stillOpen ? [invitedSlot] : current.preferredSlotGigIds,
        slotGigIds: stillOpen ? [invitedSlot] : current.slotGigIds,
        noPreference: stillOpen ? false : current.noPreference,
      }));
    }
  }, [invite, saved, slots]);

  useEffect(() => {
    writeDraft(gig.gigId, invite?.inviteId, { ...draft, step });
  }, [draft, step, gig.gigId, invite?.inviteId]);

  useEffect(() => {
    if (!FEATURES.keepProfile) return undefined;
    let cancelled = false;
    getProfileSession().then((data) => {
      if (cancelled || !data?.profile || data.profile.status !== 'live') return;
      setReturning(data);
      if (saved) return;
      const profile = data.profile;
      const contact = data.contact || {};
      const next = {
        actName: profile.name || '',
        contactName: contact.contactName || '',
        email: contact.email || '',
        phone: contact.phone || '',
        whatsapp: contact.whatsapp === true,
        instagram: profile.instagramUrl || '',
        links: {
          spotify: profile.spotifyUrl || '',
          youtube: profile.youtubeUrl || '',
          instagram: profile.instagramUrl || '',
          website: profile.websiteUrl || '',
        },
        members: profile.members?.length ? profile.members : [{ name: '', instruments: [] }],
        needs: profile.techRider?.guestNeeds || [],
        bringOwn: profile.techRider?.bringOwn || [],
        photo: profile.heroMedia?.url ? { ...profile.heroMedia, url: profile.heroMedia.url } : null,
        note: '',
        artistProfileId: profile.id,
        profileSlug: profile.slug,
        updateProfile: false,
      };
      baselineRef.current = sectionSnapshot(next);
      setDraft((current) => ({ ...current, ...next }));
      setStep('review');
    }).catch(() => {});
    return () => { cancelled = true; };
  }, [gig.gigId]);

  const patch = (partial) => setDraft((current) => ({ ...current, ...partial }));
  const whoOk = draft.actName.trim() && draft.contactName.trim() && (draft.email.trim() || draft.phone.trim() || draft.instagram.trim()) && !draft.accountBlocked;

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
        preferredSlotGigIds: draft.preferredSlotGigIds || [],
        slotGigIds: draft.preferredSlotGigIds || [],
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
        anotherAct: draft.ignoreDuplicate === true,
        artistProfileId: draft.artistProfileId || null,
      });
      if (draft.updateProfile && draft.artistProfileId) {
        await updateOwnProfile({
          name: draft.actName,
          bio: draft.bio || undefined,
          spotifyUrl: draft.links?.spotify,
          youtubeUrl: draft.links?.youtube,
          instagramUrl: draft.links?.instagram,
          websiteUrl: draft.links?.website,
          members: draft.members,
          techRider: buildGuestTechRider(draft),
          heroMedia: draft.photo?.path ? draft.photo : undefined,
        }).catch(() => {});
        setProfileNote('Your changes were saved to your profile too.');
      } else if (draft.artistProfileId) {
        setProfileNote('Your profile is up to date');
      }
      clearDraft(gig.gigId, invite?.inviteId);
      try { rememberApplication(gig.gigId, draft.manageToken); } catch { /* ignore */ }
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
          draft={{ ...draft, slots }}
          bookerName={booker.name}
          dateLabel={formatShortDay(gig)}
          onClose={onClose}
          onCreateAccount={onCreateAccount}
          profileNote={profileNote}
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
        {returning && step === 'review' && (
          <p><strong>Welcome back, {(returning.contact?.contactName || returning.profile.name || '').split(' ')[0]}.</strong> We've filled this in from your Gigin profile. <button type="button" className="ga-text" onClick={() => { setReturning(null); setDraft(emptyDraft(gig, invite, newGuestIds())); setStep('who'); forgetProfileSession(); }}>Not you? Start blank</button></p>
        )}
        {returning && (() => {
          const compat = computeCompatibility(buildGuestTechRider(draft), venue?.techRider);
          const chat = compat?.needsDiscussion?.[0];
          return chat ? <p className="ga-note">Checked against {venue?.name || booker.name}: they need a chat about {chat.label}.</p> : null;
        })()}
        {step === 'review' && (
          <GuestReviewStep
            draft={draft}
            slots={slots}
            bookerName={booker.name}
            patch={patch}
            editLabel={returning ? 'Change' : 'Edit'}
            noteHint={returning ? "Notes aren't copied from earlier applications." : ''}
            rowTags={returning && baselineRef.current ? (() => {
              const snap = sectionSnapshot(draft);
              const base = baselineRef.current;
              const tag = draft.updateProfile ? 'Also updating your profile' : 'This application only';
              return {
                who: snap.who !== base.who ? tag : '',
                assets: snap.assets !== base.assets ? tag : '',
                tech: snap.tech !== base.tech ? tag : '',
              };
            })() : null}
            onJump={(next) => { setEditing(true); setStep(next); }}
          />
        )}
        {returning && editing && (
          <label className="ga-note"><input type="checkbox" checked={Boolean(draft.updateProfile)} onChange={(event) => patch({ updateProfile: event.target.checked })} /> Also update my profile <small>Unticked, the change only goes to {booker.name} with this application.</small></label>
        )}
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
