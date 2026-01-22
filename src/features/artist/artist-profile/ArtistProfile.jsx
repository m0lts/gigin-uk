import { useState, useEffect, useMemo, useRef, useCallback, useContext } from 'react';
import { useAuth } from '@hooks/useAuth';
import { useBreakpoint } from '@hooks/useBreakpoint';
import { useNavigate, useSearchParams, useLocation, useParams } from 'react-router-dom';
import { ProfileView } from './profile-components/ProfileView';
import '@styles/artists/artist-profile-new.styles.css';
// Hardcoded background image for example profile
import { generateArtistProfileId, createArtistProfileDocument, updateArtistProfileDocument } from '@services/client-side/artists';
import { ArtistDashboardContext, ArtistDashboardProvider } from '../../../context/ArtistDashboardContext';
import { uploadFileToStorage, uploadFileWithProgress, deleteStoragePath } from '@services/storage';
import { getDownloadURL, ref } from 'firebase/storage';
import { storage } from '@lib/firebase';
import { updateUserArrayField, setPrimaryArtistProfile } from '@services/api/users';
import { createArtistCRMEntry, isArtistSavedInCRM, removeArtistFromCRMByArtistId } from '@services/client-side/artistCRM';
import { toast } from 'sonner';
import { ImageIcon, InviteIconSolid, GuitarsIcon } from '@features/shared/ui/extras/Icons';
import { CREATION_STEP_ORDER } from './profile-components/ProfileCreationBox';
import { LoadingModal } from '@features/shared/ui/loading/LoadingModal';
import { Header as MusicianHeader } from '../components/Header';
import { Header as VenueHeader } from '@features/venue/components/Header';
import { Header as SharedHeader } from '@features/shared/components/Header';
import { ArtistProfileGigs } from './gigs-components/ArtistProfileGigs';
import { ArtistProfileMessages } from './messages-components/ArtistProfileMessages';
import { ArtistProfileFinances } from './finances-components/ArtistProfileFinances';
import { inviteToGig } from '@services/api/gigs';
import { getGigsByIds } from '@services/client-side/gigs';
import { validateVenueUser } from '@services/utils/validation';
import { filterInvitableGigsForMusician } from '@services/utils/filtering';
import { fetchMyVenueMembership } from '@services/client-side/venues';
import { getOrCreateConversation } from '@services/api/conversations';
import { sendGigInvitationMessage } from '@services/client-side/messages';
import { formatDate } from '@services/utils/dates';
import { getArtistProfileMembers } from '@services/client-side/artists';
import { sanitizeArtistPermissions } from '@services/utils/permissions';
import Portal from '@features/shared/components/Portal';
import DatePicker from 'react-datepicker';
import 'react-datepicker/dist/react-datepicker.css';
import { createGigInvite } from '@services/api/gigInvites';
import { LoadingSpinner } from '../../shared/ui/loading/Loading';
import { LoadingScreen } from '../../shared/ui/loading/LoadingScreen';
import exampleProfileImage from '@assets/images/artist-profile-example.png';
import { UpdateIcon } from '../../shared/ui/extras/Icons';
import { ProfileCompletionModal } from '../components/ProfileCompletionModal';

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

const MEDIA_STORAGE_LIMIT_BYTES = 100 * 1024 * 1024; // 100MB cap for basic tier

const getTrackMediaBytes = (track = {}) => {
  if (!track) return 0;
  if (typeof track.totalSizeBytes === 'number') return track.totalSizeBytes;
  const audioBytes = track.audioFile?.size ?? track.audioSizeBytes ?? 0;
  const coverBytes = track.coverFile?.size ?? track.coverSizeBytes ?? 0;
  return audioBytes + coverBytes;
};

const getVideoMediaBytes = (video = {}) => {
  if (!video) return 0;
  if (typeof video.totalSizeBytes === 'number') return video.totalSizeBytes;
  const videoBytes = video.videoFile?.size ?? video.videoSizeBytes ?? 0;
  let thumbnailBytes = 0;
  if (video.thumbnailFile instanceof Blob) {
    thumbnailBytes = video.thumbnailFile.size ?? 0;
  } else {
    thumbnailBytes = video.thumbnailSizeBytes ?? 0;
  }
  return videoBytes + thumbnailBytes;
};

const calculateMediaUsageBytes = (tracks = [], videos = []) => {
  const tracksTotal = tracks.reduce((sum, track) => sum + getTrackMediaBytes(track), 0);
  const videosTotal = videos.reduce((sum, video) => sum + getVideoMediaBytes(video), 0);
  return tracksTotal + videosTotal;
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

const ArtistProfileComponent = ({ 
  user: userProp,
  setAuthModal,
  setAuthType,
  viewerMode = false,
  viewerProfile = null,
}) => {
  const { user: authUser, loading: authLoading } = useAuth();
  const { isMdUp } = useBreakpoint();
  const navigate = useNavigate();
  const location = useLocation();
  const { profileId: urlProfileIdParam } = useParams();
  const [searchParams, setSearchParams] = useSearchParams();
  // If ?create=true is in URL, ignore the profileId from URL path to avoid showing old profile data
  const shouldCreate = searchParams.get('create') === 'true';
  const urlProfileId = shouldCreate ? null : urlProfileIdParam;
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [selectedExampleProfile, setSelectedExampleProfile] = useState(null);
  const darkModeInitializedRef = useRef(false);
  // Use prop user if provided, otherwise use auth user
  const user = userProp || authUser;

  // Determine current state based on profile status
  const [currentState, setCurrentState] = useState(
    viewerMode ? ArtistProfileState.DASHBOARD : ArtistProfileState.EXAMPLE_PROFILE
  );
  const [backgroundImage, setBackgroundImage] = useState(null);
  const [isCreatingProfile, setIsCreatingProfile] = useState(false);
  const [initializingArtistProfile, setInitializingArtistProfile] = useState(false);
  const [creationStep, setCreationStep] = useState(CREATION_STEP_ORDER[0]);
  const [creationHasHeroImage, setCreationHasHeroImage] = useState(false);
  const [creationProfileId, setCreationProfileId] = useState(null);
  const [aboutComplete, setAboutComplete] = useState(false);
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
  const [showProfileCompletionModal, setShowProfileCompletionModal] = useState(false);
  const [completedProfileId, setCompletedProfileId] = useState(null); // Store profileId for modal even after creationProfileId is cleared
  const [isRepositioningHero, setIsRepositioningHero] = useState(false);
  const [isHeroDragging, setIsHeroDragging] = useState(false);
  const [savingDraft, setSavingDraft] = useState(false);
  const [creationWebsiteUrl, setCreationWebsiteUrl] = useState("");
  const [creationInstagramUrl, setCreationInstagramUrl] = useState("");
  const [editingName, setEditingName] = useState(null); // Track name being edited for real-time display
  const [editingHeroImage, setEditingHeroImage] = useState(null); // Track background image being edited
  const [editingHeroBrightness, setEditingHeroBrightness] = useState(null); // Track brightness being edited
  const [editingHeroPosition, setEditingHeroPosition] = useState(null); // Track position being edited
  // Dashboard sub-state (which view to show: Profile, Gigs, Messages, Finances)
  // Initialize from URL path
  const getDashboardViewFromPath = (pathname) => {
    // Only match paths that start with /artist-profile
    if (!pathname.startsWith('/artist-profile')) {
      return DashboardView.PROFILE;
    }
    // Remove profileId from path for matching (e.g., /artist-profile/abc123/gigs -> /artist-profile/gigs)
    const pathWithoutProfileId = pathname.replace(/^\/artist-profile\/[^/]+/, '/artist-profile');
    // Check for sub-routes (must come before the base path check)
    if (pathWithoutProfileId === '/artist-profile/gigs' || pathWithoutProfileId.startsWith('/artist-profile/gigs/')) {
      return DashboardView.GIGS;
    }
    if (pathWithoutProfileId === '/artist-profile/messages' || pathWithoutProfileId.startsWith('/artist-profile/messages/')) {
      return DashboardView.MESSAGES;
    }
    if (pathWithoutProfileId === '/artist-profile/finances' || pathWithoutProfileId.startsWith('/artist-profile/finances/')) {
      return DashboardView.FINANCES;
    }
    // Default to PROFILE for /artist-profile or any other /artist-profile/* path
    return DashboardView.PROFILE;
  };
  const [dashboardView, setDashboardView] = useState(() =>
    viewerMode ? DashboardView.PROFILE : getDashboardViewFromPath(location.pathname)
  );
  const isTallDashboardView =
    dashboardView === DashboardView.GIGS ||
    dashboardView === DashboardView.MESSAGES ||
    dashboardView === DashboardView.FINANCES;
  
  // Track previous profile state to detect completion
  const previousProfileRef = useRef(null);
  const justCompletedProfileRef = useRef(false);
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
  const createFromUrlRef = useRef(false); // Track if we've triggered creation from URL param
  const previousActiveProfileIdRef = useRef(null); // Track previous profile ID to detect switches
  const [isSwitchingProfile, setIsSwitchingProfile] = useState(false); // Track if we're switching profiles
  const switchingProfileTimeoutRef = useRef(null); // Store timeout ID for profile switching
  const [showUpdateModal, setShowUpdateModal] = useState(false); // Modal for new profile updates
  const [updatingProfile, setUpdatingProfile] = useState(false); // Loading state for updating profile

  // In viewer mode, use the viewerProfile prop instead of user's artistProfiles
  const artistProfiles = viewerMode && viewerProfile 
    ? [viewerProfile] 
    : (user?.artistProfiles || []);
  
  // Helper function to get/set active profile ID from localStorage
  const getStoredActiveProfileId = () => {
    if (!user?.uid) return null;
    try {
      const stored = localStorage.getItem(`activeArtistProfileId_${user.uid}`);
      return stored || null;
    } catch (e) {
      return null;
    }
  };
  
  const setStoredActiveProfileId = (profileId) => {
    if (!user?.uid || !profileId) return;
    try {
      localStorage.setItem(`activeArtistProfileId_${user.uid}`, profileId);
    } catch (e) {
      console.error('Failed to store active profile ID:', e);
    }
  };
  
  // Select profile based on URL param, localStorage, or default to primary/complete/draft
  // When creating a new profile (not resuming a draft), don't show any existing profile data
  const activeProfileData = useMemo(() => {
    // If we're in creating state, handle creation profile logic first
    if (isCreatingProfile && creationProfileId) {
      const isResumingDraft = artistProfiles.some(
        (p) => (p.id === creationProfileId || p.profileId === creationProfileId) && !p.isComplete
      );
      if (isResumingDraft) {
        // Resuming a draft - return the draft profile
        return artistProfiles.find(
          (p) => (p.id === creationProfileId || p.profileId === creationProfileId) && !p.isComplete
        ) || null;
      } else {
        // Creating a brand new profile - return null so we don't show old profile data
        return null;
      }
    }
    
    // If ?create=true is in URL, don't show any existing profile data
    const shouldCreate = searchParams.get('create') === 'true';
    if (shouldCreate) {
      return null;
    }
    
    if (urlProfileId) {
      // Find profile by ID from URL
      let profile = artistProfiles.find((p) => p.id === urlProfileId || p.profileId === urlProfileId);
      
      // If profile not found but we just completed it, try to find it even if isComplete is still false in user context
      // This handles the case where we just completed the profile but user context hasn't refreshed yet
      if (!profile && justCompletedProfileRef.current && creationProfileId === urlProfileId) {
        profile = artistProfiles.find((p) => p.id === urlProfileId || p.profileId === urlProfileId);
      }
      
      if (profile) {
        // Store the active profile ID when found in URL
        setStoredActiveProfileId(profile.id || profile.profileId);
        // If we just completed this profile, temporarily mark it as complete for display purposes
        if (justCompletedProfileRef.current && creationProfileId === urlProfileId) {
          return { ...profile, isComplete: true, status: 'complete' };
        }
        return profile;
      }
      // If URL has profileId but profile not found, return null (will redirect)
      return null;
    }
    
    // Check localStorage for previously viewed profile
    const storedProfileId = getStoredActiveProfileId();
    if (storedProfileId) {
      const storedProfile = artistProfiles.find(
        (p) => (p.id === storedProfileId || p.profileId === storedProfileId)
      );
      if (storedProfile) {
        return storedProfile;
      }
    }
    
    // Default priority: primary profile > first complete > first draft
    if (user?.primaryArtistProfileId) {
      const primary = artistProfiles.find(
        (p) => (p.id === user.primaryArtistProfileId || p.profileId === user.primaryArtistProfileId)
      );
      if (primary) {
        setStoredActiveProfileId(primary.id || primary.profileId);
        return primary;
      }
    }
    // Fallback: first complete profile, or first draft if no complete
    const completed = artistProfiles.find((profile) => profile?.isComplete);
    const fallback = completed || artistProfiles.find((profile) => !profile?.isComplete) || null;
    if (fallback) {
      setStoredActiveProfileId(fallback.id || fallback.profileId);
    }
    return fallback;
  }, [artistProfiles, urlProfileId, user?.primaryArtistProfileId, user?.uid, isCreatingProfile, creationProfileId, searchParams]);
  
  const completedProfile = useMemo(
    () => artistProfiles.find((profile) => profile?.isComplete),
    [artistProfiles]
  );
  
  const draftProfile = useMemo(
    () => artistProfiles.find((profile) => !profile?.isComplete),
    [artistProfiles]
  );
  
  const hasCompleteProfile = !!completedProfile;
  
  // Redirect if URL profileId doesn't match any profile, or if no profileId but we have profiles
  useEffect(() => {
    if (viewerMode) return; // Don't redirect in viewer mode
    if (!user?.uid) return; // Wait for auth
    
    // Don't redirect if we're creating a new profile or just completed one
    if (shouldCreate || isCreatingProfile || justCompletedProfileRef.current) return;
    
    // If URL has profileId but profile not found, redirect to default (primary > complete > draft)
    if (urlProfileId && !activeProfileData && artistProfiles.length > 0) {
      let defaultProfile = null;
      if (user?.primaryArtistProfileId) {
        defaultProfile = artistProfiles.find(
          (p) => (p.id === user.primaryArtistProfileId || p.profileId === user.primaryArtistProfileId)
        );
      }
      if (!defaultProfile) {
        defaultProfile = completedProfile || draftProfile;
      }
      if (defaultProfile) {
        const profileId = defaultProfile.id || defaultProfile.profileId;
        // Preserve query parameters (e.g., conversationId) when redirecting
        const queryString = location.search || '';
        const subPath = location.pathname.includes('/gigs') ? '/gigs' : location.pathname.includes('/messages') ? '/messages' : location.pathname.includes('/finances') ? '/finances' : '';
        navigate(`/artist-profile/${profileId}${subPath}${queryString}`, { replace: true });
      }
      return;
    }
    
    // If no profileId in URL but we have profiles, redirect to default profile
    if (!urlProfileId && artistProfiles.length > 0 && activeProfileData) {
      const profileId = activeProfileData.id || activeProfileData.profileId;
      if (profileId && location.pathname === '/artist-profile') {
        navigate(`/artist-profile/${profileId}`, { replace: true });
      }
    }
  }, [urlProfileId, activeProfileData, artistProfiles, completedProfile, draftProfile, navigate, location.pathname, viewerMode, user?.uid, shouldCreate, isCreatingProfile]);
  const isOwner =
    !!user && !!activeProfileData && user.uid && activeProfileData.userId
      ? user.uid === activeProfileData.userId
      : false;
  const [artistPerms, setArtistPerms] = useState(null);
  const [loadingArtistPerms, setLoadingArtistPerms] = useState(false);

  // Resolve artist member permissions for the current user on the active profile.
  // Owners are always treated as having full profile.edit permissions.
  useEffect(() => {
    let cancelled = false;

    const run = async () => {
      if (viewerMode || !user?.uid || !activeProfileData?.id) {
        if (!cancelled) {
          setArtistPerms(null);
          setLoadingArtistPerms(false);
        }
        return;
      }

      // Owners implicitly have full edit rights.
      if (isOwner) {
        if (!cancelled) {
          setArtistPerms(
            sanitizeArtistPermissions({
              'profile.viewer': true,
              'profile.edit': true,
              'gigs.book': true,
              'finances.edit': true,
            })
          );
          setLoadingArtistPerms(false);
        }
        return;
      }

      try {
        setLoadingArtistPerms(true);
        const members = await getArtistProfileMembers(activeProfileData.id);
        if (cancelled) return;
        const me = members.find(
          (m) => m.id === user.uid && (m.status || 'active') === 'active'
        );
        const perms = sanitizeArtistPermissions(me?.permissions || {});
        setArtistPerms(perms);
      } catch (err) {
        console.error('Failed to load artist member permissions:', err);
        if (!cancelled) {
          setArtistPerms(null);
        }
      } finally {
        if (!cancelled) {
          setLoadingArtistPerms(false);
        }
      }
    };

    run();
    return () => {
      cancelled = true;
    };
  }, [viewerMode, user?.uid, activeProfileData?.id, isOwner]);

  const hasProfileEditPerm =
    !viewerMode &&
    (isOwner || !!artistPerms?.['profile.edit']);
  const canEdit = hasProfileEditPerm;
  const viewerHasVenueProfiles = viewerMode && user?.venueProfiles && user.venueProfiles.length > 0;

  // Venue viewer: track saved state for this artist
  const [artistSaved, setArtistSaved] = useState(false);
  const [savingArtist, setSavingArtist] = useState(false);
  const [inviteArtistModal, setInviteArtistModal] = useState(false);
  const [showInviteDateStep, setShowInviteDateStep] = useState(false);
  const [selectedExpiryDate, setSelectedExpiryDate] = useState(null);
  const [creatingInvite, setCreatingInvite] = useState(false);
  const [usersGigs, setUsersGigs] = useState([]);
  const [selectedGig, setSelectedGig] = useState(null);
  const [invitingArtist, setInvitingArtist] = useState(false);

  useEffect(() => {
    const checkIfSaved = async () => {
      if (!viewerHasVenueProfiles || !activeProfileData?.id || !user?.uid) {
        setArtistSaved(false);
        return;
      }
      try {
        const saved = await isArtistSavedInCRM(user.uid, activeProfileData.id);
        setArtistSaved(saved);
      } catch (error) {
        console.error('Error checking if artist is saved:', error);
        setArtistSaved(false);
      }
    };
    checkIfSaved();
  }, [viewerHasVenueProfiles, user?.uid, activeProfileData?.id]);

  const handleToggleSaveArtist = async () => {
    if (!viewerHasVenueProfiles || !activeProfileData?.id || !user?.uid) return;
    try {
      setSavingArtist(true);
      
      if (artistSaved) {
        // Removing artist - delete from CRM (only if it has an artistId)
        const removed = await removeArtistFromCRMByArtistId(user.uid, activeProfileData.id);
        if (removed) {
          setArtistSaved(false);
          toast.success('Artist removed from saved.');
        } else {
          toast.error('Artist not found in your saved list.');
        }
      } else {
        // Adding artist - create CRM entry
        try {
          await createArtistCRMEntry(user.uid, {
            artistId: activeProfileData.id,
            name: activeProfileData.name || 'Unknown Artist',
            notes: '',
          });
          setArtistSaved(true);
          toast.success('Artist saved.');
        } catch (crmError) {
          console.error('Error creating CRM entry:', crmError);
          toast.error('Failed to save artist. Please try again.');
        }
      }
    } catch (err) {
      console.error('Error toggling saved artist:', err);
      toast.error('Failed to update saved artists. Please try again.');
    } finally {
      setSavingArtist(false);
    }
  };

  const handleInviteArtist = async () => {
    if (!viewerHasVenueProfiles || !activeProfileData?.id) return;

    const { valid, venueProfiles } = validateVenueUser({
      user,
      setAuthModal,
      setAuthType,
      showAlert: (msg) => alert(msg),
    });
    if (!valid) return;

    const gigIds = venueProfiles.flatMap((venueProfile) => venueProfile.gigs || []);
    if (!gigIds.length) {
      toast.error('You have no upcoming gigs to invite this artist to.');
      return;
    }

    try {
      const fetchedGigs = await getGigsByIds(gigIds);
      const availableGigs = filterInvitableGigsForMusician(fetchedGigs, activeProfileData.id);
      const venuesWithMembership = await Promise.all(
        (venueProfiles || []).map((v) => fetchMyVenueMembership(v, user.uid))
      );
      const membershipByVenueId = Object.fromEntries(
        venuesWithMembership
          .filter(Boolean)
          .map((v) => [v.venueId, v.myMembership || null])
      );
      const gigsWithMembership = availableGigs.map((gig) => ({
        ...gig,
        myMembership: membershipByVenueId[gig.venueId] || null,
      }));
      setUsersGigs(gigsWithMembership);
      setInviteArtistModal(true);
    } catch (error) {
      console.error('Error fetching future gigs for artist invite:', error);
      toast.error('We encountered an error. Please try again.');
    }
  };

  const handleConfigureInvite = () => {
    if (!selectedGig) return;
    setShowInviteDateStep(true);
  };

  const handleGenerateInvite = async () => {
    if (!selectedGig || !activeProfileData?.id) return;

    setCreatingInvite(true);
    try {
      // Set time to end of day (23:59:59) if date is selected
      let expiresAt = null;
      if (selectedExpiryDate) {
        const date = new Date(selectedExpiryDate);
        date.setHours(23, 59, 59, 999);
        expiresAt = date;
      }

      // Create the invite document with artistId and artistName
      await createGigInvite({
        gigId: selectedGig.gigId,
        expiresAt: expiresAt?.toISOString() || null,
        artistId: activeProfileData.id,
        artistName: activeProfileData.name
      });

      // Now proceed with the existing invite logic
      await handleSendArtistInvite(selectedGig);
    } catch (error) {
      console.error('Error creating invite:', error);
      toast.error('Failed to create invite. Please try again.');
      setCreatingInvite(false);
    }
  };

  const handleSendArtistInvite = async (gigData) => {
    if (!viewerHasVenueProfiles || !activeProfileData?.id || !gigData) return;

    const venueToSend = user.venueProfiles.find((venue) => venue.id === gigData.venueId);
    if (!venueToSend) {
      console.error('Venue not found in user profiles.');
      return;
    }

    // Normalize artist profile to legacy "musicianProfile" shape for backend compatibility
    const musicianProfilePayload = {
      musicianId: activeProfileData.id,
      id: activeProfileData.id,
      name: activeProfileData.name,
      genres: activeProfileData.genres || [],
      musicianType: activeProfileData.artistType || 'Musician/Band',
      musicType: activeProfileData.genres || [],
      bandProfile: false,
      userId: activeProfileData.userId,
    };

    try {
      setInvitingArtist(true);
      const res = await inviteToGig({ gigId: gigData.gigId, musicianProfile: musicianProfilePayload });
      if (!res.success) {
        if (res.code === 'permission-denied') {
          toast.error('You don’t have permission to invite artists for this venue.');
        } else if (res.code === 'failed-precondition') {
          toast.error('This gig is missing required venue info.');
        } else {
          toast.error('Error inviting artist. Do you have permission to invite artists to gigs at this venue?');
        }
        return;
      }

      const { conversationId } = await getOrCreateConversation({
        musicianProfile: musicianProfilePayload,
        gigData,
        venueProfile: venueToSend,
        type: 'invitation',
      });

      if (gigData.kind === 'Ticketed Gig' || gigData.kind === 'Open Mic') {
        await sendGigInvitationMessage(conversationId, {
          senderId: user.uid,
          text: `${venueToSend.accountName} invited ${activeProfileData.name} to play at their gig at ${gigData.venue.venueName} on the ${formatDate(
            gigData.date
          )}.`,
        });
      } else {
        await sendGigInvitationMessage(conversationId, {
          senderId: user.uid,
          text: `${venueToSend.accountName} invited ${activeProfileData.name} to play at their gig at ${gigData.venue.venueName} on the ${formatDate(
            gigData.date
          )} for ${gigData.budget}.`,
        });
      }

      setInviteArtistModal(false);
      setShowInviteDateStep(false);
      setSelectedExpiryDate(null);
      setSelectedGig(null);
      toast.success(`Invite sent to ${activeProfileData.name}`);
    } catch (error) {
      console.error('Error while creating or fetching conversation:', error);
      toast.error('Error inviting artist. Please try again.');
    } finally {
      setInvitingArtist(false);
      setCreatingInvite(false);
    }
  };
  const isCreationState = currentState === ArtistProfileState.CREATING;

  const displayName = useMemo(() => {
    // If name is being edited, show the editing value in real-time
    if (editingName !== null) {
      return editingName;
    }
    if (currentState === ArtistProfileState.EXAMPLE_PROFILE) {
      return selectedExampleProfile?.name || 'Example Artist';
    }
    if (currentState === ArtistProfileState.CREATING && creationArtistName) {
      return creationArtistName;
    }
    return activeProfileData?.name;
  }, [currentState, selectedExampleProfile, activeProfileData?.name, creationArtistName, editingName]);

  // Handle authentication - redirect to auth if not logged in
  // Don't auto-show modal if signup=true (will show when user clicks button)
  useEffect(() => {
    if (!authLoading && !user && setAuthModal) {
      const shouldSignup = searchParams.get('signup') === 'true';
      // Only auto-show login modal if signup param is not present
      if (!shouldSignup) {
        setAuthModal(true);
        setAuthType?.('login');
      }
    }
  }, [authLoading, user, setAuthModal, setAuthType, searchParams]);

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
    if (viewerMode) return; // viewer mode ignores URL-driven creation/dashboard state
    const urlState = searchParams.get('state');
    const shouldCreate = searchParams.get('create') === 'true';
    
    // If ?create=true is in URL, navigate to base path first (to clear old profileId), then trigger creation
    if (shouldCreate && !isCreatingProfile && !initializingArtistProfile && !createFromUrlRef.current) {
      // Allow up to 2 profiles per user
      if (artistProfiles && artistProfiles.length >= 2) {
        toast.error('You can only have up to 2 artist profiles.');
        // Remove ?create=true from URL
        setSearchParams({}, { replace: true });
        return;
      }
      
      // If there's a profileId in the URL path, navigate to base path first to clear it
      if (urlProfileId) {
        // Force navigation to base path without profileId
        navigate('/artist-profile?create=true', { replace: true });
        // The navigation will cause a re-render, and on the next render (without urlProfileId),
        // we'll trigger the creation. Set the ref to prevent multiple navigations.
        createFromUrlRef.current = true;
        return;
      }
      
      // No profileId in URL (or we've already navigated), start creation
      createFromUrlRef.current = true;
      handleBeginCreation();
      // Clear the create param after triggering
      setSearchParams((prev) => {
        const newParams = new URLSearchParams(prev);
        newParams.delete('create');
        return newParams;
      });
      return;
    }
    
    // Reset the ref when not creating
    if (!shouldCreate && !isCreatingProfile) {
      createFromUrlRef.current = false;
    }
    
    if (urlState && Object.values(ArtistProfileState).includes(urlState)) {
      // Only allow URL state if it makes sense (e.g., don't force dashboard if no profile)
      if (urlState === ArtistProfileState.CREATING && !hasCompleteProfile) {
        setCurrentState(ArtistProfileState.CREATING);
        setIsCreatingProfile(true);
      }
    }
  }, [searchParams, hasCompleteProfile, isCreatingProfile, initializingArtistProfile, urlProfileId, navigate, location.pathname]);

  // Check if active profile should redirect to creation flow (incomplete or draft)
  // This MUST run before the "Determine state based on profile status" useEffect
  useEffect(() => {
    if (viewerMode) return; // Don't redirect in viewer mode
    if (!user?.uid) return; // Wait for auth
    if (!activeProfileData) return; // No profile selected yet
    if (shouldCreate) return; // Creating new profile (not resuming draft)
    
    // Simple check: if isComplete is false, go to creation flow
    const isIncomplete = activeProfileData.isComplete === false;
    const isDraft = activeProfileData.status === 'draft';
    
    // If profile is complete, don't do anything
    if (!isIncomplete && !isDraft) {
      return;
    }
    
    // CRITICAL: Don't redirect if we just completed the profile (prevents redirect loop during Firestore refresh)
    // This flag is set when we complete the profile and cleared after 1 second
    if (justCompletedProfileRef.current) {
      return; // Just completed, wait for Firestore to refresh before checking again
    }
    
    // If we're already creating this exact profile, don't re-trigger
    const currentProfileId = activeProfileData.id || activeProfileData.profileId;
    if (isCreatingProfile && creationProfileId === currentProfileId) {
      return; // Already creating this profile
    }
    
    // Profile is incomplete - redirect to creation flow
    const profileId = currentProfileId;
    const onboardingStep = activeProfileData.onboardingStep || CREATION_STEP_ORDER[0];
    
    setIsCreatingProfile(true);
    setCurrentState(ArtistProfileState.CREATING);
    setCreationProfileId(profileId);
    setCreationStep(onboardingStep);
    
    // Load saved data from draft profile
    const savedBrightness = activeProfileData.heroBrightness ?? BRIGHTNESS_DEFAULT;
    setCreationHeroBrightness(savedBrightness);
    const savedPosition = clampHeroPosition(activeProfileData.heroPositionY ?? HERO_POSITION_DEFAULT);
    setCreationHeroPosition(savedPosition);
    setCreationArtistName(activeProfileData.name || "");
    setCreationArtistBio(activeProfileData.bio || "");
    setCreationSpotifyUrl(activeProfileData.spotifyUrl || "");
    setCreationSoundcloudUrl(activeProfileData.soundcloudUrl || "");
    setCreationYoutubeUrl(activeProfileData.youtubeUrl || "");
    setCreationWebsiteUrl(activeProfileData.websiteUrl || "");
    setCreationInstagramUrl(activeProfileData.instagramUrl || "");
    
    // Load tracks if they exist
    if (activeProfileData.tracks && Array.isArray(activeProfileData.tracks) && activeProfileData.tracks.length > 0) {
      const loadedTracks = activeProfileData.tracks.map(track => ({
        id: track.id,
        title: track.title || `Track ${track.id}`,
        artist: track.artist || "",
        audioFile: null,
        audioPreviewUrl: track.audioUrl || null,
        coverFile: null,
        coverPreviewUrl: track.coverUrl || null,
        uploadedAudioUrl: track.audioUrl || null,
        audioUrl: track.audioUrl || null,
        coverUploadedUrl: track.coverUrl || null,
        coverUrl: track.coverUrl || null,
        audioStoragePath: track.audioStoragePath || null,
        coverStoragePath: track.coverStoragePath || null,
      }));
      setCreationTracks(loadedTracks);
      latestTracksRef.current = loadedTracks;
      
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
    
    // Load videos if they exist
    if (activeProfileData.videos && Array.isArray(activeProfileData.videos) && activeProfileData.videos.length > 0) {
      const loadedVideos = activeProfileData.videos.map(video => ({
        id: video.id,
        title: video.title || `Video ${video.id}`,
        videoFile: null,
        videoPreviewUrl: video.videoUrl || null,
        thumbnailFile: null,
        thumbnailPreviewUrl: video.thumbnailUrl || null,
        uploadedVideoUrl: video.videoUrl || null,
        videoUrl: video.videoUrl || null,
        thumbnailUploadedUrl: video.thumbnailUrl || null,
        thumbnailUrl: video.thumbnailUrl || null,
        videoStoragePath: video.videoStoragePath || null,
        thumbnailStoragePath: video.thumbnailStoragePath || null,
      }));
      setCreationVideos(loadedVideos);
      latestVideosRef.current = loadedVideos;
      
      loadedVideos.forEach(video => {
        if (video.videoStoragePath || video.thumbnailStoragePath) {
          videosStoragePathsRef.current[video.id] = {
            videoPath: video.videoStoragePath || null,
            thumbnailPath: video.thumbnailStoragePath || null,
          };
        }
      });
    } else {
      setCreationVideos([]);
    }
    
    // Load hero image if it exists
    if (activeProfileData.heroMedia?.url) {
      setCreationHeroImage({
        file: null,
        previewUrl: activeProfileData.heroMedia.url,
        storagePath: activeProfileData.heroMedia.storagePath || null,
        uploadedUrl: activeProfileData.heroMedia.url,
      });
      setCreationHasHeroImage(true);
      heroStoragePathRef.current = activeProfileData.heroMedia.storagePath || null;
    }
  }, [activeProfileData, user?.uid, viewerMode, isCreatingProfile, shouldCreate, creationProfileId, urlProfileId, currentState]);


  // Determine state based on profile status
  useEffect(() => {
    if (viewerMode) return; // viewer mode always stays in dashboard/profile
    
    // Don't override if we're already in dashboard state (e.g., from direct transition in save handlers)
    if (currentState === ArtistProfileState.DASHBOARD && !isCreatingProfile) {
      // Already in dashboard - just sync dashboard view with URL if needed
      const viewFromPath = getDashboardViewFromPath(location.pathname);
      if (viewFromPath !== dashboardView) {
        setDashboardView(viewFromPath);
      }
      return;
    }
    
    // Check if the active profile is complete (either from hasCompleteProfile or activeProfileData directly)
    const activeProfileIsComplete = activeProfileData?.isComplete === true;
    const profileIsComplete = hasCompleteProfile || activeProfileIsComplete;
    
    // If we're in creating state, check if the profile we're creating is now complete
    if (isCreatingProfile) {
      // Check if the creationProfileId matches activeProfileData and it's complete
      const creatingProfileIsComplete = creationProfileId && 
        (activeProfileData?.id === creationProfileId || activeProfileData?.profileId === creationProfileId) &&
        activeProfileIsComplete;
      
      if (creatingProfileIsComplete) {
        // Profile just completed - transition to dashboard
        setIsCreatingProfile(false);
        setCurrentState(ArtistProfileState.DASHBOARD);
        // Set dashboard view to match current URL, or default to PROFILE
        const viewFromPath = getDashboardViewFromPath(location.pathname);
        setDashboardView(viewFromPath);
        // Navigate to correct path if not already there
        const profileId = activeProfileData?.id || activeProfileData?.profileId;
        const basePath = profileId ? `/artist-profile/${profileId}` : '/artist-profile';
        const pathMap = {
          [DashboardView.PROFILE]: basePath,
          [DashboardView.GIGS]: `${basePath}/gigs`,
          [DashboardView.MESSAGES]: `${basePath}/messages`,
          [DashboardView.FINANCES]: `${basePath}/finances`,
        };
        const targetPath = pathMap[viewFromPath] || basePath;
        // Preserve query parameters (e.g., conversationId) when navigating
        const queryString = location.search || '';
        if (location.pathname !== targetPath) {
          navigate(`${targetPath}${queryString}`, { replace: true });
        }
        // Clear URL state when transitioning to dashboard (but preserve query params)
        // Only clear search params if they're not conversation-related
        const currentParams = new URLSearchParams(location.search);
        if (!currentParams.has('conversationId')) {
          setSearchParams({});
        }
        previousProfileRef.current = true;
        return;
      }
      
      // Still creating and not complete yet
      return;
    }

    if (profileIsComplete) {
      // Profile just completed - transition to dashboard
      if (previousProfileRef.current !== profileIsComplete) {
        setIsCreatingProfile(false);
        setCurrentState(ArtistProfileState.DASHBOARD);
        // Set dashboard view to match current URL, or default to PROFILE
        const viewFromPath = getDashboardViewFromPath(location.pathname);
        setDashboardView(viewFromPath);
        // Navigate to correct path if not already there
        const profileId = activeProfileData?.id || activeProfileData?.profileId;
        const basePath = profileId ? `/artist-profile/${profileId}` : '/artist-profile';
        const pathMap = {
          [DashboardView.PROFILE]: basePath,
          [DashboardView.GIGS]: `${basePath}/gigs`,
          [DashboardView.MESSAGES]: `${basePath}/messages`,
          [DashboardView.FINANCES]: `${basePath}/finances`,
        };
        const targetPath = pathMap[viewFromPath] || basePath;
        // Preserve query parameters (e.g., conversationId) when navigating
        const queryString = location.search || '';
        if (location.pathname !== targetPath) {
          navigate(`${targetPath}${queryString}`, { replace: true });
        }
        // Clear URL state when transitioning to dashboard (but preserve query params)
        // Only clear search params if they're not conversation-related
        const currentParams = new URLSearchParams(location.search);
        if (!currentParams.has('conversationId')) {
          setSearchParams({});
        }
      }
    } else {
      // No complete profile - check if it's incomplete/draft and should go to creation flow
      const isIncomplete = activeProfileData?.isComplete === false;
      const isDraft = activeProfileData?.status === 'draft';
      
      // If profile is incomplete/draft, don't set to example - let the creation flow useEffect handle it
      if (isIncomplete || isDraft) {
        // Don't override - the creation flow useEffect will handle this
        return;
      }
      
      // No profile at all - show example view (unless explicitly creating)
      if (!isCreatingProfile && currentState !== ArtistProfileState.DASHBOARD) {
        setCurrentState(ArtistProfileState.EXAMPLE_PROFILE);
        // Clear URL state when showing example
        if (searchParams.get('state')) {
          setSearchParams({});
        }
      }
    }

    previousProfileRef.current = profileIsComplete;
  }, [hasCompleteProfile, activeProfileData?.isComplete, activeProfileData?.id, activeProfileData?.profileId, isCreatingProfile, creationProfileId, searchParams, location.pathname, navigate, viewerMode, currentState, dashboardView]);

  // Initialize dark mode from Firestore when profile data first loads.
  // After initialisation, local toggles control the value without being overwritten.
  useEffect(() => {
    if (activeProfileData?.darkMode === undefined) return;
    // Only initialise once per profile load
    if (!darkModeInitializedRef.current) {
      setIsDarkMode(activeProfileData.darkMode);
      darkModeInitializedRef.current = true;
    }
  }, [activeProfileData?.darkMode]);

  // Sync dashboard view with URL pathname (for browser back/forward support)
  const isNavigatingFromUrlRef = useRef(false);
  useEffect(() => {
    if (viewerMode) return; // viewer route is separate, don't sync to /artist-profile paths
    if (currentState === ArtistProfileState.DASHBOARD) {
      const viewFromPath = getDashboardViewFromPath(location.pathname);
      if (viewFromPath !== dashboardView) {
        isNavigatingFromUrlRef.current = true;
        setDashboardView(viewFromPath);
      }
    }
  }, [location.pathname, location.search, currentState]); // Added location.search to dependencies

  // Update URL when dashboard view changes (only when in dashboard state)
  useEffect(() => {
    if (viewerMode) return; // don't push /artist-profile URLs when viewing as a guest/venue
    // Don't update URL if we're creating a new profile
    if (shouldCreate || isCreatingProfile) return;
    if (currentState === ArtistProfileState.DASHBOARD && !isNavigatingFromUrlRef.current) {
      const profileId = activeProfileData?.id || activeProfileData?.profileId;
      const basePath = profileId ? `/artist-profile/${profileId}` : '/artist-profile';
      const pathMap = {
        [DashboardView.PROFILE]: basePath,
        [DashboardView.GIGS]: `${basePath}/gigs`,
        [DashboardView.MESSAGES]: `${basePath}/messages`,
        [DashboardView.FINANCES]: `${basePath}/finances`,
      };
      const targetPath = pathMap[dashboardView] || basePath;
      // Only navigate if pathname doesn't match
      const currentPathWithoutQuery = location.pathname.split('?')[0];
      if (currentPathWithoutQuery !== targetPath) {
        // Preserve existing query parameters when navigating
        const queryString = location.search || '';
        navigate(`${targetPath}${queryString}`, { replace: true });
      }
      // If pathname matches, do nothing - query parameters are already preserved in the URL
    }
    isNavigatingFromUrlRef.current = false;
  }, [dashboardView, currentState, navigate, location.pathname, location.search, activeProfileData, shouldCreate, isCreatingProfile]);

  // Track previous editing image to detect cancellation
  const previousEditingHeroImageRef = useRef(null);
  
  // Initialize previous profile ID ref when activeProfileData first loads
  useEffect(() => {
    const currentProfileId = activeProfileData?.id || activeProfileData?.profileId;
    if (currentProfileId && previousActiveProfileIdRef.current === null && currentState === ArtistProfileState.DASHBOARD) {
      previousActiveProfileIdRef.current = currentProfileId;
    }
  }, [activeProfileData?.id, activeProfileData?.profileId, currentState]);

  // Detect profile switches and show loading screen
  useEffect(() => {
    // Skip if already switching to avoid re-triggering
    if (isSwitchingProfile) return;
    
    // Don't trigger profile switching logic when creating a new profile or just completed one
    if (isCreatingProfile || shouldCreate || justCompletedProfileRef.current) {
      // Clear any existing timeout and reset switching state if we're creating
      if (switchingProfileTimeoutRef.current) {
        clearTimeout(switchingProfileTimeoutRef.current);
        switchingProfileTimeoutRef.current = null;
      }
      if (isSwitchingProfile) {
        setIsSwitchingProfile(false);
      }
      return;
    }
    
    // Clear any existing timeout
    if (switchingProfileTimeoutRef.current) {
      clearTimeout(switchingProfileTimeoutRef.current);
      switchingProfileTimeoutRef.current = null;
    }
    
    const currentProfileId = activeProfileData?.id || activeProfileData?.profileId;
    const previousProfileId = previousActiveProfileIdRef.current;
    
    // If profile ID changed and we're in dashboard state, we're switching profiles
    const profileChanged = currentProfileId !== previousProfileId && 
                           currentProfileId !== null && 
                           previousProfileId !== null;
    
    if (profileChanged && 
        currentState === ArtistProfileState.DASHBOARD && 
        !isCreatingProfile &&
        !shouldCreate &&
        !justCompletedProfileRef.current) {
      setIsSwitchingProfile(true);
      
      // Clear editing states when switching profiles
      setEditingHeroImage(null);
      setEditingHeroBrightness(null);
      setEditingHeroPosition(null);
      setEditingName(null);
      previousEditingHeroImageRef.current = null;
      
      // Hide loading after a delay to allow data to load and images to update
      switchingProfileTimeoutRef.current = setTimeout(() => {
        setIsSwitchingProfile(false);
        // Update the ref after the switch is complete
        previousActiveProfileIdRef.current = currentProfileId;
        switchingProfileTimeoutRef.current = null;
      }, 800); // Increased to 800ms for smoother transition
    } else if (currentProfileId && currentProfileId === previousProfileId) {
      // If not switching and profile ID matches, ensure ref is up to date
      previousActiveProfileIdRef.current = currentProfileId;
    }
    
    // Cleanup function to clear timeout if component unmounts or dependencies change
    return () => {
      if (switchingProfileTimeoutRef.current) {
        clearTimeout(switchingProfileTimeoutRef.current);
        switchingProfileTimeoutRef.current = null;
      }
    };
  }, [activeProfileData?.id, activeProfileData?.profileId, currentState, isCreatingProfile, shouldCreate]);
  
  // Keep hero image in sync with current state
  useEffect(() => {
    // If editing, use the editing image preview (highest priority)
    if (editingHeroImage) {
      setBackgroundImage(editingHeroImage);
      previousEditingHeroImageRef.current = editingHeroImage;
      return;
    }

    // If editingHeroImage is null but it was previously set (user canceled or saved)
    const wasEditing = previousEditingHeroImageRef.current !== null;
    if (wasEditing && editingHeroImage === null) {
      // Check if backgroundImage is already set to a new URL (just saved)
      // If so, don't revert - keep the new image
      const currentBackgroundIsNewUrl = backgroundImage && 
        (backgroundImage.startsWith('https://') || backgroundImage.startsWith('http://')) &&
        backgroundImage !== activeProfileData?.heroMedia?.url;
      
      if (currentBackgroundIsNewUrl) {
        // Just saved - keep the new image, don't revert
        previousEditingHeroImageRef.current = null;
        return;
      }
      
      // User canceled - revert to original image
      previousEditingHeroImageRef.current = null;
      const originalImage = activeProfileData?.heroMedia?.url;
      if (originalImage && originalImage !== backgroundImage) {
        setBackgroundImage(originalImage);
      }
      return;
    }

    // Don't update background image if we're in edit mode but editingHeroImage is null
    // (this prevents reverting to old image while user is selecting new one)
    // BUT: Always update when profile ID changes (switching profiles or completing creation)
    const currentProfileId = activeProfileData?.id || activeProfileData?.profileId;
    const previousProfileId = previousActiveProfileIdRef.current;
    const profileChanged = currentProfileId !== previousProfileId;
    
    // Also check if we just completed profile creation - if so, force update
    const justCompletedCreation = !isCreatingProfile && creationProfileId && currentProfileId === creationProfileId;
    
    const isInEditMode =
      activeProfileData?.heroMedia?.url && currentState === ArtistProfileState.DASHBOARD;
    if (!viewerMode && isInEditMode && !wasEditing && !profileChanged && !justCompletedCreation) {
      // In edit mode for the owner, keep current image until new one is selected
      // UNLESS we're switching profiles or just completed creation
      return;
    }

    let targetImage;

    // Priority order:
    // 1. User's profile image (if they have one, regardless of currentState)
    // 2. Creation hero image (if in creation flow)
    // 3. Example profile image (only if no user profile exists)
    if (activeProfileData?.heroMedia?.url) {
      // User has a profile with an image - use it (highest priority)
      targetImage = activeProfileData.heroMedia.url;
    } else if (creationHasHeroImage && creationHeroImage?.previewUrl) {
      // In creation flow with hero image
      targetImage = creationHeroImage.previewUrl;
    } else if (currentState === ArtistProfileState.EXAMPLE_PROFILE) {
      // Only show example profile if user has no profile
      targetImage = selectedExampleProfile?.backgroundImage;
    }

    // Always update if profile changed, just completed creation, or if targetImage is different
    if (profileChanged || justCompletedCreation || (targetImage && targetImage !== backgroundImage)) {
      setBackgroundImage(targetImage || null);
    }
  }, [
    currentState,
    selectedExampleProfile,
    creationHasHeroImage,
    creationHeroImage?.previewUrl,
    activeProfileData?.heroMedia?.url,
    activeProfileData?.id,
    activeProfileData?.profileId,
    backgroundImage,
    editingHeroImage,
    viewerMode,
    isCreatingProfile,
    creationProfileId,
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

  // Resume draft profile automatically (but not when ?create=true is in URL)
  useEffect(() => {
    if (!draftProfile) return;
    if (creationProfileId === draftProfile.id) return;
    if (isCreatingProfile) return;
    if (hasCompleteProfile) return;
    // Don't auto-resume draft if user explicitly wants to create a new profile
    const shouldCreateNew = searchParams.get('create') === 'true';
    if (shouldCreateNew) return;

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
        audioSizeBytes: track.audioSizeBytes ?? track.audioBytes ?? 0,
        coverSizeBytes: track.coverSizeBytes ?? 0,
        totalSizeBytes:
          track.totalSizeBytes ??
          (track.audioSizeBytes ?? track.audioBytes ?? 0) +
            (track.coverSizeBytes ?? 0),
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
          videoSizeBytes: video.videoSizeBytes ?? video.fileSize ?? 0,
          thumbnailSizeBytes: video.thumbnailSizeBytes ?? 0,
          totalSizeBytes:
            video.totalSizeBytes ??
            (video.videoSizeBytes ?? video.fileSize ?? 0) +
              (video.thumbnailSizeBytes ?? 0),
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
      const heroUrl = draftProfile.heroMedia.url;
      const heroStoragePath = draftProfile.heroMedia.storagePath || null;
      
      // If the URL is a blob URL, we need to get the actual URL from storage
      let actualUrl = heroUrl;
      if (heroUrl && heroUrl.startsWith('blob:') && heroStoragePath) {
        // Get the actual download URL from storage
        const storageRef = ref(storage, heroStoragePath);
        getDownloadURL(storageRef)
          .then((downloadUrl) => {
            setCreationHeroImage({
              file: null,
              previewUrl: downloadUrl,
              storagePath: heroStoragePath,
              uploadedUrl: downloadUrl,
            });
            setCreationHasHeroImage(true);
            setBackgroundImage(downloadUrl);
            // Update Firestore with the correct URL (use draftProfile.id since creationProfileId might not be updated yet)
            updateArtistProfileDocument(draftProfile.id, {
              heroMedia: { url: downloadUrl, storagePath: heroStoragePath },
            }).catch((error) => {
              console.error('Failed to update hero media URL:', error);
            });
          })
          .catch((error) => {
            console.error('Failed to get download URL from storage:', error);
            // Fallback to using the blob URL for preview (but it won't work on reload)
            setCreationHeroImage({
              file: null,
              previewUrl: heroUrl,
              storagePath: heroStoragePath,
            });
            setCreationHasHeroImage(true);
            setBackgroundImage(heroUrl);
          });
      } else {
        // Not a blob URL, use it directly
        setCreationHeroImage({
          file: null,
          previewUrl: actualUrl,
          storagePath: heroStoragePath,
          uploadedUrl: actualUrl,
        });
        setCreationHasHeroImage(true);
        setBackgroundImage(actualUrl);
      }
      heroStoragePathRef.current = draftProfile.heroMedia.storagePath || null;
    } else {
      setCreationHeroImage(null);
      heroStoragePathRef.current = null;
      setCreationHasHeroImage(false);
    }
  }, [draftProfile, creationProfileId, isCreatingProfile, hasCompleteProfile, searchParams]);

  // Handle transition to creation flow
  const handleBeginCreation = async () => {
    if (initializingArtistProfile) return;

    // Require authentication before starting the flow
    if (!user?.uid) {
      // Check if signup query param is present (from landing page)
      const shouldSignup = searchParams.get('signup') === 'true';
      setAuthModal?.(true);
      setAuthType?.(shouldSignup ? 'signup' : 'login');
      return;
    }

    // If ?create=true is in URL, skip draft profile and create a new one
    const shouldCreateNew = searchParams.get('create') === 'true';
    
    // Allow resuming draft profiles
    if (draftProfile && !shouldCreateNew) {
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

    // Allow up to 2 profiles per user
    // (This check is after the draft resume check, so drafts can still be resumed)
    if (artistProfiles && artistProfiles.length >= 2) {
      toast.error('You can only have up to 2 artist profiles.');
      return;
    }

    // Creating a new profile (not resuming a draft)
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
        userData: {
          name: user.name || null,
          email: user.email || null,
        },
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
  const handleProfileCreated = async () => {
    if (heroBrightnessUpdateTimeoutRef.current) {
      clearTimeout(heroBrightnessUpdateTimeoutRef.current);
    }
    
    if (!creationProfileId) {
      resetCreationState();
      return;
    }

    // Check for ongoing uploads - if media is still uploading, show modal
    if (heroUploadStatus === 'uploading') {
      toast.error('Please wait for hero image upload to complete');
      return;
    }

    if (tracksUploadStatus === 'uploading') {
      setShowTracksUploadModal(true);
      return;
    }

    if (videoUploadStatus === 'uploading') {
      setShowVideoUploadModal(true);
      return;
    }

    // All uploads are complete - mark profile as complete
    setSavingDraft(true);

    try {
      // Mark the profile as complete
      await updateArtistProfileDocument(creationProfileId, {
        status: 'complete',
        isComplete: true,
      });
      
      toast.success('Profile completed!');
      
      // Store profileId for modal before clearing creationProfileId
      setCompletedProfileId(creationProfileId);
      
      // Mark that we just completed the profile to prevent redirect loop
      justCompletedProfileRef.current = true;
      
      // Clear any profile switching state
      setIsSwitchingProfile(false);
      if (switchingProfileTimeoutRef.current) {
        clearTimeout(switchingProfileTimeoutRef.current);
        switchingProfileTimeoutRef.current = null;
      }
      
      // Store the new profile ID in localStorage
      setStoredActiveProfileId(creationProfileId);
      // Update the previous profile ID ref to prevent switching detection
      previousActiveProfileIdRef.current = creationProfileId;
      
      // Check for redirect URL in sessionStorage
      const redirectUrl = sessionStorage.getItem('artistProfileRedirectUrl');
      if (redirectUrl) {
        // Clear the redirect URL from sessionStorage
        sessionStorage.removeItem('artistProfileRedirectUrl');
        // Clear creating profile state before redirecting
        setIsCreatingProfile(false);
        // Navigate to the redirect URL
        navigate(redirectUrl, { replace: true });
      } else {
        // Default navigation to profile page
        navigate(`/artist-profile/${creationProfileId}`, { replace: true });
        // Directly transition to dashboard - don't wait for useEffect
        setIsCreatingProfile(false);
        setCurrentState(ArtistProfileState.DASHBOARD);
        setDashboardView(DashboardView.PROFILE);
        setSearchParams({});
      }
      
      // Show profile completion modal after navigation and state updates complete
      setTimeout(() => {
        setShowProfileCompletionModal(true);
      }, 300);
      
      // Clear creationProfileId and reset the flag after a short delay
      // Don't clear completedProfileId - let the modal handle that when it closes
      setTimeout(() => {
        setCreationProfileId(null);
        // Reset the flag after profile data has had time to refresh
        setTimeout(() => {
          justCompletedProfileRef.current = false;
        }, 1000);
      }, 100);
    } catch (error) {
      console.error('Failed to complete profile:', error);
      toast.error('Failed to complete your profile. Please try again.');
    } finally {
      setSavingDraft(false);
    }
  };

  const handleHeroPositionChange = useCallback(
    (value) => {
      const clamped = clampHeroPosition(value);
      
      // Check if we're in edit mode (dashboard with profile data)
      const isInEditMode = activeProfileData?.heroMedia?.url && currentState === ArtistProfileState.DASHBOARD;
      
      // If in edit mode, always update editing state (even if it was null initially)
      if (isInEditMode) {
        setEditingHeroPosition(clamped);
        // Force a re-render by updating a dummy state if needed
        return;
      }
      
      // Otherwise, update creation state
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
    [creationProfileId, activeProfileData?.heroMedia?.url, currentState]
  );

  const handleHeroPointerMove = useCallback(
    (event) => {
      if (!heroDragStateRef.current.isDragging) {
        return;
      }
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
      if (!isRepositioningHero) return;
      
      // Check if we're in edit mode (dashboard with profile data)
      const isInEditMode = activeProfileData?.heroMedia?.url && currentState === ArtistProfileState.DASHBOARD;
      
      // Allow repositioning if:
      // 1. In creation state with hero image, OR
      // 2. In edit mode (dashboard with profile data)
      const canReposition = isCreationState 
        ? creationHasHeroImage 
        : isInEditMode;
      
      if (!canReposition) {
        return;
      }
      
      event.preventDefault();
      heroDragStateRef.current.isDragging = true;
      heroDragStateRef.current.startY = event.clientY;
      
      // Determine current position:
      // - If in edit mode, use editingHeroPosition if set, otherwise use activeProfileData position
      // - Otherwise use creation position
      let currentPosition;
      if (isInEditMode) {
        currentPosition = editingHeroPosition !== null 
          ? editingHeroPosition 
          : clampHeroPosition(activeProfileData?.heroPositionY ?? HERO_POSITION_DEFAULT);
      } else {
        currentPosition = creationHeroPosition;
      }
      
      heroDragStateRef.current.startPosition = currentPosition;
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
      editingHeroPosition,
      activeProfileData?.heroMedia?.url,
      activeProfileData?.heroPositionY,
      currentState,
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
    // Only disable if we're in creation state and don't have hero image
    // In edit mode (dashboard), we have activeProfileData, so allow repositioning
    const isInEditMode = activeProfileData?.heroMedia?.url && currentState === ArtistProfileState.DASHBOARD;
    if (!isCreationState || isInEditMode) {
      return; // Allow repositioning in edit mode or when not in creation
    }
    
    if (!creationHasHeroImage && isRepositioningHero) {
      handleHeroRepositionToggle(false);
    }
  }, [creationHasHeroImage, isRepositioningHero, handleHeroRepositionToggle, isCreationState, activeProfileData?.heroMedia?.url, currentState]);

  useEffect(() => {
    // Only disable repositioning if we're NOT in creation state AND NOT in edit mode (dashboard with profile)
    // If we're in edit mode (dashboard with active profile), always allow repositioning
    const isInEditMode = activeProfileData?.heroMedia?.url && currentState === ArtistProfileState.DASHBOARD;
    
    // Don't disable if we're in edit mode - allow repositioning to work
    if (isInEditMode) {
      return;
    }
    
    // Only disable if we're not in creation state, repositioning is active, and position is null
    if (!isCreationState && isRepositioningHero && editingHeroPosition === null) {
      handleHeroRepositionToggle(false);
    }
  }, [isCreationState, isRepositioningHero, handleHeroRepositionToggle, editingHeroPosition, activeProfileData?.heroMedia?.url, currentState]);

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

    // Capture creationTracks at the start to prevent file reference changes during upload
    const tracksSnapshot = [...creationTracks];

    const hasTracksToUpload = tracksSnapshot.some(
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
    const tracksToUpdate = tracksSnapshot.map(track => {
      const audioSizeBytes = track.audioSizeBytes ?? track.audioFile?.size ?? 0;
      const coverSizeBytes = track.coverSizeBytes ?? track.coverFile?.size ?? 0;
      return {
        ...track,
        // Preserve existing uploaded URLs if they exist
        uploadedAudioUrl: track.uploadedAudioUrl || track.audioUrl || null,
        coverUploadedUrl: track.coverUploadedUrl || track.coverUrl || null,
        audioStoragePath: track.audioStoragePath || null,
        coverStoragePath: track.coverStoragePath || null,
        audioSizeBytes,
        coverSizeBytes,
        totalSizeBytes: track.totalSizeBytes ?? audioSizeBytes + coverSizeBytes,
      };
    });
    // Use a ref to track completed uploads so all progress callbacks see the current value
    const completedUploadsRef = { current: 0 };
    const totalUploads = tracksSnapshot.reduce((count, track) => {
      return count + (track.audioFile ? 1 : 0) + (track.coverFile ? 1 : 0);
    }, 0);



    // If there are no uploads to do, exit early
    if (totalUploads === 0) {
      return;
    }

    // Helper function to update progress
    const updateProgress = () => {
      if (tracksUploadTokenRef.current === uploadToken && isMountedRef.current) {
        const progress = (completedUploadsRef.current / totalUploads) * 100;
        setTracksUploadProgress(progress);
      }
    };

    tracksSnapshot.forEach((track, index) => {
      const trackId = track.id;
      const previousPaths = tracksStoragePathsRef.current[trackId] || {};

      // Capture file references at the start to prevent ERR_UPLOAD_FILE_CHANGED
      const audioFile = track.audioFile;
      const coverFile = track.coverFile;

      // Upload audio file if present
      if (audioFile) {
        const extension = audioFile.name?.split('.').pop() || 'mp3';
        const filename = `track-${trackId}-${Date.now()}.${extension}`;
        const storagePath = `artistProfiles/${creationProfileId}/tracks/${filename}`;
        const previousAudioPath = previousPaths.audioPath;

        const audioUploadPromise = uploadFileWithProgress(
          audioFile, // Use captured reference, not from state
          storagePath,
          (progress) => {
            if (tracksUploadTokenRef.current !== uploadToken || !isMountedRef.current) return;
            // progress is already 0-100, so we need to scale it by the upload's share
            const baseProgress = (completedUploadsRef.current / totalUploads) * 100;
            const currentProgress = (progress / totalUploads);
            setTracksUploadProgress(baseProgress + currentProgress);
          }
        )
          .then(async (audioUrl) => {
            if (tracksUploadTokenRef.current !== uploadToken) return;
            if (!isMountedRef.current) return;


            // Update track with uploaded URL and storage path
            const trackIndex = tracksToUpdate.findIndex(t => t.id === trackId);
            if (trackIndex !== -1) {
              const audioSizeBytes =
                audioFile?.size ??
                tracksToUpdate[trackIndex].audioSizeBytes ??
                0;
              const coverSizeBytes = tracksToUpdate[trackIndex].coverSizeBytes ?? 0;
              tracksToUpdate[trackIndex] = {
                ...tracksToUpdate[trackIndex],
                uploadedAudioUrl: audioUrl,
                audioStoragePath: storagePath,
                audioFile: null, // Clear file reference after upload
                // Preserve preview URL if uploaded URL exists
                audioPreviewUrl: tracksToUpdate[trackIndex].audioPreviewUrl || audioUrl,
                audioSizeBytes,
                totalSizeBytes: audioSizeBytes + coverSizeBytes,
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

            completedUploadsRef.current++;
            updateProgress();
          })
          .catch((error) => {
            if (tracksUploadTokenRef.current !== uploadToken || !isMountedRef.current) return;
            console.error(`Failed to upload audio for track ${trackId}:`, error);
            completedUploadsRef.current++;
            updateProgress();
          });

        uploadPromises.push(audioUploadPromise);
      }

      // Upload cover image if present
      if (coverFile) {
        const extension = coverFile.name?.split('.').pop() || 'jpg';
        const filename = `cover-${trackId}-${Date.now()}.${extension}`;
        const storagePath = `artistProfiles/${creationProfileId}/tracks/covers/${filename}`;
        const previousCoverPath = previousPaths.coverPath;

        const coverUploadPromise = uploadFileWithProgress(
          coverFile, // Use captured reference, not from state
          storagePath,
          (progress) => {
            if (tracksUploadTokenRef.current !== uploadToken || !isMountedRef.current) return;
            // progress is already 0-100, so we need to scale it by the upload's share
            const baseProgress = (completedUploadsRef.current / totalUploads) * 100;
            const currentProgress = (progress / totalUploads);
            setTracksUploadProgress(baseProgress + currentProgress);
          }
        )
          .then(async (coverUrl) => {
            if (tracksUploadTokenRef.current !== uploadToken) return;
            if (!isMountedRef.current) return;


            // Update track with uploaded URL and storage path
            const trackIndex = tracksToUpdate.findIndex(t => t.id === trackId);
            if (trackIndex !== -1) {
              const coverSizeBytes =
                coverFile?.size ??
                tracksToUpdate[trackIndex].coverSizeBytes ??
                0;
              const audioSizeBytes = tracksToUpdate[trackIndex].audioSizeBytes ?? 0;
              tracksToUpdate[trackIndex] = {
                ...tracksToUpdate[trackIndex],
                coverUploadedUrl: coverUrl,
                coverStoragePath: storagePath,
                coverFile: null, // Clear file reference after upload
                // Preserve preview URL if uploaded URL exists
                coverPreviewUrl: tracksToUpdate[trackIndex].coverPreviewUrl || coverUrl,
                coverSizeBytes,
                totalSizeBytes: audioSizeBytes + coverSizeBytes,
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

            completedUploadsRef.current++;
            updateProgress();
          })
          .catch((error) => {
            if (tracksUploadTokenRef.current !== uploadToken || !isMountedRef.current) return;
            console.error(`Failed to upload cover for track ${trackId}:`, error);
            completedUploadsRef.current++;
            updateProgress();
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
                audioSizeBytes: track.audioSizeBytes ?? 0,
                coverSizeBytes: track.coverSizeBytes ?? 0,
                totalSizeBytes:
                  track.totalSizeBytes ??
                  (track.audioSizeBytes ?? 0) + (track.coverSizeBytes ?? 0),
              };
            });

            const mediaUsageBytes = calculateMediaUsageBytes(
              tracksToUpdate,
              latestVideosRef.current || []
            );

            await updateArtistProfileDocument(creationProfileId, {
              tracks: tracksForFirestore,
              mediaUsageBytes,
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

    // Capture creationVideos at the start to prevent file reference changes during upload
    const videosSnapshot = [...creationVideos];
    
    const hasVideosToUpload = videosSnapshot.some(
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

    const videosToUpdate = videosSnapshot.map((video) => {
      const videoSizeBytes = video.videoSizeBytes ?? video.videoFile?.size ?? 0;
      const thumbnailSizeBytes =
        video.thumbnailSizeBytes ??
        (video.thumbnailFile instanceof Blob ? video.thumbnailFile.size ?? 0 : 0);
      return {
        ...video,
        uploadedVideoUrl: video.uploadedVideoUrl || video.videoUrl || null,
        thumbnailUploadedUrl: video.thumbnailUploadedUrl || video.thumbnail || video.thumbnailUrl || null,
        videoStoragePath: video.videoStoragePath || null,
        thumbnailStoragePath: video.thumbnailStoragePath || null,
        videoSizeBytes,
        thumbnailSizeBytes,
        totalSizeBytes: video.totalSizeBytes ?? videoSizeBytes + thumbnailSizeBytes,
      };
    });

    // Use a ref to track completed uploads so all progress callbacks see the current value
    const completedUploadsRef = { current: 0 };
    const totalUploads = videosSnapshot.reduce((count, video) => {
      let videoCount = 0;
      if (video.videoFile) videoCount++;
      if (video.thumbnailFile && (video.thumbnailFile instanceof File || video.thumbnailFile instanceof Blob)) {
        videoCount++;
      }
      return count + videoCount;
    }, 0);

    if (totalUploads === 0) {
      videosUploadInProgressRef.current = false;
      setVideoUploadStatus('complete');
      setVideoUploadProgress(100);
      return;
    }

    const uploadPromises = [];

    // Helper function to update progress
    const updateProgress = () => {
      if (videosUploadTokenRef.current === uploadToken && isMountedRef.current) {
        const progress = (completedUploadsRef.current / totalUploads) * 100;
        setVideoUploadProgress(progress);
      }
    };

    videosSnapshot.forEach((video) => {
      const videoId = video.id;
      const previousPaths = videosStoragePathsRef.current[videoId] || {};

      // Capture file references at the start to prevent ERR_UPLOAD_FILE_CHANGED
      // Use the snapshot to ensure we always use the same file reference
      const videoFile = video.videoFile;
      const thumbnailFile = video.thumbnailFile;

      if (videoFile) {
        const extension = videoFile.name?.split('.').pop() || 'mp4';
        const filename = `video-${videoId}-${Date.now()}.${extension}`;
        const storagePath = `artistProfiles/${creationProfileId}/videos/${filename}`;
        const previousVideoPath = previousPaths.videoPath;

        const videoUploadPromise = uploadFileWithProgress(
          videoFile, // Use captured reference, not from state
          storagePath,
          (progress) => {
            if (videosUploadTokenRef.current !== uploadToken || !isMountedRef.current) return;
            // progress is already 0-100, so we need to scale it by the upload's share
            const baseProgress = (completedUploadsRef.current / totalUploads) * 100;
            const currentProgress = (progress / totalUploads);
            setVideoUploadProgress(baseProgress + currentProgress);
          }
        )
          .then(async (videoUrl) => {
            if (videosUploadTokenRef.current !== uploadToken || !isMountedRef.current) return;

            const videoIndex = videosToUpdate.findIndex((v) => v.id === videoId);
            if (videoIndex !== -1) {
              const videoSizeBytes = videoFile?.size ?? videosToUpdate[videoIndex].videoSizeBytes ?? 0;
              const thumbnailSizeBytes = videosToUpdate[videoIndex].thumbnailSizeBytes ?? 0;
              videosToUpdate[videoIndex] = {
                ...videosToUpdate[videoIndex],
                uploadedVideoUrl: videoUrl,
                videoStoragePath: storagePath,
                videoFile: null, // Clear file reference after upload
                videoPreviewUrl: videosToUpdate[videoIndex].videoPreviewUrl || videoUrl,
                videoSizeBytes,
                totalSizeBytes: videoSizeBytes + thumbnailSizeBytes,
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

            completedUploadsRef.current++;
            updateProgress();
          })
          .catch((error) => {
            if (videosUploadTokenRef.current !== uploadToken || !isMountedRef.current) return;
            console.error(`Failed to upload video for id ${videoId}:`, error);
            completedUploadsRef.current++;
            updateProgress();
          });

        uploadPromises.push(videoUploadPromise);
      }

      if (thumbnailFile) {
        // Validate thumbnail file
        if (!(thumbnailFile instanceof File) && !(thumbnailFile instanceof Blob)) {
          console.error(`Invalid thumbnail file for video ${videoId}, skipping upload:`, thumbnailFile);
          // Don't increment counter or update progress - invalid files aren't counted in totalUploads
        } else {
          const extension = thumbnailFile.name?.split('.').pop() || 'png';
          const filename = `thumbnail-${videoId}-${Date.now()}.${extension}`;
          const storagePath = `artistProfiles/${creationProfileId}/videos/thumbnails/${filename}`;
          const previousThumbnailPath = previousPaths.thumbnailPath;

          const thumbnailUploadPromise = uploadFileWithProgress(
            thumbnailFile, // Use captured reference, not from state
            storagePath,
            (progress) => {
              if (videosUploadTokenRef.current !== uploadToken || !isMountedRef.current) return;
              // progress is already 0-100, so we need to scale it by the upload's share
              const baseProgress = (completedUploadsRef.current / totalUploads) * 100;
              const currentProgress = (progress / totalUploads);
              setVideoUploadProgress(baseProgress + currentProgress);
            }
          )
          .then(async (thumbnailUrl) => {
            if (videosUploadTokenRef.current !== uploadToken || !isMountedRef.current) return;

            const videoIndex = videosToUpdate.findIndex((v) => v.id === videoId);
            if (videoIndex !== -1) {
              const thumbnailSizeBytes = (thumbnailFile instanceof Blob ? thumbnailFile.size : thumbnailFile?.size) ?? videosToUpdate[videoIndex].thumbnailSizeBytes ?? 0;
              const videoSizeBytes = videosToUpdate[videoIndex].videoSizeBytes ?? 0;
              videosToUpdate[videoIndex] = {
                ...videosToUpdate[videoIndex],
                thumbnailUploadedUrl: thumbnailUrl,
                thumbnailStoragePath: storagePath,
                thumbnailFile: null, // Clear file reference after upload
                thumbnailPreviewUrl: videosToUpdate[videoIndex].thumbnailPreviewUrl || thumbnailUrl,
                thumbnailGenerationError: null,
                isThumbnailGenerating: false,
                thumbnailSizeBytes,
                totalSizeBytes: videoSizeBytes + thumbnailSizeBytes,
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

            completedUploadsRef.current++;
            updateProgress();
          })
          .catch((error) => {
            if (videosUploadTokenRef.current !== uploadToken || !isMountedRef.current) return;
            console.error(`Failed to upload thumbnail for video ${videoId}:`, error);
            completedUploadsRef.current++;
            updateProgress();
          });

          uploadPromises.push(thumbnailUploadPromise);
        }
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
              videoSizeBytes: video.videoSizeBytes ?? 0,
              thumbnailSizeBytes: video.thumbnailSizeBytes ?? 0,
              totalSizeBytes:
                video.totalSizeBytes ??
                (video.videoSizeBytes ?? 0) + (video.thumbnailSizeBytes ?? 0),
            }));

            const mediaUsageBytes = calculateMediaUsageBytes(
              latestTracksRef.current || [],
              videosToUpdate
            );

            await updateArtistProfileDocument(creationProfileId, {
              videos: videosForFirestore,
              mediaUsageBytes,
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

  // Handler for editing hero image from profile view
  const handleHeroImageEdit = async ({ file, previewUrl, brightness, position, onProgress }) => {
    const profileId = activeProfileData?.profileId || activeProfileData?.id;
    if (!profileId) {
      throw new Error('Profile ID not found');
    }

    let heroUrl = null;
    let storagePath = null;

    if (file) {
      // Upload new file
      const extension = file.name?.split('.').pop() || 'jpg';
      const filename = `background-${Date.now()}.${extension}`;
      storagePath = `artistProfiles/${profileId}/hero/${filename}`;
      
      heroUrl = await uploadFileWithProgress(file, storagePath, (progress) => {
        if (onProgress) onProgress(progress);
      });

      // Delete old image if it exists
      const oldStoragePath = activeProfileData?.heroMedia?.storagePath;
      if (oldStoragePath && oldStoragePath !== storagePath) {
        deleteStoragePath(oldStoragePath).catch(err => {
          console.error('Failed to delete old hero image:', err);
        });
      }
    }

    // Update Firestore
    const updates = {
      heroBrightness: brightness || activeProfileData?.heroBrightness || BRIGHTNESS_DEFAULT,
      heroPositionY: position || activeProfileData?.heroPositionY || HERO_POSITION_DEFAULT,
    };

    if (heroUrl && storagePath) {
      updates.heroMedia = { url: heroUrl, storagePath };
      setBackgroundImage(heroUrl);
    }

    await updateArtistProfileDocument(profileId, updates);
    
    // Clear editing states after save
    // Clear the ref FIRST so the useEffect doesn't think we're canceling
    previousEditingHeroImageRef.current = null;
    setEditingHeroImage(null);
    setEditingHeroBrightness(null);
    setEditingHeroPosition(null);
  };

  // Handler for editing name from profile view
  const handleNameEdit = async (newName) => {
    const profileId = activeProfileData?.profileId || activeProfileData?.id;
    if (!profileId) {
      throw new Error('Profile ID not found');
    }

    await updateArtistProfileDocument(profileId, { name: newName });
    
    // Clear editing state - the user data will refresh automatically from Firestore
    setEditingName(null);
  };

  // Handler for editing bio from profile view
  const handleBioEdit = async (newBio) => {
    const profileId = activeProfileData?.profileId || activeProfileData?.id;
    if (!profileId) {
      throw new Error('Profile ID not found');
    }

    try {
      await updateArtistProfileDocument(profileId, { bio: newBio });
      toast.success('Bio updated successfully');
    } catch (error) {
      console.error('Failed to update bio:', error);
      toast.error('Failed to update bio');
      throw error;
    }
  };

  // Handler for editing website URL from profile view
  const handleWebsiteUrlEdit = async (newUrl) => {
    const profileId = activeProfileData?.profileId || activeProfileData?.id;
    if (!profileId) {
      throw new Error('Profile ID not found');
    }

    try {
      await updateArtistProfileDocument(profileId, { websiteUrl: newUrl });
      // Don't show toast for website URL - it's saved along with bio
    } catch (error) {
      console.error('Failed to update website URL:', error);
      throw error;
    }
  };

  // Handler for editing Instagram URL from profile view
  const handleInstagramUrlEdit = async (newUrl) => {
    const profileId = activeProfileData?.profileId || activeProfileData?.id;
    if (!profileId) {
      throw new Error('Profile ID not found');
    }

    try {
      await updateArtistProfileDocument(profileId, { instagramUrl: newUrl });
      // Don't show toast for Instagram URL - it's saved along with bio
    } catch (error) {
      console.error('Failed to update Instagram URL:', error);
      throw error;
    }
  };

  // Handler for dark mode changes - optimistic update
  const handleDarkModeChange = async (newDarkMode) => {
    // Optimistic update: update local state immediately
    setIsDarkMode(newDarkMode);
    
    // Then sync to Firestore in the background (only if user has a profile)
    if (currentState === ArtistProfileState.DASHBOARD && activeProfileData) {
      const profileId = activeProfileData?.profileId || activeProfileData?.id;
      if (profileId) {
        try {
          await updateArtistProfileDocument(profileId, { darkMode: newDarkMode });
        } catch (error) {
          console.error('Failed to update dark mode:', error);
          // Revert to previous value on error
          setIsDarkMode(!newDarkMode);
          toast.error('Failed to save dark mode preference. Please try again.');
        }
      }
    }
  };

  // Handler for saving tracks from profile view
  const handleTracksSave = async ({ tracks: tracksToSave, spotifyUrl: newSpotifyUrl, soundcloudUrl: newSoundcloudUrl }) => {
    const profileId = activeProfileData?.profileId || activeProfileData?.id;
    if (!profileId) {
      throw new Error('Profile ID not found');
    }

    try {
      // Get existing tracks from database to preserve URL/storage path fields
      const existingTracks = activeProfileData?.tracks || [];
      const existingTracksMap = new Map(existingTracks.map(track => [track.id, track]));

      // Upload any new files
      const uploadPromises = [];
      const tracksToUpdate = tracksToSave.map(track => {
        const audioSizeBytes = track.audioSizeBytes ?? track.audioFile?.size ?? 0;
        const coverSizeBytes = track.coverSizeBytes ?? track.coverFile?.size ?? 0;
        return {
          ...track,
          audioSizeBytes,
          coverSizeBytes,
          totalSizeBytes: track.totalSizeBytes ?? audioSizeBytes + coverSizeBytes,
        };
      });

      tracksToSave.forEach((track) => {
        const trackId = track.id;
        const previousPaths = tracksStoragePathsRef.current[trackId] || {};

        // Upload audio file if present
        if (track.audioFile) {
          const extension = track.audioFile.name?.split('.').pop() || 'mp3';
          const filename = `track-${trackId}-${Date.now()}.${extension}`;
          const storagePath = `artistProfiles/${profileId}/tracks/${filename}`;
          const previousAudioPath = previousPaths.audioPath;

          const audioUploadPromise = uploadFileWithProgress(
            track.audioFile,
            storagePath,
            () => {} // No progress tracking for edit mode
          )
            .then(async (audioUrl) => {
              // Update track with uploaded URL and storage path
              const trackIndex = tracksToUpdate.findIndex(t => t.id === trackId);
              if (trackIndex !== -1) {
                const audioSizeBytes =
                  track.audioFile?.size ??
                  tracksToUpdate[trackIndex].audioSizeBytes ??
                  0;
                const coverSizeBytes = tracksToUpdate[trackIndex].coverSizeBytes ?? 0;
                tracksToUpdate[trackIndex] = {
                  ...tracksToUpdate[trackIndex],
                  uploadedAudioUrl: audioUrl,
                  audioStoragePath: storagePath,
                  audioFile: null,
                  audioPreviewUrl: tracksToUpdate[trackIndex].audioPreviewUrl || audioUrl,
                  audioSizeBytes,
                  totalSizeBytes: audioSizeBytes + coverSizeBytes,
                };
              }

              // Delete previous audio file if it exists and is different
              if (previousAudioPath && previousAudioPath !== storagePath) {
                try {
                  await deleteStoragePath(previousAudioPath);
                } catch (error) {
                  console.error('Failed to delete previous audio file:', error);
                }
              }

              // Update storage paths ref
              if (!tracksStoragePathsRef.current[trackId]) {
                tracksStoragePathsRef.current[trackId] = {};
              }
              tracksStoragePathsRef.current[trackId].audioPath = storagePath;
            })
            .catch((error) => {
              console.error(`Failed to upload audio for track ${trackId}:`, error);
              throw error;
            });

          uploadPromises.push(audioUploadPromise);
        }

        // Upload cover file if present
        if (track.coverFile) {
          const extension = track.coverFile.name?.split('.').pop() || 'jpg';
          const filename = `cover-${trackId}-${Date.now()}.${extension}`;
          const storagePath = `artistProfiles/${profileId}/tracks/${filename}`;
          const previousCoverPath = previousPaths.coverPath;

          const coverUploadPromise = uploadFileWithProgress(
            track.coverFile,
            storagePath,
            () => {} // No progress tracking for edit mode
          )
            .then(async (coverUrl) => {
              // Update track with uploaded URL and storage path
              const trackIndex = tracksToUpdate.findIndex(t => t.id === trackId);
              if (trackIndex !== -1) {
                const coverSizeBytes =
                  track.coverFile?.size ??
                  tracksToUpdate[trackIndex].coverSizeBytes ??
                  0;
                const audioSizeBytes = tracksToUpdate[trackIndex].audioSizeBytes ?? 0;
                tracksToUpdate[trackIndex] = {
                  ...tracksToUpdate[trackIndex],
                  coverUploadedUrl: coverUrl,
                  coverStoragePath: storagePath,
                  coverFile: null,
                  coverPreviewUrl: tracksToUpdate[trackIndex].coverPreviewUrl || coverUrl,
                  coverSizeBytes,
                  totalSizeBytes: audioSizeBytes + coverSizeBytes,
                };
              }

              // Delete previous cover file if it exists and is different
              if (previousCoverPath && previousCoverPath !== storagePath) {
                try {
                  await deleteStoragePath(previousCoverPath);
                } catch (error) {
                  console.error('Failed to delete previous cover file:', error);
                }
              }

              // Update storage paths ref
              if (!tracksStoragePathsRef.current[trackId]) {
                tracksStoragePathsRef.current[trackId] = {};
              }
              tracksStoragePathsRef.current[trackId].coverPath = storagePath;
            })
            .catch((error) => {
              console.error(`Failed to upload cover for track ${trackId}:`, error);
              throw error;
            });

          uploadPromises.push(coverUploadPromise);
        }
      });

      // Wait for all uploads to complete
      await Promise.all(uploadPromises);

      // Prepare tracks for Firestore
      const tracksForFirestore = tracksToUpdate.map(track => {
        const existingTrack = existingTracksMap.get(track.id);

        if (existingTrack) {
          // Track exists - update metadata, preserve or update URLs/storage paths
          return {
            id: track.id,
            title: track.title,
            artist: track.artist,
            audioUrl: track.uploadedAudioUrl || existingTrack.audioUrl,
            audioStoragePath: track.audioStoragePath || existingTrack.audioStoragePath,
            coverUrl: track.coverUploadedUrl || existingTrack.coverUrl,
            coverStoragePath: track.coverStoragePath || existingTrack.coverStoragePath,
            audioSizeBytes: track.audioSizeBytes ?? existingTrack.audioSizeBytes ?? 0,
            coverSizeBytes: track.coverSizeBytes ?? existingTrack.coverSizeBytes ?? 0,
            totalSizeBytes:
              track.totalSizeBytes ??
              (track.audioSizeBytes ?? existingTrack.audioSizeBytes ?? 0) +
                (track.coverSizeBytes ?? existingTrack.coverSizeBytes ?? 0),
          };
        } else {
          // New track
          return {
            id: track.id,
            title: track.title,
            artist: track.artist,
            audioUrl: track.uploadedAudioUrl || null,
            audioStoragePath: track.audioStoragePath || null,
            coverUrl: track.coverUploadedUrl || null,
            coverStoragePath: track.coverStoragePath || null,
            audioSizeBytes: track.audioSizeBytes ?? 0,
            coverSizeBytes: track.coverSizeBytes ?? 0,
            totalSizeBytes:
              track.totalSizeBytes ??
              (track.audioSizeBytes ?? 0) + (track.coverSizeBytes ?? 0),
          };
        }
      });

      // Update Firestore with tracks and URLs
      const updates = {
        tracks: tracksForFirestore,
      };

      if (newSpotifyUrl !== undefined) {
        updates.spotifyUrl = newSpotifyUrl;
      }
      if (newSoundcloudUrl !== undefined) {
        updates.soundcloudUrl = newSoundcloudUrl;
      }

      const mediaUsageBytes = calculateMediaUsageBytes(
        tracksForFirestore,
        activeProfileData?.videos || []
      );

      await updateArtistProfileDocument(profileId, {
        ...updates,
        mediaUsageBytes,
      });
      toast.success('Tracks updated successfully');
    } catch (error) {
      console.error('Failed to save tracks:', error);
      toast.error('Failed to save tracks');
      throw error;
    }
  };

  // Handler for saving videos from profile view
  const handleVideosSave = async ({ videos: videosToSave, youtubeUrl: newYoutubeUrl }) => {
    const profileId = activeProfileData?.profileId || activeProfileData?.id;
    if (!profileId) {
      throw new Error('Profile ID not found');
    }

    try {
      // Get existing videos from database to preserve URL/storage path fields
      const existingVideos = activeProfileData?.videos || [];
      const existingVideosMap = new Map(existingVideos.map(video => [video.id, video]));

      // Upload any new files
      const uploadPromises = [];
      const videosToUpdate = videosToSave.map(video => {
        const videoSizeBytes = video.videoSizeBytes ?? video.videoFile?.size ?? 0;
        const thumbnailSizeBytes =
          video.thumbnailSizeBytes ??
          (video.thumbnailFile instanceof Blob ? video.thumbnailFile.size ?? 0 : 0);
        return {
          ...video,
          videoSizeBytes,
          thumbnailSizeBytes,
          totalSizeBytes: video.totalSizeBytes ?? videoSizeBytes + thumbnailSizeBytes,
        };
      });

      videosToSave.forEach((video) => {
        const videoId = video.id;
        const previousPaths = videosStoragePathsRef.current[videoId] || {};

        // Upload video file if present
        if (video.videoFile) {
          const extension = video.videoFile.name?.split('.').pop() || 'mp4';
          const filename = `video-${videoId}-${Date.now()}.${extension}`;
          const storagePath = `artistProfiles/${profileId}/videos/${filename}`;
          const previousVideoPath = previousPaths.videoPath;

          const videoUploadPromise = uploadFileWithProgress(
            video.videoFile,
            storagePath,
            () => {} // No progress tracking for edit mode
          )
            .then(async (videoUrl) => {
              // Update video with uploaded URL and storage path
              const videoIndex = videosToUpdate.findIndex(v => v.id === videoId);
              if (videoIndex !== -1) {
                const videoSizeBytes =
                  video.videoFile?.size ??
                  videosToUpdate[videoIndex].videoSizeBytes ??
                  0;
                const thumbnailSizeBytes = videosToUpdate[videoIndex].thumbnailSizeBytes ?? 0;
                videosToUpdate[videoIndex] = {
                  ...videosToUpdate[videoIndex],
                  uploadedVideoUrl: videoUrl,
                  videoStoragePath: storagePath,
                  videoFile: null,
                  videoPreviewUrl: videosToUpdate[videoIndex].videoPreviewUrl || videoUrl,
                  videoSizeBytes,
                  totalSizeBytes: videoSizeBytes + thumbnailSizeBytes,
                };
              }

              // Delete previous video file if it exists and is different
              if (previousVideoPath && previousVideoPath !== storagePath) {
                try {
                  await deleteStoragePath(previousVideoPath);
                } catch (error) {
                  console.error('Failed to delete previous video file:', error);
                }
              }

              // Update storage paths ref
              if (!videosStoragePathsRef.current[videoId]) {
                videosStoragePathsRef.current[videoId] = {};
              }
              videosStoragePathsRef.current[videoId].videoPath = storagePath;
            })
            .catch((error) => {
              console.error(`Failed to upload video for video ${videoId}:`, error);
              throw error;
            });

          uploadPromises.push(videoUploadPromise);
        }

        // Upload thumbnail file if present
        if (video.thumbnailFile) {
          const extension = video.thumbnailFile.name?.split('.').pop() || 'jpg';
          const filename = `thumbnail-${videoId}-${Date.now()}.${extension}`;
          const storagePath = `artistProfiles/${profileId}/videos/${filename}`;
          const previousThumbnailPath = previousPaths.thumbnailPath;

          const thumbnailUploadPromise = uploadFileWithProgress(
            video.thumbnailFile,
            storagePath,
            () => {} // No progress tracking for edit mode
          )
            .then(async (thumbnailUrl) => {
              // Update video with uploaded URL and storage path
              const videoIndex = videosToUpdate.findIndex(v => v.id === videoId);
              if (videoIndex !== -1) {
                const thumbnailSizeBytes =
                  video.thumbnailFile?.size ??
                  videosToUpdate[videoIndex].thumbnailSizeBytes ??
                  0;
                const videoSizeBytes = videosToUpdate[videoIndex].videoSizeBytes ?? 0;
                videosToUpdate[videoIndex] = {
                  ...videosToUpdate[videoIndex],
                  thumbnailUploadedUrl: thumbnailUrl,
                  thumbnailStoragePath: storagePath,
                  thumbnailFile: null,
                  thumbnailPreviewUrl: videosToUpdate[videoIndex].thumbnailPreviewUrl || thumbnailUrl,
                  thumbnailSizeBytes,
                  totalSizeBytes: videoSizeBytes + thumbnailSizeBytes,
                };
              }

              // Delete previous thumbnail file if it exists and is different
              if (previousThumbnailPath && previousThumbnailPath !== storagePath) {
                try {
                  await deleteStoragePath(previousThumbnailPath);
                } catch (error) {
                  console.error('Failed to delete previous thumbnail file:', error);
                }
              }

              // Update storage paths ref
              if (!videosStoragePathsRef.current[videoId]) {
                videosStoragePathsRef.current[videoId] = {};
              }
              videosStoragePathsRef.current[videoId].thumbnailPath = storagePath;
            })
            .catch((error) => {
              console.error(`Failed to upload thumbnail for video ${videoId}:`, error);
              throw error;
            });

          uploadPromises.push(thumbnailUploadPromise);
        }
      });

      // Wait for all uploads to complete
      await Promise.all(uploadPromises);

      // Prepare videos for Firestore
      const videosForFirestore = videosToUpdate.map(video => {
        const existingVideo = existingVideosMap.get(video.id);

        if (existingVideo) {
          // Video exists - update metadata, preserve or update URLs/storage paths
          return {
            id: video.id,
            title: video.title,
            videoUrl: video.uploadedVideoUrl || existingVideo.videoUrl,
            videoStoragePath: video.videoStoragePath || existingVideo.videoStoragePath,
            thumbnail: video.thumbnailUploadedUrl || existingVideo.thumbnail || existingVideo.thumbnailUrl,
            thumbnailUrl: video.thumbnailUploadedUrl || existingVideo.thumbnailUrl || existingVideo.thumbnail,
            thumbnailStoragePath: video.thumbnailStoragePath || existingVideo.thumbnailStoragePath,
            videoSizeBytes: video.videoSizeBytes ?? existingVideo.videoSizeBytes ?? 0,
            thumbnailSizeBytes: video.thumbnailSizeBytes ?? existingVideo.thumbnailSizeBytes ?? 0,
            totalSizeBytes:
              video.totalSizeBytes ??
              (video.videoSizeBytes ?? existingVideo.videoSizeBytes ?? 0) +
                (video.thumbnailSizeBytes ?? existingVideo.thumbnailSizeBytes ?? 0),
          };
        } else {
          // New video
          return {
            id: video.id,
            title: video.title,
            videoUrl: video.uploadedVideoUrl || null,
            videoStoragePath: video.videoStoragePath || null,
            thumbnail: video.thumbnailUploadedUrl || null,
            thumbnailUrl: video.thumbnailUploadedUrl || null,
            thumbnailStoragePath: video.thumbnailStoragePath || null,
            videoSizeBytes: video.videoSizeBytes ?? 0,
            thumbnailSizeBytes: video.thumbnailSizeBytes ?? 0,
            totalSizeBytes:
              video.totalSizeBytes ??
              (video.videoSizeBytes ?? 0) + (video.thumbnailSizeBytes ?? 0),
          };
        }
      });

      // Update Firestore with videos and URL
      const updates = {
        videos: videosForFirestore,
      };

      if (newYoutubeUrl !== undefined) {
        updates.youtubeUrl = newYoutubeUrl;
      }

      const mediaUsageBytes = calculateMediaUsageBytes(
        activeProfileData?.tracks || [],
        videosForFirestore
      );

      await updateArtistProfileDocument(profileId, {
        ...updates,
        mediaUsageBytes,
      });
      toast.success('Videos updated successfully');
    } catch (error) {
      console.error('Failed to save videos:', error);
      toast.error('Failed to save videos');
      throw error;
    }
  };

  // Handler for real-time name editing updates
  const handleEditingNameChange = (newName) => {
    // If newName is null, clear editing state
    // Otherwise, update with the new editing value
    setEditingName(newName === null ? null : newName);
  };

  // Handler for real-time background image editing updates
  const handleEditingHeroImageChange = (previewUrl) => {
    if (previewUrl === null) {
      setEditingHeroImage(null);
    } else {
      setEditingHeroImage(previewUrl);
      // Force immediate background update
      setBackgroundImage(previewUrl);
    }
  };

  // Handler for real-time brightness editing updates
  const handleEditingHeroBrightnessChange = (brightness) => {
    setEditingHeroBrightness(brightness === null ? null : brightness);
  };

  // Handler for real-time position editing updates
  const handleEditingHeroPositionChange = (position) => {
    setEditingHeroPosition(position === null ? null : position);
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
      let heroUrl = creationHeroImage.uploadedUrl || creationHeroImage.previewUrl;
      let storagePath = creationHeroImage.storagePath;

      // Check if heroUrl is a blob URL - if so, we need to get the actual URL from storage
      if (heroUrl && heroUrl.startsWith('blob:')) {
        if (storagePath) {
          // Get the actual download URL from storage
          const storageRef = ref(storage, storagePath);
          heroUrl = await getDownloadURL(storageRef);
        } else {
          // If we have a blob URL but no storage path, we can't save it
          console.error('Cannot save blob URL without storage path');
          heroUrl = null;
        }
      }

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
            audioSizeBytes: track.audioSizeBytes ?? existingTrack.audioSizeBytes ?? 0,
            coverSizeBytes: track.coverSizeBytes ?? existingTrack.coverSizeBytes ?? 0,
            totalSizeBytes:
              track.totalSizeBytes ??
              (track.audioSizeBytes ?? existingTrack.audioSizeBytes ?? 0) +
                (track.coverSizeBytes ?? existingTrack.coverSizeBytes ?? 0),
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
            audioSizeBytes: track.audioSizeBytes ?? 0,
            coverSizeBytes: track.coverSizeBytes ?? 0,
            totalSizeBytes:
              track.totalSizeBytes ??
              (track.audioSizeBytes ?? 0) + (track.coverSizeBytes ?? 0),
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
            videoSizeBytes: video.videoSizeBytes ?? existingVideo.videoSizeBytes ?? 0,
            thumbnailSizeBytes: video.thumbnailSizeBytes ?? existingVideo.thumbnailSizeBytes ?? 0,
            totalSizeBytes:
              video.totalSizeBytes ??
              (video.videoSizeBytes ?? existingVideo.videoSizeBytes ?? 0) +
                (video.thumbnailSizeBytes ?? existingVideo.thumbnailSizeBytes ?? 0),
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
          videoSizeBytes: video.videoSizeBytes ?? 0,
          thumbnailSizeBytes: video.thumbnailSizeBytes ?? 0,
          totalSizeBytes:
            video.totalSizeBytes ??
            (video.videoSizeBytes ?? 0) + (video.thumbnailSizeBytes ?? 0),
        };
      });


      const mediaUsageBytes = calculateMediaUsageBytes(tracksForFirestore, videosForFirestore);

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
        mediaUsageBytes,
      };

      if (heroUrl) {
        updates.heroMedia = { url: heroUrl, storagePath };
      }

      // If we're on the tech-rider step, save the incomplete tech rider data
      if (creationStep === 'tech-rider' && window.__techRiderSave) {
        try {
          await window.__techRiderSave(null, false); // Save without showing success notification
        } catch (error) {
          // Continue with profile save even if tech rider save fails
        }
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

  const handleSaveAndExitFromAdditionalInfo = async () => {
    // Check for ongoing uploads - if media is still uploading, show modal
    if (heroUploadStatus === 'uploading') {
      toast.error('Please wait for hero image upload to complete');
      return;
    }

    if (tracksUploadStatus === 'uploading') {
      setShowTracksUploadModal(true);
      return;
    }

    if (videoUploadStatus === 'uploading') {
      setShowVideoUploadModal(true);
      return;
    }

    // If we're on the tech-rider step, save the incomplete tech rider data
    if (creationStep === 'tech-rider' && window.__techRiderSave) {
      setSavingDraft(true);
      try {
        await window.__techRiderSave(null, false); // Save without showing success notification
      } catch (error) {
        toast.error('Failed to save tech rider. Your progress may not be saved.');
      } finally {
        setSavingDraft(false);
      }
      // After saving tech rider, continue with normal exit flow
      resetCreationState();
      navigate('/find-a-gig');
      return;
    }

    // All uploads are complete - mark profile as complete
    // Tracks/videos/hero are already saved by the async upload processes
    setSavingDraft(true);

    try {
      // Only update the profile to mark it as complete
      // All media and data has already been saved by the async upload processes
      await updateArtistProfileDocument(creationProfileId, {
        status: 'complete',
        isComplete: true,
      });
      
      toast.success('Profile completed!');
      
      // Store profileId for modal before clearing creationProfileId
      setCompletedProfileId(creationProfileId);
      
      // Mark that we just completed the profile to prevent redirect loop
      justCompletedProfileRef.current = true;
      
      // Clear any profile switching state
      setIsSwitchingProfile(false);
      if (switchingProfileTimeoutRef.current) {
        clearTimeout(switchingProfileTimeoutRef.current);
        switchingProfileTimeoutRef.current = null;
      }
      
      // Store the new profile ID in localStorage
      if (creationProfileId) {
        setStoredActiveProfileId(creationProfileId);
        // Update the previous profile ID ref to prevent switching detection
        previousActiveProfileIdRef.current = creationProfileId;
        
        // Check for redirect URL in sessionStorage
        const redirectUrl = sessionStorage.getItem('artistProfileRedirectUrl');
        if (redirectUrl) {
          // Clear the redirect URL from sessionStorage
          sessionStorage.removeItem('artistProfileRedirectUrl');
          // Clear creating profile state before redirecting
          setIsCreatingProfile(false);
          // Navigate to the redirect URL
          navigate(redirectUrl, { replace: true });
        } else {
          // Default navigation to profile page
          navigate(`/artist-profile/${creationProfileId}`, { replace: true });
          // Directly transition to dashboard - don't wait for useEffect
          setIsCreatingProfile(false);
          setCurrentState(ArtistProfileState.DASHBOARD);
          setDashboardView(DashboardView.PROFILE);
          setSearchParams({});
        }
      }
      
      // Show profile completion modal after navigation and state updates complete
      setTimeout(() => {
        setShowProfileCompletionModal(true);
      }, 300);
      
      // Clear creationProfileId and reset the flag after a short delay
      // Don't clear completedProfileId - let the modal handle that when it closes
      setTimeout(() => {
        setCreationProfileId(null);
        // Reset the flag after profile data has had time to refresh
        setTimeout(() => {
          justCompletedProfileRef.current = false;
        }, 1000);
      }, 100);
    } catch (error) {
      console.error('Failed to complete profile:', error);
      toast.error('Failed to complete your profile. Please try again.');
    } finally {
      setSavingDraft(false);
    }
  };

  // Render dashboard sub-views
  const renderDashboardView = ({ canEdit }) => {
    switch (dashboardView) {
      case DashboardView.PROFILE:
        return (
          <ProfileView 
            profileData={
              viewerHasVenueProfiles && !canEdit
                ? {
                    ...activeProfileData,
                    onInviteArtist: handleInviteArtist,
                    onToggleSaveArtist: handleToggleSaveArtist,
                    artistSaved,
                    savingArtist,
                  }
                : activeProfileData
            }
            onBeginCreation={handleBeginCreation}
            isExample={false}
            isDarkMode={isDarkMode}
            setIsDarkMode={handleDarkModeChange}
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
            creationProfileId={creationProfileId}
            aboutComplete={aboutComplete}
            onAboutCompleteChange={setAboutComplete}
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
            videosUploadStatus={videoUploadStatus}
            videosUploadProgress={videoUploadProgress}
            scrollContainerRef={stateBoxRef}
            onSaveAndExit={handleSaveAndExitFromAdditionalInfo}
            profileId={activeProfileData?.profileId || activeProfileData?.id}
            onHeroImageEdit={canEdit ? handleHeroImageEdit : null}
            onNameEdit={canEdit ? handleNameEdit : null}
            onBioEdit={canEdit ? handleBioEdit : null}
            onWebsiteUrlEdit={canEdit ? handleWebsiteUrlEdit : null}
            onInstagramUrlEdit={canEdit ? handleInstagramUrlEdit : null}
            currentHeroImage={activeProfileData?.heroMedia?.url}
            currentHeroBrightness={activeProfileData?.heroBrightness || BRIGHTNESS_DEFAULT}
            currentHeroPosition={activeProfileData?.heroPositionY || HERO_POSITION_DEFAULT}
            currentArtistName={typeof activeProfileData?.name === 'string' ? activeProfileData.name : String(activeProfileData?.name || "")}
            isEditingHero={isRepositioningHero}
            onHeroRepositionToggleEdit={handleHeroRepositionToggle}
            onEditingNameChange={handleEditingNameChange}
            onEditingHeroImageChange={handleEditingHeroImageChange}
            onEditingHeroBrightnessChange={handleEditingHeroBrightnessChange}
            onEditingHeroPositionChange={handleEditingHeroPositionChange}
            editingHeroPosition={editingHeroPosition}
            editingHeroBrightness={editingHeroBrightness}
            onTracksSave={canEdit ? handleTracksSave : null}
            onVideosSave={canEdit ? handleVideosSave : null}
            canEdit={canEdit}
          />
        );
      case DashboardView.GIGS:
        return <ArtistProfileGigs />;
      case DashboardView.MESSAGES:
        return <ArtistProfileMessages />;
      case DashboardView.FINANCES:
        return <ArtistProfileFinances />;
      default:
        return <div className="artist-profile-loading">
                <LoadingSpinner />
                <h4>Loading artist profile...</h4>
              </div>;
    }
  };

  // Render based on current state
  const renderStateContent = ({ canEdit }) => {
    switch (currentState) {
      case ArtistProfileState.EXAMPLE_PROFILE:
        // Show example profile with hardcoded data
        return (
          <ProfileView 
            profileData={null}
            onBeginCreation={handleBeginCreation}
            isExample={true}
            isDarkMode={isDarkMode}
            setIsDarkMode={handleDarkModeChange}
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
            creationProfileId={creationProfileId}
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
            videosUploadStatus={videoUploadStatus}
            videosUploadProgress={videoUploadProgress}
            onSaveAndExit={handleSaveAndExitFromAdditionalInfo}
          />
        );
      
      case ArtistProfileState.CREATING:
        // When creating a new profile (not resuming a draft), pass null to avoid showing old profile data
        const creatingProfileData = (() => {
          if (creationProfileId) {
            const isResumingDraft = artistProfiles.some(
              (p) => (p.id === creationProfileId || p.profileId === creationProfileId) && !p.isComplete
            );
            // Only pass profileData if we're resuming a draft, otherwise pass null for new profile
            return isResumingDraft ? activeProfileData : null;
          }
          return null;
        })();
        return (
          <ProfileView 
            profileData={creatingProfileData}
            onBeginCreation={handleBeginCreation}
            isExample={false}
            isDarkMode={isDarkMode}
            setIsDarkMode={handleDarkModeChange}
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
            creationProfileId={creationProfileId}
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
            videosUploadStatus={videoUploadStatus}
            videosUploadProgress={videoUploadProgress}
            scrollContainerRef={stateBoxRef}
            onSaveAndExit={handleSaveAndExitFromAdditionalInfo}
          />
        );
      
      case ArtistProfileState.DASHBOARD:
        // Render dashboard with sub-views
        return renderDashboardView({ canEdit });
      
      default:
      return <div className="artist-profile-loading">
          <LoadingSpinner />
          <h4>Loading artist profile...</h4>
        </div>;
    }
  };

  // Check if user needs to see the update modal (newProfileUpdate field is true)
  useEffect(() => {
    if (viewerMode || authLoading || !user) return;
    if (currentState !== ArtistProfileState.CREATING) return;
    if (!activeProfileData?.id && !activeProfileData?.profileId) return;
    
    // Check if newProfileUpdate is true
    if (activeProfileData?.newProfileUpdate === true) {
      setShowUpdateModal(true);
    }
  }, [activeProfileData?.newProfileUpdate, currentState, viewerMode, authLoading, user, activeProfileData?.id, activeProfileData?.profileId]);

  // Handle closing the update modal and updating the profile
  const handleCloseUpdateModal = async () => {
    const profileId = activeProfileData?.id || activeProfileData?.profileId;
    if (!profileId) {
      setShowUpdateModal(false);
      return;
    }

    setUpdatingProfile(true);
    try {
      await updateArtistProfileDocument(profileId, { newProfileUpdate: false });
      setShowUpdateModal(false);
    } catch (error) {
      console.error('Failed to update profile:', error);
      toast.error('Failed to update profile. Please try again.');
    } finally {
      setUpdatingProfile(false);
    }
  };

  // Show loading state while checking auth, switching profiles, or loading dashboard data
  // Don't show loading screen when creating a new profile or just completed one (only when switching between existing profiles)
  if (authLoading || (isSwitchingProfile && !isCreatingProfile && currentState === ArtistProfileState.DASHBOARD && !justCompletedProfileRef.current)) {
    return (
      <div className="artist-profile-container" style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <LoadingScreen text={`Changing active profile`} />
      </div>
    );
  }

  const showCreationPlaceholder = isCreationState && !creationHasHeroImage;
  const persistedHeroBrightness = activeProfileData?.heroBrightness ?? BRIGHTNESS_DEFAULT;
  const effectiveHeroBrightness = editingHeroBrightness !== null 
    ? editingHeroBrightness 
    : (isCreationState ? creationHeroBrightness : persistedHeroBrightness);
  const persistedHeroPosition = clampHeroPosition(activeProfileData?.heroPositionY ?? HERO_POSITION_DEFAULT);
  const effectiveHeroPosition = editingHeroPosition !== null
    ? clampHeroPosition(editingHeroPosition)
    : (isCreationState ? creationHeroPosition : persistedHeroPosition);
  
  // Debug: Log effectiveHeroPosition when it changes (only during drag to avoid spam)
  if (isHeroDragging && editingHeroPosition !== null) {
  }
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
            backgroundImage: `url(${backgroundImage})`,
            backgroundPosition: `center ${effectiveHeroPosition}%`,
            cursor: isRepositioningHero ? (isHeroDragging ? 'grabbing' : 'grab') : undefined,
          }}
          data-position={effectiveHeroPosition}
          data-editing-position={editingHeroPosition}
        />
        {showCreationPlaceholder && (
          <div className="artist-profile-background placeholder-layer fade-in">
            <div className="artist-profile-background-placeholder">
              <ImageIcon />
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

        {/* Header - shown when not in creation state and not showing example profile to logged out user */}
        {!isCreationState && !(currentState === ArtistProfileState.EXAMPLE_PROFILE && !user) && (
          <>
            {viewerMode ? (
              user?.venueProfiles && user.venueProfiles.length > 0 ? (
                // Venue owner viewing an artist profile → venue header
                <VenueHeader
                  user={user}
                  setAuthModal={setAuthModal}
                  setAuthType={setAuthType}
                />
              ) : (
                // Guest or non-venue viewer → shared default header
                <SharedHeader
                  user={user}
                  setAuthModal={setAuthModal}
                  setAuthType={setAuthType}
                  // Provide safe no-op profile modal props for this context
                  noProfileModal={false}
                  setNoProfileModal={() => {}}
                  noProfileModalClosable={false}
                  setNoProfileModalClosable={() => {}}
                />
              )
            ) : (
              // Artist owner in their own dashboard/profile
              <MusicianHeader
                user={user}
                setAuthModal={setAuthModal}
                setAuthType={setAuthType}
              />
            )}
          </>
        )}

        {/* Constant elements - always visible */}
        <div className={`artist-profile-constants ${(isCreationState && !creationHasHeroImage) ? 'creation-transition' : ''}`}>
          {/* Exit button - top right */}
          {!viewerMode && isCreationState && (
            <button 
              className="btn exit-button"
              onClick={handleExitClick}
              disabled={savingDraft}
            >
              {canSaveProgress ? (savingDraft ? 'Saving...' : 'Save & Exit') : 'Exit'}
            </button>
          )}
          {/* Artist name - bottom left (desktop only) */}
          {isMdUp && (
            <div className="artist-name">
              <h1>
                {displayName}
              </h1>
            </div>
          )}
        </div>

        {/* State box - right side, 30vw, changes based on state */}
        <div
          ref={stateBoxRef}
          className={[
            'artist-profile-state-box',
            isDarkMode ? 'dark-mode' : '',
            isTallDashboardView ? 'gigs-view' : '',
          ]
            .filter(Boolean)
            .join(' ')}
        >
          {renderStateContent({ canEdit })}
        </div>

        {/* Artist name - below dashboard components (mobile only) */}
        {!isMdUp && (
          <div className="artist-name artist-name-mobile">
            <h1>
              {displayName}
            </h1>
          </div>
        )}
      </div>

      {/* Show loading modal when user tries to save while media is uploading */}
      {showTracksUploadModal && tracksUploadStatus === 'uploading' && (
        <LoadingModal 
          title={`${Math.round(tracksUploadProgress)}%`}
          text="Please wait, we are uploading your media. Don't close or refresh this window." 
        />
      )}
      {showVideoUploadModal && videoUploadStatus === 'uploading' && (
        <LoadingModal 
          title={`${Math.round(videoUploadProgress)}%`}
          text="Please wait, we are uploading your media. Don't close or refresh this window." 
        />
      )}

      {/* Venue-side invite artist modal (viewer mode) */}
      {viewerMode && inviteArtistModal && !invitingArtist && !creatingInvite && (
        <Portal>
          <div className={`modal ${showInviteDateStep ? 'gig-invites' : 'invite-musician'}`} onClick={() => {
            if (!showInviteDateStep) {
              setInviteArtistModal(false);
              setSelectedGig(null);
              setSelectedExpiryDate(null);
            }
          }}>
            <div className="modal-content" onClick={(e) => e.stopPropagation()}>
              {!showInviteDateStep ? (
                <>
                  <div className="modal-header">
                    <div className="modal-header-text">
                      <InviteIconSolid />
                      <h2>Invite {activeProfileData?.name} to one of your available gigs.</h2>
                    </div>
                    <div className="or-separator">
                      <span />
                      <h6>or</h6>
                      <span />
                    </div>
                    <button
                      className="btn secondary"
                      onClick={() => {
                        setInviteArtistModal(false);
                        navigate('/venues/dashboard/gigs', {
                          state: {
                            musicianData: {
                              id: activeProfileData?.id,
                              name: activeProfileData?.name,
                              genres: activeProfileData?.genres || [],
                              type: activeProfileData?.artistType || 'Musician/Band',
                              bandProfile: false,
                              userId: activeProfileData?.userId,
                              // Contact info may not be available from artist profile
                              email: null,
                              phone: null,
                              instagram: null,
                              facebook: null,
                              other: null,
                            },
                            buildingForMusician: true,
                            showGigPostModal: true,
                          },
                        });
                      }}
                    >
                      Build New Gig For Artist
                    </button>
                  </div>
                  <div className="gig-selection">
                    {usersGigs.length > 0 &&
                      usersGigs.map((gig, index) => {
                        const role = gig?.myMembership?.role || 'member';
                        const perms = gig?.myMembership?.permissions || {};
                        const canInvite = role === 'owner' || perms['gigs.invite'] === true;

                        if (canInvite) {
                          return (
                            <div
                              className={`card ${selectedGig === gig ? 'selected' : ''}`}
                              key={index}
                              onClick={() => setSelectedGig(gig)}
                            >
                              <div className="gig-details">
                                <h4 className="text">{gig.gigName}</h4>
                                <h5>{gig.venue?.venueName}</h5>
                              </div>
                              <p className="sub-text">
                                {formatDate(gig.date, 'short')} - {gig.startTime}
                              </p>
                            </div>
                          );
                        }

                        return (
                          <div className="card disabled" key={index}>
                            <div className="gig-details">
                              <h4 className="text">{gig.gigName}</h4>
                              <h5 className="details-text">
                                You don't have permission to invite artists to gigs at this venue.
                              </h5>
                            </div>
                            <p className="sub-text">
                              {formatDate(gig.date, 'short')} - {gig.startTime}
                            </p>
                          </div>
                        );
                      })}
                  </div>
                  <div className="two-buttons">
                    <button className="btn tertiary" onClick={() => {
                      setInviteArtistModal(false);
                      setSelectedGig(null);
                      setSelectedExpiryDate(null);
                    }}>
                      Cancel
                    </button>
                    {selectedGig && (
                      <button
                        className="btn primary"
                        disabled={!selectedGig}
                        onClick={() => {
                          if (selectedGig.private) {
                            handleConfigureInvite();
                          } else {
                            handleSendArtistInvite(selectedGig);
                          }
                        }}
                      >
                        {selectedGig.private ? 'Configure Invite' : 'Invite'}
                      </button>
                    )}
                  </div>
                </>
              ) : (
                <>
                  <div className="modal-header">
                    <div className="modal-header-text" style={{ width: '100%' }}>
                      <InviteIconSolid />
                      <h2>Configure Invite</h2>
                    </div>
                  </div>
                  <div className="modal-body">
                    <div className="stage">
                      <div className="body date">
                        <p style={{ marginBottom: '1rem' }}>
                          Select a date if you want the gig to expire at a certain time.
                        </p>
                        <div className="calendar">
                          {selectedGig?.date && (() => {
                            const gigDate = selectedGig.date.toDate ? selectedGig.date.toDate() : new Date(selectedGig.date);
                            return (
                              <DatePicker
                                selected={selectedExpiryDate}
                                onChange={(date) => setSelectedExpiryDate(date)}
                                inline
                                minDate={new Date()}
                                maxDate={gigDate}
                                dayClassName={(date) => {
                                  const today = new Date().setHours(0, 0, 0, 0);
                                  const dateTime = date.getTime();
                                  if (dateTime < today) return 'past-date';
                                  if (gigDate && dateTime > gigDate.getTime()) return 'past-date';
                                  return undefined;
                                }}
                              />
                            );
                          })()}
                        </div>
                      </div>
                    </div>
                    <div className="two-buttons">
                      <button
                        className="btn secondary"
                        onClick={() => {
                          setShowInviteDateStep(false);
                          setSelectedExpiryDate(null);
                        }}
                        disabled={creatingInvite}
                      >
                        Cancel
                      </button>
                      <button
                        className="btn primary"
                        onClick={handleGenerateInvite}
                        disabled={creatingInvite}
                      >
                        {creatingInvite ? 'Creating...' : 'Generate Invite'}
                      </button>
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>
        </Portal>
      )}

      {viewerMode && inviteArtistModal && (invitingArtist || creatingInvite) && (
        <Portal>
          <LoadingModal title={creatingInvite ? "Creating Invite" : "Sending Invite"} />
        </Portal>
      )}

      {/* Profile Update Modal - Shows when newProfileUpdate is true */}
      {showUpdateModal && (
        <Portal>
          <div className="modal profile-update" onClick={handleCloseUpdateModal}>
            <div className="modal-content" onClick={(e) => e.stopPropagation()}>
              <div className="modal-header">
                <UpdateIcon />
                <h2>New Artist Profiles!</h2>
                <p>We've upgraded how Artist Profiles look. Below is an example of what your new profile will look like. You may need to finish creating your profile to see the new look.</p>
              </div>
              <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '1rem' }}>
                <div className="example-profile-container" style={{ width: '70%', height: 'auto', objectFit: 'contain', borderRadius: '1rem', overflow: 'hidden' }}>
                  <img src={exampleProfileImage} alt="Example Profile" style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '1rem' }} />
                </div>
                <div className="two-buttons">
                  <button
                    className="btn primary"
                    disabled={updatingProfile}
                    onClick={handleCloseUpdateModal}
                  >
                    {updatingProfile ? 'Updating...' : 'Update Profile'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </Portal>
      )}

      {/* Profile Completion Modal - Shows once when profile is completed */}
      {/* TODO: Remove test mode - always showing for testing */}
      {(completedProfileId || true) && (
        <ProfileCompletionModal
          onClose={() => {
            setShowProfileCompletionModal(false);
            setCompletedProfileId(null);
          }}
          profileId={completedProfileId || 'test-profile-id'}
          shouldShow={showProfileCompletionModal || true}
        />
      )}
    </div>
  );
};

export const ArtistProfile = (props) => {
  const ctx = useContext(ArtistDashboardContext);
  // Note: activeProfileId is now read from URL params inside ArtistDashboardProvider
  if (!ctx) {
    return (
      <ArtistDashboardProvider user={props.user}>
        <ArtistProfileComponent {...props} />
      </ArtistDashboardProvider>
    );
  }
  return <ArtistProfileComponent {...props} />;
};

