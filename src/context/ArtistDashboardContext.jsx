import { createContext, useContext, useEffect, useRef, useState } from 'react';
import { subscribeToMusicianProfile, getMusicianProfilesByIds } from '@services/client-side/artists';
import { getGigsByIds } from '@services/client-side/gigs';
import { getBandMembers } from '@services/client-side/bands';
import { getBandDataOnly } from '../services/client-side/bands';
import { getMusicianProfileByMusicianId } from '../services/client-side/artists';

export const ArtistDashboardContext = createContext();

export const ArtistDashboardProvider = ({ user, children }) => {
  const [loading, setLoading] = useState(true);
  const [musicianProfile, setMusicianProfile] = useState(null);
  const [gigApplications, setGigApplications] = useState([]);
  const [gigs, setGigs] = useState([]);
  const [savedGigs, setSavedGigs] = useState([]);
  const [gigToReview, setGigToReview] = useState(null);
  const [gigsToReview, setGigsToReview] = useState(null);
  const [showReviewModal, setShowReviewModal] = useState(false);
  const [bandProfiles, setBandProfiles] = useState([]);

  // Artist dashboard specific state
  const [artistProfilesState, setArtistProfilesState] = useState([]);
  const [activeArtistProfile, setActiveArtistProfile] = useState(null);
  const [artistGigApplications, setArtistGigApplications] = useState([]);
  const [artistGigs, setArtistGigs] = useState([]);
  const [artistSavedGigs, setArtistSavedGigs] = useState([]);
  const [artistDataLoading, setArtistDataLoading] = useState(false);
  const [artistRefreshNonce, setArtistRefreshNonce] = useState(0);

  // NEW: trigger re-subscribe after refresh
  const [refreshNonce, setRefreshNonce] = useState(0);

  const unsubRef = useRef(null);
  const bandUnsubsRef = useRef([]);

  const resolveMusicianId = (u) =>
    u?.musicianProfile?.musicianId ||
    u?.musicianProfile?.id ||
    (typeof u?.musicianProfile === 'string' ? u.musicianProfile : null) ||
    (Array.isArray(u?.musicianProfile) ? u.musicianProfile[0] : null);

  const hasArtistProfiles = Array.isArray(user?.artistProfiles) && user.artistProfiles.length > 0;

  useEffect(() => {
    if (hasArtistProfiles) {
      // Artist profiles already handled via auth listener – skip musician subscriptions
      unsubRef.current?.();
      cleanupBandSubscriptions();
      setMusicianProfile(null);
      setGigApplications([]);
      setGigs([]);
      setSavedGigs([]);
      setLoading(false);
      return;
    }

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
  }, [user, refreshNonce, hasArtistProfiles]);

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

      const ownApplications = (musicianProfile.gigApplications || []).map((app) => {
          const isBand = app.profileId && (bandProfiles || []).some(b => b.bandId === app.profileId);
          return {
            ...app,
            submittedBy: isBand ? 'band' : 'musician',
            profileType: isBand ? 'band' : 'musician',
            profileName: isBand
              ? (bandProfiles.find(b => b.bandId === app.profileId)?.name || app.name)
              : musicianProfile.name,
          };
        });
        
        const bandApplications = bandProfiles.flatMap((band) =>
        (band.gigApplications || []).map((app) => ({
          ...app,
          submittedBy: 'band',
          profileType: 'band',
          profileName: band.name ?? app.name,
        }))
      );
      
      const uniqKey = (a) => `${a.gigId}:${a.profileId}`;
      const allApplications = [...ownApplications, ...bandApplications]
        .reduce((acc, a) => (acc.has(uniqKey(a)) ? acc : acc.add(uniqKey(a))), new Set())
        && Array.from(
          [...ownApplications, ...bandApplications]
            .reduce((map, a) => map.set(uniqKey(a), a), new Map())
            .values()
        );
      
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

  // ---------- Artist profile data handling ----------
  useEffect(() => {
    if (!hasArtistProfiles) {
      setArtistProfilesState([]);
      setActiveArtistProfile(null);
      return;
    }

    const profiles = (user?.artistProfiles || []).filter(Boolean);
    setArtistProfilesState(profiles);

    setActiveArtistProfile((prev) => {
      if (!profiles.length) return null;
      const completed = profiles.find((profile) => profile?.isComplete);
      if (completed) return completed;
      if (prev && profiles.some((profile) => profile.id === prev.id)) {
        return prev;
      }
      return profiles[0];
    });
  }, [hasArtistProfiles, user?.artistProfiles]);

  useEffect(() => {
    if (!hasArtistProfiles) {
      setArtistGigApplications([]);
      setArtistGigs([]);
      setArtistSavedGigs([]);
      setArtistDataLoading(false);
      return;
    }

    const profiles = artistProfilesState;
    if (!profiles.length) {
      setArtistGigApplications([]);
      setArtistGigs([]);
      setArtistSavedGigs([]);
      setArtistDataLoading(false);
      return;
    }

    let cancelled = false;
    const fetchArtistGigs = async () => {
      setArtistDataLoading(true);
      try {
        const aggregatedApplications = profiles.flatMap((profile) => {
          if (!profile) return [];
          const profileId = profile.id || profile.profileId || profile.musicianId;
          const applications = Array.isArray(profile.gigApplications) ? profile.gigApplications : [];
          return applications.map((app) => ({
            ...app,
            profileId: app.profileId || profileId,
            profileName: app.profileName || profile.name,
            submittedBy: 'artist',
            profileType: 'artist',
          }));
        });

        const uniqKey = (a) => `${a.gigId}:${a.profileId}`;
        const dedupedApplications = Array.from(
          aggregatedApplications.reduce((map, app) => map.set(uniqKey(app), app), new Map()).values()
        );
        if (!cancelled) {
          setArtistGigApplications(dedupedApplications);
        }

        const applicationGigIds = [...new Set(dedupedApplications.map((app) => app.gigId).filter(Boolean))];
        const savedGigIds = [
          ...new Set(
            profiles
              .flatMap((profile) => (Array.isArray(profile.savedGigs) ? profile.savedGigs : []))
              .filter(Boolean)
          ),
        ];

        const [appliedDocs, savedDocs] = await Promise.all([
          applicationGigIds.length ? getGigsByIds(applicationGigIds) : [],
          savedGigIds.length ? getGigsByIds(savedGigIds) : [],
        ]);

        const normalizeGigDoc = (gig) => (!gig ? gig : (gig.gigId ? gig : { ...gig, gigId: gig.gigId || gig.id }));

        if (!cancelled) {
          setArtistGigs(appliedDocs.map(normalizeGigDoc));
          setArtistSavedGigs(savedDocs.map(normalizeGigDoc));
          setArtistDataLoading(false);
        }
      } catch (err) {
        console.error('Failed to load artist gigs:', err);
        if (!cancelled) {
          setArtistGigApplications([]);
          setArtistGigs([]);
          setArtistSavedGigs([]);
          setArtistDataLoading(false);
        }
      }
    };

    fetchArtistGigs();
    return () => {
      cancelled = true;
    };
  }, [artistProfilesState, artistRefreshNonce, hasArtistProfiles]);

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

  const refreshArtistDashboard = () => {
    setArtistRefreshNonce((n) => n + 1);
  };

  return (
    <ArtistDashboardContext.Provider
      value={{
        loading,
        setLoading,
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
        artistProfiles: artistProfilesState,
        activeArtistProfile,
        setActiveArtistProfile,
        artistGigApplications,
        setArtistGigApplications,
        artistGigs,
        setArtistGigs,
        artistSavedGigs,
        setArtistSavedGigs,
        artistDataLoading,
        refreshArtistDashboard,
      }}
    >
      {children}
    </ArtistDashboardContext.Provider>
  );
};

export const useArtistDashboard = () => {
  const ctx = useContext(ArtistDashboardContext);
  if (!ctx) {
    throw new Error('useArtistDashboard must be used within <ArtistDashboardProvider>.');
  }
  return ctx;
};