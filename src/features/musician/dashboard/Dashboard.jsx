import { Route, Routes, useNavigate } from 'react-router-dom'
import { Sidebar } from './Sidebar'
import { useState, useEffect } from 'react'
import { useAuth } from '@hooks/useAuth';
import { LoadingScreen } from '@features/shared/ui/loading/LoadingScreen';
import '@styles/musician/musician-dashboard.styles.css'
import { ProfileTab } from './Profile';
import { Gigs } from './Gigs';
import { Bands } from './Bands';
import { Finances } from './Finances';
import { Overview } from './Overview';
import { ReviewModal } from '@features/shared/components/ReviewModal';
import { useGigs } from '@context/GigsContext';
import { subscribeToMusicianProfile } from '@services/musicians';
import { BandCreator } from '../bands/BandCreator';
import { JoinBand } from '../bands/JoinBand';
import { BandDashboard } from '../bands/BandDashboard';


export const MusicianDashboard = () => {

    const { user } = useAuth();
    const { gigs } = useGigs();
    const navigate = useNavigate();

    const [loadingData, setLoadingData] = useState(true);
    const [musicianProfile, setMusicianProfile] = useState(null);
    const [gigApplications, setGigApplications] = useState([]);
    const [showReviewModal, setShowReviewModal] = useState(false);
    const [gigToReview, setGigToReview] = useState(null);

    useEffect(() => {
        if (!user) return;
        let unsubscribe;
        const fetchMusicianData = () => {
          if (musicianProfile) return;
          setLoadingData(true);
          if (!user.musicianProfile) {
            navigate('/musician/create-profile');
            setLoadingData(false);
            return;
          }
          unsubscribe = subscribeToMusicianProfile(
            user.musicianProfile.musicianId,
            (data) => {
              if (data) {
                setMusicianProfile(data);
                setGigApplications(data.gigApplications || []);
              } else {
                console.warn('Musician profile does not exist.');
                setMusicianProfile(null);
                setGigApplications([]);
              }
              setLoadingData(false);
            },
            (error) => {
              console.error('Error subscribing to musician profile:', error);
              setLoadingData(false);
            }
          );
        };
        const checkGigsForReview = () => {
          const now = new Date();
          const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
          const gigsToReview = gigs.filter((gig) => {
            const gigDate = new Date(`${gig.date.toDate().toISOString().split('T')[0]}T${gig.startTime}`);
            const localReviewed = localStorage.getItem(`reviewedGig-${gig.gigId}`) === 'true';
            const dbReviewed = gig.musicianHasReviewed;
            const musicianConfirmed = gig.applicants.some(
              (a) => a.id === musicianProfile?.musicianId && a.status === 'confirmed'
            );
            return (
              gigDate > oneWeekAgo &&
              gigDate <= now &&
              !localReviewed &&
              !dbReviewed &&
              musicianConfirmed
            );
          });
          if (gigsToReview.length > 0) {
            setGigToReview(gigsToReview[0]);
            setShowReviewModal(true);
          }
        };
        fetchMusicianData();
        if (musicianProfile) {
          checkGigsForReview();
        }
        return () => unsubscribe && unsubscribe();
      }, [user, gigs, musicianProfile]);

    return (
        <>  
            {loadingData ? (<LoadingScreen /> ) : (
                <>
                    <Sidebar />
                    <div className='window dashboard musician'>
                        <Routes>
                            <Route index element={<Overview musicianProfile={musicianProfile} gigApplications={gigApplications} />} />
                            <Route path='profile' element={<ProfileTab musicianProfile={musicianProfile} />} />
                            <Route path='gigs' element={<Gigs gigApplications={gigApplications} musicianId={musicianProfile.musicianId} musicianProfile={musicianProfile} />} />
                            <Route path='bands' element={<Bands musicianProfile={musicianProfile} />} />
                            <Route path="bands/create" element={<BandCreator musicianProfile={musicianProfile} />} />
                            <Route path="bands/join" element={<JoinBand musicianProfile={musicianProfile} />} />
                            <Route path="bands/:bandId" element={<BandDashboard musicianProfile={musicianProfile} />} />
                            <Route path='finances' element={<Finances musicianProfile={musicianProfile} setMusicianProfile={setMusicianProfile} />} />
                        </Routes>
                    </div>
                </>
            )}
            {showReviewModal &&
                <ReviewModal
                    gigData={gigToReview}
                    reviewer='musician'
                    onClose={() => {
                        setShowReviewModal(false);
                        localStorage.setItem(`reviewedGig-${gigToReview.gigId}`, 'true');
                    }}
                />
            }
        </>
    )
}