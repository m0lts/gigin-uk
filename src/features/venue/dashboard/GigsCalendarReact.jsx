import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Calendar from 'react-calendar';
import { format } from 'date-fns';
import 'react-calendar/dist/Calendar.css';
import '@styles/host/gigs-calendar-react.styles.css';
import { getArtistProfileById, getMusicianProfileByMusicianId } from '@services/client-side/artists';
import { getConversationsByParticipantAndGigId } from '@services/client-side/conversations';
import { hasVenuePerm } from '@services/utils/permissions';
import { updateGigDocument } from '@services/api/gigs';
import { postCancellationMessage } from '@services/api/messages';
import Portal from '../../shared/components/Portal';
import { CloseIcon, LinkIcon, NewTabIcon, OptionsIcon, SettingsIcon, EditIcon, CancelIcon, DeleteGigIcon } from '../../shared/ui/extras/Icons';
import { openInNewTab } from '@services/utils/misc';
import { toast } from 'sonner';
import { getArtistCRMEntries } from '@services/client-side/artistCRM';

const WEEKDAY_LABELS = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];

function getDisplayName(applicant, applicantNames) {
  if (!applicant) return null;
  return (
    applicant.profileName ??
    applicant.name ??
    applicant.musicianName ??
    (applicant.id && applicantNames ? applicantNames[applicant.id] : null) ??
    null
  );
}

function getGigCalendarLabel(gig, applicantNames = {}) {
  const isPast = gig.status === 'past';
  const confirmed = gig.applicants?.some((a) => a.status === 'confirmed');
  const timeStr = gig.startTime || '—';

  const hasConfirmedApplicant = !!confirmed;
  const hasRenterName = !!(gig.renterName && String(gig.renterName).trim());
  const isHired = hasConfirmedApplicant || hasRenterName;

  if (isHired) {
    const confirmedApplicants = (gig.applicants || []).filter((a) => a.status === 'confirmed');
    const count = confirmedApplicants.length;
    const title =
      hasRenterName && !hasConfirmedApplicant
        ? String(gig.renterName).trim() || 'Hired'
        : count > 1
          ? `${count} Artists`
          : getDisplayName(confirmedApplicants[0], applicantNames) || 'Artist';
    const status = hasRenterName && !hasConfirmedApplicant ? 'Hired' : 'Confirmed';
    return {
      title,
      time: timeStr,
      status,
      isPast,
    };
  }

  const isRental = gig.itemType === 'venue_hire' || gig.bookingMode === 'rental' || gig.kind === 'Venue Rental';
  return {
    title: isRental ? 'For Hire' : 'Looking for artist',
    time: timeStr,
    status: 'Unbooked',
    isPast,
  };
}

function formatDateKey(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function formatDisplayDate(dateIso) {
  if (!dateIso) return '—';
  const d = new Date(dateIso + 'T12:00:00');
  if (isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });
}

function getPrimaryGig(groupGigs) {
  if (!groupGigs?.length) return null;
  const sorted = [...groupGigs].sort((a, b) => (a.startTime || '').localeCompare(b.startTime || ''));
  return sorted[0];
}

/** True if this gig/item is a venue hire (rental or venue hire opportunity from venueHireOpportunities). */
function isVenueHireRental(gig) {
  if (!gig) return false;
  return gig.itemType === 'venue_hire' || gig.kind === 'Venue Rental' || gig.bookingMode === 'rental';
}

/** True if this gig is a venue hire (rental) with a confirmed hirer (renterName set). */
function isConfirmedVenueHire(gig) {
  if (!gig) return false;
  const hasRenter = !!(gig.renterName && String(gig.renterName).trim());
  return isVenueHireRental(gig) && hasRenter;
}

/** True if this gig is a venue hire (rental) but not yet confirmed (no hirer or hirer not confirmed). */
function isUnconfirmedVenueHire(gig) {
  return isVenueHireRental(gig) && !isConfirmedVenueHire(gig);
}

/** True if this gig is an artist booking (book and pay artist(s)), not venue hire. */
function isArtistBooking(gig) {
  return !isVenueHireRental(gig);
}

/**
 * Whether the booking is linked to a Gigin account/thread (vs manually entered).
 * Uses existing data: conversation exists for this gig + venue user.
 */
async function isBookedViaGigin(gigId, userId) {
  if (!gigId || !userId) return { bookedViaGigin: false, conversation: null };
  const convs = await getConversationsByParticipantAndGigId(gigId, userId);
  const conversation = convs.length > 0 ? convs[0] : null;
  return { bookedViaGigin: !!conversation, conversation };
}

function formatHireDateLine(dateIso, startTime, endTimeOrDuration) {
  if (!dateIso) return '—';
  const d = new Date(dateIso + 'T12:00:00');
  if (isNaN(d.getTime())) return '—';
  const dateStr = format(d, 'EEE d MMM');
  if (!startTime) return dateStr;
  let endTime = endTimeOrDuration;
  if (typeof endTimeOrDuration === 'number') {
    const [h, m] = (startTime || '0:0').split(':').map(Number);
    const totalMins = h * 60 + m + endTimeOrDuration;
    const eh = Math.floor(totalMins / 60) % 24;
    const em = totalMins % 60;
    endTime = `${String(eh).padStart(2, '0')}:${String(em).padStart(2, '0')}`;
  }
  return endTime ? `${dateStr} • ${startTime}–${endTime}` : `${dateStr} • ${startTime}`;
}

export function GigsCalendarReact({
  gigs = [],
  onDeleteGigs,
  onDeleteHireOpportunities,
  onAddGigForDate,
  venues = [],
  user,
  refreshGigs,
  copyToClipboard,
  setAddGigsEditData,
  setShowAddGigsModal,
  setShowInvitesModal,
  setSelectedGigForInvites,
}) {
  const navigate = useNavigate();
  const [value, setValue] = useState(new Date());
  const [applicantNames, setApplicantNames] = useState({});
  const [pendingDeleteGigIds, setPendingDeleteGigIds] = useState(null);
  const [pendingDeleteHireIds, setPendingDeleteHireIds] = useState(null);
  const [selectedGigDetail, setSelectedGigDetail] = useState(null);
  const [detailNotesValue, setDetailNotesValue] = useState('');
  const [detailSoundManagerValue, setDetailSoundManagerValue] = useState('');
  const [detailEditingNotes, setDetailEditingNotes] = useState(false);
  const [detailEditingSoundManager, setDetailEditingSoundManager] = useState(false);
  /** For confirmed venue hire popup: conversation if booked via Gigin. */
  const [hireConversation, setHireConversation] = useState(null);
  const [hireConversationLoading, setHireConversationLoading] = useState(false);
  /** Cancel booking confirm: show modal, notify booker checkbox. */
  const [hireCancelConfirm, setHireCancelConfirm] = useState(null);
  const [hireCancelNotifyBooker, setHireCancelNotifyBooker] = useState(true);
  /** Overflow menu (⋯) in venue hire popup header. */
  const [hireMoreMenuOpen, setHireMoreMenuOpen] = useState(false);
  /** Unconfirmed venue hire: delete confirm (gigId or null). */
  const [unconfirmedHireDeleteConfirm, setUnconfirmedHireDeleteConfirm] = useState(null);
  /** CRM entries for resolving performer names and Add performers picker. */
  const [hireCrmEntries, setHireCrmEntries] = useState([]);
  const [hireCrmEntriesLoading, setHireCrmEntriesLoading] = useState(false);
  /** Add performers modal: text input + optional CRM list. */
  const [showAddPerformersModal, setShowAddPerformersModal] = useState(false);
  const [addPerformerQuery, setAddPerformerQuery] = useState('');
  const [addPerformerShowCrmList, setAddPerformerShowCrmList] = useState(false);
  const [addPerformerSelectedIds, setAddPerformerSelectedIds] = useState([]);
  const [addPerformerSaving, setAddPerformerSaving] = useState(false);
  /** For dates with multiple gigs: which pill index is shown (0-based). Key = dateKey (yyyy-mm-dd). */
  const [visiblePillIndexByDate, setVisiblePillIndexByDate] = useState({});
  const hireMoreMenuRef = useRef(null);

  const gigsByDate = useMemo(() => {
    const flat = Array.isArray(gigs)
      ? gigs.flatMap((g) => {
          const list = g.allGigs ? g.allGigs : [g.primaryGig || g];
          const groupKey = g.primaryGig?.gigId ?? g.allGigs?.[0]?.gigId ?? list[0]?.gigId;
          return list.map((gig) => (gig ? { ...gig, _groupKey: groupKey } : null)).filter(Boolean);
        })
      : [];
    const byDate = {};
    flat.forEach((gig) => {
      const iso = gig.dateIso;
      if (!iso) return;
      if (!byDate[iso]) byDate[iso] = [];
      byDate[iso].push(gig);
    });
    return byDate;
  }, [gigs]);

  // Fetch profile names for confirmed single-artist applicants that don't have a name on the gig
  const applicantIdsToFetch = useMemo(() => {
    const flat = Array.isArray(gigs) ? gigs.flatMap((g) => (g.allGigs ? g.allGigs : [g.primaryGig || g])) : [];
    const ids = new Set();
    flat.forEach((gig) => {
      const confirmedApplicants = (gig.applicants || []).filter((a) => a.status === 'confirmed');
      if (confirmedApplicants.length !== 1 || !confirmedApplicants[0]?.id) return;
      const a = confirmedApplicants[0];
      if (a.profileName ?? a.name ?? a.musicianName) return;
      ids.add(a.id);
    });
    return Array.from(ids);
  }, [gigs]);

  useEffect(() => {
    if (applicantIdsToFetch.length === 0) return;
    let cancelled = false;
    (async () => {
      const next = {};
      for (const id of applicantIdsToFetch) {
        if (cancelled) return;
        let profile = await getArtistProfileById(id);
        if (!profile) profile = await getMusicianProfileByMusicianId(id);
        const name = profile?.name ?? null;
        if (name) next[id] = name;
      }
      if (!cancelled) setApplicantNames((prev) => ({ ...prev, ...next }));
    })();
    return () => { cancelled = true; };
  }, [applicantIdsToFetch]);

  // When opening a confirmed venue hire popup, resolve whether it's booked via Gigin.
  useEffect(() => {
    if (!selectedGigDetail?.primaryGig || !isConfirmedVenueHire(selectedGigDetail.primaryGig) || !user?.uid) {
      setHireConversation(null);
      setHireConversationLoading(false);
      setHireCancelConfirm(null);
      return;
    }
    const primaryGig = selectedGigDetail.primaryGig;
    setHireConversationLoading(true);
    setHireConversation(null);
    let cancelled = false;
    isBookedViaGigin(primaryGig.gigId, user.uid).then(({ conversation }) => {
      if (!cancelled) {
        setHireConversation(conversation);
        setHireConversationLoading(false);
      }
    });
    return () => { cancelled = true; };
  }, [selectedGigDetail?.primaryGig?.gigId, user?.uid]);

  // Load CRM entries for venue hire popup (performer names + Add performers picker).
  useEffect(() => {
    const primaryGig = selectedGigDetail?.primaryGig;
    if (!primaryGig || !isConfirmedVenueHire(primaryGig) || !user?.uid) {
      setHireCrmEntries([]);
      setShowAddPerformersModal(false);
      return;
    }
    let cancelled = false;
    setHireCrmEntriesLoading(true);
    getArtistCRMEntries(user.uid)
      .then((entries) => { if (!cancelled) setHireCrmEntries(entries || []); })
      .catch(() => { if (!cancelled) setHireCrmEntries([]); })
      .finally(() => { if (!cancelled) setHireCrmEntriesLoading(false); });
    return () => { cancelled = true; };
  }, [selectedGigDetail?.primaryGig?.gigId, user?.uid]);

  useEffect(() => {
    if (!hireMoreMenuOpen) return;
    const handleClickOutside = (e) => {
      if (hireMoreMenuRef.current?.contains(e.target)) return;
      setHireMoreMenuOpen(false);
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [hireMoreMenuOpen]);

  const formatShortWeekday = (_, date) => WEEKDAY_LABELS[date.getDay()];

  const tileContent = ({ date }) => {
    const dateKey = formatDateKey(date);
    const dayGigs = gigsByDate[dateKey] || [];
    // Collapse multiple past unbooked slots from the same gig into one "Unbooked" pill
    const byGroup = new Map();
    dayGigs.forEach((gig) => {
      const key = gig._groupKey ?? gig.gigId;
      if (!byGroup.has(key)) byGroup.set(key, []);
      byGroup.get(key).push(gig);
    });
    const pills = [];
    byGroup.forEach((groupGigs, groupKey) => {
      const allPastUnbooked =
        groupGigs.length > 1 &&
        groupGigs.every(
          (g) => g.status === 'past' && !(g.applicants || []).some((a) => a.status === 'confirmed')
        );
      const primaryGig = getPrimaryGig(groupGigs);
      if (allPastUnbooked) {
        const n = groupGigs.length;
        const isRental = primaryGig?.itemType === 'venue_hire' || primaryGig?.bookingMode === 'rental' || primaryGig?.kind === 'Venue Rental';
        const title = isRental
          ? (n > 1 ? `For hire (0/${n})` : 'For Hire')
          : (n > 1 ? `Looking for artists (0/${n})` : 'Looking for artist');
        pills.push({
          key: `group-${groupKey}`,
          title,
          time: '',
          status: 'Unbooked',
          isPast: true,
          gigIds: groupGigs.map((g) => g.gigId),
          primaryGig,
          allGigs: groupGigs,
        });
      } else if (groupGigs.length > 1) {
        // Multiple sets (same gig group): one pill for the whole group; show first set's start time only
        const confirmedCount = groupGigs.filter((g) => (g.applicants || []).some((a) => a.status === 'confirmed')).length;
        const totalCount = groupGigs.length;
        const unbookedCount = totalCount - confirmedCount;
        const allConfirmed = confirmedCount === totalCount;
        const title =
          allConfirmed
            ? `${totalCount} Artists`
            : unbookedCount === 1
              ? 'Looking for Artist'
              : 'Looking for Artists';
        const status = `${confirmedCount}/${totalCount} Booked`;
        pills.push({
          key: `group-${groupKey}`,
          title,
          time: primaryGig?.startTime || '—',
          status,
          isAllConfirmed: allConfirmed,
          isPast: groupGigs[0]?.status === 'past',
          primaryGig,
          allGigs: groupGigs,
        });
      } else {
        const gig = groupGigs[0];
        const { title, time, status, isPast } = getGigCalendarLabel(gig, applicantNames);
        const isPastUnbooked = isPast && status === 'Unbooked';
        const isVenueHire = gig.itemType === 'venue_hire';
        pills.push({
          key: gig.gigId ?? gig.hireSpaceId,
          title,
          time,
          status,
          isPast,
          gigIds: isPastUnbooked ? [gig.gigId ?? gig.hireSpaceId] : undefined,
          itemType: isVenueHire ? 'venue_hire' : undefined,
          primaryGig: gig,
          allGigs: [gig],
        });
      }
    });

    // Merge multiple unbooked pills on this day into one "Looking for artists (0/N)"
    const unbookedPills = pills.filter((p) => p.status === 'Unbooked');
    const confirmedPills = pills.filter((p) => p.status !== 'Unbooked');
    const finalPills =
      unbookedPills.length > 1
        ? [
            ...confirmedPills,
            {
              key: 'unbooked-merged',
              title: `Looking for artists (0/${unbookedPills.length})`,
              time: unbookedPills[0].time,
              status: 'Unbooked',
              isPast: unbookedPills[0].isPast,
              gigIds: unbookedPills[0].isPast ? unbookedPills.flatMap((p) => p.gigIds || (p.primaryGig ? [p.primaryGig.gigId] : [])) : undefined,
              primaryGig: unbookedPills[0].primaryGig,
              allGigs: unbookedPills.flatMap((p) => p.allGigs || []),
            },
          ]
        : pills;

    const hasMultiplePills = finalPills.length > 1;
    const currentIndex = hasMultiplePills
      ? Math.min(Math.max(visiblePillIndexByDate[dateKey] ?? 0, 0), finalPills.length - 1)
      : 0;
    const pillsToShow = hasMultiplePills ? [finalPills[currentIndex]] : finalPills;

    return (
      <>
        {hasMultiplePills && (
          <div className="gigs-calendar-react__day-gig-nav" onClick={(e) => e.stopPropagation()}>
            {currentIndex > 0 && (
              <button
                type="button"
                className="gigs-calendar-react__day-gig-nav-btn gigs-calendar-react__day-gig-nav-btn--prev"
                aria-label="Previous gig"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  setVisiblePillIndexByDate((prev) => ({
                    ...prev,
                    [dateKey]: currentIndex - 1,
                  }));
                }}
              >
                ‹
              </button>
            )}
            <span className="gigs-calendar-react__day-gig-nav-label">
              {currentIndex + 1}/{finalPills.length}
            </span>
            {currentIndex < finalPills.length - 1 && (
              <button
                type="button"
                className="gigs-calendar-react__day-gig-nav-btn gigs-calendar-react__day-gig-nav-btn--next"
                aria-label="Next gig"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  setVisiblePillIndexByDate((prev) => ({
                    ...prev,
                    [dateKey]: currentIndex + 1,
                  }));
                }}
              >
                ›
              </button>
            )}
          </div>
        )}
        <div className={`gigs-calendar-react__day-gigs ${hasMultiplePills ? 'gigs-calendar-react__day-gigs--has-nav' : ''}`}>
          {pillsToShow.map((pill) => (
            <div
              key={pill.key}
              role="button"
              tabIndex={0}
              className={`gigs-calendar-react__day-gig ${((pill.status === 'Confirmed' || pill.status === 'Hired') || pill.isAllConfirmed) ? 'gigs-calendar-react__day-gig--confirmed' : ''} ${pill.isPast ? 'gigs-calendar-react__day-gig--past' : ''} ${pill.isPast && pill.status === 'Unbooked' ? 'gigs-calendar-react__day-gig--past-unbooked' : ''} ${pill.gigIds?.length ? 'gigs-calendar-react__day-gig--deletable' : ''} gigs-calendar-react__day-gig--clickable`}
              onClick={(e) => {
                e.stopPropagation();
                if (e.target.closest('.gigs-calendar-react__day-gig-delete')) return;
                if (pill.primaryGig) {
                  setDetailNotesValue(pill.primaryGig.notes || '');
                  setDetailSoundManagerValue(pill.primaryGig.soundManager || '');
                  setDetailEditingNotes(false);
                  setDetailEditingSoundManager(false);
                  setSelectedGigDetail({ primaryGig: pill.primaryGig, allGigs: pill.allGigs });
                }
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  e.stopPropagation();
                  if (e.target.closest('.gigs-calendar-react__day-gig-delete')) return;
                  if (pill.primaryGig) {
                    setDetailNotesValue(pill.primaryGig.notes || '');
                    setDetailSoundManagerValue(pill.primaryGig.soundManager || '');
                    setDetailEditingNotes(false);
                    setDetailEditingSoundManager(false);
                    setSelectedGigDetail({ primaryGig: pill.primaryGig, allGigs: pill.allGigs });
                  }
                }
              }}
            >
              {pill.isPast && pill.status === 'Unbooked' ? (
                /* Past unbooked: single line (time • Unbooked), vertically centred */
                <div className="gigs-calendar-react__day-gig-meta gigs-calendar-react__day-gig-meta--only">
                  {pill.time !== '—' && pill.time ? `${pill.time} • ` : ''}{pill.status}
                </div>
              ) : (
                <>
                  {/* Line 1 (primary, bold): artist name / "X Artists" / "Looking for artist" */}
                  <div className="gigs-calendar-react__day-gig-title">{pill.title}</div>
                  {/* Line 2 (secondary, lighter): time • status */}
                  <div className="gigs-calendar-react__day-gig-meta">
                    {pill.time !== '—' && pill.time ? `${pill.time} • ` : ''}{pill.status}
                  </div>
                </>
              )}
              {pill.gigIds?.length && (onDeleteGigs || onDeleteHireOpportunities) && (
                <span
                  role="button"
                  tabIndex={0}
                  className="gigs-calendar-react__day-gig-delete"
                  aria-label={pill.itemType === 'venue_hire' ? 'Delete venue hire' : 'Delete gig'}
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    if (pill.itemType === 'venue_hire') {
                      setPendingDeleteHireIds(pill.gigIds);
                    } else {
                      setPendingDeleteGigIds(pill.gigIds);
                    }
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      e.stopPropagation();
                      if (pill.itemType === 'venue_hire') {
                        setPendingDeleteHireIds(pill.gigIds);
                      } else {
                        setPendingDeleteGigIds(pill.gigIds);
                      }
                    }
                  }}
                >
                  ×
                </span>
              )}
            </div>
          ))}
        </div>
        <span className="gigs-calendar-react__day-add-wrap">
          <span
            role="button"
            tabIndex={0}
            className="gigs-calendar-react__day-add"
            aria-label="Add gig"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              onAddGigForDate?.(dateKey);
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                e.stopPropagation();
                onAddGigForDate?.(dateKey);
              }
            }}
          >
            +
          </span>
        </span>
      </>
    );
  };

  return (
    <div className="gigs-calendar-react">
      <Calendar
        value={value}
        onChange={setValue}
        locale="en-GB"
        minDetail="month"
        maxDetail="month"
        prev2Label={null}
        next2Label={null}
        showFixedNumberOfWeeks={false}
        formatShortWeekday={formatShortWeekday}
        tileContent={tileContent}
      />
      {pendingDeleteGigIds && (
        <Portal>
          <div
            className="modal cancel-gig"
            onClick={() => setPendingDeleteGigIds(null)}
            role="dialog"
            aria-modal="true"
            aria-labelledby="remove-unbooked-gig-title"
          >
            <div className="modal-content" onClick={(e) => e.stopPropagation()}>
              <h3 id="remove-unbooked-gig-title">Do you want to remove this unbooked gig?</h3>
              <div className="two-buttons" style={{ marginTop: '1rem' }}>
                <button type="button" className="btn tertiary" onClick={() => setPendingDeleteGigIds(null)}>No</button>
                <button type="button" className="btn danger" onClick={() => { onDeleteGigs?.(pendingDeleteGigIds); setPendingDeleteGigIds(null); }}>Yes</button>
              </div>
            </div>
          </div>
        </Portal>
      )}
      {pendingDeleteHireIds && (
        <Portal>
          <div
            className="modal cancel-gig"
            onClick={() => setPendingDeleteHireIds(null)}
            role="dialog"
            aria-modal="true"
            aria-labelledby="remove-hire-title"
          >
            <div className="modal-content" onClick={(e) => e.stopPropagation()}>
              <h3 id="remove-hire-title">Do you want to remove this venue hire opportunity?</h3>
              <div className="two-buttons" style={{ marginTop: '1rem' }}>
                <button type="button" className="btn tertiary" onClick={() => setPendingDeleteHireIds(null)}>No</button>
                <button type="button" className="btn danger" onClick={() => { onDeleteHireOpportunities?.(pendingDeleteHireIds); setPendingDeleteHireIds(null); }}>Yes</button>
              </div>
            </div>
          </div>
        </Portal>
      )}
      {selectedGigDetail && (() => {
        const { primaryGig, allGigs } = selectedGigDetail;
        const showVenueHirePopup = isConfirmedVenueHire(primaryGig) || isUnconfirmedVenueHire(primaryGig);
        const isConfirmedHire = isConfirmedVenueHire(primaryGig);
        const hasRenter = !!(primaryGig.renterName && String(primaryGig.renterName).trim());
        const applicantCount = allGigs.reduce((sum, g) => sum + (g.applicants?.length || 0), 0);
        const canUpdate = hasVenuePerm(venues, primaryGig.venueId, 'gigs.update');
        const gigLink = `${typeof window !== 'undefined' ? window.location.origin : ''}/gig/${primaryGig.gigId}`;
        const openFullScreen = () => {
          setSelectedGigDetail(null);
          navigate('/venues/dashboard/gigs/gig-applications', { state: { gig: primaryGig } });
        };
        const endTime = primaryGig.rentalHardCurfew || (primaryGig.startTime && primaryGig.duration != null
            ? (() => {
              const [h, m] = primaryGig.startTime.split(':').map(Number);
              const totalMins = h * 60 + (m || 0) + primaryGig.duration;
              const eh = Math.floor(totalMins / 60) % 24;
              const em = totalMins % 60;
              return `${String(eh).padStart(2, '0')}:${String(em).padStart(2, '0')}`;
            })()
            : null);

        if (showVenueHirePopup) {
          const bookedViaGigin = isConfirmedHire && !!hireConversation;
          const handleCancelBooking = async () => {
            if (!hireCancelConfirm || !canUpdate) return;
            try {
              if (bookedViaGigin && hireCancelNotifyBooker && hireConversation?.id) {
                await postCancellationMessage({
                  conversationId: hireConversation.id,
                  senderId: user.uid,
                  message: 'This venue hire booking has been cancelled. The slot is now available again.',
                  cancellingParty: 'venue',
                });
              }
              await updateGigDocument({
                gigId: primaryGig.gigId,
                action: 'gigs.update',
                updates: { renterName: null, status: 'open' },
              });
              toast.success('Booking cancelled.');
              setHireCancelConfirm(null);
              setSelectedGigDetail(null);
              refreshGigs?.();
            } catch (err) {
              console.error(err);
              toast.error('Failed to cancel booking.');
            }
          };

          const handleAddExistingPerformer = async (crmEntry) => {
            if (!crmEntry?.id) return;
            if (!canUpdate) {
              toast.error("You don't have permission to update this gig.");
              return;
            }
            const current = primaryGig.bookedPerformerIds || [];
            if (current.includes(crmEntry.id)) {
              toast.info('That performer is already on the gig.');
              return;
            }
            setAddPerformerSaving(true);
            try {
              await updateGigDocument({
                gigId: primaryGig.gigId,
                action: 'gigs.update',
                updates: { bookedPerformerIds: [...current, crmEntry.id] },
              });
              setSelectedGigDetail((prev) => prev ? { ...prev, primaryGig: { ...prev.primaryGig, bookedPerformerIds: [...(prev.primaryGig.bookedPerformerIds || []), crmEntry.id] } } : null);
              refreshGigs?.();
              toast.success(`Added ${crmEntry.name || 'performer'}.`);
              setAddPerformerQuery('');
            } catch (err) {
              console.error(err);
              toast.error('Failed to add performer.');
            } finally {
              setAddPerformerSaving(false);
            }
          };

          const availableCrmEntries = hireCrmEntries.filter((e) => !(primaryGig.bookedPerformerIds || []).includes(e.id));
          const queryLower = (addPerformerQuery || '').trim().toLowerCase();
          const filteredCrmEntries = queryLower
            ? availableCrmEntries.filter((e) => (e.name || '').toLowerCase().includes(queryLower))
            : availableCrmEntries;

          const handleAddFromTextBox = async () => {
            const name = (addPerformerQuery || '').trim();
            if (!name || !canUpdate) return;
            const currentNames = primaryGig.bookedPerformerNames || [];
            if (currentNames.includes(name)) {
              toast.info('That performer is already on the gig.');
              return;
            }
            setAddPerformerSaving(true);
            try {
              const newNames = [...currentNames, name];
              await updateGigDocument({
                gigId: primaryGig.gigId,
                action: 'gigs.update',
                updates: { bookedPerformerNames: newNames },
              });
              setSelectedGigDetail((prev) => prev ? { ...prev, primaryGig: { ...prev.primaryGig, bookedPerformerNames: newNames } } : null);
              refreshGigs?.();
              toast.success(`Added ${name}.`);
              closeAddPerformersModal();
            } catch (err) {
              console.error(err);
              toast.error('Failed to add performer.');
            } finally {
              setAddPerformerSaving(false);
            }
          };

          const handleAddSelectedFromCrmList = async () => {
            if (addPerformerSelectedIds.length === 0 || !canUpdate) return;
            const current = primaryGig.bookedPerformerIds || [];
            const newIds = [...new Set([...current, ...addPerformerSelectedIds])];
            setAddPerformerSaving(true);
            try {
              await updateGigDocument({
                gigId: primaryGig.gigId,
                action: 'gigs.update',
                updates: { bookedPerformerIds: newIds },
              });
              setSelectedGigDetail((prev) => prev ? { ...prev, primaryGig: { ...prev.primaryGig, bookedPerformerIds: newIds } } : null);
              refreshGigs?.();
              const n = addPerformerSelectedIds.length;
              toast.success(n === 1 ? 'Added 1 performer.' : `Added ${n} performers.`);
              closeAddPerformersModal();
            } catch (err) {
              console.error(err);
              toast.error('Failed to add performers.');
            } finally {
              setAddPerformerSaving(false);
            }
          };

          const toggleCrmListSelection = (entryId) => {
            setAddPerformerSelectedIds((prev) =>
              prev.includes(entryId) ? prev.filter((id) => id !== entryId) : [...prev, entryId]
            );
          };

          const closeAddPerformersModal = () => {
            setShowAddPerformersModal(false);
            setAddPerformerQuery('');
            setAddPerformerShowCrmList(false);
            setAddPerformerSelectedIds([]);
          };

          const performerIds = primaryGig.bookedPerformerIds || [];
          const crmNames = performerIds
            .map((id) => hireCrmEntries.find((e) => e.id === id)?.name)
            .filter(Boolean);
          const manualNames = primaryGig.bookedPerformerNames || [];
          const performerNames = [...crmNames, ...manualNames];
          const hasMorePerformers = performerNames.length > 3;
          const showPerformerNames = performerNames.slice(0, 3);

          const handleInviteToApply = () => {
            setHireMoreMenuOpen(false);
            setSelectedGigDetail(null);
            setSelectedGigForInvites?.(primaryGig);
            setShowInvitesModal?.(true);
          };
          const handleConfirmBooking = async () => {
            if (!canUpdate) return;
            try {
              await updateGigDocument({
                gigId: primaryGig.gigId,
                action: 'gigs.update',
                updates: {
                  rentalStatus: 'confirmed_renter',
                  renterName: (primaryGig.renterName && String(primaryGig.renterName).trim()) || undefined,
                },
              });
              toast.success('Booking confirmed.');
              setSelectedGigDetail(null);
              refreshGigs?.();
            } catch (err) {
              console.error(err);
              toast.error('Failed to confirm booking.');
            }
          };
          const handleUnconfirmedDelete = () => {
            const id = primaryGig?.hireSpaceId ?? primaryGig?.gigId;
            if (!id) return;
            if (primaryGig?.itemType === 'venue_hire') {
              onDeleteHireOpportunities?.([id]);
            } else {
              onDeleteGigs?.([primaryGig.gigId]);
            }
            setUnconfirmedHireDeleteConfirm(null);
            setSelectedGigDetail(null);
            refreshGigs?.();
          };

          return (
            <Portal>
              <div
                className="modal cancel-gig gigs-calendar-react__gig-detail-modal gigs-calendar-react__venue-hire-modal"
                onClick={() => { setHireCancelConfirm(null); setUnconfirmedHireDeleteConfirm(null); setSelectedGigDetail(null); }}
                role="dialog"
                aria-modal="true"
                aria-labelledby="venue-hire-modal-title"
              >
                <div className="modal-content" onClick={(e) => e.stopPropagation()}>
                  <header className="gigs-calendar-react__venue-hire-header">
                    <h2 id="venue-hire-modal-title" className="gigs-calendar-react__venue-hire-title">Venue hire</h2>
                    <div className="gigs-calendar-react__venue-hire-header-right" ref={hireMoreMenuRef}>
                      <button
                        type="button"
                        className="gigs-calendar-react__venue-hire-more-btn gigs-calendar-react__venue-hire-options-btn"
                        onClick={() => setHireMoreMenuOpen((v) => !v)}
                        aria-haspopup="true"
                        aria-expanded={hireMoreMenuOpen}
                        aria-label="Options"
                      >
                        <SettingsIcon /> Options
                      </button>
                      {hireMoreMenuOpen && (
                        <div className="gigs-calendar-react__venue-hire-more-menu">
                          <button
                            type="button"
                            className="gigs-calendar-react__venue-hire-more-menu-item"
                            onClick={() => {
                              setHireMoreMenuOpen(false);
                              openInNewTab(`/gig/${primaryGig.gigId}?venue=${primaryGig.venueId}`);
                            }}
                          >
                            View gig <NewTabIcon />
                          </button>
                          {canUpdate && (
                            <button
                              type="button"
                              className="gigs-calendar-react__venue-hire-more-menu-item"
                              onClick={() => {
                                setHireMoreMenuOpen(false);
                                setAddGigsEditData?.(primaryGig);
                                setShowAddGigsModal?.(true);
                                setSelectedGigDetail(null);
                              }}
                            >
                              Edit gig details <EditIcon />
                            </button>
                          )}
                          {isConfirmedHire ? (
                            <button
                              type="button"
                              className="gigs-calendar-react__venue-hire-more-menu-item gigs-calendar-react__venue-hire-more-menu-item--danger"
                              onClick={() => {
                                setHireMoreMenuOpen(false);
                                setHireCancelConfirm({ primaryGig, bookedViaGigin });
                              }}
                            >
                              Cancel gig <CancelIcon />
                            </button>
                          ) : (
                            <button
                              type="button"
                              className="gigs-calendar-react__venue-hire-more-menu-item gigs-calendar-react__venue-hire-more-menu-item--danger"
                              onClick={() => {
                                setHireMoreMenuOpen(false);
                                setUnconfirmedHireDeleteConfirm(primaryGig.gigId);
                              }}
                            >
                              Delete gig <DeleteGigIcon />
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  </header>
                  <p className="gigs-calendar-react__venue-hire-datetime">
                    {formatHireDateLine(primaryGig.dateIso, primaryGig.rentalAccessFrom || primaryGig.startTime, primaryGig.rentalHardCurfew || (primaryGig.duration != null ? primaryGig.duration : endTime))}
                  </p>

                  <section className="gigs-calendar-react__venue-hire-section">
                    <h4 className="gigs-calendar-react__venue-hire-section-title">Booked by</h4>
                    <div className="gigs-calendar-react__venue-hire-booked-row">
                      <p className="gigs-calendar-react__venue-hire-booked-name">
                        {isConfirmedHire
                          ? ((primaryGig.renterName && String(primaryGig.renterName).trim()) || '—')
                          : hasRenter
                            ? (primaryGig.renterName && String(primaryGig.renterName).trim()) || '—'
                            : 'No hirer yet'}
                      </p>
                      <span className={`gigs-calendar-react__venue-hire-status-pill gigs-calendar-react__venue-hire-status-pill--${isConfirmedHire ? 'confirmed' : hasRenter ? 'ready' : 'available'}`}>
                        {isConfirmedHire ? 'Confirmed' : hasRenter ? 'Ready to confirm' : 'Available'}
                      </span>
                    </div>
                    {isConfirmedHire && (primaryGig.depositPaid === true || primaryGig.depositPaid === false || (primaryGig.depositStatus && ['paid', 'unpaid'].includes(primaryGig.depositStatus))) && (
                      <p className="gigs-calendar-react__venue-hire-deposit-status">
                        Deposit: {primaryGig.depositStatus === 'paid' || primaryGig.depositPaid === true ? 'Paid' : 'Unpaid'}
                      </p>
                    )}
                  </section>

                  {!hasRenter ? (
                    <div className="gigs-calendar-react__venue-hire-section gigs-calendar-react__venue-hire-body-actions">
                      <button type="button" className="btn secondary gigs-calendar-react__venue-hire-invite-btn" onClick={handleInviteToApply}>
                        Invite to apply
                      </button>
                    </div>
                  ) : (
                    <section className="gigs-calendar-react__venue-hire-section">
                      <h4 className="gigs-calendar-react__venue-hire-section-title">Performers</h4>
                      {performerNames.length === 0 ? (
                        <p className="gigs-calendar-react__venue-hire-performers-empty">No performers added</p>
                      ) : (
                        <p className="gigs-calendar-react__venue-hire-performers-list">
                          {showPerformerNames.join(', ')}
                          {hasMorePerformers && <span className="gigs-calendar-react__venue-hire-performers-more"> +{performerNames.length - 3} more</span>}
                        </p>
                      )}
                      {isConfirmedHire && (
                        <button
                          type="button"
                          className="btn tertiary gigs-calendar-react__venue-hire-add-performers-btn"
                          onClick={() => { setShowAddPerformersModal(true); setAddPerformerQuery(''); setAddPerformerShowCrmList(false); setAddPerformerSelectedIds([]); }}
                        >
                          + Add performers
                        </button>
                      )}
                    </section>
                  )}

                  <footer className="gigs-calendar-react__venue-hire-footer">
                    {isConfirmedHire ? (
                      <button type="button" className="btn primary gigs-calendar-react__venue-hire-open-booking-btn" onClick={openFullScreen}>
                        View full details
                      </button>
                    ) : hasRenter ? (
                      <>
                        <button type="button" className="btn primary gigs-calendar-react__venue-hire-open-booking-btn" onClick={handleConfirmBooking}>
                          Confirm booking
                        </button>
                        <button type="button" className="btn secondary" onClick={handleInviteToApply}>
                          Invite to apply
                        </button>
                      </>
                    ) : (
                      <button type="button" className="btn primary gigs-calendar-react__venue-hire-open-booking-btn" onClick={openFullScreen}>
                        View full details
                      </button>
                    )}
                  </footer>
                </div>
              </div>

              {hireCancelConfirm && (
                <Portal>
                  <div
                    className="modal cancel-gig"
                    onClick={() => setHireCancelConfirm(null)}
                    role="dialog"
                    aria-modal="true"
                  >
                    <div className="modal-content" onClick={(e) => e.stopPropagation()}>
                      <h3>Cancel booking?</h3>
                      {hireCancelConfirm.bookedViaGigin && (
                        <label className="gigs-calendar-react__venue-hire-cancel-notify">
                          <input
                            type="checkbox"
                            checked={hireCancelNotifyBooker}
                            onChange={(e) => setHireCancelNotifyBooker(e.target.checked)}
                          />
                          <span>Notify booker</span>
                        </label>
                      )}
                      <div className="two-buttons" style={{ marginTop: '1rem' }}>
                        <button type="button" className="btn tertiary" onClick={() => setHireCancelConfirm(null)}>Keep booking</button>
                        <button type="button" className="btn danger" onClick={handleCancelBooking}>Cancel booking</button>
                      </div>
                    </div>
                  </div>
                </Portal>
              )}

              {unconfirmedHireDeleteConfirm && (
                <Portal>
                  <div
                    className="modal cancel-gig"
                    onClick={() => setUnconfirmedHireDeleteConfirm(null)}
                    role="dialog"
                    aria-modal="true"
                  >
                    <div className="modal-content" onClick={(e) => e.stopPropagation()}>
                      <h3>Delete this gig?</h3>
                      <p>This slot will be removed. This action cannot be undone.</p>
                      <div className="two-buttons" style={{ marginTop: '1rem' }}>
                        <button type="button" className="btn tertiary" onClick={() => setUnconfirmedHireDeleteConfirm(null)}>Keep</button>
                        <button type="button" className="btn danger" onClick={handleUnconfirmedDelete}>Delete</button>
                      </div>
                    </div>
                  </div>
                </Portal>
              )}

              {showAddPerformersModal && (
                <Portal>
                  <div
                    className="modal cancel-gig gigs-calendar-react__add-performers-modal"
                    onClick={closeAddPerformersModal}
                    role="dialog"
                    aria-modal="true"
                    aria-labelledby="add-performers-title"
                  >
                    <div className="modal-content" onClick={(e) => e.stopPropagation()}>
                      <div className="gigs-calendar-react__add-performers-header" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
                        <h3 id="add-performers-title" style={{ margin: 0 }}>Add performers</h3>
                        <button
                          type="button"
                          className="btn icon gigs-calendar-react__add-performers-close-btn"
                          onClick={closeAddPerformersModal}
                          aria-label="Close"
                        >
                          <CloseIcon />
                        </button>
                      </div>
                      <div className="gigs-calendar-react__add-performers-search-wrap">
                        <input
                          type="text"
                          className="input gigs-calendar-react__add-performers-input"
                          value={addPerformerQuery}
                          onChange={(e) => setAddPerformerQuery(e.target.value)}
                          placeholder="Type artist name"
                          id="add-performers-search"
                        />
                      </div>
                      <div className="gigs-calendar-react__add-performers-actions" style={{ marginTop: '1rem', display: 'flex', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'center' }}>
                        <button
                          type="button"
                          className="btn secondary"
                          onClick={() => setAddPerformerShowCrmList((v) => !v)}
                        >
                          {addPerformerShowCrmList ? 'Hide CRM list' : 'Add from CRM list'}
                        </button>
                        {(addPerformerQuery || '').trim() && (
                          <button
                            type="button"
                            className="btn primary"
                            onClick={handleAddFromTextBox}
                            disabled={addPerformerSaving}
                            style={{ marginLeft: 'auto' }}
                          >
                            Add to gig
                          </button>
                        )}
                      </div>
                      {addPerformerShowCrmList && (
                        <div className="gigs-calendar-react__add-performers-crm-list-wrap" style={{ marginTop: '1rem' }}>
                          {hireCrmEntriesLoading ? (
                            <p className="gigs-calendar-react__add-performers-muted">Loading…</p>
                          ) : filteredCrmEntries.length === 0 ? (
                            <p className="gigs-calendar-react__add-performers-muted">
                              {availableCrmEntries.length === 0 && hireCrmEntries.length > 0
                                ? 'All CRM artists are already added.'
                                : 'No artists in CRM yet.'}
                            </p>
                          ) : (
                            <>
                              <p className="gigs-calendar-react__add-performers-muted" style={{ marginBottom: '0.5rem' }}>
                                Select one or more, then click Add to gig.
                              </p>
                              <ul className="gigs-calendar-react__add-performers-list">
                                {filteredCrmEntries.map((entry) => (
                                  <li key={entry.id}>
                                    <button
                                      type="button"
                                      className={`btn secondary gigs-calendar-react__add-performers-list-btn${addPerformerSelectedIds.includes(entry.id) ? ' gigs-calendar-react__add-performers-list-btn--selected' : ''}`}
                                      onClick={() => toggleCrmListSelection(entry.id)}
                                      disabled={addPerformerSaving}
                                    >
                                      {entry.name || 'Unknown'}
                                    </button>
                                  </li>
                                ))}
                              </ul>
                              {addPerformerSelectedIds.length > 0 && (
                                <div style={{ marginTop: '0.75rem' }}>
                                  <button
                                    type="button"
                                    className="btn primary"
                                    onClick={handleAddSelectedFromCrmList}
                                    disabled={addPerformerSaving}
                                  >
                                    Add to gig ({addPerformerSelectedIds.length})
                                  </button>
                                </div>
                              )}
                            </>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                </Portal>
              )}
            </Portal>
          );
        }

        if (isArtistBooking(primaryGig)) {
          const handleInviteArtist = () => {
            setSelectedGigDetail(null);
            setSelectedGigForInvites?.(primaryGig);
            setShowInvitesModal?.(true);
          };
          const handleArtistPrivateToggle = async (e) => {
            if (!canUpdate) return;
            const newPrivate = e.target.checked;
            try {
              await Promise.all(
                allGigs.map((g) =>
                  updateGigDocument({
                    gigId: g.gigId,
                    action: 'gigs.update',
                    updates: { private: newPrivate },
                  })
                )
              );
              toast.success(`Applications ${newPrivate ? 'Invite only' : 'Public'}.`);
              refreshGigs?.();
              setSelectedGigDetail((prev) =>
                prev ? { ...prev, primaryGig: { ...prev.primaryGig, private: newPrivate } } : null
              );
            } catch (err) {
              console.error(err);
              toast.error('Failed to update.');
            }
          };
          const confirmedArtists = allGigs.flatMap((g) =>
            (g.applicants || []).filter((a) => a.status === 'confirmed' || a.status === 'paid').map((a) => a.name || a.profileName || 'Artist')
          );
          const rawFee = primaryGig.budget ?? '';
          const feeDisplay = (typeof rawFee === 'string' && rawFee.trim() === '') || rawFee === '£'
            ? 'No fee set'
            : (rawFee || 'No fee set');
          const isInviteOnly = !!primaryGig.private;

          return (
            <Portal>
              <div
                className="modal cancel-gig gigs-calendar-react__gig-detail-modal gigs-calendar-react__artist-booking-modal"
                onClick={() => setSelectedGigDetail(null)}
                role="dialog"
                aria-modal="true"
                aria-labelledby="artist-booking-modal-title"
              >
                <div className="modal-content" onClick={(e) => e.stopPropagation()}>
                  <h2 id="artist-booking-modal-title" className="gigs-calendar-react__venue-hire-title">
                    {primaryGig.gigName || 'Gig'}
                  </h2>
                  <p className="gigs-calendar-react__venue-hire-datetime">
                    {formatDisplayDate(primaryGig.dateIso)}
                    {primaryGig.startTime ? ` · ${primaryGig.startTime}` : ''}
                    {primaryGig.duration != null ? ` · ${primaryGig.duration} min` : ''}
                  </p>

                  <section className="gigs-calendar-react__venue-hire-section">
                    <h4 className="gigs-calendar-react__venue-hire-section-title">Artist(s)</h4>
                    <p className="gigs-calendar-react__gig-detail-value">
                      {confirmedArtists.length > 0 ? confirmedArtists.join(', ') : 'No artists confirmed yet'}
                    </p>
                  </section>

                  <section className="gigs-calendar-react__venue-hire-section">
                    <h4 className="gigs-calendar-react__venue-hire-section-title">Fee</h4>
                    <p className="gigs-calendar-react__gig-detail-value">{feeDisplay}</p>
                  </section>

                  <section className="gigs-calendar-react__venue-hire-section">
                    <h4 className="gigs-calendar-react__venue-hire-section-title">Open for applications</h4>
                    {canUpdate ? (
                      <div className="gigs-calendar-react__artist-booking-visibility">
                        <span className={`gigs-calendar-react__artist-booking-visibility-option ${!isInviteOnly ? 'gigs-calendar-react__artist-booking-visibility-option--active' : ''}`}>
                          Yes
                        </span>
                        <div className="gigs-toggle-container gigs-calendar-react__artist-booking-visibility-toggle">
                          <label className="gigs-toggle-switch">
                            <input
                              type="checkbox"
                              checked={isInviteOnly}
                              onChange={handleArtistPrivateToggle}
                            />
                            <span className="gigs-toggle-slider" />
                          </label>
                        </div>
                        <span className={`gigs-calendar-react__artist-booking-visibility-option ${isInviteOnly ? 'gigs-calendar-react__artist-booking-visibility-option--active' : ''}`}>
                          Invite-only
                        </span>
                      </div>
                    ) : (
                      <p className="gigs-calendar-react__gig-detail-value">{isInviteOnly ? 'Invite-only' : 'Yes'}</p>
                    )}
                  </section>

                  <footer className="gigs-calendar-react__venue-hire-footer">
                    {canUpdate && (
                      <button type="button" className="btn secondary" onClick={handleInviteArtist}>
                        Invite artist
                      </button>
                    )}
                    <button type="button" className="btn primary gigs-calendar-react__venue-hire-open-booking-btn" onClick={openFullScreen}>
                      View full details
                    </button>
                  </footer>
                </div>
              </div>
            </Portal>
          );
        }

        const handleSaveNotes = async () => {
          if (!canUpdate) return;
          try {
            await Promise.all(
              allGigs.map((g) =>
                updateGigDocument({
                  gigId: g.gigId,
                  action: 'gigs.update',
                  updates: { notes: detailNotesValue.trim() || null },
                })
              )
            );
            toast.success('Notes updated.');
            setDetailEditingNotes(false);
            refreshGigs?.();
          } catch (err) {
            console.error(err);
            toast.error('Failed to update notes.');
          }
        };
        const handleSaveSoundManager = async () => {
          if (!canUpdate) return;
          try {
            await Promise.all(
              allGigs.map((g) =>
                updateGigDocument({
                  gigId: g.gigId,
                  action: 'gigs.update',
                  updates: { soundManager: detailSoundManagerValue.trim() || null },
                })
              )
            );
            toast.success('Sound manager updated.');
            setDetailEditingSoundManager(false);
            refreshGigs?.();
          } catch (err) {
            console.error(err);
            toast.error('Failed to update sound manager.');
          }
        };
        const handlePrivateToggle = async (e) => {
          if (!canUpdate) return;
          const newPrivate = e.target.checked;
          try {
            await Promise.all(
              allGigs.map((g) =>
                updateGigDocument({
                  gigId: g.gigId,
                  action: 'gigs.update',
                  updates: { private: newPrivate },
                })
              )
            );
            toast.success(`Gig changed to ${newPrivate ? 'Invite Only' : 'Public'}.`);
            refreshGigs?.();
            setSelectedGigDetail((prev) =>
              prev ? { ...prev, primaryGig: { ...prev.primaryGig, private: newPrivate } } : null
            );
          } catch (err) {
            console.error(err);
            toast.error('Failed to update.');
          }
        };
        return (
          <Portal>
            <div
              className="modal cancel-gig gigs-calendar-react__gig-detail-modal"
              onClick={() => setSelectedGigDetail(null)}
              role="dialog"
              aria-modal="true"
              aria-labelledby="gig-detail-title"
            >
              <div className="modal-content" onClick={(e) => e.stopPropagation()}>
                <h3 id="gig-detail-title" className="gigs-calendar-react__gig-detail-title">
                  {primaryGig.gigName || 'Gig'}
                </h3>
                <div className="gigs-calendar-react__gig-detail-grid">
                  <div className="gigs-calendar-react__gig-detail-row">
                    <span className="gigs-calendar-react__gig-detail-label">Date</span>
                    <span>{formatDisplayDate(primaryGig.dateIso)}</span>
                  </div>
                  <div className="gigs-calendar-react__gig-detail-row">
                    <span className="gigs-calendar-react__gig-detail-label">Start time</span>
                    <span>{primaryGig.startTime || '—'}</span>
                  </div>
                  <div className="gigs-calendar-react__gig-detail-row">
                    <span className="gigs-calendar-react__gig-detail-label">Duration</span>
                    <span>{primaryGig.duration != null ? `${primaryGig.duration} min` : '—'}</span>
                  </div>
                </div>
                <div className="gigs-calendar-react__gig-detail-actions">
                  <button
                    type="button"
                    className="btn primary"
                    onClick={openFullScreen}
                  >
                    {applicantCount === 0
                      ? 'View gig'
                      : applicantCount === 1
                        ? '1 Applicant'
                        : `${applicantCount} Applicants`}
                  </button>
                  <button
                    type="button"
                    className="btn secondary"
                    onClick={openFullScreen}
                    title="Open gig applications full screen"
                  >
                    <NewTabIcon /> Open full screen
                  </button>
                </div>
                <div className="gigs-calendar-react__gig-detail-section">
                  <h4 className="gigs-calendar-react__gig-detail-section-title">Notes</h4>
                  {detailEditingNotes ? (
                    <div className="gigs-calendar-react__gig-detail-edit">
                      <textarea
                        className="input"
                        value={detailNotesValue}
                        onChange={(e) => setDetailNotesValue(e.target.value)}
                        rows={3}
                      />
                      <div className="gigs-calendar-react__gig-detail-edit-actions">
                        <button type="button" className="btn tertiary" onClick={() => setDetailEditingNotes(false)}>
                          Cancel
                        </button>
                        <button type="button" className="btn primary" onClick={handleSaveNotes}>
                          Save
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div
                      className={`gigs-calendar-react__gig-detail-box ${canUpdate ? 'gigs-calendar-react__gig-detail-box--editable' : ''}`}
                      onClick={() => canUpdate && setDetailEditingNotes(true)}
                    >
                      {detailNotesValue || '—'}
                      {canUpdate && <span className="gigs-calendar-react__gig-detail-hint">Click to edit</span>}
                    </div>
                  )}
                </div>
                <div className="gigs-calendar-react__gig-detail-section">
                  <h4 className="gigs-calendar-react__gig-detail-section-title">Sound manager</h4>
                  {detailEditingSoundManager ? (
                    <div className="gigs-calendar-react__gig-detail-edit">
                      <textarea
                        className="input"
                        value={detailSoundManagerValue}
                        onChange={(e) => setDetailSoundManagerValue(e.target.value)}
                        rows={2}
                      />
                      <div className="gigs-calendar-react__gig-detail-edit-actions">
                        <button type="button" className="btn tertiary" onClick={() => setDetailEditingSoundManager(false)}>
                          Cancel
                        </button>
                        <button type="button" className="btn primary" onClick={handleSaveSoundManager}>
                          Save
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div
                      className={`gigs-calendar-react__gig-detail-box ${canUpdate ? 'gigs-calendar-react__gig-detail-box--editable' : ''}`}
                      onClick={() => canUpdate && setDetailEditingSoundManager(true)}
                    >
                      {detailSoundManagerValue || '—'}
                      {canUpdate && <span className="gigs-calendar-react__gig-detail-hint">Click to edit</span>}
                    </div>
                  )}
                </div>
                <div className="gigs-calendar-react__gig-detail-section">
                  <h4 className="gigs-calendar-react__gig-detail-section-title">Gig link</h4>
                  <div className="gigs-calendar-react__gig-detail-link-row">
                    <span className="gigs-calendar-react__gig-detail-link">{gigLink}</span>
                    <button
                      type="button"
                      className="btn icon"
                      onClick={() => copyToClipboard?.(gigLink)}
                      title="Copy link"
                    >
                      <LinkIcon />
                    </button>
                  </div>
                </div>
                <div className="gigs-calendar-react__gig-detail-section">
                  <div className="gigs-calendar-react__gig-detail-invite-row">
                    <span className="gigs-calendar-react__gig-detail-label">Invite only</span>
                    <label className="gigs-toggle-switch">
                      <input
                        type="checkbox"
                        checked={primaryGig.private || false}
                        disabled={!canUpdate}
                        onChange={handlePrivateToggle}
                      />
                      <span className="gigs-toggle-slider" />
                    </label>
                  </div>
                </div>
                <div className="two-buttons" style={{ marginTop: '1rem' }}>
                  <button type="button" className="btn tertiary" onClick={() => setSelectedGigDetail(null)}>
                    Close
                  </button>
                  <button type="button" className="btn primary" onClick={openFullScreen}>
                    Open gig applications full screen
                  </button>
                </div>
              </div>
            </div>
          </Portal>
        );
      })()}
    </div>
  );
}
