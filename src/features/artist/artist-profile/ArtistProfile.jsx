import { useState, useEffect, useMemo, useRef } from 'react';
import { useAuth } from '@hooks/useAuth';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { ProfileView } from './components/ProfileView';
import '@styles/artists/artist-profile-new.styles.css';
// Hardcoded background image for example profile
import artistProfileBackground from '@assets/images/arctic-monkeys.jpeg';
import { generateArtistProfileId, createArtistProfileDocument, updateArtistProfileDocument } from '@services/client-side/artists';
import { uploadFileToStorage } from '@services/storage';
import { updateUserArrayField } from '@services/api/users';
import { toast } from 'sonner';
import { NoImageIcon } from '@features/shared/ui/extras/Icons';
import { CREATION_STEP_ORDER } from './components/ProfileCreationBox';

const BRIGHTNESS_DEFAULT = 100;
const BRIGHTNESS_RANGE = 40; // slider distance from neutral

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
  const [creationArtistName, setCreationArtistName] = useState("");
  const [savingDraft, setSavingDraft] = useState(false);
  
  // Dashboard sub-state (which view to show: Profile, Gigs, Messages, Finances)
  const [dashboardView, setDashboardView] = useState(DashboardView.PROFILE);
  
  // Track previous profile state to detect completion
  const previousProfileRef = useRef(null);
  const heroBrightnessUpdateTimeoutRef = useRef(null);
  const artistNameUpdateTimeoutRef = useRef(null);

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
      if (heroBrightnessUpdateTimeoutRef.current) {
        clearTimeout(heroBrightnessUpdateTimeoutRef.current);
      }
      if (artistNameUpdateTimeoutRef.current) {
        clearTimeout(artistNameUpdateTimeoutRef.current);
      }
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
    setCreationHasHeroImage(false);
    setCreationHeroBrightness(BRIGHTNESS_DEFAULT);
    setCreationArtistName("");
    setCreationStep(CREATION_STEP_ORDER[0]);
    if (heroBrightnessUpdateTimeoutRef.current) {
      clearTimeout(heroBrightnessUpdateTimeoutRef.current);
    }
    if (artistNameUpdateTimeoutRef.current) {
      clearTimeout(artistNameUpdateTimeoutRef.current);
    }
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
    setCreationArtistName(draftProfile.name || "");

    if (draftProfile.heroMedia?.url) {
      setCreationHeroImage({
        file: null,
        previewUrl: draftProfile.heroMedia.url,
        storagePath: draftProfile.heroMedia.storagePath || null,
      });
      setCreationHasHeroImage(true);
      setBackgroundImage(draftProfile.heroMedia.url);
    } else {
      setCreationHeroImage(null);
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
      if (draftProfile.heroMedia?.url) {
        setCreationHeroImage({
          file: null,
          previewUrl: draftProfile.heroMedia.url,
          storagePath: draftProfile.heroMedia.storagePath || null,
        });
        setCreationHasHeroImage(true);
        setBackgroundImage(draftProfile.heroMedia.url);
      } else {
        setCreationHeroImage(null);
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
      setCreationHeroBrightness(BRIGHTNESS_DEFAULT);
      setCreationHasHeroImage(false);
      if (heroBrightnessUpdateTimeoutRef.current) {
        clearTimeout(heroBrightnessUpdateTimeoutRef.current);
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

  const handleHeroImageUpdate = (payload) => {
    if (!payload) {
      setCreationHeroImage(null);
      setCreationHasHeroImage(false);
      return;
    }

    const { previewUrl, file, storagePath } = payload;
    setCreationHeroImage({
      file: file || null,
      previewUrl,
      storagePath: storagePath || null,
    });
    setCreationHasHeroImage(true);
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

      const updates = {
        name: creationArtistName,
        heroBrightness: creationHeroBrightness,
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
            initialArtistName={creationArtistName}
            onArtistNameChange={handleArtistNameChange}
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
            initialArtistName={creationArtistName}
            onArtistNameChange={handleArtistNameChange}
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
            initialArtistName={creationArtistName}
            onArtistNameChange={handleArtistNameChange}
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

  const isCreationState = currentState === ArtistProfileState.CREATING;
  const showCreationPlaceholder = isCreationState && !creationHasHeroImage;
  const persistedHeroBrightness = activeProfileData?.heroBrightness ?? BRIGHTNESS_DEFAULT;
  const effectiveHeroBrightness = isCreationState ? creationHeroBrightness : persistedHeroBrightness;
  const brightnessOverlayStyle = getBrightnessOverlayStyle(effectiveHeroBrightness);
  const showBrightnessOverlay = !showCreationPlaceholder && brightnessOverlayStyle.opacity > 0;
  const canSaveProgress = isCreationState && creationHasHeroImage;

  return (
    <div 
      className="artist-profile-container"
      style={{
        position: 'relative',
        minHeight: '100vh',
        width: '100%',
      }}
    >
      {/* Background layers */}
      <div className="artist-profile-background-wrapper">
        <div
          className={`artist-profile-background image-layer ${showCreationPlaceholder ? 'fade-out' : ''}`}
          style={{
            backgroundImage: `url(${backgroundImage || artistProfileBackground})`,
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
        <div className={`artist-profile-state-box ${isDarkMode ? 'dark-mode' : ''}`}>
          {renderStateContent()}
        </div>
      </div>
    </div>
  );
};

