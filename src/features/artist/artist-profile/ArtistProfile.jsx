import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { useAuth } from '@hooks/useAuth';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { ProfileView } from './components/ProfileView';
import '@styles/artists/artist-profile-new.styles.css';
// Hardcoded background image for example profile
import artistProfileBackground from '@assets/images/arctic-monkeys.jpeg';
import { generateArtistProfileId, createArtistProfileDocument, updateArtistProfileDocument } from '@services/client-side/artists';
import { uploadFileToStorage, uploadFileWithProgress, deleteStoragePath } from '@services/storage';
import { updateUserArrayField } from '@services/api/users';
import { toast } from 'sonner';
import { NoImageIcon } from '@features/shared/ui/extras/Icons';
import { CREATION_STEP_ORDER } from './components/ProfileCreationBox';
import { LoadingModal } from '@features/shared/ui/loading/LoadingModal';

const BRIGHTNESS_DEFAULT = 100;
const BRIGHTNESS_RANGE = 40; // slider distance from neutral

const HERO_POSITION_DEFAULT = 50;
const HERO_POSITION_MIN = 0;
const HERO_POSITION_MAX = 100;

const generateCreationId = (prefix = 'item') =>
  typeof crypto !== 'undefined' && crypto.randomUUID
    ? crypto.randomUUID()
    : `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;

const clampHeroPosition = (value = HERO_POSITION_DEFAULT) =>
  Math.min(HERO_POSITION_MAX, Math.max(HERO_POSITION_MIN, value));

const getBrightnessOverlayStyle = (value = BRIGHTNESS_DEFAULT) => {
  if (!value || value === BRIGHTNESS_DEFAULT) {
    return { opacity: 0, backgroundColor: 'transparent' };
  }

  const delta = value - BRIGHTNESS_DEFAULT;
  const intensity = Math.min(Math.abs(delta) / BRIGHTNESS_RANGE, 1);
  const opacity = Math.min(intensity * 0.65, 0.65);
  const backgroundColor = delta > 0 ? 'rgba(0,0,0,1)' : 'rgba(255,255,255,1)';
  return { opacity, backgroundColor };
};

/**
 * Unified Artist Profile Component
 * 
 * Handles three states seamlessly:
 * 1. EXAMPLE_PROFILE - Shows example profiles when user hasn't created one yet
 * 2. CREATING - Profile creation flow overlay
 * 3. DASHBOARD - Full dashboard when profile is complete
 * 
 * The user's image stays as a constant background regardless of state changes.
 * 
 * Within DASHBOARD state, there are 4 sub-states:
 * - Profile
 * - Gigs
 * - Messages
 * - Finances
 */

// Main state constants
export const ArtistProfileState = {
  EXAMPLE_PROFILE: 'example_profile',
  CREATING: 'creating',
  DASHBOARD: 'dashboard',
};

// Dashboard sub-state constants
export const DashboardView = {
  PROFILE: 'profile',
  GIGS: 'gigs',
  MESSAGES: 'messages',
  FINANCES: 'finances',
};

export const ArtistProfile = ({ 
  user: userProp,
  setAuthModal,
  setAuthType,
}) => {
  const { user: authUser, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [selectedExampleProfile, setSelectedExampleProfile] = useState(null);
  
  // Use prop user if provided, otherwise use auth user
  const user = userProp || authUser;

  // Determine current state based on profile status
  const [currentState, setCurrentState] = useState(ArtistProfileState.EXAMPLE_PROFILE);
  const [backgroundImage, setBackgroundImage] = useState(null);
  const [isCreatingProfile, setIsCreatingProfile] = useState(false);
  const [initializingArtistProfile, setInitializingArtistProfile] = useState(false);
  const [creationStep, setCreationStep] = useState(CREATION_STEP_ORDER[0]);
  const [creationHasHeroImage, setCreationHasHeroImage] = useState(false);
  const [creationProfileId, setCreationProfileId] = useState(null);
  const [creationHeroImage, setCreationHeroImage] = useState(null);
  const [creationHeroBrightness, setCreationHeroBrightness] = useState(BRIGHTNESS_DEFAULT);
  const [creationHeroPosition, setCreationHeroPosition] = useState(HERO_POSITION_DEFAULT);
  const [creationArtistName, setCreationArtistName] = useState("");
  const [creationArtistBio, setCreationArtistBio] = useState("");
  const [creationSpotifyUrl, setCreationSpotifyUrl] = useState("");
  const [creationSoundcloudUrl, setCreationSoundcloudUrl] = useState("");
  const [creationYoutubeUrl, setCreationYoutubeUrl] = useState("");
  const [creationVideos, setCreationVideos] = useState([]);
  const [creationTracks, setCreationTracks] = useState([]);
  const [heroUploadStatus, setHeroUploadStatus] = useState('idle');
  const [heroUploadProgress, setHeroUploadProgress] = useState(0);
  const [tracksUploadStatus, setTracksUploadStatus] = useState('idle');
  const [tracksUploadProgress, setTracksUploadProgress] = useState(0);
  const [showTracksUploadModal, setShowTracksUploadModal] = useState(false);
  const [videoUploadStatus, setVideoUploadStatus] = useState('idle');
  const [videoUploadProgress, setVideoUploadProgress] = useState(0);
  const [showVideoUploadModal, setShowVideoUploadModal] = useState(false);
  const [isRepositioningHero, setIsRepositioningHero] = useState(false);
  const [isHeroDragging, setIsHeroDragging] = useState(false);
  const [savingDraft, setSavingDraft] = useState(false);
  const [creationWebsiteUrl, setCreationWebsiteUrl] = useState("");
  const [creationInstagramUrl, setCreationInstagramUrl] = useState("");
  // Dashboard sub-state (which view to show: Profile, Gigs, Messages, Finances)
  const [dashboardView, setDashboardView] = useState(DashboardView.PROFILE);
  
  // Track previous profile state to detect completion
  const previousProfileRef = useRef(null);
  const heroBrightnessUpdateTimeoutRef = useRef(null);
  const heroPositionUpdateTimeoutRef = useRef(null);
  const artistNameUpdateTimeoutRef = useRef(null);
  const artistBioUpdateTimeoutRef = useRef(null);
  const spotifyUrlUpdateTimeoutRef = useRef(null);
  const soundcloudUrlUpdateTimeoutRef = useRef(null);
  const websiteUrlUpdateTimeoutRef = useRef(null);
  const instagramUrlUpdateTimeoutRef = useRef(null);
  const youtubeUrlUpdateTimeoutRef = useRef(null);
  const heroDragStateRef = useRef({
    isDragging: false,
    startY: 0,
    startPosition: HERO_POSITION_DEFAULT,
  });
  const backgroundImageRef = useRef(null);
  const stateBoxRef = useRef(null);
  const heroStoragePathRef = useRef(null);
  const heroUploadTokenRef = useRef(null);
  const tracksUploadTokenRef = useRef(null);
  const videosUploadTokenRef = useRef(null);
  const tracksStoragePathsRef = useRef({}); // Track storage paths: { trackId: { audioPath, coverPath } }
  const videosStoragePathsRef = useRef({}); // Track storage paths for videos: { videoId: { videoPath, thumbnailPath } }
  const tracksUploadInProgressRef = useRef(false); // Track if upload is in progress to prevent re-runs
  const videosUploadInProgressRef = useRef(false);
  const previousTracksStepRef = useRef(creationStep); // Track previous step to detect when moving away from tracks
  const previousVideosStepRef = useRef(creationStep); // Track previous step to detect when moving away from videos
  const latestTracksRef = useRef([]); // Store the most up-to-date tracks data (including uploaded URLs)
  const latestVideosRef = useRef([]); // Store the most up-to-date videos data (including generated thumbnails)
  const isMountedRef = useRef(true);

  const artistProfiles = user?.artistProfiles || [];
  const completedProfile = useMemo(
    () => artistProfiles.find((profile) => profile?.isComplete),
    [artistProfiles]
  );
  const draftProfile = useMemo(
    () => artistProfiles.find((profile) => !profile?.isComplete),
    [artistProfiles]
  );
  const activeProfileData = completedProfile || draftProfile || null;
  const hasCompleteProfile = !!completedProfile;
  const isCreationState = currentState === ArtistProfileState.CREATING;

  const displayName = useMemo(() => {
    if (currentState === ArtistProfileState.EXAMPLE_PROFILE) {
      return selectedExampleProfile?.name || 'Example Artist';
    }
    if (currentState === ArtistProfileState.CREATING && creationArtistName) {
      return creationArtistName;
    }
    return activeProfileData?.name;
  }, [currentState, selectedExampleProfile, activeProfileData?.name, creationArtistName]);

  // Handle authentication - redirect to auth if not logged in
  useEffect(() => {
    if (!authLoading && !user && setAuthModal) {
      setAuthModal(true);
      setAuthType?.('login');
    }
  }, [authLoading, user, setAuthModal, setAuthType]);

  useEffect(() => {
    return () => {
      isMountedRef.current = false;
      if (heroBrightnessUpdateTimeoutRef.current) {
        clearTimeout(heroBrightnessUpdateTimeoutRef.current);
      }
      if (heroPositionUpdateTimeoutRef.current) {
        clearTimeout(heroPositionUpdateTimeoutRef.current);
      }
      if (artistNameUpdateTimeoutRef.current) {
        clearTimeout(artistNameUpdateTimeoutRef.current);
      }
      if (artistBioUpdateTimeoutRef.current) {
        clearTimeout(artistBioUpdateTimeoutRef.current);
      }
      if (spotifyUrlUpdateTimeoutRef.current) {
        clearTimeout(spotifyUrlUpdateTimeoutRef.current);
      }
      if (soundcloudUrlUpdateTimeoutRef.current) {
        clearTimeout(soundcloudUrlUpdateTimeoutRef.current);
      }
      if (websiteUrlUpdateTimeoutRef.current) {
        clearTimeout(websiteUrlUpdateTimeoutRef.current);
      }
      if (instagramUrlUpdateTimeoutRef.current) {
        clearTimeout(instagramUrlUpdateTimeoutRef.current);
      }
      heroUploadTokenRef.current = null;
      tracksUploadTokenRef.current = null;
      videosUploadTokenRef.current = null;
    };
  }, []);

  // Support URL-based state (optional, for deep linking)
  useEffect(() => {
    const urlState = searchParams.get('state');
    if (urlState && Object.values(ArtistProfileState).includes(urlState)) {
      // Only allow URL state if it makes sense (e.g., don't force dashboard if no profile)
      if (urlState === ArtistProfileState.CREATING && !hasCompleteProfile) {
        setCurrentState(ArtistProfileState.CREATING);
        setIsCreatingProfile(true);
      }
    }
  }, [searchParams, hasCompleteProfile]);

  // Determine state based on profile status
  useEffect(() => {
    // If we're in creating state, don't auto-switch until profile is complete
    if (isCreatingProfile && !hasCompleteProfile) {
      return;
    }

    if (hasCompleteProfile) {
      // Profile just completed - transition to dashboard
      if (previousProfileRef.current !== hasCompleteProfile) {
        setIsCreatingProfile(false);
        setCurrentState(ArtistProfileState.DASHBOARD);
        // Clear URL state when transitioning to dashboard
        setSearchParams({});
      }
    } else {
      // No complete profile - show example view (unless explicitly creating)
      if (!isCreatingProfile) {
        setCurrentState(ArtistProfileState.EXAMPLE_PROFILE);
        // Clear URL state when showing example
        if (searchParams.get('state')) {
          setSearchParams({});
        }
      }
    }

    previousProfileRef.current = hasCompleteProfile;
  }, [hasCompleteProfile, isCreatingProfile, searchParams]);

  // Keep hero image in sync with current state
  useEffect(() => {
    let targetImage;

    if (currentState === ArtistProfileState.EXAMPLE_PROFILE) {
      targetImage = selectedExampleProfile?.backgroundImage || artistProfileBackground;
    } else if (creationHasHeroImage && creationHeroImage?.previewUrl) {
      targetImage = creationHeroImage.previewUrl;
    } else if (activeProfileData?.heroMedia?.url) {
      targetImage = activeProfileData.heroMedia.url;
    } else {
      targetImage = artistProfileBackground;
    }

    if (targetImage && targetImage !== backgroundImage) {
      setBackgroundImage(targetImage);
    }
  }, [
    currentState,
    selectedExampleProfile,
    creationHasHeroImage,
    creationHeroImage?.previewUrl,
    activeProfileData?.heroMedia?.url,
    backgroundImage,
  ]);

  const resetCreationState = () => {
    setIsCreatingProfile(false);
    setCreationProfileId(null);
    setCreationHeroImage(null);
    heroStoragePathRef.current = null;
    setCreationHasHeroImage(false);
    setCreationHeroBrightness(BRIGHTNESS_DEFAULT);
    setCreationHeroPosition(HERO_POSITION_DEFAULT);
    setCreationArtistName("");
    setCreationArtistBio("");
    setCreationSpotifyUrl("");
    setCreationSoundcloudUrl("");
    setCreationYoutubeUrl("");
    setCreationWebsiteUrl("");
    setCreationInstagramUrl("");
    setCreationVideos([]);
    setCreationTracks([]);
    setCreationStep(CREATION_STEP_ORDER[0]);
    setHeroUploadStatus('idle');
    setHeroUploadProgress(0);
    setTracksUploadStatus('idle');
    setTracksUploadProgress(0);
    setVideoUploadStatus('idle');
    setVideoUploadProgress(0);
    setShowTracksUploadModal(false);
    setShowVideoUploadModal(false);
    heroUploadTokenRef.current = null;
    tracksUploadTokenRef.current = null;
    videosUploadTokenRef.current = null;
    tracksStoragePathsRef.current = {};
    videosStoragePathsRef.current = {};
    tracksUploadInProgressRef.current = false;
    videosUploadInProgressRef.current = false;
    latestTracksRef.current = [];
    latestVideosRef.current = [];
    if (heroBrightnessUpdateTimeoutRef.current) {
      clearTimeout(heroBrightnessUpdateTimeoutRef.current);
    }
    if (heroPositionUpdateTimeoutRef.current) {
      clearTimeout(heroPositionUpdateTimeoutRef.current);
    }
    if (artistNameUpdateTimeoutRef.current) {
      clearTimeout(artistNameUpdateTimeoutRef.current);
    }
    if (artistBioUpdateTimeoutRef.current) {
      clearTimeout(artistBioUpdateTimeoutRef.current);
    }
    if (websiteUrlUpdateTimeoutRef.current) {
      clearTimeout(websiteUrlUpdateTimeoutRef.current);
    }
    if (instagramUrlUpdateTimeoutRef.current) {
      clearTimeout(instagramUrlUpdateTimeoutRef.current);
    }
    if (youtubeUrlUpdateTimeoutRef.current) {
      clearTimeout(youtubeUrlUpdateTimeoutRef.current);
    }
    setIsRepositioningHero(false);
    setIsHeroDragging(false);
    heroDragStateRef.current.isDragging = false;
    setSearchParams({});
  };

  // Resume draft profile automatically
  useEffect(() => {
    if (!draftProfile) return;
    if (creationProfileId === draftProfile.id) return;
    if (isCreatingProfile) return;
    if (hasCompleteProfile) return;

    setIsCreatingProfile(true);
    setCurrentState(ArtistProfileState.CREATING);
    setCreationProfileId(draftProfile.id);
    setCreationStep(draftProfile.onboardingStep || CREATION_STEP_ORDER[0]);
    const savedBrightness = draftProfile.heroBrightness ?? BRIGHTNESS_DEFAULT;
    setCreationHeroBrightness(savedBrightness);
    const savedPosition = clampHeroPosition(draftProfile.heroPositionY ?? HERO_POSITION_DEFAULT);
    setCreationHeroPosition(savedPosition);
    setCreationArtistName(draftProfile.name || "");
    setCreationArtistBio(draftProfile.bio || "");
    setCreationSpotifyUrl(draftProfile.spotifyUrl || "");
    setCreationSoundcloudUrl(draftProfile.soundcloudUrl || "");
    setCreationYoutubeUrl(draftProfile.youtubeUrl || "");
    setCreationWebsiteUrl(draftProfile.websiteUrl || "");
    setCreationInstagramUrl(draftProfile.instagramUrl || "");

    // Load tracks from draft profile
    if (draftProfile.tracks && Array.isArray(draftProfile.tracks) && draftProfile.tracks.length > 0) {
      const loadedTracks = draftProfile.tracks.map(track => ({
        id: track.id,
        title: track.title || `Track ${track.id}`,
        artist: track.artist || "",
        audioFile: null,
        audioPreviewUrl: track.audioUrl || null,
        coverFile: null,
        coverPreviewUrl: track.coverUrl || null,
        // Preserve both uploadedAudioUrl and audioUrl for fallback
        uploadedAudioUrl: track.audioUrl || null,
        audioUrl: track.audioUrl || null, // Preserve original for fallback
        coverUploadedUrl: track.coverUrl || null,
        coverUrl: track.coverUrl || null, // Preserve original for fallback
        audioStoragePath: track.audioStoragePath || null,
        coverStoragePath: track.coverStoragePath || null,
      }));
      setCreationTracks(loadedTracks);
      latestTracksRef.current = loadedTracks; // Update ref with loaded tracks

      // Update storage paths ref
      loadedTracks.forEach(track => {
        if (track.audioStoragePath || track.coverStoragePath) {
          tracksStoragePathsRef.current[track.id] = {
            audioPath: track.audioStoragePath || null,
            coverPath: track.coverStoragePath || null,
          };
        }
      });
    } else {
      setCreationTracks([]);
    }

    // Load videos from draft profile
    if (draftProfile.videos && Array.isArray(draftProfile.videos) && draftProfile.videos.length > 0) {
      const loadedVideos = draftProfile.videos.map((video, index) => {
        const resolvedId = video.id || generateCreationId('video');
        const resolvedTitle = video.title || `Video ${index + 1}`;
        const storedVideoUrl = video.videoUrl || video.file || null;
        const storedThumbnailUrl = video.thumbnail || null;
        return {
          id: resolvedId,
          title: resolvedTitle,
          videoFile: null,
          videoPreviewUrl: storedVideoUrl,
          thumbnailFile: null,
          thumbnailPreviewUrl: storedThumbnailUrl,
          uploadedVideoUrl: storedVideoUrl,
          thumbnailUploadedUrl: storedThumbnailUrl,
          videoStoragePath: video.videoStoragePath || null,
          thumbnailStoragePath: video.thumbnailStoragePath || null,
        };
      });
      setCreationVideos(loadedVideos);
      latestVideosRef.current = loadedVideos;
        loadedVideos.forEach((video) => {
          if (video.videoStoragePath || video.thumbnailStoragePath) {
            videosStoragePathsRef.current[video.id] = {
              videoPath: video.videoStoragePath || null,
              thumbnailPath: video.thumbnailStoragePath || null,
            };
          }
        });
    } else {
      setCreationVideos([]);
      latestVideosRef.current = [];
    }

    if (draftProfile.heroMedia?.url) {
      setCreationHeroImage({
        file: null,
        previewUrl: draftProfile.heroMedia.url,
        storagePath: draftProfile.heroMedia.storagePath || null,
      });
      setCreationHasHeroImage(true);
      setBackgroundImage(draftProfile.heroMedia.url);
      heroStoragePathRef.current = draftProfile.heroMedia.storagePath || null;
    } else {
      setCreationHeroImage(null);
      heroStoragePathRef.current = null;
      setCreationHasHeroImage(false);
    }
  }, [draftProfile, creationProfileId, isCreatingProfile, hasCompleteProfile]);

  // Handle transition to creation flow
  const handleBeginCreation = async () => {
    if (initializingArtistProfile) return;

    // Require authentication before starting the flow
    if (!user?.uid) {
      setAuthModal?.(true);
      setAuthType?.('login');
      return;
    }

    if (draftProfile) {
      setIsCreatingProfile(true);
      setCurrentState(ArtistProfileState.CREATING);
      setCreationProfileId(draftProfile.id);
      setCreationStep(draftProfile.onboardingStep || CREATION_STEP_ORDER[0]);
      const savedBrightness = draftProfile.heroBrightness ?? BRIGHTNESS_DEFAULT;
      setCreationHeroBrightness(savedBrightness);
      const savedPosition = clampHeroPosition(draftProfile.heroPositionY ?? HERO_POSITION_DEFAULT);
      setCreationHeroPosition(savedPosition);
      setCreationArtistBio(draftProfile.bio || "");
      setCreationSpotifyUrl(draftProfile.spotifyUrl || "");
      setCreationSoundcloudUrl(draftProfile.soundcloudUrl || "");
      setCreationYoutubeUrl(draftProfile.youtubeUrl || "");
      setCreationWebsiteUrl(draftProfile.websiteUrl || "");
      setCreationInstagramUrl(draftProfile.instagramUrl || "");

      // Load tracks from draft profile
      if (draftProfile.tracks && Array.isArray(draftProfile.tracks) && draftProfile.tracks.length > 0) {
        const loadedTracks = draftProfile.tracks.map(track => ({
          id: track.id,
          title: track.title || `Track ${track.id}`,
          artist: track.artist || "",
          audioFile: null,
          audioPreviewUrl: track.audioUrl || null,
          coverFile: null,
          coverPreviewUrl: track.coverUrl || null,
          // Preserve both uploadedAudioUrl and audioUrl for fallback
          uploadedAudioUrl: track.audioUrl || null,
          audioUrl: track.audioUrl || null, // Preserve original for fallback
          coverUploadedUrl: track.coverUrl || null,
          coverUrl: track.coverUrl || null, // Preserve original for fallback
          audioStoragePath: track.audioStoragePath || null,
          coverStoragePath: track.coverStoragePath || null,
        }));
        setCreationTracks(loadedTracks);
        latestTracksRef.current = loadedTracks; // Update ref with loaded tracks

        // Update storage paths ref
        loadedTracks.forEach(track => {
          if (track.audioStoragePath || track.coverStoragePath) {
            tracksStoragePathsRef.current[track.id] = {
              audioPath: track.audioStoragePath || null,
              coverPath: track.coverStoragePath || null,
            };
          }
        });
      } else {
        setCreationTracks([]);
      }

      if (draftProfile.videos && Array.isArray(draftProfile.videos) && draftProfile.videos.length > 0) {
        const loadedVideos = draftProfile.videos.map((video, index) => {
          const resolvedId = video.id || generateCreationId('video');
          const resolvedTitle = video.title || `Video ${index + 1}`;
          const storedVideoUrl = video.videoUrl || video.file || null;
          const storedThumbnailUrl = video.thumbnail || null;
          return {
            id: resolvedId,
            title: resolvedTitle,
            videoFile: null,
            videoPreviewUrl: storedVideoUrl,
            thumbnailFile: null,
            thumbnailPreviewUrl: storedThumbnailUrl,
            uploadedVideoUrl: storedVideoUrl,
            thumbnailUploadedUrl: storedThumbnailUrl,
            videoStoragePath: video.videoStoragePath || null,
            thumbnailStoragePath: video.thumbnailStoragePath || null,
          };
        });
        setCreationVideos(loadedVideos);
        latestVideosRef.current = loadedVideos;
        loadedVideos.forEach((video) => {
          if (video.videoStoragePath || video.thumbnailStoragePath) {
            videosStoragePathsRef.current[video.id] = {
              videoPath: video.videoStoragePath || null,
              thumbnailPath: video.thumbnailStoragePath || null,
            };
          }
        });
      } else {
        setCreationVideos([]);
        latestVideosRef.current = [];
      }

      if (draftProfile.heroMedia?.url) {
        setCreationHeroImage({
          file: null,
          previewUrl: draftProfile.heroMedia.url,
          storagePath: draftProfile.heroMedia.storagePath || null,
        });
        setCreationHasHeroImage(true);
        setBackgroundImage(draftProfile.heroMedia.url);
        heroStoragePathRef.current = draftProfile.heroMedia.storagePath || null;
      } else {
        setCreationHeroImage(null);
        heroStoragePathRef.current = null;
        setCreationHasHeroImage(false);
      }
      setSearchParams({ state: ArtistProfileState.CREATING, profileId: draftProfile.id });
      return;
    }

    setInitializingArtistProfile(true);
    setCreationHasHeroImage(false);
    const newProfileId = generateArtistProfileId();

    try {
      // Step 1: add reference to the user's artistProfiles array
      await updateUserArrayField({ field: 'artistProfiles', op: 'add', value: newProfileId });

      // Step 2: create the artist profile document with initial data
      await createArtistProfileDocument({
        profileId: newProfileId,
        userId: user.uid,
        darkMode: isDarkMode,
      });

      setIsCreatingProfile(true);
      setCreationProfileId(newProfileId);
      setCreationHeroImage(null);
      heroStoragePathRef.current = null;
      setCreationHeroBrightness(BRIGHTNESS_DEFAULT);
      setCreationHeroPosition(HERO_POSITION_DEFAULT);
      setCreationArtistBio("");
      setCreationSpotifyUrl("");
      setCreationSoundcloudUrl("");
      setCreationYoutubeUrl("");
      setCreationWebsiteUrl("");
      setCreationInstagramUrl("");
      setCreationHasHeroImage(false);
      if (heroBrightnessUpdateTimeoutRef.current) {
        clearTimeout(heroBrightnessUpdateTimeoutRef.current);
      }
      if (heroPositionUpdateTimeoutRef.current) {
        clearTimeout(heroPositionUpdateTimeoutRef.current);
      }
      setCreationStep(CREATION_STEP_ORDER[0]);
      setCurrentState(ArtistProfileState.CREATING);
      setSearchParams({ state: ArtistProfileState.CREATING, profileId: newProfileId });
    } catch (error) {
      console.error('Failed to start artist profile creation:', error);
      toast.error('Unable to start your artist profile right now. Please try again.');

      // Roll back the user document if the profile creation fails after adding the ID
      try {
        await updateUserArrayField({ field: 'artistProfiles', op: 'remove', value: newProfileId });
      } catch (rollbackError) {
        console.error('Failed to rollback artistProfiles reference:', rollbackError);
      }
    } finally {
      setInitializingArtistProfile(false);
    }
  };

  // Handle profile creation completion
  const handleProfileCreated = () => {
    if (heroBrightnessUpdateTimeoutRef.current) {
      clearTimeout(heroBrightnessUpdateTimeoutRef.current);
    }
    resetCreationState();
    // State will automatically transition to DASHBOARD via useEffect
  };

  const handleHeroPositionChange = useCallback(
    (value) => {
      const clamped = clampHeroPosition(value);
      setCreationHeroPosition(clamped);
      if (!creationProfileId) return;

      if (heroPositionUpdateTimeoutRef.current) {
        clearTimeout(heroPositionUpdateTimeoutRef.current);
      }

      heroPositionUpdateTimeoutRef.current = setTimeout(async () => {
        try {
          await updateArtistProfileDocument(creationProfileId, { heroPositionY: clamped });
        } catch (error) {
          console.error('Failed to update hero position:', error);
        }
      }, 400);
    },
    [creationProfileId]
  );

  const handleHeroPointerMove = useCallback(
    (event) => {
      if (!heroDragStateRef.current.isDragging) return;
      event.preventDefault();
      const viewportHeight = window.innerHeight || backgroundImageRef.current?.offsetHeight || 1;
      const deltaY = event.clientY - heroDragStateRef.current.startY;
      const percentDelta = (deltaY / viewportHeight) * 100;
      const nextPosition = clampHeroPosition(heroDragStateRef.current.startPosition - percentDelta);
      handleHeroPositionChange(nextPosition);
    },
    [handleHeroPositionChange]
  );

  const handleHeroPointerUp = useCallback(() => {
    if (!heroDragStateRef.current.isDragging) return;
    heroDragStateRef.current.isDragging = false;
    setIsHeroDragging(false);
    window.removeEventListener('pointermove', handleHeroPointerMove);
    window.removeEventListener('pointerup', handleHeroPointerUp);
  }, [handleHeroPointerMove]);

  const handleHeroPointerDown = useCallback(
    (event) => {
      if (!isRepositioningHero || !isCreationState || !creationHasHeroImage) return;
      event.preventDefault();
      heroDragStateRef.current.isDragging = true;
      heroDragStateRef.current.startY = event.clientY;
      heroDragStateRef.current.startPosition = creationHeroPosition;
      setIsHeroDragging(true);
      window.addEventListener('pointermove', handleHeroPointerMove);
      window.addEventListener('pointerup', handleHeroPointerUp);
    },
    [
      isRepositioningHero,
      isCreationState,
      creationHasHeroImage,
      creationHeroPosition,
      handleHeroPointerMove,
      handleHeroPointerUp,
    ]
  );

  const handleHeroRepositionToggle = useCallback(
    (active) => {
      setIsRepositioningHero(active);
      if (!active && heroDragStateRef.current.isDragging) {
        heroDragStateRef.current.isDragging = false;
        setIsHeroDragging(false);
        window.removeEventListener('pointermove', handleHeroPointerMove);
        window.removeEventListener('pointerup', handleHeroPointerUp);
      }
    },
    [handleHeroPointerMove, handleHeroPointerUp]
  );

  useEffect(() => {
    return () => {
      window.removeEventListener('pointermove', handleHeroPointerMove);
      window.removeEventListener('pointerup', handleHeroPointerUp);
    };
  }, [handleHeroPointerMove, handleHeroPointerUp]);

  useEffect(() => {
    if (!creationHasHeroImage && isRepositioningHero) {
      handleHeroRepositionToggle(false);
    }
  }, [creationHasHeroImage, isRepositioningHero, handleHeroRepositionToggle]);

  useEffect(() => {
    if (!isCreationState && isRepositioningHero) {
      handleHeroRepositionToggle(false);
    }
  }, [isCreationState, isRepositioningHero, handleHeroRepositionToggle]);

  useEffect(() => {
    const isHeroStep = creationStep === CREATION_STEP_ORDER[0];
    const shouldUpload =
      creationProfileId &&
      !isHeroStep &&
      creationHeroImage?.file;

    if (!shouldUpload) return;

    const uploadToken = Symbol('hero-upload');
    heroUploadTokenRef.current = uploadToken;
    setHeroUploadStatus('uploading');
    setHeroUploadProgress(0);

    const file = creationHeroImage.file;
    const extension = file.name?.split('.').pop() || 'jpg';
    const filename = `background-${Date.now()}.${extension}`;
    const storagePath = `artistProfiles/${creationProfileId}/hero/${filename}`;
    const previousStoragePath = heroStoragePathRef.current;
    const currentPreviewUrl = creationHeroImage?.previewUrl;

    uploadFileWithProgress(file, storagePath, (progress) => {
      if (heroUploadTokenRef.current !== uploadToken) return;
      if (!isMountedRef.current) return;
      setHeroUploadProgress(progress);
    })
      .then(async (heroUrl) => {
        if (heroUploadTokenRef.current !== uploadToken) return;
        if (!isMountedRef.current) return;
        setCreationHeroImage({
          file: null,
          previewUrl: currentPreviewUrl || heroUrl,
          storagePath,
          uploadedUrl: heroUrl,
        });
        setCreationHasHeroImage(true);
        setHeroUploadStatus('complete');
        setHeroUploadProgress(100);
        heroStoragePathRef.current = storagePath;
        if (previousStoragePath && previousStoragePath !== storagePath) {
          deleteStoragePath(previousStoragePath);
        }

        const preload = new Image();
        preload.onload = () => {
          if (heroUploadTokenRef.current !== uploadToken) return;
          if (!isMountedRef.current) return;
          setBackgroundImage(heroUrl);
        };
        preload.onerror = () => {
          if (heroUploadTokenRef.current !== uploadToken) return;
          if (!isMountedRef.current) return;
          setBackgroundImage(heroUrl);
        };
        preload.src = heroUrl;

        if (creationProfileId) {
          try {
            await updateArtistProfileDocument(creationProfileId, {
              heroMedia: { url: heroUrl, storagePath },
            });
          } catch (error) {
            console.error('Failed to persist hero media after upload:', error);
          }
        }
      })
      .catch((error) => {
        if (heroUploadTokenRef.current !== uploadToken) return;
        if (!isMountedRef.current) return;
        console.error('Hero image async upload failed:', error);
        setHeroUploadStatus('error');
      });
  }, [creationStep, creationHeroImage?.file, creationProfileId]);

  // Async upload tracks when user moves away from tracks step
  useEffect(() => {
    const previousStep = previousTracksStepRef.current;
    const currentStep = creationStep;
    previousTracksStepRef.current = currentStep;

    // Only trigger upload if we're moving FROM tracks step TO a different step
    const movedAwayFromTracks = previousStep === 'tracks' && currentStep !== 'tracks';

    // Prevent re-running if upload is already in progress
    if (tracksUploadInProgressRef.current) {
      return;
    }

    const hasTracksToUpload = creationTracks.some(
      track => track.audioFile || track.coverFile
    );

    const shouldUpload =
      creationProfileId &&
      movedAwayFromTracks &&
      hasTracksToUpload;

    if (!shouldUpload) {
      // Reset upload status if there's nothing to upload
      if (tracksUploadStatus === 'uploading') {
        setTracksUploadStatus('idle');
        setTracksUploadProgress(0);
      }
      return;
    }

    // Mark upload as in progress
    tracksUploadInProgressRef.current = true;

    const uploadToken = Symbol('tracks-upload');
    tracksUploadTokenRef.current = uploadToken;
    setTracksUploadStatus('uploading');
    setTracksUploadProgress(0);

    const uploadPromises = [];
    // Create a deep copy of tracks to update, preserving all existing properties including uploaded URLs
    const tracksToUpdate = creationTracks.map(track => ({
      ...track,
      // Preserve existing uploaded URLs if they exist
      uploadedAudioUrl: track.uploadedAudioUrl || track.audioUrl || null,
      coverUploadedUrl: track.coverUploadedUrl || track.coverUrl || null,
      audioStoragePath: track.audioStoragePath || null,
      coverStoragePath: track.coverStoragePath || null,
    }));
    let completedUploads = 0;
    const totalUploads = creationTracks.reduce((count, track) => {
      return count + (track.audioFile ? 1 : 0) + (track.coverFile ? 1 : 0);
    }, 0);



    // If there are no uploads to do, exit early
    if (totalUploads === 0) {
      return;
    }

    creationTracks.forEach((track, index) => {
      const trackId = track.id;
      const previousPaths = tracksStoragePathsRef.current[trackId] || {};

      // Upload audio file if present
      if (track.audioFile) {
        const extension = track.audioFile.name?.split('.').pop() || 'mp3';
        const filename = `track-${trackId}-${Date.now()}.${extension}`;
        const storagePath = `artistProfiles/${creationProfileId}/tracks/${filename}`;
        const previousAudioPath = previousPaths.audioPath;

        const audioUploadPromise = uploadFileWithProgress(
          track.audioFile,
          storagePath,
          (progress) => {
            if (tracksUploadTokenRef.current !== uploadToken) return;
            if (!isMountedRef.current) return;
            // Update progress based on completed uploads + current progress
            const baseProgress = (completedUploads / totalUploads) * 100;
            const currentProgress = (progress / totalUploads) * 100;
            setTracksUploadProgress(baseProgress + currentProgress);
          }
        )
          .then(async (audioUrl) => {
            if (tracksUploadTokenRef.current !== uploadToken) return;
            if (!isMountedRef.current) return;


            // Update track with uploaded URL and storage path
            const trackIndex = tracksToUpdate.findIndex(t => t.id === trackId);
            if (trackIndex !== -1) {
              tracksToUpdate[trackIndex] = {
                ...tracksToUpdate[trackIndex],
                uploadedAudioUrl: audioUrl,
                audioStoragePath: storagePath,
                audioFile: null, // Clear file reference after upload
                // Preserve preview URL if uploaded URL exists
                audioPreviewUrl: tracksToUpdate[trackIndex].audioPreviewUrl || audioUrl,
              };
            }

            // Update storage paths ref
            tracksStoragePathsRef.current[trackId] = {
              ...tracksStoragePathsRef.current[trackId],
              audioPath: storagePath,
            };

            // Delete previous audio file if it exists and is different
            if (previousAudioPath && previousAudioPath !== storagePath) {
              try {
                await deleteStoragePath(previousAudioPath);
              } catch (error) {
                console.error(`Failed to delete previous audio file ${previousAudioPath}:`, error);
              }
            }

            completedUploads++;
            const progress = (completedUploads / totalUploads) * 100;
            if (tracksUploadTokenRef.current === uploadToken) {
              if (!isMountedRef.current) return;
              setTracksUploadProgress(progress);
            }
          })
          .catch((error) => {
            if (tracksUploadTokenRef.current !== uploadToken) return;
            console.error(`Failed to upload audio for track ${trackId}:`, error);
            completedUploads++;
          });

        uploadPromises.push(audioUploadPromise);
      }

      // Upload cover image if present
      if (track.coverFile) {
        const extension = track.coverFile.name?.split('.').pop() || 'jpg';
        const filename = `cover-${trackId}-${Date.now()}.${extension}`;
        const storagePath = `artistProfiles/${creationProfileId}/tracks/covers/${filename}`;
        const previousCoverPath = previousPaths.coverPath;

        const coverUploadPromise = uploadFileWithProgress(
          track.coverFile,
          storagePath,
          (progress) => {
            if (tracksUploadTokenRef.current !== uploadToken) return;
            if (!isMountedRef.current) return;
            // Update progress based on completed uploads + current progress
            const baseProgress = (completedUploads / totalUploads) * 100;
            const currentProgress = (progress / totalUploads) * 100;
            setTracksUploadProgress(baseProgress + currentProgress);
          }
        )
          .then(async (coverUrl) => {
            if (tracksUploadTokenRef.current !== uploadToken) return;
            if (!isMountedRef.current) return;


            // Update track with uploaded URL and storage path
            const trackIndex = tracksToUpdate.findIndex(t => t.id === trackId);
            if (trackIndex !== -1) {
              tracksToUpdate[trackIndex] = {
                ...tracksToUpdate[trackIndex],
                coverUploadedUrl: coverUrl,
                coverStoragePath: storagePath,
                coverFile: null, // Clear file reference after upload
                // Preserve preview URL if uploaded URL exists
                coverPreviewUrl: tracksToUpdate[trackIndex].coverPreviewUrl || coverUrl,
              };
            }

            // Update storage paths ref
            tracksStoragePathsRef.current[trackId] = {
              ...tracksStoragePathsRef.current[trackId],
              coverPath: storagePath,
            };

            // Delete previous cover file if it exists and is different
            if (previousCoverPath && previousCoverPath !== storagePath) {
              try {
                await deleteStoragePath(previousCoverPath);
              } catch (error) {
                console.error(`Failed to delete previous cover file ${previousCoverPath}:`, error);
              }
            }

            completedUploads++;
            const progress = (completedUploads / totalUploads) * 100;
            if (tracksUploadTokenRef.current === uploadToken) {
              if (!isMountedRef.current) return;
              setTracksUploadProgress(progress);
            }
          })
          .catch((error) => {
            if (tracksUploadTokenRef.current !== uploadToken) return;
            console.error(`Failed to upload cover for track ${trackId}:`, error);
            completedUploads++;
          });

        uploadPromises.push(coverUploadPromise);
      }
    });

    // Wait for all uploads to complete
    Promise.all(uploadPromises)
      .then(async () => {
        if (tracksUploadTokenRef.current !== uploadToken) return;
        if (!isMountedRef.current) return;


        // Update the ref with the latest tracks data (for use in handleSaveAndExit)
        latestTracksRef.current = tracksToUpdate;

        // Persist tracks to Firestore BEFORE updating state
        if (creationProfileId) {
          try {
            const tracksForFirestore = tracksToUpdate.map(track => {
              // Use uploaded URL if available (from new upload), otherwise keep existing
              const audioUrl = track.uploadedAudioUrl || null;
              const audioStoragePath = track.audioStoragePath || null;
              const coverUrl = track.coverUploadedUrl || null;
              const coverStoragePath = track.coverStoragePath || null;

              return {
                id: track.id,
                title: track.title,
                artist: track.artist,
                audioUrl,
                audioStoragePath,
                coverUrl,
                coverStoragePath,
              };
            });

            await updateArtistProfileDocument(creationProfileId, {
              tracks: tracksForFirestore,
            });
          } catch (error) {
            console.error('Failed to persist tracks after upload:', error);
            console.error('Error details:', error.message, error.stack);
          }
        }

        // Update tracks state with uploaded URLs AFTER Firestore update
        setCreationTracks(tracksToUpdate);
        setTracksUploadStatus('complete');
        setTracksUploadProgress(100);
        setShowTracksUploadModal(false); // Hide modal when upload completes
        tracksUploadInProgressRef.current = false; // Mark upload as complete
      })
      .catch((error) => {
        if (tracksUploadTokenRef.current !== uploadToken) return;
        if (!isMountedRef.current) return;
        console.error('Tracks async upload failed:', error);
        setTracksUploadStatus('error');
        setShowTracksUploadModal(false); // Hide modal on error
        tracksUploadInProgressRef.current = false; // Mark upload as complete even on error
      });
    // Don't reset tracksUploadInProgressRef here - let it complete naturally
  }, [creationStep, creationProfileId]); // Removed creationTracks from dependencies to prevent re-runs

  // Hide modal when upload status changes away from 'uploading'
  useEffect(() => {
    if (tracksUploadStatus !== 'uploading' && showTracksUploadModal) {
      setShowTracksUploadModal(false);
    }
  }, [tracksUploadStatus, showTracksUploadModal]);

  // Async upload videos when user leaves videos step
  useEffect(() => {
    const previousStep = previousVideosStepRef.current;
    const currentStep = creationStep;
    previousVideosStepRef.current = currentStep;

    const movedAwayFromVideos = previousStep === 'videos' && currentStep !== 'videos';

    if (videosUploadInProgressRef.current) {
      return;
    }

    const hasVideosToUpload = creationVideos.some(
      (video) => video.videoFile || video.thumbnailFile
    );

    const shouldUpload =
      creationProfileId &&
      movedAwayFromVideos &&
      hasVideosToUpload;

    if (!shouldUpload) {
      if (videoUploadStatus === 'uploading') {
        setVideoUploadStatus('idle');
        setVideoUploadProgress(0);
      }
      return;
    }

    videosUploadInProgressRef.current = true;

    const uploadToken = Symbol('videos-upload');
    videosUploadTokenRef.current = uploadToken;
    setVideoUploadStatus('uploading');
    setVideoUploadProgress(0);

    const videosToUpdate = creationVideos.map((video) => ({
      ...video,
      uploadedVideoUrl: video.uploadedVideoUrl || video.videoUrl || null,
      thumbnailUploadedUrl: video.thumbnailUploadedUrl || video.thumbnail || video.thumbnailUrl || null,
      videoStoragePath: video.videoStoragePath || null,
      thumbnailStoragePath: video.thumbnailStoragePath || null,
    }));

    let completedUploads = 0;
    const totalUploads = creationVideos.reduce((count, video) => {
      return count + (video.videoFile ? 1 : 0) + (video.thumbnailFile ? 1 : 0);
    }, 0);

    if (totalUploads === 0) {
      videosUploadInProgressRef.current = false;
      setVideoUploadStatus('complete');
      setVideoUploadProgress(100);
      return;
    }

    const uploadPromises = [];

    creationVideos.forEach((video) => {
      const videoId = video.id;
      const previousPaths = videosStoragePathsRef.current[videoId] || {};

      if (video.videoFile) {
        const extension = video.videoFile.name?.split('.').pop() || 'mp4';
        const filename = `video-${videoId}-${Date.now()}.${extension}`;
        const storagePath = `artistProfiles/${creationProfileId}/videos/${filename}`;
        const previousVideoPath = previousPaths.videoPath;

        const videoUploadPromise = uploadFileWithProgress(
          video.videoFile,
          storagePath,
          (progress) => {
            if (videosUploadTokenRef.current !== uploadToken || !isMountedRef.current) return;
            const baseProgress = (completedUploads / totalUploads) * 100;
            const currentProgress = (progress / totalUploads) * 100;
            setVideoUploadProgress(baseProgress + currentProgress);
          }
        )
          .then(async (videoUrl) => {
            if (videosUploadTokenRef.current !== uploadToken || !isMountedRef.current) return;

            const videoIndex = videosToUpdate.findIndex((v) => v.id === videoId);
            if (videoIndex !== -1) {
              videosToUpdate[videoIndex] = {
                ...videosToUpdate[videoIndex],
                uploadedVideoUrl: videoUrl,
                videoStoragePath: storagePath,
                videoFile: null,
                videoPreviewUrl: videosToUpdate[videoIndex].videoPreviewUrl || videoUrl,
              };
            }

            videosStoragePathsRef.current[videoId] = {
              ...videosStoragePathsRef.current[videoId],
              videoPath: storagePath,
            };

            if (previousVideoPath && previousVideoPath !== storagePath) {
              try {
                await deleteStoragePath(previousVideoPath);
              } catch (error) {
                console.error(`Failed to delete previous video file ${previousVideoPath}:`, error);
              }
            }

            completedUploads++;
            const progress = (completedUploads / totalUploads) * 100;
            if (videosUploadTokenRef.current === uploadToken && isMountedRef.current) {
              setVideoUploadProgress(progress);
            }
          })
          .catch((error) => {
            if (videosUploadTokenRef.current !== uploadToken || !isMountedRef.current) return;
            console.error(`Failed to upload video for id ${videoId}:`, error);
            completedUploads++;
          });

        uploadPromises.push(videoUploadPromise);
      }

      if (video.thumbnailFile) {
        const extension = video.thumbnailFile.name?.split('.').pop() || 'png';
        const filename = `thumbnail-${videoId}-${Date.now()}.${extension}`;
        const storagePath = `artistProfiles/${creationProfileId}/videos/thumbnails/${filename}`;
        const previousThumbnailPath = previousPaths.thumbnailPath;

        const thumbnailUploadPromise = uploadFileWithProgress(
          video.thumbnailFile,
          storagePath,
          (progress) => {
            if (videosUploadTokenRef.current !== uploadToken || !isMountedRef.current) return;
            const baseProgress = (completedUploads / totalUploads) * 100;
            const currentProgress = (progress / totalUploads) * 100;
            setVideoUploadProgress(baseProgress + currentProgress);
          }
        )
          .then(async (thumbnailUrl) => {
            if (videosUploadTokenRef.current !== uploadToken || !isMountedRef.current) return;

            const videoIndex = videosToUpdate.findIndex((v) => v.id === videoId);
            if (videoIndex !== -1) {
              videosToUpdate[videoIndex] = {
                ...videosToUpdate[videoIndex],
                thumbnailUploadedUrl: thumbnailUrl,
                thumbnailStoragePath: storagePath,
                thumbnailFile: null,
                thumbnailPreviewUrl: videosToUpdate[videoIndex].thumbnailPreviewUrl || thumbnailUrl,
                thumbnailGenerationError: null,
                isThumbnailGenerating: false,
              };
            }

            videosStoragePathsRef.current[videoId] = {
              ...videosStoragePathsRef.current[videoId],
              thumbnailPath: storagePath,
            };

            if (previousThumbnailPath && previousThumbnailPath !== storagePath) {
              try {
                await deleteStoragePath(previousThumbnailPath);
              } catch (error) {
                console.error(`Failed to delete previous thumbnail file ${previousThumbnailPath}:`, error);
              }
            }

            completedUploads++;
            const progress = (completedUploads / totalUploads) * 100;
            if (videosUploadTokenRef.current === uploadToken && isMountedRef.current) {
              setVideoUploadProgress(progress);
            }
          })
          .catch((error) => {
            if (videosUploadTokenRef.current !== uploadToken || !isMountedRef.current) return;
            console.error(`Failed to upload thumbnail for video ${videoId}:`, error);
            completedUploads++;
          });

        uploadPromises.push(thumbnailUploadPromise);
      }
    });

    Promise.all(uploadPromises)
      .then(async () => {
        if (videosUploadTokenRef.current !== uploadToken || !isMountedRef.current) return;

        latestVideosRef.current = videosToUpdate;

        if (creationProfileId) {
          try {
            const videosForFirestore = videosToUpdate.map((video) => ({
              id: video.id,
              title: video.title,
              videoUrl: video.uploadedVideoUrl || null,
              videoStoragePath: video.videoStoragePath || null,
              thumbnail: video.thumbnailUploadedUrl || null,
              thumbnailUrl: video.thumbnailUploadedUrl || null,
              thumbnailStoragePath: video.thumbnailStoragePath || null,
            }));

            await updateArtistProfileDocument(creationProfileId, {
              videos: videosForFirestore,
            });
          } catch (error) {
            console.error('Failed to persist videos after upload:', error);
            console.error('Error details:', error.message, error.stack);
          }
        }

        setCreationVideos(videosToUpdate);
        setVideoUploadStatus('complete');
        setVideoUploadProgress(100);
        setShowVideoUploadModal(false);
        videosUploadInProgressRef.current = false;
      })
      .catch((error) => {
        if (videosUploadTokenRef.current !== uploadToken || !isMountedRef.current) return;
        console.error('Videos async upload failed:', error);
        setVideoUploadStatus('error');
        setShowVideoUploadModal(false);
        videosUploadInProgressRef.current = false;
      });
  }, [creationStep, creationProfileId]); // Removed creationVideos from dependencies to prevent re-runs

  useEffect(() => {
    if (videoUploadStatus !== 'uploading' && showVideoUploadModal) {
      setShowVideoUploadModal(false);
    }
  }, [videoUploadStatus, showVideoUploadModal]);

  // Scroll state box to bottom when step changes, content updates, or container height changes
  useEffect(() => {
    if (!stateBoxRef.current) return;

    const scrollToBottom = () => {
      if (stateBoxRef.current) {
        stateBoxRef.current.scrollTo({
          top: stateBoxRef.current.scrollHeight,
          behavior: 'smooth'
        });
      }
    };

    // Initial scroll - use RAF for immediate response
    requestAnimationFrame(() => {
      requestAnimationFrame(scrollToBottom);
    });

    // Watch for height changes in the state box - scroll immediately on resize
    const stateBoxObserver = new ResizeObserver(() => {
      requestAnimationFrame(() => {
        requestAnimationFrame(scrollToBottom);
      });
    });

    stateBoxObserver.observe(stateBoxRef.current);

    // Also observe the creation box container if it exists (has 0.5s height transition)
    // Start scrolling immediately and let smooth behavior follow the transition
    const creationBoxContainer = stateBoxRef.current.querySelector('.creation-box-container');
    let creationBoxObserver = null;
    if (creationBoxContainer) {
      creationBoxObserver = new ResizeObserver(() => {
        // Start scrolling immediately - smooth behavior will follow the transition
        requestAnimationFrame(() => {
          requestAnimationFrame(scrollToBottom);
        });
        // Also scroll again near the end of transition to ensure we're at bottom
        setTimeout(() => {
          scrollToBottom();
        }, 500);
      });
      creationBoxObserver.observe(creationBoxContainer);
    }

    return () => {
      stateBoxObserver.disconnect();
      if (creationBoxObserver) {
        creationBoxObserver.disconnect();
      }
    };
  }, [creationStep, isCreatingProfile, creationTracks.length, creationVideos.length]);

  const handleHeroImageUpdate = (payload) => {
    if (!payload) {
      setCreationHeroImage(null);
      heroStoragePathRef.current = null;
      setCreationHasHeroImage(false);
      setHeroUploadStatus('idle');
      setHeroUploadProgress(0);
      heroUploadTokenRef.current = null;
      heroStoragePathRef.current = null;
      return;
    }

    const { previewUrl, file, storagePath } = payload;
    const previousStoragePath = heroStoragePathRef.current;
    setCreationHeroImage({
      file: file || null,
      previewUrl,
      storagePath: storagePath || null,
    });
    setCreationHasHeroImage(true);
    handleHeroPositionChange(HERO_POSITION_DEFAULT);
    if (file) {
      setHeroUploadStatus('idle');
      setHeroUploadProgress(0);
      heroUploadTokenRef.current = null;
    } else if (storagePath) {
      heroStoragePathRef.current = storagePath;
      setHeroUploadStatus('complete');
      setHeroUploadProgress(100);
      if (previousStoragePath && previousStoragePath !== storagePath) {
        deleteStoragePath(previousStoragePath);
      }
    }
    if (previewUrl) {
      setBackgroundImage(previewUrl);
    }
  };

  const handleHeroBrightnessChange = (value) => {
    setCreationHeroBrightness(value);
    if (!creationProfileId) return;

    if (heroBrightnessUpdateTimeoutRef.current) {
      clearTimeout(heroBrightnessUpdateTimeoutRef.current);
    }

    heroBrightnessUpdateTimeoutRef.current = setTimeout(async () => {
      try {
        await updateArtistProfileDocument(creationProfileId, { heroBrightness: value });
      } catch (error) {
        console.error('Failed to update hero brightness:', error);
      }
    }, 400);
  };

  const handleArtistNameChange = (newName) => {
    setCreationArtistName(newName);
    if (!creationProfileId) return;

    if (artistNameUpdateTimeoutRef.current) {
      clearTimeout(artistNameUpdateTimeoutRef.current);
    }

    artistNameUpdateTimeoutRef.current = setTimeout(async () => {
      try {
        await updateArtistProfileDocument(creationProfileId, { name: newName });
      } catch (error) {
        console.error('Failed to update artist name:', error);
      }
    }, 400);
  };

  const handleArtistBioChange = (newBio) => {
    setCreationArtistBio(newBio);
    if (!creationProfileId) return;

    if (artistBioUpdateTimeoutRef.current) {
      clearTimeout(artistBioUpdateTimeoutRef.current);
    }

    artistBioUpdateTimeoutRef.current = setTimeout(async () => {
      try {
        await updateArtistProfileDocument(creationProfileId, { bio: newBio });
      } catch (error) {
        console.error('Failed to update artist bio:', error);
      }
    }, 500);
  };

  const handleWebsiteUrlChange = (newUrl) => {
    setCreationWebsiteUrl(newUrl);
    if (!creationProfileId) return;
    if (websiteUrlUpdateTimeoutRef.current) {
      clearTimeout(websiteUrlUpdateTimeoutRef.current);
    }
    websiteUrlUpdateTimeoutRef.current = setTimeout(async () => {
      try {
        await updateArtistProfileDocument(creationProfileId, { websiteUrl: newUrl });
      } catch (error) {
      console.error('Failed to update Website URL:', error);
    }
  }, 500);
};
  const handleInstagramUrlChange = (newUrl) => {
    setCreationInstagramUrl(newUrl);
    if (!creationProfileId) return;
    if (instagramUrlUpdateTimeoutRef.current) {
      clearTimeout(instagramUrlUpdateTimeoutRef.current);
    }
    instagramUrlUpdateTimeoutRef.current = setTimeout(async () => {
      try {
        await updateArtistProfileDocument(creationProfileId, { instagramUrl: newUrl });
      } catch (error) {
        console.error('Failed to update Instagram URL:', error);
      }
  }, 500);
  };

  const handleYoutubeUrlChange = (newUrl) => {
    setCreationYoutubeUrl(newUrl);
    if (!creationProfileId) return;

    if (youtubeUrlUpdateTimeoutRef.current) {
      clearTimeout(youtubeUrlUpdateTimeoutRef.current);
    }

    youtubeUrlUpdateTimeoutRef.current = setTimeout(async () => {
      try {
        await updateArtistProfileDocument(creationProfileId, { youtubeUrl: newUrl });
      } catch (error) {
        console.error('Failed to update YouTube URL:', error);
      }
    }, 500);
  };
  const handleSpotifyUrlChange = (newUrl) => {
    setCreationSpotifyUrl(newUrl);
    if (!creationProfileId) return;

    if (spotifyUrlUpdateTimeoutRef.current) {
      clearTimeout(spotifyUrlUpdateTimeoutRef.current);
    }

    spotifyUrlUpdateTimeoutRef.current = setTimeout(async () => {
      try {
        await updateArtistProfileDocument(creationProfileId, { spotifyUrl: newUrl });
      } catch (error) {
        console.error('Failed to update Spotify URL:', error);
      }
    }, 500);
  };

  const handleSoundcloudUrlChange = (newUrl) => {
    setCreationSoundcloudUrl(newUrl);
    if (!creationProfileId) return;
    
    if (soundcloudUrlUpdateTimeoutRef.current) {
      clearTimeout(soundcloudUrlUpdateTimeoutRef.current);
    }

    soundcloudUrlUpdateTimeoutRef.current = setTimeout(async () => {
      try {
        await updateArtistProfileDocument(creationProfileId, { soundcloudUrl: newUrl });
      } catch (error) {
        console.error('Failed to update SoundCloud URL:', error);
      }
    }, 500);
  };

  const handleTracksChange = (newTracks) => {
    setCreationTracks(newTracks);
    latestTracksRef.current = newTracks; // Keep ref in sync with state
  };

  const handleVideosChange = (newVideos) => {
    setCreationVideos(newVideos);
    latestVideosRef.current = newVideos;
  };

  const handleSaveAndExit = async () => {
    if (!creationProfileId) {
      resetCreationState();
      navigate('/find-a-gig');
      return;
    }

    if (!creationHasHeroImage || !creationHeroImage) {
      resetCreationState();
      navigate('/find-a-gig');
      return;
    }

    // Check if media uploads are still running
    if (tracksUploadStatus === 'uploading') {
      // Show loading modal and prevent save
      setShowTracksUploadModal(true);
      return;
    }

    if (videoUploadStatus === 'uploading') {
      setShowVideoUploadModal(true);
      return;
    }

    setSavingDraft(true);

    try {
      let heroUrl = creationHeroImage.previewUrl;
      let storagePath = creationHeroImage.storagePath;

      if (creationHeroImage.file) {
        const extension = creationHeroImage.file.name?.split('.').pop() || 'jpg';
        const filename = `background-${Date.now()}.${extension}`;
        storagePath = `artistProfiles/${creationProfileId}/hero/${filename}`;
        heroUrl = await uploadFileToStorage(creationHeroImage.file, storagePath);
      }

      // Prepare tracks for Firestore
      // Only update title, artist, and id - preserve URL/storage path fields from database
      // (URL/storage paths are handled by the async upload process, which already persists them)
      const tracksToSave = latestTracksRef.current.length > 0 ? latestTracksRef.current : creationTracks;
      
      // Get existing tracks from database to preserve URL/storage path fields
      const existingTracks = draftProfile?.tracks || [];
      const existingTracksMap = new Map(existingTracks.map(track => [track.id, track]));
      
      const tracksForFirestore = tracksToSave.map(track => {
        // Get existing track data from database (preserves URLs/storage paths set by async upload)
        const existingTrack = existingTracksMap.get(track.id);
        
        if (existingTrack) {
          // Track exists in database - only update metadata, preserve URL/storage paths
          return {
            id: track.id,
            title: track.title,
            artist: track.artist,
            // Preserve URL/storage paths from database (set by async upload process)
            audioUrl: existingTrack.audioUrl,
            audioStoragePath: existingTrack.audioStoragePath,
            coverUrl: existingTrack.coverUrl,
            coverStoragePath: existingTrack.coverStoragePath,
          };
        } else {
          // New track (not yet uploaded) - include uploaded URLs if available
          return {
            id: track.id,
            title: track.title,
            artist: track.artist,
            audioUrl: track.uploadedAudioUrl || null,
            audioStoragePath: track.audioStoragePath || null,
            coverUrl: track.coverUploadedUrl || null,
            coverStoragePath: track.coverStoragePath || null,
          };
        }
      });

      const videosToSave = latestVideosRef.current.length > 0 ? latestVideosRef.current : creationVideos;
      const existingVideos = draftProfile?.videos || [];
      const existingVideosMap = new Map(existingVideos.map(video => [video.id, video]));

      const videosForFirestore = videosToSave.map(video => {
        const existingVideo = existingVideosMap.get(video.id);
        if (existingVideo) {
          return {
            id: video.id,
            title: video.title,
            videoUrl: existingVideo.videoUrl || existingVideo.file || null,
            videoStoragePath: existingVideo.videoStoragePath || null,
            thumbnail: existingVideo.thumbnail || existingVideo.thumbnailUrl || null,
            thumbnailUrl: existingVideo.thumbnailUrl || existingVideo.thumbnail || null,
            thumbnailStoragePath: existingVideo.thumbnailStoragePath || null,
          };
        }

        return {
          id: video.id,
          title: video.title,
          videoUrl: video.uploadedVideoUrl || null,
          videoStoragePath: video.videoStoragePath || null,
          thumbnail: video.thumbnailUploadedUrl || null,
          thumbnailUrl: video.thumbnailUploadedUrl || null,
          thumbnailStoragePath: video.thumbnailStoragePath || null,
        };
      });


      const updates = {
        name: creationArtistName,
        bio: creationArtistBio,
        websiteUrl: creationWebsiteUrl,
        instagramUrl: creationInstagramUrl,
        youtubeUrl: creationYoutubeUrl,
        spotifyUrl: creationSpotifyUrl,
        soundcloudUrl: creationSoundcloudUrl,
        tracks: tracksForFirestore,
        videos: videosForFirestore,
        heroBrightness: creationHeroBrightness,
        heroPositionY: creationHeroPosition,
        onboardingStep: creationStep,
        status: 'draft',
        isComplete: false,
      };

      if (heroUrl) {
        updates.heroMedia = { url: heroUrl, storagePath };
      }

      await updateArtistProfileDocument(creationProfileId, updates);
      toast.success('Progress saved');
      resetCreationState();
      navigate('/find-a-gig');
    } catch (error) {
      console.error('Failed to save artist profile progress:', error);
      toast.error('Failed to save your progress. Please try again.');
    } finally {
      setSavingDraft(false);
    }
  };

  const handleExitClick = () => {
    if (canSaveProgress) {
      handleSaveAndExit();
    } else {
      resetCreationState();
      navigate('/find-a-gig');
    }
  };

  // Render dashboard sub-views
  const renderDashboardView = () => {
    switch (dashboardView) {
      case DashboardView.PROFILE:
        return (
          <ProfileView 
            profileData={activeProfileData}
            onBeginCreation={handleBeginCreation}
            isExample={false}
            isDarkMode={isDarkMode}
            setIsDarkMode={setIsDarkMode}
            isCreationLoading={initializingArtistProfile}
            isCreatingProfile={isCreatingProfile}
            creationStep={creationStep}
            onCreationStepChange={setCreationStep}
            onCompleteCreation={handleProfileCreated}
            onHeroImageUpdate={handleHeroImageUpdate}
            initialHeroImage={creationHeroImage}
            heroBrightness={creationHeroBrightness}
            onHeroBrightnessChange={handleHeroBrightnessChange}
            heroPosition={creationHeroPosition}
            onHeroPositionChange={handleHeroPositionChange}
            isRepositioningHero={isRepositioningHero}
            onHeroRepositionToggle={handleHeroRepositionToggle}
            initialArtistName={creationArtistName}
            onArtistNameChange={handleArtistNameChange}
            creationArtistBio={creationArtistBio}
            onArtistBioChange={handleArtistBioChange}
            creationWebsiteUrl={creationWebsiteUrl}
            onWebsiteUrlChange={handleWebsiteUrlChange}
            creationInstagramUrl={creationInstagramUrl}
            onInstagramUrlChange={handleInstagramUrlChange}
            creationSpotifyUrl={creationSpotifyUrl}
            onSpotifyUrlChange={handleSpotifyUrlChange}
            creationSoundcloudUrl={creationSoundcloudUrl}
            onSoundcloudUrlChange={handleSoundcloudUrlChange}
            creationYoutubeUrl={creationYoutubeUrl}
            onYoutubeUrlChange={handleYoutubeUrlChange}
            heroUploadStatus={heroUploadStatus}
            heroUploadProgress={heroUploadProgress}
            creationTracks={creationTracks}
            onTracksChange={handleTracksChange}
            creationVideos={creationVideos}
            onVideosChange={handleVideosChange}
            tracksUploadStatus={tracksUploadStatus}
            tracksUploadProgress={tracksUploadProgress}
            videoUploadStatus={videoUploadStatus}
            videoUploadProgress={videoUploadProgress}
            scrollContainerRef={stateBoxRef}
          />
        );
      case DashboardView.GIGS:
        return <div>Gigs View (to be implemented)</div>;
      case DashboardView.MESSAGES:
        return <div>Messages View (to be implemented)</div>;
      case DashboardView.FINANCES:
        return <div>Finances View (to be implemented)</div>;
      default:
        return <div>Loading...</div>;
    }
  };

  // Render based on current state
  const renderStateContent = () => {
    switch (currentState) {
      case ArtistProfileState.EXAMPLE_PROFILE:
        // Show example profile with hardcoded data
        return (
          <ProfileView 
            profileData={null}
            onBeginCreation={handleBeginCreation}
            isExample={true}
            isDarkMode={isDarkMode}
            setIsDarkMode={setIsDarkMode}
            onExampleProfileSelected={setSelectedExampleProfile}
            isCreationLoading={initializingArtistProfile}
            isCreatingProfile={isCreatingProfile}
            creationStep={creationStep}
            onCreationStepChange={setCreationStep}
            onCompleteCreation={handleProfileCreated}
            onHeroImageUpdate={handleHeroImageUpdate}
            initialHeroImage={creationHeroImage}
            heroBrightness={creationHeroBrightness}
            onHeroBrightnessChange={handleHeroBrightnessChange}
            heroPosition={creationHeroPosition}
            onHeroPositionChange={handleHeroPositionChange}
            isRepositioningHero={isRepositioningHero}
            onHeroRepositionToggle={handleHeroRepositionToggle}
            initialArtistName={creationArtistName}
            onArtistNameChange={handleArtistNameChange}
            creationArtistBio={creationArtistBio}
            onArtistBioChange={handleArtistBioChange}
            creationWebsiteUrl={creationWebsiteUrl}
            onWebsiteUrlChange={handleWebsiteUrlChange}
            creationInstagramUrl={creationInstagramUrl}
            onInstagramUrlChange={handleInstagramUrlChange}
            creationSpotifyUrl={creationSpotifyUrl}
            onSpotifyUrlChange={handleSpotifyUrlChange}
            creationSoundcloudUrl={creationSoundcloudUrl}
            onSoundcloudUrlChange={handleSoundcloudUrlChange}
            creationYoutubeUrl={creationYoutubeUrl}
            onYoutubeUrlChange={handleYoutubeUrlChange}
            heroUploadStatus={heroUploadStatus}
            heroUploadProgress={heroUploadProgress}
            creationTracks={creationTracks}
            onTracksChange={handleTracksChange}
            creationVideos={creationVideos}
            onVideosChange={handleVideosChange}
            tracksUploadStatus={tracksUploadStatus}
            tracksUploadProgress={tracksUploadProgress}
            videoUploadStatus={videoUploadStatus}
            videoUploadProgress={videoUploadProgress}
          />
        );
      
      case ArtistProfileState.CREATING:
        return (
          <ProfileView 
            profileData={activeProfileData}
            onBeginCreation={handleBeginCreation}
            isExample={false}
            isDarkMode={isDarkMode}
            setIsDarkMode={setIsDarkMode}
            isCreationLoading={initializingArtistProfile}
            isCreatingProfile={true}
            creationStep={creationStep}
            onCreationStepChange={setCreationStep}
            onCompleteCreation={handleProfileCreated}
            onHeroImageUpdate={handleHeroImageUpdate}
            initialHeroImage={creationHeroImage}
            heroBrightness={creationHeroBrightness}
            onHeroBrightnessChange={handleHeroBrightnessChange}
            heroPosition={creationHeroPosition}
            onHeroPositionChange={handleHeroPositionChange}
            isRepositioningHero={isRepositioningHero}
            onHeroRepositionToggle={handleHeroRepositionToggle}
            initialArtistName={creationArtistName}
            onArtistNameChange={handleArtistNameChange}
            creationArtistBio={creationArtistBio}
            onArtistBioChange={handleArtistBioChange}
            creationWebsiteUrl={creationWebsiteUrl}
            onWebsiteUrlChange={handleWebsiteUrlChange}
            creationInstagramUrl={creationInstagramUrl}
            onInstagramUrlChange={handleInstagramUrlChange}
            creationSpotifyUrl={creationSpotifyUrl}
            onSpotifyUrlChange={handleSpotifyUrlChange}
            creationSoundcloudUrl={creationSoundcloudUrl}
            onSoundcloudUrlChange={handleSoundcloudUrlChange}
            creationYoutubeUrl={creationYoutubeUrl}
            onYoutubeUrlChange={handleYoutubeUrlChange}
            heroUploadStatus={heroUploadStatus}
            heroUploadProgress={heroUploadProgress}
            creationTracks={creationTracks}
            onTracksChange={handleTracksChange}
            creationVideos={creationVideos}
            onVideosChange={handleVideosChange}
            tracksUploadStatus={tracksUploadStatus}
            tracksUploadProgress={tracksUploadProgress}
            videoUploadStatus={videoUploadStatus}
            videoUploadProgress={videoUploadProgress}
            scrollContainerRef={stateBoxRef}
          />
        );
      
      case ArtistProfileState.DASHBOARD:
        // Render dashboard with sub-views
        return renderDashboardView();
      
      default:
        return <div>Loading...</div>;
    }
  };

  // Show loading state while checking auth or dashboard data
  if (authLoading) {
    return (
      <div className="artist-profile-container" style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div>Loading...</div>
      </div>
    );
  }

  const showCreationPlaceholder = isCreationState && !creationHasHeroImage;
  const persistedHeroBrightness = activeProfileData?.heroBrightness ?? BRIGHTNESS_DEFAULT;
  const effectiveHeroBrightness = isCreationState ? creationHeroBrightness : persistedHeroBrightness;
  const persistedHeroPosition = clampHeroPosition(activeProfileData?.heroPositionY ?? HERO_POSITION_DEFAULT);
  const effectiveHeroPosition = isCreationState ? creationHeroPosition : persistedHeroPosition;
  const brightnessOverlayStyle = getBrightnessOverlayStyle(effectiveHeroBrightness);
  const showBrightnessOverlay = !showCreationPlaceholder && brightnessOverlayStyle.opacity > 0;
  const canSaveProgress = isCreationState && creationHasHeroImage;

  const containerClasses = [
    'artist-profile-container',
    isRepositioningHero ? 'repositioning-mode' : '',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <div 
      className={containerClasses}
      style={{
        position: 'relative',
        minHeight: '100vh',
        width: '100%',
      }}
    >
      {/* Background layers */}
      <div
        className="artist-profile-background-wrapper"
        style={{ pointerEvents: isRepositioningHero ? 'auto' : 'none' }}
      >
        <div
          ref={backgroundImageRef}
          onPointerDown={handleHeroPointerDown}
          className={`artist-profile-background image-layer ${showCreationPlaceholder ? 'fade-out' : ''} ${
            isRepositioningHero ? 'repositioning' : ''
          } ${isHeroDragging ? 'dragging' : ''}`}
          style={{
            backgroundImage: `url(${backgroundImage || artistProfileBackground})`,
            backgroundPosition: `center ${effectiveHeroPosition}%`,
            cursor: isRepositioningHero ? (isHeroDragging ? 'grabbing' : 'grab') : undefined,
          }}
        />
        {showCreationPlaceholder && (
          <div className="artist-profile-background placeholder-layer fade-in">
            <div className="artist-profile-background-placeholder">
              <NoImageIcon />
            </div>
          </div>
        )}
        {showBrightnessOverlay && (
          <div
            className="artist-profile-background brightness-overlay"
            style={brightnessOverlayStyle}
          />
        )}
      </div>

      {/* Content overlay */}
      <div
        className="artist-profile-content"
        style={{
          position: 'relative',
          zIndex: 1,
          width: '100%',
          minHeight: '100vh',
        }}
      >
        {/* Constant elements - always visible */}
        <div className={`artist-profile-constants ${(isCreationState && !creationHasHeroImage) ? 'creation-transition' : ''}`}>
          {/* Exit button - top right */}
          <button 
            className="btn exit-button"
            onClick={handleExitClick}
            disabled={savingDraft}
          >
            {canSaveProgress ? (savingDraft ? 'Saving...' : 'Save & Exit') : 'Exit'}
          </button>

          {/* Artist name - bottom left */}
          <div className="artist-name">
            <h1>
              {displayName}
            </h1>
          </div>
        </div>

        {/* State box - right side, 30vw, changes based on state */}
        <div ref={stateBoxRef} className={`artist-profile-state-box ${isDarkMode ? 'dark-mode' : ''}`}>
          {renderStateContent()}
        </div>
      </div>

      {/* Show loading modal when user tries to save while media is uploading */}
      {((showTracksUploadModal && tracksUploadStatus === 'uploading') ||
        (showVideoUploadModal && videoUploadStatus === 'uploading')) && (
        <LoadingModal 
          title="Please wait" 
          text="We are uploading your media" 
        />
      )}
    </div>
  );
};

