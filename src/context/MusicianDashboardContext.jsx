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
  const [savedGigs, setSavedGigs] = useState([]);
  const [gigToReview, setGigToReview] = useState(null);
  const [gigsToReview, setGigsToReview] = useState(null);
  const [showReviewModal, setShowReviewModal] = useState(false);
  const [bandProfiles, setBandProfiles] = useState([]);

  // NEW: trigger re-subscribe after refresh
  const [refreshNonce, setRefreshNonce] = useState(0);

  const unsubRef = useRef(null);
  const bandUnsubsRef = useRef([]);

  const resolveMusicianId = (u) =>
    u?.musicianProfile?.musicianId ||
    u?.musicianProfile?.id ||
    (typeof u?.musicianProfile === 'string' ? u.musicianProfile : null) ||
    (Array.isArray(u?.musicianProfile) ? u.musicianProfile[0] : null);

  useEffect(() => {
    const baseId = resolveMusicianId(user);

    // no user or no id → stop loading so UI can render empty state
    if (!user || !baseId) {
      setMusicianProfile(null);
      setGigApplications([]);
      setGigs([]);
      setSavedGigs([]);
      setLoading(false);
      return;
    }

    setLoading(true);

    // cleanup previous subscription (on user/nonce change)
    unsubRef.current?.();

    const unsub = subscribeToMusicianProfile(
      baseId,
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
      },
      (err) => {
        console.error('Error subscribing to musician profile:', err);
        setLoading(false);
      }
    );

    unsubRef.current = unsub;
    return () => unsub?.();
  }, [user, refreshNonce]);

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
          const finalBandProfile = { ...profile, bandId, members, bandInfo };
          setBandProfiles((prev) => {
            const filtered = prev.filter((p) => p.bandId !== bandId);
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
    bandUnsubsRef.current.forEach((unsub) => unsub?.());
    bandUnsubsRef.current = [];
  };

  useEffect(() => {
    const run = async () => {
      if (!musicianProfile) return;

      const ownApplications = (musicianProfile.gigApplications || []).map((app) => ({
        ...app,
        submittedBy: 'musician',
        profileId: musicianProfile.musicianId,
        profileName: musicianProfile.name,
      }));

      const bandApplications = bandProfiles.flatMap((band) =>
        (band.gigApplications || []).map((app) => ({
          ...app,
          submittedBy: 'band',
          profileId: band.bandId,
          profileName: band.name,
        }))
      );

      const allApplications = [...ownApplications, ...bandApplications];
      setGigApplications(allApplications);

      const ownSaved = musicianProfile.savedGigs || [];
      const bandSaved = (bandProfiles || []).flatMap((b) => b.savedGigs || []);
      const savedGigIds = [...new Set([...ownSaved, ...bandSaved])];
      const applicationGigIds = [...new Set(allApplications.map((a) => a.gigId))];

      const [fetchedGigs, fetchedSavedGigs] = await Promise.all([
        applicationGigIds.length ? getGigsByIds(applicationGigIds) : Promise.resolve([]),
        savedGigIds.length ? getGigsByIds(savedGigIds) : Promise.resolve([]),
      ]);

      const allMusicianIds = [musicianProfile.musicianId, ...(bandProfiles || []).map((b) => b.bandId)];
      if (fetchedGigs.length) checkGigsForReview(fetchedGigs, allMusicianIds);

      setGigs(fetchedGigs);
      setSavedGigs(fetchedSavedGigs);
    };
    run();
  }, [musicianProfile, bandProfiles]);

  const checkGigsForReview = (gigs, musicianIds = []) => {
    const now = new Date();
    const eligible = gigs.filter((gig) => {
      const gigDate = gig.startDateTime?.toDate?.() || new Date(gig.startDateTime);
      const localReviewed = localStorage.getItem(`reviewedGig-${gig.gigId}`) === 'true';
      const dbReviewed = gig.musicianHasReviewed;
      const isConfirmedByAny = gig.applicants?.some(
        (a) => musicianIds.includes(a.id) && a.status === 'confirmed'
      );
      return gigDate <= now && !localReviewed && !dbReviewed && isConfirmedByAny;
    });
    if (eligible.length) {
      setGigToReview(eligible[0]);
      setGigsToReview(eligible);
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
      const updatedBand = { ...profile, bandId, members, bandInfo };
      setBandProfiles((prev) => {
        const filtered = prev.filter((b) => b.bandId !== bandId);
        return [...filtered, updatedBand];
      });
    } catch (err) {
      console.error(`Failed to refresh band ${bandId}:`, err);
    }
  };

  // 🔧 Updated refresh: trigger a new subscription pass
  const refreshMusicianProfile = () => {
    unsubRef.current?.();
    cleanupBandSubscriptions();

    setMusicianProfile(null);
    setBandProfiles([]);
    setGigApplications([]);
    setGigs([]);
    setSavedGigs([]);
    setGigToReview(null);
    setGigsToReview(null);
    setShowReviewModal(false);

    setLoading(true);
    setRefreshNonce((n) => n + 1); // <- drives the effect to resubscribe
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
        setGigToReview,
        gigsToReview,
        setGigsToReview,
        showReviewModal,
        setShowReviewModal,
        bandProfiles,
        refreshMusicianProfile,
        refreshSingleBand,
        savedGigs,
        setSavedGigs,
      }}
    >
      {children}
    </MusicianDashboardContext.Provider>
  );
};

export const useMusicianDashboard = () => {
  const ctx = useContext(MusicianDashboardContext);
  if (!ctx) {
    throw new Error('useMusicianDashboard must be used within <MusicianDashboardProvider>.');
  }
  return ctx;
};