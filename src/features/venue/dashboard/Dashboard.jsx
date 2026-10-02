import { Route, Routes, useLocation, Link, useNavigate, Navigate, useParams } from 'react-router-dom'
import { FEATURES } from '../../../config/features';
import { FinderListingSettings } from '../../keep-profile/FinderPages';
import { Sidebar } from './Sidebar'
import React, { useState, useEffect, useMemo, useCallback } from 'react'
import { AddGigsModal } from './AddGigsModal';
import { useAuth } from '@hooks/useAuth';
import { LoadingScreen } from '@features/shared/ui/loading/LoadingScreen';
import { Gigs } from './Gigs';
import '@styles/host/host-dashboard.styles.css'
import { Venues } from './Venues';
import { VenueGigPageShell } from '../gigs/pages/VenueGigPageShell';
import { Finances } from './Finances';
import { SavedArtists } from './SavedArtists';
import { FindArtists } from './FindArtists';
import { NearbyLineups } from './NearbyLineups';
import { ArtistCRM } from './ArtistCRM';
import { ReviewModal } from '@features/shared/components/ReviewModal';
import { WelcomeModal } from '@features/artist/components/WelcomeModal';
import { mergeAndSortConversations } from '@services/utils/filtering';
import { getBreadcrumbs } from '@services/utils/breadcrumbs';
import { getPendingGigsToReview } from '@services/utils/filtering';
import { RightChevronIcon } from '../../shared/ui/extras/Icons';
import { useVenueDashboard } from '@context/VenueDashboardContext';
import { getUnreviewedPastGigs } from '../../../services/utils/filtering';
import { MessagePage } from './messages/MessagePage';
import { listenToUserConversations } from '@services/client-side/conversations';
import Portal from '../../shared/components/Portal';
import { hasVenuePerm } from '../../../services/utils/permissions';
import { useBreakpoint } from '../../../hooks/useBreakpoint';
import { VenueHome } from '../home/VenueHome';
import { ShareLinkProvider } from '../home/shareLinkContext';
import { VenueMobileChrome } from '../home/VenueMobileChrome';
import { readLastNewGigRoute } from './new-gig/useNewGigDraft';

function FinderListingRoute() {
  const { venueId } = useParams();
  return <FinderListingSettings venueId={venueId} />;
}

export const VenueDashboard = ({ user }) => {
    const {
      loading,
      venueProfiles,
      setVenueProfiles,
      gigs,
      venueHireOpportunities,
      templates,
      requests,
      setRequests,
      stripe: { customerDetails, savedCards, receipts },
      setStripe,
      refreshData,
      refreshGigs,
      refreshTemplates,
      refreshStripe
    } = useVenueDashboard();
    const { isMdUp } = useBreakpoint();

    const [showAddGigsModal, setShowAddGigsModal] = useState(false);
    const [addGigsEditData, setAddGigsEditData] = useState(null);
    const [addGigsInitialDateIso, setAddGigsInitialDateIso] = useState(null);
    const [addGigsMode, setAddGigsMode] = useState(null); // 'bookNew' | 'addExisting' | null
    const [newGigRoute, setNewGigRoute] = useState(null);
    const [newGigEntry, setNewGigEntry] = useState('menu');
    const [addGigsBookNewTemplate, setAddGigsBookNewTemplate] = useState(null);
    const [showWelcomeModal, setShowWelcomeModal] = useState(false);
    const [revisitingModal, setRevisitingModal] = useState(false);
    const [showReviewModal, setShowReviewModal] = useState(false);
    const [gigToReview, setGigToReview] = useState(null);
    const [gigsToReview, setGigsToReview] = useState([]);
    const [newMessages, setNewMessages] = useState(false);
    const [mobileNavOpen, setMobileNavOpen] = useState(false);
    const [conversations, setConversations] = useState([]);
    // "Build for musician" context, sourced from location.state when deep-linking
    // from ArtistCRM / MusicianProfile / ArtistProfile / RequestCard /
    // MessagePage. Passed straight through to AddGigsModal.
    const [buildingForMusician, setBuildingForMusician] = useState(false);
    const [buildingForMusicianData, setBuildingForMusicianData] = useState(false);
    const [requestId, setRequestId] = useState(null);
    const [preferredDate, setPreferredDate] = useState(null);
    const location = useLocation();
    const navigate = useNavigate();
    const breadcrumbs = useMemo(() => getBreadcrumbs(location.pathname, 'venue', venueProfiles), [location.pathname]);
  
    useEffect(() => {
      // Only process location.state if it exists and has relevant data.
      // `buildingForMusician` / `musicianData` / `requestId` / `preferredDate`
      // may arrive alongside `showAddGigsModal: true` (build-for-musician deep
      // links) and are surfaced as extra context to AddGigsModal below.
      const hasAddGigsState = !!(location.state && (
        location.state.showAddGigsModal ||
        location.state.buildingForMusician ||
        location.state.musicianData ||
        location.state.requestId ||
        location.state.preferredDate
      ));
      if (hasAddGigsState) {
        setShowAddGigsModal(true);
        if (location.state?.addGigsMode === 'bookNew' || location.state?.addGigsMode === 'addExisting') {
          setAddGigsMode(location.state.addGigsMode);
        } else {
          setAddGigsMode('bookNew');
        }
        setNewGigRoute('full');
        setNewGigEntry('crm');
        if (location.state?.initialDateIso) setAddGigsInitialDateIso(location.state.initialDateIso);
        if (location.state?.buildingForMusician) setBuildingForMusician(true);
        if (location.state?.musicianData) setBuildingForMusicianData(location.state?.musicianData);
        if (location.state?.requestId) setRequestId(location.state?.requestId);
        if (location.state?.preferredDate) {
          const date = location.state.preferredDate instanceof Date
            ? location.state.preferredDate
            : new Date(location.state.preferredDate);
          setPreferredDate(date);
        }
        // Clear the location.state after reading it to prevent it from persisting on refresh
        navigate(location.pathname + location.search, { replace: true, state: null });
      }
    }, [location, navigate]);
  
    useEffect(() => {
      if (!FEATURES.reviews) return;
      if (!gigs?.length) return;
      const gigsWithReviewPerm = gigs.filter(gig =>
        hasVenuePerm(venueProfiles, gig.venueId, 'reviews.create')
      );
      const localGigsToReview = getPendingGigsToReview(gigsWithReviewPerm);
      const unreviewedGigs = getUnreviewedPastGigs(gigsWithReviewPerm);
      if (localGigsToReview.length > 0) {
        setGigToReview(localGigsToReview[0]);
        setShowReviewModal(true);
      } else if (unreviewedGigs.length > 0) {
        setGigsToReview(unreviewedGigs);
      } else {
        setGigToReview(null);
        setShowReviewModal(false);
        setGigsToReview([]);
      }
    }, [gigs, venueProfiles]);


    useEffect(() => {
      if (!user) return;
      const unsubscribe = listenToUserConversations(user, (updatedConversations) => {
        setConversations(prev => mergeAndSortConversations(prev, updatedConversations));
        const hasUnread = updatedConversations.some((conv) => {
          const lastViewed = conv.lastViewed?.[user.uid]?.seconds || 0;
          const lastMessage = conv.lastMessageTimestamp?.seconds || 0;
          const isNotSender = conv.lastMessageSenderId !== user.uid;
          return lastMessage > lastViewed && isNotSender;
        });
        setNewMessages(hasUnread);
      });
      return unsubscribe;
    }, [user]);

    const closeMobileNav = useCallback(() => setMobileNavOpen(false), []);
    const openNewGig = (route) => {
        setAddGigsEditData(null);
        setAddGigsInitialDateIso(null);
        setAddGigsMode('bookNew');
        setNewGigRoute(route || readLastNewGigRoute() || 'full');
        setNewGigEntry('menu');
        setShowAddGigsModal(true);
    };

    return (
        <ShareLinkProvider>
            {loading && <LoadingScreen />}
            {!isMdUp && (
              <VenueMobileChrome
                user={user}
                newMessages={newMessages}
                gigs={gigs}
                venues={venueProfiles}
                open={mobileNavOpen}
                onOpen={() => setMobileNavOpen(true)}
                onClose={closeMobileNav}
              />
            )}
            {isMdUp && (
              <Sidebar
                user={user}
                newMessages={newMessages}
                setShowWelcomeModal={setShowWelcomeModal}
                setRevisitingModal={setRevisitingModal}
              />
            )}
            <div className='window venues'>
              {isMdUp && (
                location.pathname !== '/venues/dashboard' &&
                !/^\/venues\/dashboard\/gigs\/?$/.test(location.pathname) && (
                    <div className="breadcrumbs">
                        {breadcrumbs.map((crumb, index) => (
                            <React.Fragment key={crumb.path}>
                            <Link className="breadcrumb" to={crumb.path}>
                                {index !== breadcrumbs.length - 1 ? (
                                  <p className='breadcrumb-link'>{crumb.label}</p>
                                ) : (
                                  <p className='breadcrumb-text'>{crumb.label}</p>
                                )}
                            </Link>
                            {index !== breadcrumbs.length - 1 && (
                                <div className="breadcrumb-separator">
                                <RightChevronIcon />
                                </div>
                            )}
                            </React.Fragment>
                        ))}
                    </div>
                )
              )}
                <div className="output">
                    <Routes>
                        <Route index element={<VenueHome user={user} gigs={gigs} venues={venueProfiles} onNewGig={openNewGig} />} />
                        <Route path='gigs' element={<Gigs gigs={gigs} venueHireOpportunities={venueHireOpportunities} venues={venueProfiles} setShowAddGigsModal={setShowAddGigsModal} setAddGigsEditData={setAddGigsEditData} setAddGigsInitialDateIso={setAddGigsInitialDateIso} setAddGigsMode={setAddGigsMode} setNewGigRoute={setNewGigRoute} setNewGigEntry={setNewGigEntry} setAddGigsBookNewTemplate={setAddGigsBookNewTemplate} requests={requests} setRequests={setRequests} user={user} refreshGigs={refreshGigs} templates={templates} refreshTemplates={refreshTemplates} />} />
                        <Route path='gigs/gig-applications' element={<VenueGigPageShell setShowAddGigsModal={setShowAddGigsModal} setAddGigsEditData={setAddGigsEditData} setAddGigsMode={setAddGigsMode} gigs={gigs} venueHireOpportunities={venueHireOpportunities} venues={venueProfiles} user={user} refreshStripe={refreshStripe} customerDetails={customerDetails} refreshGigs={refreshGigs} />} />
                        <Route path='messages' element={FEATURES.chat ? <MessagePage user={user} conversations={conversations} setConversations={setConversations} venueGigs={gigs} venueProfiles={venueProfiles} customerDetails={customerDetails} refreshStripe={refreshStripe} requests={requests} setRequests={setRequests} setShowAddGigsModal={setShowAddGigsModal} setAddGigsMode={setAddGigsMode} setBuildingForMusician={setBuildingForMusician} setBuildingForMusicianData={setBuildingForMusicianData} setRequestId={setRequestId} setPreferredDate={setPreferredDate} refreshGigs={refreshGigs} /> : <Navigate to="/venues/dashboard/gigs" replace />} />
                        <Route path='my-venues' element={<Venues venues={venueProfiles} user={user} setVenues={setVenueProfiles} />} />
                        <Route path='finder-listing/:venueId' element={FEATURES.venueFinder ? <FinderListingRoute /> : <Navigate to="/venues/dashboard/gigs" replace />} />
                        <Route path='artists' element={<ArtistCRM user={user} venues={venueProfiles} />} />
                        <Route path='artists/find' element={FEATURES.discovery ? <FindArtists user={user} /> : <Navigate to="/venues/dashboard/gigs" replace />} />
                        <Route path='artists/find/nearby-lineups' element={FEATURES.discovery ? <NearbyLineups /> : <Navigate to="/venues/dashboard/gigs" replace />} />
                        <Route path='finances' element={FEATURES.finances ? <Finances savedCards={savedCards} receipts={receipts} customerDetails={customerDetails} setStripe={setStripe} venues={venueProfiles} /> : <Navigate to="/venues/dashboard/gigs" replace />} />
                    </Routes>
                </div>
            </div>
            {showAddGigsModal && (
              <AddGigsModal
                onClose={() => {
                  setShowAddGigsModal(false);
                  setAddGigsEditData(null);
                  setAddGigsInitialDateIso(null);
                  setAddGigsMode(null);
                  setNewGigRoute(null);
                  setAddGigsBookNewTemplate(null);
                  // Clear any "building for musician" context that may have
                  // been attached via location.state so a later open doesn't
                  // inherit stale musician / request data.
                  setBuildingForMusician(false);
                  setBuildingForMusicianData(false);
                  setRequestId(null);
                  setPreferredDate(null);
                }}
                venues={venueProfiles}
                user={user}
                refreshGigs={refreshGigs}
                initialDateIso={addGigsInitialDateIso}
                editGigData={addGigsEditData}
                addGigsMode={addGigsMode}
                newGigRoute={newGigRoute}
                newGigEntry={newGigEntry}
                gigs={gigs}
                templates={templates}
                refreshTemplates={refreshTemplates}
                bookNewTemplateToApply={addGigsBookNewTemplate}
                onBookNewTemplateConsumed={() => setAddGigsBookNewTemplate(null)}
                buildingForMusician={buildingForMusician}
                buildingForMusicianData={buildingForMusicianData}
                setBuildingForMusician={setBuildingForMusician}
                setBuildingForMusicianData={setBuildingForMusicianData}
                requestId={requestId}
                setRequestId={setRequestId}
                setRequests={setRequests}
                preferredDate={preferredDate}
                setPreferredDate={setPreferredDate}
              />
            )}
            {FEATURES.reviews && showReviewModal && gigToReview && hasVenuePerm(venueProfiles, gigToReview.venueId, 'reviews.create') && (
              <Portal>
                <ReviewModal
                    venueProfiles={venueProfiles}
                    gigData={gigToReview}
                    reviewer='venue'
                    setGigData={setGigToReview}
                    onClose={() => {
                        setShowReviewModal(false);
                        localStorage.setItem(`reviewedGig-${gigToReview.gigId}`, 'true');
                    }}
                />
              </Portal>
            )}
            {showWelcomeModal && (
              <Portal>
                <WelcomeModal
                  user={user}
                  setShowWelcomeModal={setShowWelcomeModal}
                  role='venue'
                  revisiting={revisitingModal}
                />
              </Portal>
            )}
        </ShareLinkProvider>
    )
}