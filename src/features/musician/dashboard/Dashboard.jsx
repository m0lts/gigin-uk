import { Link, Route, Routes, useLocation, useNavigate } from 'react-router-dom'
import { Sidebar } from './Sidebar'
import React, { useState, useEffect, useMemo } from 'react'
import { LoadingScreen } from '@features/shared/ui/loading/LoadingScreen';
import '@styles/musician/musician-dashboard.styles.css'
import { ProfileTab } from './Profile';
import { Gigs } from './Gigs';
import { Bands } from './Bands';
import { Finances } from './Finances';
import { Overview } from './Overview';
import { ReviewModal } from '@features/shared/components/ReviewModal';
import { BandCreator } from '../bands/BandCreator';
import { JoinBand } from '../bands/JoinBand';
import { BandDashboard } from '../bands/BandDashboard';
import { useMusicianDashboard } from '../../../context/MusicianDashboardContext';
import { listenToUserConversations } from '../../../services/conversations';
import { mergeAndSortConversations } from '@services/utils/filtering';
import { getBreadcrumbs } from '@services/utils/breadcrumbs';
import { RightChevronIcon } from '../../shared/ui/extras/Icons';


export const MusicianDashboard = ({ user }) => {
    const navigate = useNavigate();

    const {
      loading,
      musicianProfile,
      gigApplications,
      setGigApplications,
      gigs,
      setGigs,
      gigToReview,
      showReviewModal,
      setShowReviewModal,
      bandProfiles,
      gigsToReview,
      setGigsToReview
    } = useMusicianDashboard();

    const [newMessages, setNewMessages] = useState(false);
    const [conversations, setConversations] = useState([]);

    const location = useLocation();
    const breadcrumbs = useMemo(() => getBreadcrumbs(location.pathname, 'musician'), [location.pathname]);
  
    useEffect(() => {
      if (location.state?.newUser) setShowWelcomeModal(true);
      if (location.state?.showGigPostModal) setGigPostModal(true);
      if (location.state?.buildingForMusician) setBuildingForMusician(true);
      if (location.state?.musicianData) setBuildingForMusicianData(location.state?.musicianData);
    }, [location]);
  
  
    useEffect(() => {
      if (!loading && !musicianProfile && user && !user.musicianProfile) {
        navigate('/musician/create-profile');
      }
    }, [loading, musicianProfile, user]);

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
  
    if (loading) return <LoadingScreen />;

    return (
      <>
          {loading && <LoadingScreen />}
           <Sidebar
            user={user}
            newMessages={newMessages}
          />
           <div className='window musicians'>
               {location.pathname !== '/dashboard' && (
                  <div className="breadcrumbs">
                      {breadcrumbs.map((crumb, index) => (
                          <React.Fragment key={crumb.path}>
                          <div className="breadcrumb">
                              {index !== breadcrumbs.length - 1 ? (
                              <Link to={crumb.path} className='breadcrumb-link'>{crumb.label}</Link>
                              ) : (
                              <p className='breadcrumb-text'>{crumb.label}</p>
                              )}
                          </div>
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
                  <Route index element={<Overview user={user} musicianProfile={musicianProfile} gigApplications={gigApplications} gigs={gigs} gigsToReview={gigsToReview} setGigsToReview={setGigsToReview} />} />
                  <Route path='profile' element={<ProfileTab musicianProfile={musicianProfile} />} />
                  <Route path='gigs' element={<Gigs gigApplications={gigApplications} musicianId={musicianProfile.musicianId} musicianProfile={musicianProfile} gigs={gigs} bandProfiles={bandProfiles} setGigs={setGigs} setGigApplications={setGigApplications} />} />
                  <Route path='bands' element={<Bands musicianProfile={musicianProfile} />} />
                  <Route path="bands/create" element={<BandCreator musicianProfile={musicianProfile} />} />
                  <Route path="bands/join" element={<JoinBand musicianProfile={musicianProfile} />} />
                  <Route path="bands/:bandId" element={<BandDashboard musicianProfile={musicianProfile} />} />
                  <Route path='finances' element={<Finances musicianProfile={musicianProfile} />} />
                </Routes>
               </div>
           </div>
        {showReviewModal && gigToReview && (
          <ReviewModal
            gigData={gigToReview}
            reviewer="musician"
            onClose={() => {
              setShowReviewModal(false);
              localStorage.setItem(`reviewedGig-${gigToReview.gigId}`, 'true');
            }}
          />
        )}
      </>
    );
}

{/* <div className='window dashboard musician'>
<Routes>
  <Route index element={<Overview musicianProfile={musicianProfile} gigApplications={gigApplications} />} />
  <Route path='profile' element={<ProfileTab musicianProfile={musicianProfile} />} />
  <Route path='gigs' element={<Gigs gigApplications={gigApplications} musicianId={musicianProfile.musicianId} musicianProfile={musicianProfile} />} />
  <Route path='bands' element={<Bands musicianProfile={musicianProfile} />} />
  <Route path="bands/create" element={<BandCreator musicianProfile={musicianProfile} />} />
  <Route path="bands/join" element={<JoinBand musicianProfile={musicianProfile} />} />
  <Route path="bands/:bandId" element={<BandDashboard musicianProfile={musicianProfile} />} />
  <Route path='finances' element={<Finances musicianProfile={musicianProfile} setMusicianProfile={() => {}} />} />
</Routes>
</div> */}

// export const VenueDashboard = ({ user }) => {
//   const {
//     loading,
//     venueProfiles,
//     gigs,
//     incompleteGigs,
//     templates,
//     requests,
//     setRequests,
//     stripe: { customerDetails, savedCards, receipts },
//     refreshData,
//     refreshGigs,
//     refreshTemplates,
//     refreshStripe
//   } = useVenueDashboard();

//   const [gigPostModal, setGigPostModal] = useState(false);
//   const [editGigData, setEditGigData] = useState();
//   const [showWelcomeModal, setShowWelcomeModal] = useState(false);
//   const [showReviewModal, setShowReviewModal] = useState(false);
//   const [gigToReview, setGigToReview] = useState(null);
//   const [gigsToReview, setGigsToReview] = useState([]);
  // const [newMessages, setNewMessages] = useState(false);
  // const [conversations, setConversations] = useState([]);
//   const [buildingForMusician, setBuildingForMusician] = useState(false);
//   const [buildingForMusicianData, setBuildingForMusicianData] = useState(false);
  // const location = useLocation();
  // const breadcrumbs = useMemo(() => getBreadcrumbs(location.pathname), [location.pathname]);

  // useEffect(() => {
  //   if (location.state?.newUser) setShowWelcomeModal(true);
  //   if (location.state?.showGigPostModal) setGigPostModal(true);
  //   if (location.state?.buildingForMusician) setBuildingForMusician(true);
  //   if (location.state?.musicianData) setBuildingForMusicianData(location.state?.musicianData);
  // }, [location]);

//   useEffect(() => {
//       const localGigsToReview = getPendingGigsToReview(gigs);
//       const unreviewedGigs = getUnreviewedPastGigs(gigs);
//       if (localGigsToReview.length > 0) {
//         setGigToReview(localGigsToReview[0]);
//         setShowReviewModal(true);
//       } else if (unreviewedGigs.length > 0) {
//         setGigsToReview(unreviewedGigs);
//       }
//     }, [gigs]);


    // useEffect(() => {
    //   if (!user) return;
    //   const unsubscribe = listenToUserConversations(user, (updatedConversations) => {
    //     setConversations(prev => mergeAndSortConversations(prev, updatedConversations));
    //     const hasUnread = updatedConversations.some((conv) => {
    //       const lastViewed = conv.lastViewed?.[user.uid]?.seconds || 0;
    //       const lastMessage = conv.lastMessageTimestamp?.seconds || 0;
    //       const isNotSender = conv.lastMessageSenderId !== user.uid;
    //       return lastMessage > lastViewed && isNotSender;
    //     });
    //     setNewMessages(hasUnread);
    //   });
    //   return unsubscribe;
    // }, [user]);

//   return (
//       <>  
//           {loading && <LoadingScreen />}
//           <Sidebar
//             setGigPostModal={setGigPostModal}
//             user={user}
//             newMessages={newMessages}
//           />
//           <div className='window venue'>
//               {location.pathname !== '/venues/dashboard' && (
//                   <div className="breadcrumbs">
//                       {breadcrumbs.map((crumb, index) => (
//                           <React.Fragment key={crumb.path}>
//                           <div className="breadcrumb">
//                               {index !== breadcrumbs.length - 1 ? (
//                               <Link to={crumb.path} className='breadcrumb-link'>{crumb.label}</Link>
//                               ) : (
//                               <p className='breadcrumb-text'>{crumb.label}</p>
//                               )}
//                           </div>
//                           {index !== breadcrumbs.length - 1 && (
//                               <div className="breadcrumb-separator">
//                               <RightChevronIcon />
//                               </div>
//                           )}
//                           </React.Fragment>
//                       ))}
//                   </div>
//               )}
//               <div className="output">
//                   <Routes>
//                       <Route index element={<Overview gigs={gigs} loadingGigs={loading} venues={venueProfiles} setGigPostModal={setGigPostModal} user={user} gigsToReview={gigsToReview} setGigsToReview={setGigsToReview} requests={requests} />} />
//                       <Route path='gigs' element={<Gigs gigs={gigs} venues={venueProfiles} setGigPostModal={setGigPostModal} setEditGigData={setEditGigData} requests={requests} setRequests={setRequests} />} />
//                       <Route path='gigs/gig-applications' element={<GigApplications setGigPostModal={setGigPostModal} setEditGigData={setEditGigData} gigs={gigs} />} />
//                       <Route path='messages' element={<MessagePage user={user} conversations={conversations} setConversations={setConversations} venueGigs={gigs} venueProfiles={venueProfiles} />} />
//                       <Route path='my-venues' element={<Venues venues={venueProfiles} />} />
//                       <Route path='musicians' element={<SavedMusicians user={user} />} />
//                       <Route path='musicians/find' element={<FindMusicians user={user} />} />
//                       <Route path='finances' element={<Finances savedCards={savedCards} receipts={receipts} customerDetails={customerDetails} venues={venueProfiles} />} />
//                   </Routes>
//               </div>
//           </div>
//           {gigPostModal && 
//             <GigPostModal 
//               setGigPostModal={setGigPostModal} 
//               venueProfiles={venueProfiles} 
//               user={user} 
//               templates={templates} 
//               incompleteGigs={incompleteGigs} 
//               editGigData={editGigData}
//               buildingForMusician={buildingForMusician}
//               buildingForMusicianData={buildingForMusicianData}
//             />
//           }
//           {showReviewModal && 
//               <ReviewModal
//                   gigData={gigToReview}
//                   reviewer='venue'
//                   onClose={() => {
//                       setShowReviewModal(false);
//                       localStorage.setItem(`reviewedGig-${gigToReview.gigId}`, 'true');
//                   }}
//               />
//           }
//           {showWelcomeModal && (
//               <WelcomeModal
//                   user={user}
//                   setShowWelcomeModal={setShowWelcomeModal}
//                   role='venue'
//               />
//           )}
//       </>
//   )
// }