import React, { useState, useEffect, useMemo } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import '@styles/host/venue-gig-page.styles.css';
import { LoadingScreen } from '@features/shared/ui/loading/LoadingScreen';
import { LeftArrowIcon, LinkIcon, NewTabIcon, InviteIconSolid, SettingsIcon, EditIcon, DeleteGigIcon, CancelIcon } from '@features/shared/ui/extras/Icons';
import { useBreakpoint } from '@hooks/useBreakpoint';
import { getLocalGigDateTime } from '@services/utils/filtering';
import { getGigsByIds } from '@services/client-side/gigs';
import { updateGigDocument } from '@services/api/gigs';
import { updateVenueHireOpportunity } from '@services/client-side/venueHireOpportunities';
import { postCancellationMessage } from '@services/api/messages';
import { getConversationsByParticipantAndGigId } from '@services/client-side/conversations';
import { hasVenuePerm } from '@services/utils/permissions';
import { openInNewTab } from '@services/utils/misc';
import { toast } from 'sonner';
import { normaliseGig } from '../utils/normaliseGig';
import { BookingSummarySidebar } from '../components/BookingSummarySidebar';
import { GigInvitesModal } from '../../components/GigInvitesModal';
import { getMainPanelComponent } from './panels';
import Portal from '@features/shared/components/Portal';

function calculateEndTime(startTime, duration) {
  if (!startTime || duration == null) return null;
  const [h, m] = startTime.split(':').map(Number);
  const totalMins = (h || 0) * 60 + (m || 0) + (duration || 0);
  const eh = Math.floor(totalMins / 60) % 24;
  const em = totalMins % 60;
  return `${String(eh).padStart(2, '0')}:${String(em).padStart(2, '0')}`;
}

async function isBookedViaGigin(gigId, userId) {
  if (!gigId || !userId) return { bookedViaGigin: false, conversation: null };
  const convs = await getConversationsByParticipantAndGigId(gigId, userId);
  const conversation = convs.length > 0 ? convs[0] : null;
  return { bookedViaGigin: !!conversation, conversation };
}

export function VenueGigPageShell({
  gigs,
  venues,
  user,
  refreshGigs,
  setGigPostModal,
  setEditGigData,
  setShowAddGigsModal,
  setAddGigsEditData,
  refreshStripe,
  customerDetails,
  copyToClipboard,
}) {
  const location = useLocation();
  const navigate = useNavigate();
  const { isMdUp } = useBreakpoint();

  const stateGig = location.state?.gig;
  const gigId = stateGig?.gigId || '';
  const isVenueHireFromState = stateGig?.itemType === 'venue_hire';
  const [gigInfo, setGigInfo] = useState(null);
  const [relatedSlots, setRelatedSlots] = useState([]);
  const [showOptionsMenu, setShowOptionsMenu] = useState(false);
  const [showInvitesModal, setShowInvitesModal] = useState(false);
  const [showCancelConfirm, setShowCancelConfirm] = useState(false);
  const [cancelConversation, setCancelConversation] = useState(null);
  const [cancelNotifyBooker, setCancelNotifyBooker] = useState(true);
  const [showInviteToApplyModal, setShowInviteToApplyModal] = useState(false);
  const optionsMenuRef = React.useRef(null);

  // Load gig from list and related slots (or use venue hire from state)
  useEffect(() => {
    if (isVenueHireFromState && stateGig) {
      setGigInfo(stateGig);
      setRelatedSlots([]);
      return;
    }
    if (!gigId || !gigs) return;
    const activeGig = gigs.find((g) => g.gigId === gigId);
    setGigInfo(activeGig || null);
    if (activeGig && Array.isArray(activeGig.gigSlots) && activeGig.gigSlots.length > 0) {
      getGigsByIds(activeGig.gigSlots)
        .then((slotGigs) => {
          setRelatedSlots(
            slotGigs.map((g) => ({ ...g, gigId: g.id || g.gigId }))
          );
        })
        .catch(() => setRelatedSlots([]));
    } else {
      setRelatedSlots([]);
    }
  }, [gigId, gigs, isVenueHireFromState, stateGig]);

  const allSlots = useMemo(() => {
    if (!gigInfo) return [];
    if (!relatedSlots.length) return [gigInfo];
    const sorted = [gigInfo, ...relatedSlots].sort((a, b) => {
      if (!a?.startTime || !b?.startTime) return 0;
      const [aH, aM] = a.startTime.split(':').map(Number);
      const [bH, bM] = b.startTime.split(':').map(Number);
      return aH * 60 + (aM || 0) - (bH * 60 + (bM || 0));
    });
    return sorted;
  }, [gigInfo, relatedSlots]);

  const normalisedGig = useMemo(
    () => (gigInfo ? normaliseGig(gigInfo, { allSlots }) : null),
    [gigInfo, allSlots]
  );

  const copyGigLink = () => {
    const link = normalisedGig?.links?.gigLinkUrl;
    if (link && typeof copyToClipboard === 'function') {
      copyToClipboard(link);
    } else if (link) {
      navigator.clipboard.writeText(link).then(
        () => toast.success('Copied gig link'),
        () => toast.error('Failed to copy')
      );
    }
  };

  useEffect(() => {
    if (!showOptionsMenu) return;
    const handleClickOutside = (e) => {
      if (optionsMenuRef.current && !optionsMenuRef.current.contains(e.target)) {
        setShowOptionsMenu(false);
      }
    };
    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  }, [showOptionsMenu]);

  const hasAnyConfirmed =
    gigInfo &&
    [gigInfo, ...relatedSlots].some((slot) =>
      (slot?.applicants || []).some((a) => ['confirmed', 'paid'].includes(a?.status))
    );
  const isVenueHire = normalisedGig?.bookingMode === 'venue_hire';
  const hasVenueHireBooker = isVenueHire && !!(gigInfo?.renterName && String(gigInfo.renterName).trim());
  const showCancelGigOption = (hasAnyConfirmed || hasVenueHireBooker) && hasVenuePerm(venues, gigInfo?.venueId, 'gigs.update');
  const showDeleteGigOption = !hasAnyConfirmed && !hasVenueHireBooker && hasVenuePerm(venues, gigInfo?.venueId, 'gigs.update');
  // When cancel confirm opens for venue hire, resolve whether booking is via Gigin (for "Notify booker").
  useEffect(() => {
    if (!showCancelConfirm || !isVenueHire || !gigInfo?.gigId || !user?.uid) {
      setCancelConversation(null);
      return;
    }
    let cancelled = false;
    isBookedViaGigin(gigInfo.gigId, user.uid).then(({ conversation }) => {
      if (!cancelled) setCancelConversation(conversation);
    });
    return () => { cancelled = true; };
  }, [showCancelConfirm, isVenueHire, gigInfo?.gigId, user?.uid]);
  const now = useMemo(() => new Date(), []);
  const gigDateTime = gigInfo ? getLocalGigDateTime(gigInfo) : null;
  const venueName = gigInfo?.venue?.venueName || '';

  const handleCancelGig = async () => {
    if (!gigInfo?.gigId || !hasVenuePerm(venues, gigInfo.venueId, 'gigs.update')) return;
    setShowCancelConfirm(false);
    try {
      if (isVenueHire) {
        if (cancelConversation && cancelNotifyBooker && cancelConversation.id) {
          await postCancellationMessage({
            conversationId: cancelConversation.id,
            senderId: user.uid,
            message: 'This venue hire booking has been cancelled. The slot is now available again.',
            cancellingParty: 'venue',
          });
        }
        const hireId = gigInfo.id || gigInfo.gigId;
        await updateVenueHireOpportunity(hireId, { hirerName: null, status: 'available' });
        toast.success('Booking cancelled.');
        refreshGigs?.();
        navigate('/venues/dashboard/gigs', { replace: true });
      } else {
        toast.info('To cancel an artist booking, use the Options menu on the Gigs list.');
        navigate('/venues/dashboard/gigs');
      }
    } catch (err) {
      console.error(err);
      toast.error('Failed to cancel booking.');
    }
  };

  if (!gigId) {
    navigate('/venues/dashboard/gigs', { replace: true });
    return null;
  }

  if (!gigInfo) {
    return <LoadingScreen />;
  }

  const MainPanel = getMainPanelComponent(normalisedGig);
  const isVenueHirePage = normalisedGig.bookingMode === 'venue_hire';
  const isConfirmedVenueHire = isVenueHirePage && normalisedGig.status === 'confirmed';
  const noBookerYet = isVenueHirePage && !hasVenueHireBooker;
  const bookingModeLabel = isVenueHirePage ? 'Venue hire' : 'Artist booking';
  const showEventTypeTag = !isConfirmedVenueHire && normalisedGig.eventTypeLabel && normalisedGig.eventTypeLabel !== '—' && normalisedGig.eventTypeLabel !== bookingModeLabel;
  const hasPublicApplyLink = !gigInfo.private && normalisedGig?.links?.gigLinkUrl;

  return (
    <div className="venue-gig-page">
      <div className="venue-gig-page__container">
        <header className="venue-gig-page__header">
          {!isMdUp && (
            <button
              type="button"
              className="btn text venue-gig-page__back"
              onClick={() => navigate(-1)}
            >
              <LeftArrowIcon /> Back
            </button>
          )}
          <div className="venue-gig-page__header-grid">
            <div className="venue-gig-page__header-left">
              <div className="venue-gig-page__title-row">
                <h1 className="venue-gig-page__title">{normalisedGig.title}</h1>
              </div>
              <p className="venue-gig-page__datetime">
                {normalisedGig.dateLabel}
                {normalisedGig.timeRangeLabel ? ` • ${normalisedGig.timeRangeLabel}` : ''}
                {venueName ? ` at ${venueName}` : ''}
              </p>
            </div>
            <div className="venue-gig-page__header-right">
              {!isConfirmedVenueHire && !noBookerYet && (
                <div className="venue-gig-page__header-row venue-gig-page__header-row--pills">
                  <span className={`venue-gig-page__status-pill venue-gig-page__status-pill--${normalisedGig.status}`}>
                    {normalisedGig.status === 'open' ? 'Open' : normalisedGig.status === 'confirmed' ? 'Confirmed' : normalisedGig.status === 'completed' ? 'Completed' : 'Cancelled'}
                  </span>
                </div>
              )}
              {!isConfirmedVenueHire && !noBookerYet && (
                <div className="venue-gig-page__header-row venue-gig-page__header-row--tags">
                  <span className="venue-gig-page__tag-pill">{bookingModeLabel}</span>
                  {showEventTypeTag && <span className="venue-gig-page__tag-pill venue-gig-page__tag-pill--event">{normalisedGig.eventTypeLabel}</span>}
                </div>
              )}
              <div className="venue-gig-page__header-row venue-gig-page__header-row--actions">
                {isVenueHirePage && !isConfirmedVenueHire && !noBookerYet && (
                  <button
                    type="button"
                    className="btn primary"
                    onClick={() => setShowInviteToApplyModal(true)}
                    title="Invite artists or promoters to apply for this hire"
                  >
                    <InviteIconSolid /> Invite to apply
                  </button>
                )}
                {!isConfirmedVenueHire && !isVenueHirePage && gigInfo.private ? (
                  <button
                    type="button"
                    className="btn primary"
                    disabled={!hasVenuePerm(venues, gigInfo.venueId, 'gigs.invite')}
                    onClick={() => setShowInvitesModal(true)}
                    title="Invite artist"
                  >
                    <InviteIconSolid /> Invite artist
                  </button>
                ) : null}
                {!isConfirmedVenueHire && hasPublicApplyLink && !noBookerYet && (
                  <button type="button" className="btn secondary" onClick={copyGigLink}>
                    <LinkIcon /> Copy link
                  </button>
                )}
                {!noBookerYet && !isConfirmedVenueHire && hasVenuePerm(venues, gigInfo.venueId, 'gigs.update') && (
                  <label className="venue-gig-page__invite-only">
                    <input
                      type="checkbox"
                      checked={!!gigInfo.private}
                      onChange={async (e) => {
                        try {
                          if (isVenueHirePage) {
                            await updateVenueHireOpportunity(gigInfo.id || gigInfo.gigId, { private: e.target.checked });
                          } else {
                            await updateGigDocument({
                              gigId: gigInfo.gigId,
                              action: 'gigs.update',
                              updates: { private: e.target.checked },
                            });
                          }
                          toast.success(`Gig changed to ${e.target.checked ? 'Invite only' : 'Public'}`);
                          refreshGigs?.();
                        } catch (err) {
                          toast.error('Failed to update.');
                        }
                      }}
                    />
                    <span>Invite only</span>
                  </label>
                )}
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
                      <button type="button" onClick={() => { openInNewTab(`/gig/${gigInfo.gigId}?venue=${gigInfo.venueId}`); setShowOptionsMenu(false); }}>
                        View gig <NewTabIcon />
                      </button>
                      {gigDateTime > now && (
                        <>
                          {(!hasAnyConfirmed || hasVenuePerm(venues, gigInfo.venueId, 'gigs.update')) && (
                            <button
                              type="button"
                              onClick={() => {
                                setShowOptionsMenu(false);
                                if (normalisedGig.bookingMode === 'venue_hire') {
                                  setAddGigsEditData?.(gigInfo);
                                  setShowAddGigsModal?.(true);
                                } else {
                                  setEditGigData?.(gigInfo);
                                  setGigPostModal?.(true);
                                }
                              }}
                            >
                              Edit gig details <EditIcon />
                            </button>
                          )}
                          {hasAnyConfirmed && hasVenuePerm(venues, gigInfo.venueId, 'gigs.update') && (
                            <>
                              <button type="button" onClick={() => setShowOptionsMenu(false)}>Edit time <EditIcon /></button>
                              <button type="button" onClick={() => setShowOptionsMenu(false)}>Edit name <EditIcon /></button>
                            </>
                          )}
                          {showCancelGigOption && (
                            <button
                              type="button"
                              onClick={() => {
                                setShowOptionsMenu(false);
                                if (isVenueHire) setShowCancelConfirm(true);
                                else {
                                  toast.info('To cancel an artist booking, use the Options menu on the Gigs list.');
                                  navigate('/venues/dashboard/gigs');
                                }
                              }}
                            >
                              Cancel gig <CancelIcon />
                            </button>
                          )}
                          {showDeleteGigOption && (
                            <button
                              type="button"
                              onClick={() => {
                                setShowOptionsMenu(false);
                                toast.info('To delete this gig, use the Options menu on the Gigs list.');
                                navigate('/venues/dashboard/gigs');
                              }}
                            >
                              Delete gig <DeleteGigIcon />
                            </button>
                          )}
                        </>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </header>

        <div className="venue-gig-page__divider" role="presentation" />

        <div className="venue-gig-page__layout">
          <main className="venue-gig-page__main">
            <div className="venue-gig-page__main-card">
              <MainPanel
            normalisedGig={normalisedGig}
            rawGig={gigInfo}
            setGigInfo={setGigInfo}
            gigs={gigs}
            venues={venues}
            refreshGigs={refreshGigs}
            setGigPostModal={setGigPostModal}
            setEditGigData={setEditGigData}
            refreshStripe={refreshStripe}
            customerDetails={customerDetails}
            copyToClipboard={copyToClipboard}
            showInvitesModal={showInvitesModal}
            setShowInvitesModal={setShowInvitesModal}
            onInviteHirer={noBookerYet ? () => setShowInviteToApplyModal(true) : undefined}
            onCopyBookingLink={noBookerYet ? copyGigLink : undefined}
            applicationsInviteOnly={noBookerYet ? !!gigInfo?.private : undefined}
            onApplicationsVisibilityChange={noBookerYet ? (async (inviteOnly) => {
              try {
                if (isVenueHirePage) {
                  await updateVenueHireOpportunity(gigInfo.id || gigInfo.gigId, { private: inviteOnly });
                } else {
                  await updateGigDocument({
                    gigId: gigInfo.gigId,
                    action: 'gigs.update',
                    updates: { private: inviteOnly },
                  });
                }
                toast.success(`Applications ${inviteOnly ? 'Invite-only' : 'Public'}`);
                refreshGigs?.();
              } catch (err) {
                toast.error('Failed to update.');
              }
            }) : undefined}
            />
            </div>
          </main>
          <BookingSummarySidebar
            normalisedGig={normalisedGig}
            rawGig={gigInfo}
            setGigInfo={setGigInfo}
            refreshGigs={refreshGigs}
            venues={venues}
          />
        </div>
      </div>

      {showCancelConfirm && (
        <Portal>
          <div
            className="modal cancel-gig"
            onClick={() => setShowCancelConfirm(false)}
            role="dialog"
            aria-modal="true"
          >
            <div className="modal-content" onClick={(e) => e.stopPropagation()}>
              <h3>Cancel booking?</h3>
              {cancelConversation && (
                <label className="gigs-calendar-react__venue-hire-cancel-notify">
                  <input
                    type="checkbox"
                    checked={cancelNotifyBooker}
                    onChange={(e) => setCancelNotifyBooker(e.target.checked)}
                  />
                  <span>Notify booker</span>
                </label>
              )}
              <div className="two-buttons" style={{ marginTop: '1rem' }}>
                <button type="button" className="btn tertiary" onClick={() => setShowCancelConfirm(false)}>
                  Keep booking
                </button>
                <button type="button" className="btn danger" onClick={handleCancelGig}>
                  Cancel booking
                </button>
              </div>
            </div>
          </div>
        </Portal>
      )}

      {showInviteToApplyModal && gigInfo && user && (
        <GigInvitesModal
          gig={gigInfo}
          venues={venues}
          onClose={() => setShowInviteToApplyModal(false)}
          refreshGigs={refreshGigs}
          user={user}
          fromGigsTable={false}
        />
      )}
    </div>
  );
}
