import { useEffect, useMemo, useRef, useState } from 'react';
import { toast } from 'sonner';
import { planAssignment, preferencePhrase, readNight } from '@services/utils/nightApplications';
import { buildGuestTechRider, computeCompatibility } from '@services/utils/techRiderCompatibility';
import { get } from '@services/http';
import { markApplicantsViewed } from '@services/api/gigs';
import {
  acceptNightApplication,
  assignNightApplication,
  closeNightApplications,
  declineNightApplication,
  reopenNightApplications,
  saveNightSoundTech,
  undoCloseNightApplications,
  undoNightApplication,
} from '@services/api/gigs';
import { formatClock, slotEnd } from '@features/gig-discovery/guest/guestFormat';
import { isNewApplicant } from '@features/venue/gigs/utils/isNewApplicant';
import { ApplicantProfileModal, useApplicantQuery } from '@features/venue/gigs/components/ApplicantProfileModal';
import '@styles/host/night-apply.styles.css';

const ACTIVE = new Set(['accepted', 'confirmed', 'paid']);
const WAITING = new Set(['pending', 'sent', '']);

function isWaiting(app) {
  return WAITING.has(String(app?.status || 'pending').toLowerCase());
}
function isAccepted(app) {
  return ACTIVE.has(String(app?.status || '').toLowerCase());
}
function actName(app) {
  return app?.actName || app?.name || app?.artistName || 'This act';
}
function when(value) {
  if (!value) return '';
  const date = typeof value?.toDate === 'function'
    ? value.toDate()
    : new Date(value.seconds ? value.seconds * 1000 : value);
  if (Number.isNaN(date.getTime())) return '';
  const mins = Math.max(0, Math.round((Date.now() - date.getTime()) / 60000));
  if (mins < 60) return `${Math.max(1, mins)}m ago`;
  const hours = Math.round(mins / 60);
  if (hours < 36) return `${hours}h ago`;
  return date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
}
function initials(name) {
  return String(name || '?').split(/\s+/).slice(0, 2).map((part) => part[0]?.toUpperCase() || '').join('');
}
function musicOf(app) {
  const links = app.links || {};
  if (links.spotify) return { provider: 'Spotify', url: links.spotify, verb: 'Listen' };
  if (links.youtube) return { provider: 'YouTube', url: links.youtube, verb: 'Watch' };
  if (links.soundcloud) return { provider: 'SoundCloud', url: links.soundcloud, verb: 'Listen' };
  const instagram = links.instagram || app.instagram;
  if (instagram) {
    const url = String(instagram).startsWith('http') ? instagram : `https://instagram.com/${String(instagram).replace(/^@/, '')}`;
    return { provider: 'Instagram', url, verb: 'Watch' };
  }
  return null;
}

function mergeGuest(app, guests) {
  const priv = guests?.[app.id] || {};
  const links = { ...(priv.links || {}), ...(app.links || {}) };
  return {
    ...priv,
    ...app,
    links,
    email: app.email || priv.email || '',
    phone: app.phone || priv.phone || '',
    instagram: app.instagram || priv.instagram || links.instagram || '',
    note: app.note || priv.note || priv.applicationMessage || '',
    members: app.members?.length ? app.members : (priv.members || []),
    needs: app.needs?.length ? app.needs : (priv.needs || []),
    bringOwn: app.bringOwn?.length ? app.bringOwn : (priv.bringOwn || []),
    contactName: app.contactName || priv.contactName || '',
    photoUrl: app.photoUrl || priv.photoUrl || priv.photo?.url || app.photo?.url || app.profilePicture || '',
    actName: actName({ ...priv, ...app }),
  };
}

export function NightApplyReview({
  rawGig,
  slots,
  venue,
  guestPrivate,
  canUpdate,
  refreshGigs,
  onInviteArtist,
  onSaveNotes,
  notes,
  soundTech,
  user,
  venues,
  gigs,
}) {
  const night = useMemo(() => readNight(slots?.length ? slots : [rawGig].filter(Boolean)), [slots, rawGig]);
  const ordered = night.slots;
  const rootId = night.applicationsRootGigId || rawGig?.gigId;
  const oneSet = ordered.length < 2;
  const signature = night.applications.map((app) => `${app.id}:${app.status}:${app.assignedSlotGigId || ''}:${app.viewed ? 1 : 0}`).join('|');
  const serverClosed = ordered.length > 0 && ordered.every((slot) => slot.applicationsOpen === false);
  const [localApps, setLocalApps] = useState(null);
  const [closedOverride, setClosedOverride] = useState(null);
  const [tab, setTab] = useState('applications');
  const [bucket, setBucket] = useState('all');
  const [prefer, setPrefer] = useState('any');
  const [panel, setPanel] = useState(null);
  const [draggingId, setDraggingId] = useState(null);
  const [hoverSlot, setHoverSlot] = useState('');
  const [toastNote, setToastNote] = useState(null);
  const [hideClose, setHideClose] = useState(false);
  const [declineWaiting, setDeclineWaiting] = useState(true);
  const [busy, setBusy] = useState(false);
  const queueRef = useRef(Promise.resolve());
  const [copied, setCopied] = useState(false);
  const [sound, setSound] = useState(soundTech || venue?.defaultSoundTech || null);
  const [soundEdit, setSoundEdit] = useState(null);
  const [noteEdit, setNoteEdit] = useState(null);
  const [noteValue, setNoteValue] = useState(notes || '');
  const hoverRef = useRef('');
  const { applicantId, openApplicant, moveApplicant, closeApplicant, focusRef } = useApplicantQuery();

  useEffect(() => { setLocalApps(null); }, [signature]);
  useEffect(() => { setClosedOverride(null); }, [serverClosed]);
  useEffect(() => {
    if (soundTech?.name) setSound(soundTech);
  }, [soundTech]);
  useEffect(() => { setNoteValue(notes || ''); }, [notes]);
  useEffect(() => {
    if (!toastNote) return undefined;
    const timer = setTimeout(() => setToastNote(null), 7000);
    return () => clearTimeout(timer);
  }, [toastNote]);

  const applications = (localApps || night.applications).map((app) => mergeGuest(app, guestPrivate));
  const closed = closedOverride ?? serverClosed;
  const filledCount = ordered.filter((slot) => applications.some((app) => isAccepted(app) && app.assignedSlotGigId === (slot.gigId || slot.id))).length;
  const waiting = applications.filter(isWaiting);
  const accepted = applications.filter(isAccepted);
  const unassigned = accepted.filter((app) => !app.assignedSlotGigId);
  const allFilled = ordered.length > 0 && filledCount === ordered.length;

  const flash = (message, undo) => setToastNote({ message, undo });

  const run = (work, optimistic) => {
    if (!canUpdate) return Promise.resolve(null);
    const job = queueRef.current.then(async () => {
      if (optimistic) setLocalApps(optimistic);
      setBusy(true);
      try {
        const result = await work();
        if (result?.toast) flash(result.toast, result.undo);
        refreshGigs?.();
        return result;
      } catch (err) {
        setLocalApps(null);
        toast.error(err?.message || 'Something went wrong.');
        return null;
      } finally {
        setBusy(false);
      }
    });
    queueRef.current = job.then(() => {}, () => {});
    return job;
  };

  const accept = (app, slotGigId) => run(
    () => acceptNightApplication({ rootGigId: rootId, applicantId: app.id, slotGigId: slotGigId || null }),
    applications.map((item) => (item.id === app.id
      ? { ...item, status: 'accepted', assignedSlotGigId: slotGigId || null, viewed: true }
      : item)),
  );

  const assign = (appId, slotGigId) => {
    const planned = planAssignment(applications, appId, slotGigId);
    if (planned.error) {
      toast.error(planned.error);
      return;
    }
    const current = applications.find((item) => item.id === appId);
    if (current && (current.assignedSlotGigId || null) === (slotGigId || null)) return;
    run(
      () => assignNightApplication({ rootGigId: rootId, applicantId: appId, slotGigId }),
      planned.applications,
    );
  };

  const decline = (app) => run(
    () => declineNightApplication({ rootGigId: rootId, applicantId: app.id }),
    applications.map((item) => (item.id === app.id
      ? { ...item, status: 'declined', assignedSlotGigId: null, viewed: true }
      : item)),
  );

  const undo = async (app) => {
    setToastNote(null);
    await run(() => undoNightApplication({ rootGigId: rootId, applicantId: app.id }), null);
    setLocalApps(null);
  };

  const closeNight = (shouldDecline) => run(async () => {
    const decline = typeof shouldDecline === 'boolean' ? shouldDecline : declineWaiting;
    setClosedOverride(true);
    if (decline) {
      setLocalApps(applications.map((item) => (isWaiting(item) ? { ...item, status: 'declined', viewed: true } : item)));
    }
    const result = await closeNightApplications({ rootGigId: rootId, declineWaiting: decline });
    const extra = decline && waiting.length ? ` ${waiting.length} ${waiting.length === 1 ? 'act' : 'acts'} will get a polite no.` : '';
    return { ...result, toast: `Applications closed.${extra}`, undo: { close: true } };
  });

  const undoToast = async () => {
    const undoInfo = toastNote?.undo;
    setToastNote(null);
    if (!undoInfo) return;
    if (undoInfo.close) {
      setClosedOverride(false);
      await run(() => undoCloseNightApplications({ rootGigId: rootId }));
      setLocalApps(null);
      return;
    }
    if (undoInfo.applicationId) {
      const app = applications.find((item) => item.id === undoInfo.applicationId);
      if (app) await undo(app);
    }
  };

  const beginDrag = (app, event) => {
    if (!canUpdate || !isAccepted(app)) return;
    event.preventDefault();
    setDraggingId(app.id);
    const move = (ev) => {
      const zone = document.elementFromPoint(ev.clientX, ev.clientY)?.closest?.('[data-drop-slot]');
      const next = zone?.getAttribute('data-drop-slot') || '';
      hoverRef.current = next;
      setHoverSlot(next);
    };
    const up = () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      const slot = hoverRef.current;
      hoverRef.current = '';
      setDraggingId(null);
      setHoverSlot('');
      if (slot && slot !== app.assignedSlotGigId) assign(app.id, slot);
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
  };

  const occupant = (slot) => applications.find((app) => isAccepted(app) && app.assignedSlotGigId === (slot.gigId || slot.id));
  const slotLabel = (slot) => {
    const index = ordered.findIndex((item) => (item.gigId || item.id) === (slot.gigId || slot.id));
    return oneSet ? 'The set' : `Set ${index + 1}`;
  };
  const prefersLabel = (app) => {
    const phrase = preferencePhrase(ordered, app.preferredSlotGigIds || []);
    return phrase ? `Prefers ${phrase}` : 'No preference';
  };
  const givenAway = (app) => {
    const ids = app.preferredSlotGigIds || [];
    if (!ids.length || app.assignedSlotGigId) return null;
    const blocked = ids.every((id) => {
      const holder = applications.find((item) => isAccepted(item) && item.assignedSlotGigId === id && item.id !== app.id);
      return Boolean(holder);
    });
    if (!blocked) return null;
    const holder = applications.find((item) => isAccepted(item) && item.assignedSlotGigId === ids[0]);
    const index = ordered.findIndex((slot) => (slot.gigId || slot.id) === ids[0]);
    return `Prefers Set ${index + 1} · given to ${actName(holder)}`;
  };

  const visible = applications.filter((app) => {
    if (bucket === 'waiting' && !isWaiting(app)) return false;
    if (bucket === 'accepted' && !isAccepted(app)) return false;
    if (bucket === 'declined' && app.status !== 'declined') return false;
    if (bucket === 'all' || prefer === 'any' || oneSet) return true;
    const ids = app.preferredSlotGigIds || [];
    return ids.length === 0 || ids.includes(prefer);
  }).sort((a, b) => {
    const rank = (app) => (isWaiting(app) ? (app.viewed ? 1 : 0) : isAccepted(app) ? 2 : app.status === 'declined' ? 3 : 4);
    const diff = rank(a) - rank(b);
    if (diff) return diff;
    return String(b.createdAt || '').localeCompare(String(a.createdAt || ''));
  });

  const counts = {
    all: applications.length,
    waiting: waiting.length,
    accepted: accepted.length,
    declined: applications.filter((app) => app.status === 'declined').length,
  };

  const markOpened = (ids) => {
    const pending = (ids || []).filter((id) => isNewApplicant(applications.find((item) => item.id === id)));
    if (!pending.length || !rawGig?.venueId) return;
    const wanted = new Set(pending);
    setLocalApps((current) => (current || applications).map((item) => (
      wanted.has(item.id) ? { ...item, viewed: true } : item
    )));
    markApplicantsViewed({ venueId: rawGig.venueId, gigId: rootId, applicantIds: pending })
      .then(() => refreshGigs?.())
      .catch(() => {});
  };

  const copyLink = async () => {
    const url = `${window.location.origin}/gig/${rootId}`;
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 1400);
    } catch {
      toast.error('Could not copy the link.');
    }
  };

  const saveSound = async () => {
    if (!soundEdit?.name?.trim()) return;
    const value = {
      name: soundEdit.name.trim(),
      role: soundEdit.role?.trim() || 'House engineer',
      phone: soundEdit.phone?.trim() || '',
      arrives: soundEdit.arrives?.trim() || '',
    };
    setSound(value);
    setSoundEdit(null);
    try {
      await saveNightSoundTech({ rootGigId: rootId, soundTech: value });
      refreshGigs?.();
    } catch (err) {
      toast.error(err?.message || 'Could not save the sound tech.');
    }
  };

  return (
    <div className={`na${ordered.length >= 4 ? ' is-compact' : ''}`}>
      <div className="na-grid">
        <section>
          <div className="na-tabs" role="tablist">
            <button type="button" className={tab === 'applications' ? 'is-on' : ''} onClick={() => setTab('applications')}>
              Applications
              {waiting.length > 0 && <b>{waiting.length}</b>}
              {applications.filter(isNewApplicant).length > 0 && (
                <span className="na-new">{applications.filter(isNewApplicant).length} new</span>
              )}
            </button>
            <button type="button" className={tab === 'order' ? 'is-on' : ''} onClick={() => setTab('order')}>
              Running order
              <em>{filledCount}/{ordered.length || 0}</em>
            </button>
          </div>
          {tab === 'applications' ? (
            <>
              <div className="na-toolbar">
                <div className="na-seg">
                  {[['all', 'All'], ['waiting', 'Waiting'], ['accepted', 'Accepted'], ['declined', 'Declined']].map(([key, label]) => (
                    <button key={key} type="button" className={bucket === key ? 'is-on' : ''} onClick={() => setBucket(key)}>
                      {label} <span>{counts[key]}</span>
                    </button>
                  ))}
                </div>
                {!oneSet && (
                  <div className="na-filters">
                    <button type="button" className={prefer === 'any' ? 'is-on' : ''} onClick={() => setPrefer('any')}>Any set</button>
                    {ordered.map((slot, index) => (
                      <button key={slot.gigId || index} type="button" className={prefer === (slot.gigId || slot.id) ? 'is-on' : ''} onClick={() => setPrefer(slot.gigId || slot.id)}>
                        Set {index + 1}
                      </button>
                    ))}
                  </div>
                )}
              </div>
              <div className="na-list">
                {visible.map((app) => (
                  <ApplicantCard
                    key={app.id}
                    app={app}
                    ordered={ordered}
                    oneSet={oneSet}
                    venue={venue}
                    canUpdate={canUpdate}
                    panel={panel?.id === app.id ? panel.kind : ''}
                    applications={applications}
                    onOpen={(kind) => setPanel(panel?.id === app.id && panel.kind === kind ? null : { id: app.id, kind })}
                    onAccept={(slotGigId) => { setPanel(null); accept(app, slotGigId); }}
                    onDecline={() => decline(app)}
                    onUndo={() => undo(app)}
                    onAssign={(slotGigId) => { setPanel(null); assign(app.id, slotGigId); }}
                    prefersLabel={prefersLabel(app)}
                    conflict={givenAway(app)}
                    slotLabel={slotLabel}
                    occupant={occupant}
                    onView={() => markOpened([app.id])}
                    onOpenProfile={(id, trigger) => {
                      markOpened([id]);
                      openApplicant(id, trigger);
                    }}
                  />
                ))}
                {visible.length === 0 && <p className="na-empty">No applications in this view.</p>}
              </div>
            </>
          ) : (
            <RunningOrder
              ordered={ordered}
              oneSet={oneSet}
              occupant={occupant}
              applications={applications}
              draggingId={draggingId}
              hoverSlot={hoverSlot}
              canUpdate={canUpdate}
              onDrag={beginDrag}
              onAssign={assign}
              slotLabel={slotLabel}
              onSee={(slotId) => { setTab('applications'); setBucket('waiting'); setPrefer(slotId); }}
            />
          )}
        </section>
        <aside>
          <SetsPanel
            ordered={ordered}
            oneSet={oneSet}
            filledCount={filledCount}
            accepted={accepted}
            unassigned={unassigned}
            waiting={waiting}
            applications={applications}
            occupant={occupant}
            draggingId={draggingId}
            hoverSlot={hoverSlot}
            canUpdate={canUpdate}
            onDrag={beginDrag}
            onAssign={assign}
            slotLabel={slotLabel}
            prefersLabel={prefersLabel}
          />
          <CloseCard
            oneSet={oneSet}
            allFilled={allFilled}
            closed={closed}
            openSets={ordered.length - filledCount}
            waiting={waiting.length}
            accepted={accepted.length}
            hide={hideClose}
            declineWaiting={declineWaiting}
            setDeclineWaiting={setDeclineWaiting}
            onHide={() => setHideClose(true)}
            onClose={closeNight}
            onReopen={() => run(async () => {
              setClosedOverride(false);
              await reopenNightApplications({ rootGigId: rootId });
              return { toast: '' };
            })}
            canUpdate={canUpdate}
          />
          {!closed && (
            <section className="na-card">
              <h2>Share the gig</h2>
              <div className="na-share">
                <input readOnly value={`${typeof window !== 'undefined' ? window.location.origin : ''}/gig/${rootId}`} />
                <button type="button" onClick={copyLink}>{copied ? 'Copied' : 'Copy'}</button>
              </div>
              {onInviteArtist && <button type="button" className="na-text" onClick={onInviteArtist}>Invite from My Contacts</button>}
            </section>
          )}
          <SoundTechCard
            sound={sound}
            editing={soundEdit}
            setEditing={setSoundEdit}
            onSave={saveSound}
            onRemove={async () => {
              setSound(null);
              setSoundEdit(null);
              try {
                await saveNightSoundTech({ rootGigId: rootId, soundTech: null });
                refreshGigs?.();
              } catch (err) {
                toast.error(err?.message || 'Could not remove the sound tech.');
              }
            }}
            canUpdate={canUpdate}
          />
          <NotesCard
            notes={notes}
            editing={noteEdit}
            value={noteValue}
            setValue={setNoteValue}
            setEditing={setNoteEdit}
            canUpdate={canUpdate}
            onSave={async () => {
              setNoteEdit(false);
              try { await onSaveNotes?.(noteValue); } catch (err) { toast.error(err?.message || 'Could not save the note.'); }
            }}
          />
        </aside>
      </div>
      {applicantId ? (
        <ApplicantProfileModal
          applicant={applications.find((item) => item.id === applicantId)}
          applicants={visible}
          applications={applications}
          slots={ordered}
          gig={rawGig}
          venue={venue}
          venueGigs={gigs}
          user={user}
          venues={venues}
          canUpdate={canUpdate}
          busy={busy}
          onClose={closeApplicant}
          onMove={moveApplicant}
          onAccept={(app, slotGigId) => accept(app, slotGigId)}
          onDecline={(app) => decline(app)}
          returnFocusEl={focusRef.current}
        />
      ) : null}
      {toastNote?.message && (
        <div className="na-toast" role="status">
          <span>{toastNote.message}</span>
          {toastNote.undo && <button type="button" onClick={undoToast}>Undo</button>}
        </div>
      )}
    </div>
  );
}

function ApplicantCard({
  app, ordered, oneSet, venue, canUpdate, panel, onOpen, onAccept, onDecline, onUndo, onAssign,
  prefersLabel, conflict, slotLabel, occupant, onView, onOpenProfile, applications,
}) {
  const music = musicOf(app);
  const [preview, setPreview] = useState(null);
  useEffect(() => {
    if (!music?.url || music.provider === 'Instagram') return undefined;
    let cancelled = false;
    get('/link-preview/oembed', { query: { url: music.url }, auth: false })
      .then((data) => { if (!cancelled) setPreview(data); })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [music?.url, music?.provider]);
  const tech = techLine(app, venue);
  const assigned = ordered.find((slot) => (slot.gigId || slot.id) === app.assignedSlotGigId);
  const withdrawn = app.status === 'withdrawn';
  const unviewed = isNewApplicant(app);
  const status = statusChip(app, assigned, ordered, oneSet);
  const members = (app.members || []).filter((member) => member?.name || member?.instruments?.length);
  return (
    <article className={`na-app${withdrawn ? ' is-muted' : ''}${unviewed ? ' is-unviewed' : ''}`}>
      {unviewed ? <span className="na-app__dot" aria-label="New application" /> : null}
      <button type="button" className="na-photo" aria-label={`View ${actName(app)} profile`} style={app.photoUrl ? { backgroundImage: `url(${app.photoUrl})` } : undefined} onClick={(event) => onOpenProfile?.(app.id, event.currentTarget)}>{app.photoUrl ? '' : initials(actName(app))}</button>
      <div>
        <header>
          <button type="button" className="na-name" onClick={(event) => onOpenProfile?.(app.id, event.currentTarget)}>{actName(app)}</button>
          {(app.type === 'guest' || app.guest) && <em>Guest</em>}
          <span className={status.className}>{status.label}</span>
        </header>
        <p>{app.kind || 'Act'} · {members.length || 1} {members.length === 1 ? 'member' : 'members'} · applied {when(app.createdAt || app.appliedAt) || 'recently'}</p>
        {!oneSet && <div className="na-tags"><span className={conflict ? 'is-warn' : (app.preferredSlotGigIds || []).length ? 'is-pref' : ''}>{conflict || prefersLabel}</span></div>}
        {music && <p className="na-music"><i />{music.provider}{preview?.title ? ` · ${preview.title}` : ''}</p>}
        <p className={`na-tech ${tech.tone}`}>{tech.text}</p>
        <blockquote>{app.note ? `“${app.note}”` : 'No note'}</blockquote>
        <div className="na-actions">
          <div>
            <button type="button" onClick={(event) => onOpenProfile?.(app.id, event.currentTarget)}>View profile</button>
            {music && <button type="button" onClick={() => { onView(); onOpen('listen'); }}>{panel === 'listen' ? 'Close' : music.verb}</button>}
            <button type="button" onClick={() => onOpen('contact')}>{panel === 'contact' ? 'Close' : 'Contact'}</button>
          </div>
          {canUpdate && isWaiting(app) && (
            <div>
              <button type="button" className="is-outline" onClick={onDecline}>Decline</button>
              <button type="button" className="is-orange" onClick={() => {
                const only = ordered[0];
                const taken = occupant(only);
                if (oneSet && !taken) onAccept(only.gigId || only.id);
                else onOpen('accept');
              }}>Accept</button>
            </div>
          )}
          {canUpdate && isAccepted(app) && !oneSet && (
            <button type="button" className={assigned ? 'is-outline' : 'is-dark'} onClick={() => onOpen('change')}>
              {assigned ? `${slotLabel(assigned)} ▾` : 'Choose a set ▾'}
            </button>
          )}
          {canUpdate && app.status === 'declined' && <button type="button" className="na-text" onClick={onUndo}>Undo decline</button>}
        </div>
        {panel === 'listen' && music && <ListenPanel music={music} preview={preview} />}
        {panel === 'contact' && <ContactPanel app={app} />}
        {panel === 'accept' && (
          <SetPicker
            title={ordered.every((slot) => occupant(slot)) ? 'All sets are filled' : `Accept ${actName(app)} for which set?`}
            note={ordered.every((slot) => occupant(slot))
              ? 'You can still accept them and give them a set later, for example if someone drops out.'
              : ((app.preferredSlotGigIds || []).length ? `They'd prefer ${preferencePhrase(ordered, app.preferredSlotGigIds)}. You can pick any open set.` : 'No preference, so any open set works.')}
            ordered={ordered}
            app={app}
            occupant={occupant}
            mode="accept"
            onPick={onAccept}
            onLater={() => onAccept(null)}
            onCancel={() => onOpen('accept')}
            applications={applications}
          />
        )}
        {panel === 'change' && (
          <SetPicker
            title={`Move ${actName(app)} to which set?`}
            note="Picking a taken set swaps the two acts."
            ordered={ordered}
            app={app}
            occupant={occupant}
            mode="change"
            onPick={onAssign}
            onLater={() => onAssign(null)}
            onCancel={() => onOpen('change')}
            applications={applications}
          />
        )}
      </div>
    </article>
  );
}

function statusChip(app, assigned, ordered, oneSet) {
  if (app.status === 'withdrawn') return { label: `Withdrew ${when(app.withdrawnAt) || ''}`.trim(), className: 'is-muted' };
  if (app.status === 'declined') return { label: 'Declined', className: 'is-muted' };
  if (isAccepted(app)) {
    if (oneSet) return { label: 'Accepted', className: 'is-ok' };
    if (!assigned) return { label: 'Accepted · no set yet', className: 'is-wait' };
    const index = ordered.findIndex((slot) => (slot.gigId || slot.id) === (assigned.gigId || assigned.id));
    return { label: `Accepted · Set ${index + 1}`, className: 'is-ok' };
  }
  if (isNewApplicant(app)) return { label: 'New', className: 'is-new' };
  return { label: 'Waiting', className: 'is-muted' };
}

function techLine(app, venue) {
  const rider = (app.type === 'guest' || app.guest)
    ? buildGuestTechRider({ needs: app.needs || [], bringOwn: app.bringOwn || [], members: app.members || [] })
    : (app.techRider || app.techSetup);
  if (!rider) return { text: 'Tech rider not filled in', tone: 'is-muted' };
  const compat = computeCompatibility(rider, venue?.techRider);
  const chat = (compat?.needsDiscussion || []).map((item) => item.label || item).filter(Boolean);
  if (chat.length) return { text: `Needs a chat: ${chat.join(', ')}`, tone: 'is-warn' };
  if (!app.needs?.length && !app.bringOwn?.length && !app.techRider && !app.techSetup) {
    return { text: 'Tech rider not filled in', tone: 'is-muted' };
  }
  return { text: "Fits the bar's kit", tone: 'is-ok' };
}

function ListenPanel({ music, preview }) {
  return (
    <div className="na-listen">
      <strong>{preview?.title || music.provider}</strong>
      <span>{music.provider}</span>
      {preview?.html ? <div dangerouslySetInnerHTML={{ __html: preview.html }} /> : null}
      <a href={music.url} target="_blank" rel="noreferrer">Open in {music.provider}</a>
    </div>
  );
}

function ContactPanel({ app }) {
  const guest = app.type === 'guest' || app.guest;
  const methods = [
    app.email ? ['Email', `mailto:${app.email}`] : null,
    app.phone ? ['Phone', `tel:${app.phone}`] : null,
    app.whatsapp && app.phone ? ['WhatsApp', `https://wa.me/${String(app.phone).replace(/\D/g, '')}`] : null,
    app.instagram ? ['Instagram', String(app.instagram).startsWith('http') ? app.instagram : `https://instagram.com/${String(app.instagram).replace(/^@/, '')}`] : null,
    app.userId || app.linkedArtistId ? ['Gigin', `/artists/${app.linkedArtistId || app.userId}`] : null,
  ].filter(Boolean);
  return (
    <div className="na-contact">
      <p>Contact {app.contactName || actName(app)}{guest ? ' (applied as a guest, no Gigin profile)' : ''}</p>
      <div>
        {methods.map(([label, href]) => <a key={label} href={href}>{label}</a>)}
      </div>
    </div>
  );
}

function SetPicker({ title, note, ordered, app, occupant, mode, onPick, onLater, onCancel }) {
  const prefs = new Set(app.preferredSlotGigIds || []);
  return (
    <div className="na-picker">
      <strong>{title}</strong>
      <p>{note}</p>
      <div className={ordered.length >= 4 ? 'is-wrap' : ''}>
        {ordered.map((slot) => {
          const id = slot.gigId || slot.id;
          const holder = occupant(slot);
          const current = app.assignedSlotGigId === id;
          const taken = holder && holder.id !== app.id;
          const disabled = mode === 'accept' ? Boolean(taken) : current;
          const index = ordered.findIndex((item) => (item.gigId || item.id) === id);
          let sub = 'Open';
          if (current) sub = 'Current set';
          else if (taken && mode === 'change') sub = `Swap with ${actName(holder)}`;
          else if (taken) sub = `Taken · ${actName(holder)}`;
          else if (prefs.has(id)) sub = 'Their pick';
          return (
            <button key={id} type="button" disabled={disabled} className={prefs.has(id) && !taken ? 'is-pick' : ''} onClick={() => onPick(id)}>
              <b>{ordered.length < 2 ? 'The set' : `Set ${index + 1}`}</b>
              <small>{formatClock(slot.startTime)}{slotEnd(slot) ? `–${slotEnd(slot)}` : ''}</small>
              <em>{sub}</em>
            </button>
          );
        })}
      </div>
      <footer>
        <button type="button" onClick={onCancel}>Cancel</button>
        <button type="button" onClick={onLater}>{mode === 'accept' ? 'Accept, choose set later' : 'Remove from set'}</button>
      </footer>
    </div>
  );
}

function SetsPanel({ ordered, oneSet, filledCount, accepted, unassigned, waiting, applications, occupant, draggingId, hoverSlot, canUpdate, onDrag, onAssign, slotLabel, prefersLabel }) {
  const todo = todoLine({
    filled: filledCount,
    accepted: accepted.length,
    total: ordered.length,
    unassigned: unassigned.length,
    waiting: waiting.length,
    oneSet,
  });
  return (
    <section className="na-card">
      <header className="na-sets-head">
        <h2>{oneSet ? 'The set' : 'Sets'}</h2>
        <span>{filledCount} OF {ordered.length || 0} FILLED</span>
      </header>
      <div className="na-progress">{ordered.map((slot) => <i key={slot.gigId || slot.id} className={occupant(slot) ? 'is-on' : ''} />)}</div>
      <p className={`na-todo ${todo.tone}`}><span>{todo.mark}</span><span><strong>{todo.title}</strong><small>{todo.sub}</small></span></p>
      <div className="na-slots">
        {ordered.map((slot) => {
          const id = slot.gigId || slot.id;
          const holder = occupant(slot);
          const dragged = applications.find((item) => item.id === draggingId);
          const preferred = dragged && (dragged.preferredSlotGigIds || []).includes(id);
          const withdrew = !holder ? applications.find((item) => item.status === 'withdrawn' && item.lastSlotGigId === id) : null;
          return (
            <div key={id} className={`na-slot${hoverSlot === id ? ' is-hover' : ''}${preferred ? ' is-pref' : ''}`} data-drop-slot={id}>
              <header>
                <strong>{slotLabel(slot)}</strong>
                <em>{formatClock(slot.startTime)}{slotEnd(slot) ? `–${slotEnd(slot)}` : ''}</em>
                {slot.duration ? <span>{slot.duration} min</span> : null}
              </header>
              {holder ? (
                <div className={`na-act${draggingId === holder.id ? ' is-dragging' : ''}`} onPointerDown={(event) => onDrag(holder, event)}>
                  <span className="na-grip" aria-hidden="true">⋮⋮</span>
                  <b>{initials(actName(holder))}</b>
                  <span>
                    <strong>{actName(holder)}</strong>
                    <small>{fitLine(holder, id, ordered)}</small>
                  </span>
                  {canUpdate && <AssignMenu label="Change ▾" app={holder} slot={slot} ordered={ordered} unassigned={unassigned} accepted={accepted} onAssign={onAssign} mode="change" />}
                </div>
              ) : (
                <>
                  {withdrew && <p className="na-withdrew">{actName(withdrew)} withdrew on {when(withdrew.withdrawnAt) || 'this date'}, so {slotLabel(slot)} is open again.</p>}
                  <div className="na-drop">{hoverSlot === id ? 'Drop here' : (draggingId ? 'Drag an act here' : 'No act yet')}</div>
                  {canUpdate && <AssignMenu label="Assign ▾" slot={slot} ordered={ordered} unassigned={unassigned} occupant={occupant} onAssign={onAssign} mode="assign" />}
                  <Suggestion slotId={id} unassigned={unassigned} ordered={ordered} takenIds={ordered.filter((item) => occupant(item)).map((item) => item.gigId || item.id)} onAssign={onAssign} canUpdate={canUpdate} />
                </>
              )}
            </div>
          );
        })}
      </div>
      {!oneSet && unassigned.length > 0 && (
        <div className="na-tray">
          <header><strong>Accepted, no set yet</strong><span>Drag onto a set</span></header>
          {unassigned.map((app) => (
            <div key={app.id} className={`na-act${draggingId === app.id ? ' is-dragging' : ''}`} onPointerDown={(event) => onDrag(app, event)}>
              <span className="na-grip" aria-hidden="true">⋮⋮</span>
              <b>{initials(actName(app))}</b>
              <span>
                <strong>{actName(app)}</strong>
                <small>{prefersLabel(app)}</small>
              </span>
              {canUpdate && <AssignMenu label="Assign ▾" app={app} ordered={ordered} unassigned={unassigned} occupant={occupant} onAssign={onAssign} mode="tray" />}
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

function fitLine(app, slotId, ordered) {
  const ids = app.preferredSlotGigIds || [];
  if (ids.includes(slotId)) return 'Their pick';
  const phrase = preferencePhrase(ordered, ids);
  return phrase ? `Preferred ${phrase}` : 'No preference';
}

function todoLine({ filled, accepted, total, unassigned, waiting, oneSet }) {
  if (!accepted) {
    return oneSet
      ? { tone: '', mark: '·', title: 'No act accepted yet', sub: "Accept an applicant and they're booked for the set." }
      : { tone: '', mark: '·', title: 'No acts accepted yet', sub: 'Accept applicants, then give each one a set.' };
  }
  if (filled < total) {
    const left = total - filled;
    return {
      tone: 'is-warn',
      mark: '!',
      title: `${accepted} ${accepted === 1 ? 'act' : 'acts'} accepted, ${left} ${left === 1 ? 'set' : 'sets'} still to assign`,
      sub: unassigned ? `${unassigned} accepted ${unassigned === 1 ? 'act' : 'acts'} waiting for a set` : 'Accept another act to fill it',
    };
  }
  return {
    tone: 'is-ok',
    mark: '✓',
    title: oneSet ? 'Set filled' : 'All sets filled',
    sub: waiting ? `${waiting} ${waiting === 1 ? 'act' : 'acts'} still waiting to hear back` : 'Everyone has heard back',
  };
}

function Suggestion({ slotId, unassigned, ordered, takenIds = [], onAssign, canUpdate }) {
  const taken = new Set(takenIds);
  const match = unassigned.find((app) => (app.preferredSlotGigIds || []).includes(slotId))
    || unassigned.find((app) => !(app.preferredSlotGigIds || []).length)
    || unassigned.find((app) => (app.preferredSlotGigIds || []).length > 0 && (app.preferredSlotGigIds || []).every((id) => taken.has(id)));
  if (!match) return null;
  const ids = match.preferredSlotGigIds || [];
  let why = 'no preference';
  if (ids.includes(slotId)) why = 'prefers this set';
  else if (ids.length) why = `wanted ${preferencePhrase(ordered, ids)}, now taken`;
  return (
    <p className="na-suggest">Suggested: <strong>{actName(match)}</strong>, {why}
      {canUpdate && <button type="button" onClick={() => onAssign(match.id, slotId)}>Assign</button>}
    </p>
  );
}

function AssignMenu({ label, app, slot, ordered, unassigned, accepted = [], occupant, onAssign, mode }) {
  const [open, setOpen] = useState(false);
  const slotId = slot?.gigId || slot?.id;
  const others = accepted.filter((item) => item.id !== app?.id && item.assignedSlotGigId && item.assignedSlotGigId !== slotId);
  return (
    <div className="na-menu" onPointerDown={(event) => event.stopPropagation()}>
      <button type="button" onClick={(event) => { event.stopPropagation(); setOpen((value) => !value); }}>{label}</button>
      {open && (
        <div role="menu" onPointerDown={(event) => event.stopPropagation()}>
          {mode !== 'tray' && unassigned.filter((item) => item.id !== app?.id).map((item) => (
            <button key={item.id} type="button" onClick={() => { setOpen(false); onAssign(item.id, slotId); }}>
              {actName(item)}{(item.preferredSlotGigIds || []).includes(slotId) ? ' · Prefers this set' : ''}
            </button>
          ))}
          {mode === 'change' && others.map((item) => {
            const index = ordered.findIndex((entry) => (entry.gigId || entry.id) === item.assignedSlotGigId);
            return (
              <button key={item.id} type="button" onClick={() => { setOpen(false); onAssign(app.id, item.assignedSlotGigId); }}>
                Swap with {ordered.length < 2 ? 'the set' : `Set ${index + 1}`}
              </button>
            );
          })}
          {mode === 'tray' && ordered.map((item) => {
            const id = item.gigId || item.id;
            const index = ordered.findIndex((entry) => (entry.gigId || entry.id) === id);
            const holder = occupant?.(item);
            const theirs = (app.preferredSlotGigIds || []).includes(id);
            let detail = 'Open';
            if (holder && holder.id !== app.id) detail = `Replace ${actName(holder)} (they'll have no set)`;
            else if (theirs) detail = 'Their pick · open';
            return (
              <button key={id} type="button" onClick={() => { setOpen(false); onAssign(app.id, id); }}>
                {ordered.length < 2 ? 'The set' : `Set ${index + 1}`} · {detail}
              </button>
            );
          })}
          {mode === 'change' && app && (
            <button type="button" className="is-danger" onClick={() => { setOpen(false); onAssign(app.id, null); }}>
              Remove from this set
            </button>
          )}
        </div>
      )}
    </div>
  );
}

function RunningOrder({ ordered, occupant, applications, draggingId, hoverSlot, canUpdate, onDrag, onAssign, slotLabel, onSee }) {
  const unassigned = applications.filter((app) => isAccepted(app) && !app.assignedSlotGigId);
  return (
    <div className="na-order">
      {ordered.map((slot, index) => {
        const id = slot.gigId || slot.id;
        const holder = occupant(slot);
        const preferrers = applications.filter((app) => isWaiting(app) && (app.preferredSlotGigIds || []).includes(id)).length;
        const withdrew = (applications.find((app) => app.status === 'withdrawn' && app.lastSlotGigId === id && !holder));
        return (
          <div key={id} className="na-order-row">
            <time>{formatClock(slot.startTime)}</time>
            <span className={holder ? 'is-ok' : ''} />
            <article data-drop-slot={id} className={hoverSlot === id ? 'is-hover' : ''}>
              <header>
                <strong>{slotLabel(slot)}</strong>
                <em>{formatClock(slot.startTime)}{slotEnd(slot) ? `–${slotEnd(slot)}` : ''}{slot.duration ? ` · ${slot.duration} min` : ''}</em>
                <b className={holder ? 'is-ok' : withdrew ? 'is-wait' : ''}>{holder ? 'Filled' : withdrew ? 'Open again' : 'Open'}</b>
              </header>
              {holder ? (
                <div className={`na-act${draggingId === holder.id ? ' is-dragging' : ''}`} onPointerDown={(event) => onDrag(holder, event)}>
                  <span className="na-grip">⋮⋮</span>
                  <b>{initials(actName(holder))}</b>
                  <span><strong>{actName(holder)}</strong><small>{fitLine(holder, id, ordered)}</small></span>
                  {canUpdate && <AssignMenu label="Change ▾" app={holder} slot={slot} ordered={ordered} unassigned={unassigned} accepted={applications.filter(isAccepted)} onAssign={onAssign} mode="change" />}
                </div>
              ) : (
                <>
                  {withdrew && <p className="na-withdrew">{actName(withdrew)} withdrew, so this set is open again.</p>}
                  <div className="na-drop">Drag an act here</div>
                  {canUpdate && <AssignMenu label="Assign ▾" slot={slot} ordered={ordered} unassigned={unassigned} onAssign={onAssign} mode="assign" />}
                </>
              )}
              {!holder && preferrers > 0 && (
                <footer>{preferrers} waiting {preferrers === 1 ? 'applicant prefers' : 'applicants prefer'} this set
                  <button type="button" onClick={() => onSee(id)}>See them</button>
                </footer>
              )}
              {index < ordered.length - 1 && <em className="na-break">Break</em>}
            </article>
          </div>
        );
      })}
    </div>
  );
}

function CloseCard({ oneSet, allFilled, closed, openSets, waiting, accepted, hide, declineWaiting, setDeclineWaiting, onHide, onClose, onReopen, canUpdate }) {
  if (closed) {
    return (
      <section className="na-card">
        <h2>Applications closed</h2>
        <p>{allFilled ? 'The line-up is set. Nobody new can apply.' : 'Nobody new can apply. You can still accept acts who applied and give them a set.'}</p>
        {canUpdate && <button type="button" className="is-outline" onClick={onReopen}>Reopen applications</button>}
      </section>
    );
  }
  if (allFilled && !hide) {
    return (
      <section className="na-card is-close">
        <h2>{oneSet ? 'Set filled. Close applications now?' : 'All sets filled. Close applications now?'}</h2>
        <p>{waiting ? `${waiting} ${waiting === 1 ? 'act' : 'acts'} still waiting to hear back. Closing stops new applications.` : "Nobody else is waiting. Closing stops new applications and takes the gig off the bar's page."}</p>
        {waiting > 0 && (
          <label><input type="checkbox" checked={declineWaiting} onChange={(event) => setDeclineWaiting(event.target.checked)} /> Send a polite no to the {waiting} still waiting</label>
        )}
        <div className="na-row">
          <button type="button" className="is-dark" disabled={!canUpdate} onClick={() => onClose(declineWaiting)}>Close applications</button>
          <button type="button" onClick={onHide}>Not yet</button>
        </div>
      </section>
    );
  }
  if (!allFilled && accepted > 0) {
    return (
      <section className="na-card">
        <h2>Close applications for the rest?</h2>
        <p>{openSets} {openSets === 1 ? 'set' : 'sets'} still to fill. Closing stops new applications. You can still accept acts already waiting, or give a set to anyone you've accepted.</p>
        {canUpdate && <button type="button" className="is-outline" onClick={() => onClose(false)}>Close applications</button>}
      </section>
    );
  }
  return null;
}

function SoundTechCard({ sound, editing, setEditing, onSave, onRemove, canUpdate }) {
  return (
    <section className="na-card">
      <header className="na-card-head"><h2>Sound tech</h2>{sound && !editing && canUpdate && <button type="button" className="is-outline" onClick={() => setEditing({ ...sound })}>Edit</button>}</header>
      {editing ? (
        <div className="na-form">
          <label>Name<input value={editing.name || ''} onChange={(event) => setEditing({ ...editing, name: event.target.value })} /></label>
          <label>Role<input value={editing.role || 'House engineer'} onChange={(event) => setEditing({ ...editing, role: event.target.value })} /></label>
          <label>Phone<input value={editing.phone || ''} onChange={(event) => setEditing({ ...editing, phone: event.target.value })} /></label>
          <label>Arrives at<input value={editing.arrives || ''} onChange={(event) => setEditing({ ...editing, arrives: event.target.value })} /></label>
          <div className="na-row">
            {sound && <button type="button" className="is-danger" onClick={onRemove}>Remove</button>}
            <button type="button" onClick={() => setEditing(null)}>Cancel</button>
            <button type="button" className="is-dark" disabled={!editing.name?.trim()} onClick={onSave}>Save</button>
          </div>
        </div>
      ) : sound?.name ? (
        <div className="na-tech-row">
          <b>{initials(sound.name)}</b>
          <span><strong>{sound.name}</strong><small>{[sound.role, sound.phone, sound.arrives ? `arrives ${sound.arrives}` : ''].filter(Boolean).join(' · ')}</small></span>
        </div>
      ) : (
        <>
          <p>Nobody added yet. Add who's running the desk so you have their number on the night.</p>
          {canUpdate && <button type="button" className="na-dashed" onClick={() => setEditing({ name: '', role: 'House engineer', phone: '', arrives: '' })}>+ Add sound tech</button>}
        </>
      )}
    </section>
  );
}

function NotesCard({ notes, editing, value, setValue, setEditing, onSave, canUpdate }) {
  return (
    <section className="na-card">
      <header className="na-card-head">
        <div><h2>Notes</h2><small>Only you and your team see these</small></div>
        {notes && !editing && canUpdate && <button type="button" className="is-outline" onClick={() => setEditing(true)}>Edit</button>}
      </header>
      {editing ? (
        <div className="na-form">
          <textarea rows={4} value={value} placeholder="e.g. Load-in through the side gate. Two drinks per act on the house." onChange={(event) => setValue(event.target.value)} />
          <div className="na-row">
            <button type="button" onClick={() => setEditing(false)}>Cancel</button>
            <button type="button" className="is-dark" onClick={onSave}>Save note</button>
          </div>
        </div>
      ) : notes ? <p className="na-notes">{notes}</p> : (
        canUpdate && <button type="button" className="na-dashed" onClick={() => setEditing(true)}>+ Add a note</button>
      )}
    </section>
  );
}
