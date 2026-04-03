/**
 * Dedicated page for a single venue hire opportunity.
 * Route: /hire/:docId
 * Data: venueHireOpportunities collection only (no gigs).
 */
import React, { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import '@styles/host/venue-gig-page.styles.css';
import { LoadingScreen } from '@features/shared/ui/loading/LoadingScreen';
import { LeftArrowIcon, LinkIcon, NewTabIcon, SettingsIcon, EditIcon, CancelIcon } from '@features/shared/ui/extras/Icons';
import { useBreakpoint } from '@hooks/useBreakpoint';
import { getVenueHireOpportunityById } from '@services/client-side/venueHireOpportunities';
import { getVenueProfileById } from '@services/client-side/venues';
import { updateVenueHireOpportunity } from '@services/client-side/venueHireOpportunities';
import { hasVenuePerm } from '@services/utils/permissions';
import { openInNewTab } from '@services/utils/misc';
import { toast } from 'sonner';
import { VenueHireDetailsPanel } from '@features/venue/gigs/pages/panels/VenueHireDetailsPanel';
import { BookingSummarySidebar } from '@features/venue/gigs/components/BookingSummarySidebar';
import Portal from '@features/shared/components/Portal';

function toJsDate(v) {
  if (!v) return null;
  if (typeof v?.toDate === 'function') return v.toDate();
  if (v instanceof Date) return v;
  if (typeof v === 'string') return new Date(v);
  if (v?.seconds != null) return new Date(v.seconds * 1000);
  return null;
}

function formatDateLabel(dateObj) {
  if (!dateObj || !(dateObj instanceof Date) || isNaN(dateObj.getTime())) return '—';
  const day = dateObj.getDate();
  const weekday = dateObj.toLocaleDateString('en-GB', { weekday: 'long' });
  const month = dateObj.toLocaleDateString('en-GB', { month: 'long' });
  const suffix = day > 3 && day < 21 ? 'th' : { 1: 'st', 2: 'nd', 3: 'rd' }[day % 10] || 'th';
  return `${weekday} ${day}${suffix} ${month}`;
}

/** Map hire doc to rawGig-like shape for VenueHireDetailsPanel & BookingSummarySidebar */
function mapHireToRawGig(hire) {
  if (!hire) return null;
  const tech = hire.technicalSetup || {};
  return {
    ...hire,
    id: hire.id,
    gigId: hire.id,
    itemType: 'venue_hire',
    renterName: hire.hirerName ?? null,
    rentalStatus: hire.status === 'confirmed' ? 'confirmed_renter' : hire.status,
    accessFrom: hire.accessFrom ?? null,
    curfew: hire.curfew ?? null,
    rentalAccessFrom: hire.accessFrom ?? null,
    rentalHardCurfew: hire.curfew ?? null,
    rentalPaIncluded: tech.paIncluded ?? 'no',
    rentalSoundEngineerIncluded: tech.soundEngineerIncluded ?? 'no',
    rentalDepositRequired: !!hire.depositRequired,
    notesInternal: hire.notesInternal ?? '',
    internalNotes: hire.notesInternal ?? '',
  };
}

/** Build normalised display object for hire (same shape as normaliseGig for venue_hire). */
function buildNormalisedHire(hire) {
  if (!hire) return null;
  const dateObj = toJsDate(hire.date);
  const dateLabel = formatDateLabel(dateObj);
  const timeRangeLabel = [hire.startTime, hire.endTime].filter(Boolean).join(' – ') || '—';
  const base = typeof window !== 'undefined' ? window.location?.origin : '';
  return {
    id: hire.id,
    title: 'Venue hire',
    eventTypeLabel: '—',
    bookingMode: 'venue_hire',
    status: hire.status === 'confirmed' ? 'confirmed' : 'open',
    dateLabel,
    timeRangeLabel,
    fee: hire.hireFee ?? null,
    depositAmount: hire.depositAmount ?? null,
    depositStatus: hire.depositPaid === true ? 'paid' : hire.depositPaid === false ? 'unpaid' : null,
    capacity: hire.capacity != null && hire.capacity !== '' ? String(hire.capacity) : null,
    accessFrom: hire.accessFrom ?? null,
    curfew: hire.curfew ?? null,
    bookedBy: (() => {
      const name = (hire.hirerName && String(hire.hirerName).trim()) || null;
      const fromAcceptedApplication = hire.hirerType === 'gigin_user';
      return {
        type: fromAcceptedApplication ? 'gigin' : 'manual',
        name,
        contactId: null,
        userId: hire.hirerUserId || null,
        subtitle: name && fromAcceptedApplication ? 'On Gigin' : (name ? 'Manually entered' : null),
      };
    })(),
    performers: {
      count: (hire.performers && hire.performers.length) || 0,
      previewNames: (hire.performers || []).map((p) => p.displayName || '').filter(Boolean),
      items: (hire.performers || []).map((p) => ({
        source: p.source || 'manual',
        displayName: p.displayName || '',
        contactId: p.contactId,
        userId: p.userId,
        artistId: p.artistId,
      })),
    },
    links: {
      gigLinkUrl: `${base}/hire/${hire.id}`,
      messagesUrl: null,
    },
  };
}

export function HireOpportunityPage({ user, copyToClipboard }) {
  const { docId } = useParams();
  const navigate = useNavigate();
  const { isMdUp } = useBreakpoint();
  const [hire, setHire] = useState(null);
  const [venueProfile, setVenueProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showOptionsMenu, setShowOptionsMenu] = useState(false);
  const [showCancelConfirm, setShowCancelConfirm] = useState(false);
  const [cancelNotifyBooker, setCancelNotifyBooker] = useState(true);
  const optionsMenuRef = React.useRef(null);

  useEffect(() => {
    if (!docId) return;
    let cancelled = false;
    setLoading(true);
    getVenueHireOpportunityById(docId)
      .then((data) => {
        if (cancelled) return;
        setHire(data);
        if (data?.venueId) {
          return getVenueProfileById(data.venueId).then((venue) => {
            if (!cancelled) setVenueProfile(venue || null);
          });
        }
      })
      .catch((err) => {
        if (!cancelled) {
          console.error(err);
          toast.error('Failed to load hire opportunity.');
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, [docId]);

  useEffect(() => {
    if (!showOptionsMenu) return;
    const handleClickOutside = (e) => {
      if (optionsMenuRef.current && !optionsMenuRef.current.contains(e.target)) setShowOptionsMenu(false);
    };
    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  }, [showOptionsMenu]);

  const rawGig = useMemo(() => mapHireToRawGig(hire), [hire]);
  const normalisedGig = useMemo(() => buildNormalisedHire(hire), [hire]);
  const venues = useMemo(() => (venueProfile ? [{ ...venueProfile, venueId: venueProfile.venueId || venueProfile.id }] : []), [venueProfile]);
  const venueName = venueProfile?.name ?? '';
  const canUpdate = hire?.venueId && hasVenuePerm(venues, hire.venueId, 'gigs.update');
  const hasBooker = !!(hire?.hirerName && String(hire.hirerName).trim());
  const isConfirmed = hire?.status === 'confirmed';

  const refreshHire = () => {
    if (!docId) return;
    getVenueHireOpportunityById(docId).then(setHire);
  };

  const copyHireLink = () => {
    const link = typeof window !== 'undefined' ? `${window.location.origin}/hire/${hire.id}` : '';
    if (link && typeof copyToClipboard === 'function') {
      copyToClipboard(link);
    } else if (link) {
      navigator.clipboard.writeText(link).then(
        () => toast.success('Link copied'),
        () => toast.error('Failed to copy')
      );
    }
  };

  const handleCancelBooking = async () => {
    if (!hire?.id || !canUpdate) return;
    setShowCancelConfirm(false);
    try {
      await updateVenueHireOpportunity(hire.id, { hirerName: null, status: 'available' });
      toast.success('Booking cancelled.');
      refreshHire();
    } catch (err) {
      console.error(err);
      toast.error('Failed to cancel.');
    }
  };

  if (!docId) {
    navigate(-1);
    return null;
  }

  if (loading || !hire) {
    return <LoadingScreen />;
  }

  return (
    <div className="venue-gig-page">
      <div className="venue-gig-page__container">
        <header className="venue-gig-page__header">
          {!isMdUp && (
            <button type="button" className="btn text venue-gig-page__back" onClick={() => navigate(-1)}>
              <LeftArrowIcon /> Back
            </button>
          )}
          <div className="venue-gig-page__header-grid">
            <div className="venue-gig-page__header-left">
              <div className="venue-gig-page__title-row">
                <h1 className="venue-gig-page__title">{normalisedGig?.title ?? 'Venue hire'}</h1>
              </div>
              <p className="venue-gig-page__datetime">
                {normalisedGig?.dateLabel}
                {normalisedGig?.timeRangeLabel ? ` • ${normalisedGig.timeRangeLabel}` : ''}
                {venueName ? ` at ${venueName}` : ''}
              </p>
            </div>
            <div className="venue-gig-page__header-right">
              <div className="venue-gig-page__header-row venue-gig-page__header-row--actions">
                {!hasBooker && (
                  <button type="button" className="btn secondary" onClick={copyHireLink}>
                    <LinkIcon /> Copy link
                  </button>
                )}
                {canUpdate && (
                  <div className="venue-gig-page__options-wrap" ref={optionsMenuRef}>
                    <button
                      type="button"
                      className={`btn secondary venue-gig-page__options-btn ${showOptionsMenu ? 'active' : ''}`}
                      onClick={(e) => { e.stopPropagation(); setShowOptionsMenu((v) => !v); }}
                      aria-label="Options"
                    >
                      <SettingsIcon /> Options
                    </button>
                    {showOptionsMenu && (
                      <div className="venue-gig-page__options-dropdown" onClick={(e) => e.stopPropagation()}>
                        <button
                          type="button"
                          onClick={() => {
                            setShowOptionsMenu(false);
                            openInNewTab(`/hire/${hire.id}`);
                          }}
                        >
                          Open in new tab <NewTabIcon />
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setShowOptionsMenu(false);
                            navigate('/venues/dashboard/gigs');
                          }}
                        >
                          Edit hire details <EditIcon />
                        </button>
                        {isConfirmed && (
                          <button
                            type="button"
                            className="venue-gig-page__options-dropdown-item--danger"
                            onClick={() => { setShowOptionsMenu(false); setShowCancelConfirm(true); }}
                          >
                            Cancel booking <CancelIcon />
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        </header>

        <div className="venue-gig-page__divider" role="presentation" />

        <div className="venue-gig-page__layout">
          <main className="venue-gig-page__main">
            <VenueHireDetailsPanel
              normalisedGig={normalisedGig}
              rawGig={rawGig}
              setGigInfo={setHire}
              venues={venues}
              refreshGigs={refreshHire}
              bookingLinkUrl={typeof window !== 'undefined' && hire?.id ? `${window.location.origin}/hire/${hire.id}` : ''}
              applicationsInviteOnly={!!hire?.private}
            />
          </main>
          <BookingSummarySidebar
            normalisedGig={normalisedGig}
            rawGig={rawGig}
            setGigInfo={setHire}
            refreshGigs={refreshHire}
            venues={venues}
          />
        </div>
      </div>

      {showCancelConfirm && (
        <Portal>
          <div className="modal cancel-gig" onClick={() => setShowCancelConfirm(false)} role="dialog" aria-modal="true">
            <div className="modal-content" onClick={(e) => e.stopPropagation()}>
              <h3>Cancel booking?</h3>
              <p>This slot will become available again.</p>
              <div className="two-buttons" style={{ marginTop: '1rem' }}>
                <button type="button" className="btn tertiary" onClick={() => setShowCancelConfirm(false)}>Keep booking</button>
                <button type="button" className="btn danger" onClick={handleCancelBooking}>Cancel booking</button>
              </div>
            </div>
          </div>
        </Portal>
      )}
    </div>
  );
}
