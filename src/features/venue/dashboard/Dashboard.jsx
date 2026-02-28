import { Route, Routes, useLocation, Link, useNavigate } from 'react-router-dom'
import { Sidebar } from './Sidebar'
import React, { useState, useEffect, useMemo } from 'react'
import { GigPostModal } from '../gig-post/GigPostModal';
import { AddGigsModal } from './AddGigsModal';
import { useAuth } from '@hooks/useAuth';
import { LoadingScreen } from '@features/shared/ui/loading/LoadingScreen';
import { Gigs } from './Gigs';
import '@styles/host/host-dashboard.styles.css'
import { Venues } from './Venues';
import { VenueGigPageShell } from '../gigs/pages/VenueGigPageShell';
import { Overview } from './Overview';
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
import { Header } from '../components/Header';

export const VenueDashboard = ({ user }) => {
    const {
      loading,
      venueProfiles,
      setVenueProfiles,
      gigs,
      incompleteGigs,
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
  
    const [gigPostModal, setGigPostModal] = useState(false);
    const [editGigData, setEditGigData] = useState();
    const [showAddGigsModal, setShowAddGigsModal] = useState(false);
    const [addGigsEditData, setAddGigsEditData] = useState(null);
    const [addGigsInitialDateIso, setAddGigsInitialDateIso] = useState(null);
    const [showWelcomeModal, setShowWelcomeModal] = useState(false);
    const [revisitingModal, setRevisitingModal] = useState(false);
    const [showReviewModal, setShowReviewModal] = useState(false);
    const [gigToReview, setGigToReview] = useState(null);
    const [gigsToReview, setGigsToReview] = useState([]);
    const [newMessages, setNewMessages] = useState(false);
    const [conversations, setConversations] = useState([]);
    const [buildingForMusician, setBuildingForMusician] = useState(false);
    const [buildingForMusicianData, setBuildingForMusicianData] = useState(false);
    const [requestId, setRequestId] = useState(null);
    const [preferredDate, setPreferredDate] = useState(null);
    const [showInviteMethodsModal, setShowInviteMethodsModal] = useState(false);
    const [createdGigForInvite, setCreatedGigForInvite] = useState(null);
    const location = useLocation();
    const navigate = useNavigate();
    const breadcrumbs = useMemo(() => getBreadcrumbs(location.pathname, 'venue', venueProfiles), [location.pathname]);
  
    useEffect(() => {
      // Only process location.state if it exists and has relevant data
      if (location.state && (location.state.showGigPostModal || location.state.buildingForMusician || location.state.musicianData || location.state.requestId || location.state.preferredDate)) {
        if (location.state?.showGigPostModal) setGigPostModal(true);
        if (location.state?.buildingForMusician) setBuildingForMusician(true);
        if (location.state?.musicianData) setBuildingForMusicianData(location.state?.musicianData);
        if (location.state?.requestId) setRequestId(location.state?.requestId);
        if (location.state?.preferredDate) {
          // Convert to Date object if it's a string (serialized from location.state)
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

    return (
        <>  
            {loading && <LoadingScreen />}
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
                location.pathname !== '/venues/dashboard' && (
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
                        {/* <Route index element={<Overview gigs={gigs} loadingGigs={loading} venues={venueProfiles} setGigPostModal={setGigPostModal} user={user} gigsToReview={gigsToReview} setGigsToReview={setGigsToReview} requests={requests} />} /> */}
                        <Route index path='gigs' element={<Gigs gigs={gigs} venueHireOpportunities={venueHireOpportunities} venues={venueProfiles} setGigPostModal={setGigPostModal} setEditGigData={setEditGigData} setShowAddGigsModal={setShowAddGigsModal} setAddGigsEditData={setAddGigsEditData} setAddGigsInitialDateIso={setAddGigsInitialDateIso} requests={requests} setRequests={setRequests} user={user} refreshGigs={refreshGigs} />} />
                        <Route path='gigs/gig-applications' element={<VenueGigPageShell setGigPostModal={setGigPostModal} setEditGigData={setEditGigData} setShowAddGigsModal={setShowAddGigsModal} setAddGigsEditData={setAddGigsEditData} gigs={gigs} venues={venueProfiles} user={user} refreshStripe={refreshStripe} customerDetails={customerDetails} refreshGigs={refreshGigs} />} />
                        <Route path='messages' element={<MessagePage user={user} conversations={conversations} setConversations={setConversations} venueGigs={gigs} venueProfiles={venueProfiles} customerDetails={customerDetails} refreshStripe={refreshStripe} requests={requests} setRequests={setRequests} setGigPostModal={setGigPostModal} setBuildingForMusician={setBuildingForMusician} setBuildingForMusicianData={setBuildingForMusicianData} setRequestId={setRequestId} setPreferredDate={setPreferredDate} refreshGigs={refreshGigs} />} />
                        <Route path='my-venues' element={<Venues venues={venueProfiles} user={user} setVenues={setVenueProfiles} />} />
                        <Route path='artists' element={<ArtistCRM user={user} venues={venueProfiles} />} />
                        <Route path='artists/find' element={<FindArtists user={user} />} />
                        <Route path='artists/find/nearby-lineups' element={<NearbyLineups />} />
                        <Route path='finances' element={<Finances savedCards={savedCards} receipts={receipts} customerDetails={customerDetails} setStripe={setStripe} venues={venueProfiles} />} />
                    </Routes>
                </div>
            </div>
            {gigPostModal && (
              <Portal>
                <GigPostModal 
                  setGigPostModal={setGigPostModal} 
                  venueProfiles={venueProfiles}
                  setVenueProfiles={setVenueProfiles}
                  user={user} 
                  templates={templates} 
                  incompleteGigs={incompleteGigs} 
                  editGigData={editGigData}
                  setEditGigData={setEditGigData}
                  buildingForMusician={buildingForMusician}
                  buildingForMusicianData={buildingForMusicianData}
                  setBuildingForMusician={setBuildingForMusician}
                  setBuildingForMusicianData={setBuildingForMusicianData}
                  refreshTemplates={refreshTemplates}
                  refreshGigs={refreshGigs}
                  requestId={requestId}
                  setRequestId={setRequestId}
                  setRequests={setRequests}
                  preferredDate={preferredDate}
                  setPreferredDate={setPreferredDate}
                  showInviteMethodsModal={showInviteMethodsModal}
                  setShowInviteMethodsModal={setShowInviteMethodsModal}
                  createdGigForInvite={createdGigForInvite}
                  setCreatedGigForInvite={setCreatedGigForInvite}
                />
              </Portal>
            )
            }
            {showAddGigsModal && (
              <AddGigsModal
                onClose={() => {
                  setShowAddGigsModal(false);
                  setAddGigsEditData(null);
                  setAddGigsInitialDateIso(null);
                }}
                venues={venueProfiles}
                user={user}
                refreshGigs={refreshGigs}
                initialDateIso={addGigsInitialDateIso}
                editGigData={addGigsEditData}
              />
            )}
            {showReviewModal && gigToReview && hasVenuePerm(venueProfiles, gigToReview.venueId, 'reviews.create') && (
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
        </>
    )
}