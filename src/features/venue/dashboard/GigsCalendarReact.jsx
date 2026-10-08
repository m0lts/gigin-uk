import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import '@styles/host/gigs-calendar-react.styles.css';
import { getArtistProfileById, getMusicianProfileByMusicianId } from '@services/client-side/artists';
import { getConversationsByParticipantAndGigId } from '@services/client-side/conversations';
import { hasVenuePerm } from '@services/utils/permissions';
import { updateGigDocument } from '@services/api/gigs';
import { postCancellationMessage } from '@services/api/messages';
import Portal from '../../shared/components/Portal';
import { InviteAndShareModal } from '../components/InviteAndShareModal';
import { FillThisSlotModal } from '../components/FillThisSlotModal';
import { openInNewTab } from '@services/utils/misc';
import { toast } from 'sonner';
import { gigCreationClosed, NIGHTS_CLOSED_MESSAGE } from '../../../config/venueAccess';
import { CalendarHeader } from './calendar/CalendarHeader';
import { CalendarSidePanel } from './calendar/CalendarSidePanel';
import { MonthView } from './calendar/MonthView';
import { SeasonView, emptyRegularNights } from './calendar/SeasonView';
import { WeekView } from './calendar/WeekView';
import { filterCounts, formatDateKey, gigsInRange, rangeTitle, stepCursor } from './calendar/calendarRange';
import { presentGig } from './calendar/gigPresent';

const ARTIST_SEEN_KEY = 'gigin-artist-gig-pending-seen';

function useNarrow() {
  const [narrow, setNarrow] = useState(() => (
    typeof window !== 'undefined' && window.matchMedia('(max-width: 767.98px)').matches
  ));
  useEffect(() => {
    const query = window.matchMedia('(max-width: 767.98px)');
    const sync = () => setNarrow(query.matches);
    sync();
    query.addEventListener('change', sync);
    return () => query.removeEventListener('change', sync);
  }, []);
  return narrow;
}

export function GigsCalendarReact({
  gigs = [],
  onDeleteGigs,
  onDeleteHireOpportunities,
  onAddGigForDate,
  onEditGig,
  onRequestConfirm,
  venues = [],
  user,
  refreshGigs,
  copyToClipboard,
  children,
}) {
  const navigate = useNavigate();
  const narrow = useNarrow();
  const [searchParams, setSearchParams] = useSearchParams();
  const [cursorDate, setCursorDate] = useState(() => new Date());
  const [now, setNow] = useState(() => new Date());
  const [selectedId, setSelectedId] = useState(null);
  const [copied, setCopied] = useState(false);
  const [applicantNames, setApplicantNames] = useState({});
  const [hireApplicationCounts, setHireApplicationCounts] = useState({});
  const [hireConversation, setHireConversation] = useState(null);
  const [hireCancelConfirm, setHireCancelConfirm] = useState(null);
  const [hireCancelNotifyBooker, setHireCancelNotifyBooker] = useState(true);
  const [pendingDeleteGigIds, setPendingDeleteGigIds] = useState(null);
  const [pendingDeleteHireIds, setPendingDeleteHireIds] = useState(null);
  const [inviteShareGig, setInviteShareGig] = useState(null);
  const [regularNights, setRegularNights] = useState([4, 5, 6]);
  const nightsSeeded = useRef(false);
  const copyTimer = useRef(null);

  const calParam = searchParams.get('cal');
  const urlView = calParam === 'week' || calParam === 'season' ? calParam : 'month';
  const view = narrow ? 'month' : urlView;
  const statusParam = searchParams.get('status');
  const filter = statusParam === 'attention' || statusParam === 'awaiting' || statusParam === 'confirmed'
    ? statusParam
    : 'all';

  const setQueryParam = (key, nextValue) => {
    const next = new URLSearchParams(searchParams);
    if (nextValue) next.set(key, nextValue);
    else next.delete(key);
    setSearchParams(next);
  };

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 30000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    if (nightsSeeded.current) return;
    const stored = venues.find((venue) => Array.isArray(venue?.regularNights) && venue.regularNights.length)?.regularNights;
    if (!stored) return;
    setRegularNights(stored.map(Number));
    nightsSeeded.current = true;
  }, [venues]);

  const applicantIdsToFetch = useMemo(() => {
    const ids = new Set();
    gigs.forEach((group) => {
      const slots = group.allGigs?.length ? group.allGigs : [group.primaryGig].filter(Boolean);
      slots.forEach((slot) => {
        (slot?.applicants || []).forEach((applicant) => {
          if (!applicant?.id) return;
          if (applicant.profileName || applicant.name || applicant.musicianName || applicant.artistName) return;
          ids.add(applicant.id);
        });
      });
    });
    return Array.from(ids);
  }, [gigs]);

  useEffect(() => {
    if (applicantIdsToFetch.length === 0) return undefined;
    let cancelled = false;
    (async () => {
      const next = {};
      for (const id of applicantIdsToFetch) {
        if (cancelled) return;
        let profile = await getArtistProfileById(id);
        if (!profile) profile = await getMusicianProfileByMusicianId(id);
        if (profile?.name) next[id] = profile.name;
      }
      if (!cancelled) setApplicantNames((prev) => ({ ...prev, ...next }));
    })();
    return () => { cancelled = true; };
  }, [applicantIdsToFetch]);

  const unbookedHireIds = useMemo(() => {
    const ids = new Set();
    gigs.forEach((group) => {
      const primary = group.primaryGig;
      if (!primary || primary.itemType !== 'venue_hire') return;
      if (primary.renterName && String(primary.renterName).trim()) return;
      const id = primary.gigId ?? primary.hireSpaceId;
      if (id) ids.add(id);
    });
    return Array.from(ids);
  }, [gigs]);

  useEffect(() => {
    if (unbookedHireIds.length === 0 || !user?.uid) return undefined;
    let cancelled = false;
    (async () => {
      const next = {};
      for (const hireId of unbookedHireIds) {
        if (cancelled) return;
        const conversations = await getConversationsByParticipantAndGigId(hireId, user.uid);
        next[hireId] = (conversations || []).length;
      }
      if (!cancelled) setHireApplicationCounts((prev) => ({ ...prev, ...next }));
    })();
    return () => { cancelled = true; };
  }, [unbookedHireIds, user?.uid]);

  const presented = useMemo(
    () => gigs.map((group) => presentGig(group, { applicantNames, now, hireApplicationCounts })),
    [gigs, applicantNames, now, hireApplicationCounts],
  );
  const rangeGigs = useMemo(() => {
    const ids = new Set(gigsInRange(gigs, view, cursorDate).map((group) => String(group.primaryGig?.gigId || group.primaryGig?.hireSpaceId || '')));
    return presented.filter((gig) => ids.has(gig.id));
  }, [gigs, presented, view, cursorDate]);
  const counts = useMemo(() => filterCounts(gigs, view, cursorDate, now), [gigs, view, cursorDate, now]);
  const selected = presented.find((gig) => gig.id === selectedId) || null;
  const actions = rangeGigs.filter((gig) => gig.needsAction).sort((a, b) => a.dateIso.localeCompare(b.dateIso) || a.start.localeCompare(b.start));
  const emptyNights = useMemo(
    () => (view === 'season' ? emptyRegularNights(cursorDate, presented, regularNights, now) : []),
    [view, cursorDate, presented, regularNights, now],
  );

  useEffect(() => {
    const primary = selected?.group?.primaryGig;
    const confirmedHire = selected?.hire && !!(primary?.renterName && String(primary.renterName).trim());
    if (!confirmedHire || !user?.uid || !primary?.gigId) {
      setHireConversation(null);
      return undefined;
    }
    let cancelled = false;
    getConversationsByParticipantAndGigId(primary.gigId, user.uid).then((conversations) => {
      if (!cancelled) setHireConversation(conversations?.[0] || null);
    });
    return () => { cancelled = true; };
  }, [selected?.id, selected?.hire, selected?.group?.primaryGig?.gigId, selected?.group?.primaryGig?.renterName, user?.uid]);

  const selectGig = (gig, jump) => {
    setSelectedId(gig.id);
    if (jump && (view === 'week' || view === 'month') && gig.dateIso) {
      const [year, month, day] = gig.dateIso.split('-').map(Number);
      setCursorDate(new Date(year, month - 1, day));
    }
  };

  const venueId = selected?.group?.primaryGig?.venueId;
  const canUpdate = hasVenuePerm(venues, venueId, 'gigs.update');
  const canInvite = hasVenuePerm(venues, venueId, 'gigs.invite');
  const canCreate = hasVenuePerm(venues, venueId, 'gigs.create');

  const openGig = () => {
    if (!selected) return;
    const primary = selected.group.primaryGig;
    const slots = selected.group.allGigs?.length ? selected.group.allGigs : [primary];
    const pending = slots.reduce((sum, slot) => sum + (slot.applicants || []).filter((applicant) => applicant?.status === 'pending').length, 0);
    const groupKey = primary._groupKey ?? primary.gigId ?? selected.id;
    if (typeof localStorage !== 'undefined' && groupKey) {
      localStorage.setItem(`${ARTIST_SEEN_KEY}-${groupKey}`, String(pending));
    }
    const linkedGigIds = slots.length > 1 ? [...new Set(slots.map((slot) => slot?.gigId).filter(Boolean))] : null;
    navigate('/venues/dashboard/gigs/gig-applications', {
      state: { gig: primary, ...(linkedGigIds?.length > 1 ? { linkedGigIds } : {}) },
    });
  };

  const copyLink = () => {
    const gigId = selected?.group?.primaryGig?.gigId;
    if (!gigId) return;
    const link = `${window.location.origin}/gig/${gigId}`;
    copyToClipboard?.(link);
    setCopied(true);
    clearTimeout(copyTimer.current);
    copyTimer.current = setTimeout(() => setCopied(false), 1400);
  };

  const saveField = async (field, value) => {
    if (!selected || !canUpdate) return;
    const slots = selected.group.allGigs?.length ? selected.group.allGigs : [selected.group.primaryGig];
    const key = field === 'notes' ? 'notes' : 'soundManager';
    try {
      await Promise.all(slots.filter((slot) => slot?.gigId).map((slot) => updateGigDocument({
        gigId: slot.gigId,
        action: 'gigs.update',
        updates: { [key]: value.trim() || null },
      })));
      toast.success(key === 'notes' ? 'Notes updated.' : 'Sound manager updated.');
      refreshGigs?.();
    } catch (error) {
      console.error(error);
      toast.error('Failed to update.');
    }
  };

  const setPrivate = async (nextPrivate) => {
    if (!selected || !canUpdate) return;
    const slots = selected.group.allGigs?.length ? selected.group.allGigs : [selected.group.primaryGig];
    try {
      await Promise.all(slots.filter((slot) => slot?.gigId).map((slot) => updateGigDocument({
        gigId: slot.gigId,
        action: 'gigs.update',
        updates: { private: nextPrivate },
      })));
      toast.success(nextPrivate ? 'Invite only' : 'Public');
      refreshGigs?.();
    } catch (error) {
      console.error(error);
      toast.error('Failed to update.');
    }
  };

  const gigIds = () => {
    const slots = selected?.group?.allGigs?.length ? selected.group.allGigs : [selected?.group?.primaryGig];
    return slots.map((slot) => slot?.gigId).filter(Boolean);
  };

  const requestDelete = () => {
    if (!selected) return;
    const primary = selected.group.primaryGig;
    const ids = gigIds();
    if (primary?.itemType === 'venue_hire') {
      const hireId = primary.hireSpaceId ?? primary.gigId;
      if (hireId) setPendingDeleteHireIds([hireId]);
      return;
    }
    if (ids.length) setPendingDeleteGigIds(ids);
  };

  const requestCancel = () => {
    if (!selected || !canUpdate) return;
    if (selected.hire) {
      setHireCancelConfirm({ bookedViaGigin: !!hireConversation });
      return;
    }
    if (selected.booking === 'confirmed' && onRequestConfirm) {
      onRequestConfirm('cancel', gigIds());
    }
  };

  const cancelHireBooking = async () => {
    const primary = selected?.group?.primaryGig;
    if (!hireCancelConfirm || !primary?.gigId || !canUpdate) return;
    try {
      if (hireCancelConfirm.bookedViaGigin && hireCancelNotifyBooker && hireConversation?.id) {
        await postCancellationMessage({
          conversationId: hireConversation.id,
          senderId: user.uid,
          message: 'This venue hire booking has been cancelled. The slot is now available again.',
          cancellingParty: 'venue',
        });
      }
      await updateGigDocument({
        gigId: primary.gigId,
        action: 'gigs.update',
        updates: { renterName: null, status: 'open' },
      });
      toast.success('Booking cancelled.');
      setHireCancelConfirm(null);
      refreshGigs?.();
    } catch (error) {
      console.error(error);
      toast.error('Failed to cancel booking.');
    }
  };

  const menuItems = selected ? [
    { label: 'Copy link', onClick: copyLink },
    { label: 'Open in new tab', onClick: () => openInNewTab(`${window.location.origin}/gig/${selected.group.primaryGig.gigId}`) },
    { label: 'Duplicate', disabled: !canCreate, onClick: () => onRequestConfirm?.('duplicate', gigIds()) },
    {
      label: selected.private ? 'Make public' : 'Make invite only',
      disabled: !canUpdate,
      onClick: () => setPrivate(!selected.private),
    },
    { label: 'Cancel gig', disabled: !canUpdate || (!selected.hire && selected.booking !== 'confirmed'), onClick: requestCancel },
    { label: 'Delete', danger: true, onClick: requestDelete },
  ] : [];

  const requestNewGig = (dateIso) => {
    if (gigCreationClosed(venues)) {
      toast.error(NIGHTS_CLOSED_MESSAGE);
      return;
    }
    onAddGigForDate?.(dateIso);
  };

  const viewProps = {
    cursor: cursorDate,
    gigs: presented,
    filter,
    now,
    selectedId,
    onSelect: (gig) => selectGig(gig, false),
    onAdd: requestNewGig,
  };

  return (
    <>
      <div className="gigs-cal">
        <div className="gigs-cal__main">
          <CalendarHeader
            title={rangeTitle(view, cursorDate)}
            view={view}
            filter={filter}
            counts={counts}
            onView={(next) => setQueryParam('cal', next === 'month' ? '' : next)}
            onFilter={(next) => setQueryParam('status', next === 'all' ? '' : next)}
            onPrev={() => setCursorDate((current) => stepCursor(view, current, -1))}
            onNext={() => setCursorDate((current) => stepCursor(view, current, 1))}
            onToday={() => setCursorDate(new Date())}
          />
          {view === 'week' && <WeekView {...viewProps} />}
          {view === 'season' && <SeasonView {...viewProps} regularNights={regularNights} />}
          {view === 'month' && <MonthView {...viewProps} />}
          {children}
        </div>
        <CalendarSidePanel
          view={view}
          rangeGigs={rangeGigs}
          now={now}
          actions={actions}
          emptyNights={emptyNights}
          regularNights={regularNights}
          onToggleNight={(day) => setRegularNights((current) => (
            current.includes(day) ? current.filter((item) => item !== day) : [...current, day]
          ))}
          onAdd={requestNewGig}
          onSelect={selectGig}
          selected={selected}
          onClose={() => setSelectedId(null)}
          copied={copied}
          onCopy={copyLink}
          onOpen={openGig}
          onEdit={() => selected && onEditGig?.(selected.group.primaryGig)}
          onInvite={() => canInvite && setInviteShareGig(selected?.group?.primaryGig)}
          canInvite={canInvite}
          canUpdate={canUpdate}
          menuItems={menuItems}
          onSaveField={saveField}
        />
      </div>
      {pendingDeleteGigIds && (
        <Portal>
          <div className="modal cancel-gig" onClick={() => setPendingDeleteGigIds(null)} role="dialog" aria-modal="true">
            <div className="modal-content" onClick={(event) => event.stopPropagation()}>
              <h3>Do you want to remove this gig?</h3>
              <div className="two-buttons" style={{ marginTop: '1rem' }}>
                <button type="button" className="btn tertiary" onClick={() => setPendingDeleteGigIds(null)}>No</button>
                <button type="button" className="btn danger" onClick={() => { onDeleteGigs?.(pendingDeleteGigIds); setPendingDeleteGigIds(null); setSelectedId(null); }}>Yes</button>
              </div>
            </div>
          </div>
        </Portal>
      )}
      {pendingDeleteHireIds && (
        <Portal>
          <div className="modal cancel-gig" onClick={() => setPendingDeleteHireIds(null)} role="dialog" aria-modal="true">
            <div className="modal-content" onClick={(event) => event.stopPropagation()}>
              <h3>Do you want to remove this venue hire opportunity?</h3>
              <div className="two-buttons" style={{ marginTop: '1rem' }}>
                <button type="button" className="btn tertiary" onClick={() => setPendingDeleteHireIds(null)}>No</button>
                <button type="button" className="btn danger" onClick={() => { onDeleteHireOpportunities?.(pendingDeleteHireIds); setPendingDeleteHireIds(null); setSelectedId(null); }}>Yes</button>
              </div>
            </div>
          </div>
        </Portal>
      )}
      {hireCancelConfirm && (
        <Portal>
          <div className="modal cancel-gig" onClick={() => setHireCancelConfirm(null)} role="dialog" aria-modal="true">
            <div className="modal-content" onClick={(event) => event.stopPropagation()}>
              <h3>Cancel booking?</h3>
              {hireCancelConfirm.bookedViaGigin && (
                <label className="gigs-calendar-react__venue-hire-cancel-notify">
                  <input type="checkbox" checked={hireCancelNotifyBooker} onChange={(event) => setHireCancelNotifyBooker(event.target.checked)} />
                  <span>Notify booker</span>
                </label>
              )}
              <div className="two-buttons" style={{ marginTop: '1rem' }}>
                <button type="button" className="btn tertiary" onClick={() => setHireCancelConfirm(null)}>Keep booking</button>
                <button type="button" className="btn danger" onClick={cancelHireBooking}>Cancel booking</button>
              </div>
            </div>
          </div>
        </Portal>
      )}
      {inviteShareGig && inviteShareGig.itemType === 'venue_hire' && (
        <FillThisSlotModal gig={inviteShareGig} venues={venues} user={user} refreshGigs={refreshGigs} onClose={() => setInviteShareGig(null)} />
      )}
      {inviteShareGig && inviteShareGig.itemType !== 'venue_hire' && (
        <InviteAndShareModal gig={inviteShareGig} venues={venues} user={user} onClose={() => setInviteShareGig(null)} refreshGigs={refreshGigs} />
      )}
    </>
  );
}
