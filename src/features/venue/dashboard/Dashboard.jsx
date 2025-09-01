import { Route, Routes, useLocation, Link } from 'react-router-dom'
import { Sidebar } from './Sidebar'
import React, { useState, useEffect, useMemo } from 'react'
import { GigPostModal } from '../gig-post/GigPostModal';
import { useAuth } from '@hooks/useAuth';
import { LoadingScreen } from '@features/shared/ui/loading/LoadingScreen';
import { Gigs } from './Gigs';
import '@styles/host/host-dashboard.styles.css'
import { Venues } from './Venues';
import { GigApplications } from './GigApplications';
import { Overview } from './Overview';
import { Finances } from './Finances';
import { SavedMusicians } from './SavedMusicians';
import { FindMusicians } from './FindMusicians';
import { ReviewModal } from '@features/shared/components/ReviewModal';
import { WelcomeModal } from '@features/musician/components/WelcomeModal';
import { mergeAndSortConversations } from '@services/utils/filtering';
import { getBreadcrumbs } from '@services/utils/breadcrumbs';
import { getPendingGigsToReview } from '@services/utils/filtering';
import { RightChevronIcon } from '../../shared/ui/extras/Icons';
import { useVenueDashboard } from '@context/VenueDashboardContext';
import { getUnreviewedPastGigs } from '../../../services/utils/filtering';
import { MessagePage } from './messages/MessagePage';
import { listenToUserConversations } from '@services/conversations';
import Portal from '../../shared/components/Portal';

export const VenueDashboard = ({ user }) => {
    const {
      loading,
      venueProfiles,
      gigs,
      incompleteGigs,
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
  
    const [gigPostModal, setGigPostModal] = useState(false);
    const [editGigData, setEditGigData] = useState();
    const [showWelcomeModal, setShowWelcomeModal] = useState(false);
    const [revisitingModal, setRevisitingModal] = useState(false);
    const [showReviewModal, setShowReviewModal] = useState(false);
    const [gigToReview, setGigToReview] = useState(null);
    const [gigsToReview, setGigsToReview] = useState([]);
    const [newMessages, setNewMessages] = useState(false);
    const [conversations, setConversations] = useState([]);
    const [buildingForMusician, setBuildingForMusician] = useState(false);
    const [buildingForMusicianData, setBuildingForMusicianData] = useState(false);
    const location = useLocation();
    const breadcrumbs = useMemo(() => getBreadcrumbs(location.pathname), [location.pathname]);
  
    useEffect(() => {
      if (location.state?.newUser && user?.venueProfiles?.length === 1) {
        setShowWelcomeModal(true);
      };
      if (location.state?.showGigPostModal) setGigPostModal(true);
      if (location.state?.buildingForMusician) setBuildingForMusician(true);
      if (location.state?.musicianData) setBuildingForMusicianData(location.state?.musicianData);
    }, [location]);
  
    useEffect(() => {
        const localGigsToReview = getPendingGigsToReview(gigs);
        const unreviewedGigs = getUnreviewedPastGigs(gigs);
        if (localGigsToReview.length > 0) {
          setGigToReview(localGigsToReview[0]);
          setShowReviewModal(true);
        } else if (unreviewedGigs.length > 0) {
          setGigsToReview(unreviewedGigs);
        }
      }, [gigs]);


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
            <Sidebar
              setGigPostModal={setGigPostModal}
              user={user}
              newMessages={newMessages}
              setShowWelcomeModal={setShowWelcomeModal}
              setRevisitingModal={setRevisitingModal}
            />
            <div className='window venues'>
                {location.pathname !== '/venues/dashboard' && (
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
                )}
                <div className="output">
                    <Routes>
                        {/* <Route index element={<Overview gigs={gigs} loadingGigs={loading} venues={venueProfiles} setGigPostModal={setGigPostModal} user={user} gigsToReview={gigsToReview} setGigsToReview={setGigsToReview} requests={requests} />} /> */}
                        <Route index path='gigs' element={<Gigs gigs={gigs} venues={venueProfiles} setGigPostModal={setGigPostModal} setEditGigData={setEditGigData} requests={requests} setRequests={setRequests} />} />
                        <Route path='gigs/gig-applications' element={<GigApplications setGigPostModal={setGigPostModal} setEditGigData={setEditGigData} gigs={gigs} />} />
                        <Route path='messages' element={<MessagePage user={user} conversations={conversations} setConversations={setConversations} venueGigs={gigs} venueProfiles={venueProfiles} />} />
                        <Route path='my-venues' element={<Venues venues={venueProfiles} user={user} />} />
                        <Route path='musicians' element={<SavedMusicians user={user} />} />
                        <Route path='musicians/find' element={<FindMusicians user={user} />} />
                        <Route path='finances' element={<Finances savedCards={savedCards} receipts={receipts} customerDetails={customerDetails} setStripe={setStripe} venues={venueProfiles} />} />
                    </Routes>
                </div>
            </div>
            {gigPostModal && (
              <Portal>
                <GigPostModal 
                  setGigPostModal={setGigPostModal} 
                  venueProfiles={venueProfiles} 
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
                />
              </Portal>
            )
            }
            {showReviewModal && (
              <Portal>
                <ReviewModal
                    gigData={gigToReview}
                    reviewer='venue'
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