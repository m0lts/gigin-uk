import { Link, Route, Routes, useLocation, useNavigate } from 'react-router-dom'
import { Sidebar } from './Sidebar'
import React, { useState, useEffect, useCallback } from 'react'
import { LoadingScreen } from '@features/shared/ui/loading/LoadingScreen';
import '@styles/musician/musician-dashboard.styles.css'
import { Profile } from './Profile';
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
import { RightChevronIcon } from '../../shared/ui/extras/Icons';
import { TopBar } from './TopBar';
import Portal from '../../shared/components/Portal';
import { WelcomeModal } from '../components/WelcomeModal';


export const MusicianDashboard = ({ user, setNoProfileModal, setNoProfileModalClosable }) => {

  const {
    loading,
    musicianProfile,
    gigApplications,
    setGigApplications,
    gigs,
    setGigs,
    gigToReview,
    setGigToReview,
    showReviewModal,
    setShowReviewModal,
    bandProfiles,
    gigsToReview,
    setGigsToReview,
    refreshMusicianProfile,
    savedGigs,
    setSavedGigs
  } = useMusicianDashboard();

  const [newMessages, setNewMessages] = useState(false);
  const [conversations, setConversations] = useState([]);
  const [unseenInvites, setUnseenInvites] = useState([]);
  const [refreshInvites, setRefreshInvites] = useState(true);
  const [showWelcomeModal, setShowWelcomeModal] = useState(false);
  const [revisitingModal, setRevisitingModal] = useState(false);

  const location = useLocation();

  useEffect(() => {
    if (location.state?.newUser) setShowWelcomeModal(true);
    if (location.state?.showGigPostModal) setGigPostModal(true);
    if (location.state?.buildingForMusician) setBuildingForMusician(true);
    if (location.state?.musicianData) setBuildingForMusicianData(location.state?.musicianData);
  }, [location]);

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

  useEffect(() => {
    if (gigs.length > 0) filterInvites();
  }, [gigs])

  const filterInvites = useCallback(() => {
    if (!gigs && !refreshInvites) return;
    const gigInvites = gigs
      .map((gig) => {
        const invitedApplicant = gig.applicants.find(
          (app) => app.invited === true && (app.viewed === false || !app.viewed)
        );
        return invitedApplicant ? { gigId: gig.gigId, ...invitedApplicant } : null;
      })
      .filter(Boolean);
    setUnseenInvites(gigInvites);
    setRefreshInvites(false);
  }, [gigs, refreshInvites]);

  if (loading) return <LoadingScreen />;

  return (
    <>
        {loading && <LoadingScreen />}
          <Sidebar
          user={user}
          newMessages={newMessages}
          unseenInvites={unseenInvites}
          bandProfiles={bandProfiles}
          musicianProfile={musicianProfile}
          setShowWelcomeModal={setShowWelcomeModal}
          setRevisitingModal={setRevisitingModal}
        />
          <div className='window musicians'>
            <TopBar user={user} bandProfiles={bandProfiles} />
              <div className="output">
              <Routes>
                <Route index element={<Overview user={user} musicianProfile={musicianProfile} gigApplications={gigApplications} gigs={gigs} gigsToReview={gigsToReview} setGigsToReview={setGigsToReview} bandProfiles={bandProfiles} unseenInvites={unseenInvites} setUnseenInvites={setUnseenInvites} />} />
                <Route path='profile' element={<Profile musicianProfile={musicianProfile} user={user} />} />
                <Route path='gigs' element={<Gigs gigApplications={gigApplications} musicianId={musicianProfile.musicianId} musicianProfile={musicianProfile} gigs={gigs} bandProfiles={bandProfiles} setGigs={setGigs} setGigApplications={setGigApplications} savedGigs={savedGigs} setSavedGigs={setSavedGigs} />} />
                <Route path='bands' element={<Bands bandProfiles={bandProfiles} refreshData={refreshMusicianProfile} />} />
                <Route path="bands/create" element={<BandCreator musicianProfile={musicianProfile} refreshData={refreshMusicianProfile} />} />
                <Route path="bands/join" element={<JoinBand musicianProfile={musicianProfile} />} />
                <Route path="bands/:bandId" element={<BandDashboard user={user} musicianProfile={musicianProfile} bandProfiles={bandProfiles} />} />
                <Route path='finances' element={<Finances user={user} musicianProfile={musicianProfile} />} />
              </Routes>
              </div>
          </div>
      {showReviewModal && gigToReview && (
        <Portal>
          <ReviewModal
            gigData={gigToReview}
            setGigData={setGigToReview}
            reviewer="musician"
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
            role='musician'
            revisiting={revisitingModal}
          />
        </Portal>
      )}
    </>
  );
}