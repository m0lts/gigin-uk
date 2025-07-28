import { createContext, useContext, useEffect, useRef, useState } from 'react';
import { subscribeToMusicianProfile, getMusicianProfilesByIds } from '@services/musicians';
import { getGigsByIds } from '@services/gigs';
import { getBandMembers } from '@services/bands';

const MusicianDashboardContext = createContext();

export const MusicianDashboardProvider = ({ user, children }) => {
  const [loading, setLoading] = useState(true);
  const [musicianProfile, setMusicianProfile] = useState(null);
  const [gigApplications, setGigApplications] = useState([]);
  const [gigs, setGigs] = useState([]);
  const [gigToReview, setGigToReview] = useState(null);
  const [gigsToReview, setGigsToReview] = useState(null);
  const [showReviewModal, setShowReviewModal] = useState(false);
  const [bandProfiles, setBandProfiles] = useState([]);

  const loadedOnce = useRef(false);
  const unsubRef = useRef(null);

  useEffect(() => {
    if (!user || !user.musicianProfile || loadedOnce.current) return;
    const unsub = subscribeToMusicianProfile(
      user.musicianProfile.musicianId,
      async (profile) => {
        if (!profile) {
          setMusicianProfile(null);
          setGigApplications([]);
          setGigs([]);
          setLoading(false);
          return;
        }
        setMusicianProfile(profile);
        console.log(profile)
        const applications = profile.gigApplications || [];
        setGigApplications(applications);
        if (applications.length > 0) {
          const gigIds = applications.map((app) => app.gigId);
          const fetchedGigs = await getGigsByIds(gigIds);
          checkGigsForReview(fetchedGigs, profile.musicianId);
          setGigs(fetchedGigs);
        }
        fetchBandProfiles(profile);
        setLoading(false);
        loadedOnce.current = true;
      },
      (err) => {
        console.error('Error subscribing to musician profile:', err);
        setLoading(false);
      }
    );

    unsubRef.current = unsub;
    return () => unsub && unsub();
  }, [user]);

  const fetchBandProfiles = async (profile) => {
    if (!profile?.bands?.length) {
      setBandProfiles([]);
      return;
    }

    try {
      const bandProfiles = await getMusicianProfilesByIds(profile.bands);
      const validBandProfiles = [];

      for (const bandProfile of bandProfiles) {
        const bandId = bandProfile.musicianId;
        const members = await getBandMembers(bandId);
        const userIsLeader = members.find(m => m.musicianProfileId === profile.musicianId)?.role === 'Band Leader';

        if (userIsLeader && bandProfile.completed) {
          validBandProfiles.push(bandProfile);
        }
      }

      setBandProfiles(validBandProfiles);
    } catch (err) {
      console.error('Error fetching band profiles:', err);
    }
  };

  const checkGigsForReview = (gigs, musicianId) => {
    const now = new Date();
    const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

    const eligibleGigs = gigs.filter((gig) => {
      const gigDate = new Date(gig.startDateTime);
      const localReviewed = localStorage.getItem(`reviewedGig-${gig.gigId}`) === 'true';
      const dbReviewed = gig.musicianHasReviewed;

      const musicianConfirmed = gig.applicants?.some(
        (a) => a.id === musicianId && a.status === 'confirmed'
      );

      return (
        gigDate > oneWeekAgo &&
        gigDate <= now &&
        !localReviewed &&
        !dbReviewed &&
        musicianConfirmed
      );
    });

    if (eligibleGigs.length > 0) {
      setGigToReview(eligibleGigs[0]);
      setGigsToReview(eligibleGigs);
      setShowReviewModal(true);
    }
  };

  const refreshMusicianProfile = () => {
    loadedOnce.current = false;
    unsubRef.current?.();
    setLoading(true);
    setMusicianProfile(null);
    setGigApplications([]);
    setGigs([]);
  };

  return (
    <MusicianDashboardContext.Provider
      value={{
        loading,
        musicianProfile,
        gigApplications,
        setGigApplications,
        gigs,
        setGigs,
        gigToReview,
        gigsToReview,
        setGigsToReview,
        showReviewModal,
        setShowReviewModal,
        bandProfiles,
        refreshMusicianProfile,
      }}
    >
      {children}
    </MusicianDashboardContext.Provider>
  );
};

export const useMusicianDashboard = () => useContext(MusicianDashboardContext);