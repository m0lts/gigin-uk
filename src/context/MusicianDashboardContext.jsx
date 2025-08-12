import { createContext, useContext, useEffect, useRef, useState } from 'react';
import { subscribeToMusicianProfile, getMusicianProfilesByIds } from '@services/musicians';
import { getGigsByIds } from '@services/gigs';
import { getBandMembers } from '@services/bands';
import { getBandDataOnly, getBandsByMusicianId } from '../services/bands';
import { getMusicianProfileByMusicianId } from '../services/musicians';

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
  const bandUnsubsRef = useRef([]);

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
        subscribeToBands(profile.bands);
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

  const subscribeToBands = (bandIds = []) => {
    cleanupBandSubscriptions();
    if (!bandIds.length) {
      setBandProfiles([]);
      return;
    }
    const newUnsubs = [];
    bandIds.forEach((bandId) => {
      const unsub = subscribeToMusicianProfile(
        bandId,
        async (profile) => {
          if (!profile) return;
          const [members, bandInfo] = await Promise.all([
            getBandMembers(bandId),
            getBandDataOnly(bandId),
          ]);

          const finalBandProfile = {
            ...profile,
            bandId,
            members,
            bandInfo,
          };

          setBandProfiles((prev) => {
            const filtered = prev.filter(p => p.bandId !== bandId);
            return [...filtered, finalBandProfile];
          });
        },
        (err) => console.error(`Error subscribing to band profile ${bandId}:`, err)
      );
      newUnsubs.push(unsub);
    });
    bandUnsubsRef.current = newUnsubs;
  };

  const cleanupBandSubscriptions = () => {
    bandUnsubsRef.current.forEach(unsub => unsub?.());
    bandUnsubsRef.current = [];
  };

  useEffect(() => {
    const run = async () => {
      if (!musicianProfile) return;
  
      const ownApplications = (musicianProfile.gigApplications || []).map(app => ({
        ...app,
        submittedBy: 'musician',
        profileId: musicianProfile.musicianId,
        profileName: musicianProfile.name,
      }));
  
      const bandApplications = bandProfiles.flatMap(band =>
        (band.gigApplications || []).map(app => ({
          ...app,
          submittedBy: 'band',
          profileId: band.bandId,
          profileName: band.name,
        }))
      );
  
      const allApplications = [...ownApplications, ...bandApplications];
      setGigApplications(allApplications);
  
      if (allApplications.length > 0) {
        const gigIds = allApplications.map((app) => app.gigId);
        const fetchedGigs = await getGigsByIds(gigIds);
  
        const allMusicianIds = [
          musicianProfile.musicianId,
          ...bandProfiles.map((band) => band.bandId),
        ];
  
        checkGigsForReview(fetchedGigs, allMusicianIds);
        setGigs(fetchedGigs);
      }
    };
  
    run();
  }, [musicianProfile, bandProfiles]);

  const checkGigsForReview = (gigs, musicianIds = []) => {
    const now = new Date();
  
    const eligibleGigs = gigs.filter((gig) => {
      const gigDate = gig.startDateTime.toDate?.() || new Date(gig.startDateTime);
      const localReviewed = localStorage.getItem(`reviewedGig-${gig.gigId}`) === 'true';
      const dbReviewed = gig.musicianHasReviewed;
  
      const isConfirmedByAnyProfile = gig.applicants?.some(
        (a) => musicianIds.includes(a.id) && a.status === 'confirmed'
      );
  
      return (
        gigDate <= now &&
        !localReviewed &&
        !dbReviewed &&
        isConfirmedByAnyProfile
      );
    });
  
    if (eligibleGigs.length > 0) {
      setGigToReview(eligibleGigs[0]);
      setGigsToReview(eligibleGigs);
      setShowReviewModal(true);
    }
  };

  const refreshSingleBand = async (bandId) => {
    try {
      const [profile, members, bandInfo] = await Promise.all([
        getMusicianProfileByMusicianId(bandId),
        getBandMembers(bandId),
        getBandDataOnly(bandId),
      ]);
  
      const updatedBand = {
        ...profile,
        bandId,
        members,
        bandInfo,
      };
  
      setBandProfiles((prev) => {
        const filtered = prev.filter((b) => b.bandId !== bandId);
        return [...filtered, updatedBand];
      });
    } catch (err) {
      console.error(`Failed to refresh band ${bandId}:`, err);
    }
  };

  const refreshMusicianProfile = () => {
    loadedOnce.current = false;
    unsubRef.current?.();
    cleanupBandSubscriptions();
    setLoading(true);
    setMusicianProfile(null);
    setBandProfiles([]);
    setGigApplications([]);
    setGigs([]);
    setGigToReview(null);
    setGigsToReview(null);
    setShowReviewModal(false);
  };

  return (
    <MusicianDashboardContext.Provider
      value={{
        loading,
        musicianProfile,
        setMusicianProfile,
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
        refreshSingleBand,
      }}
    >
      {children}
    </MusicianDashboardContext.Provider>
  );
};

export const useMusicianDashboard = () => useContext(MusicianDashboardContext);