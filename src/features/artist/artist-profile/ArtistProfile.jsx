import { useState, useEffect, useMemo, useRef } from 'react';
import { useAuth } from '@hooks/useAuth';
import { useArtistDashboard } from '@context/ArtistDashboardContext';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { ProfileView } from './components/ProfileView';
import '@styles/artists/artist-profile-new.styles.css';
// Hardcoded background image for example profile
import artistProfileBackground from '@assets/images/arctic-monkeys.jpeg';

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
  const { musicianProfile, loading: dashboardLoading, refreshMusicianProfile } = useArtistDashboard();
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
  
  // Dashboard sub-state (which view to show: Profile, Gigs, Messages, Finances)
  const [dashboardView, setDashboardView] = useState(DashboardView.PROFILE);
  
  // Track previous profile state to detect completion
  const previousProfileRef = useRef(null);

  // Check if user has a complete profile
  const hasCompleteProfile = useMemo(() => {
    if (!user?.musicianProfile) return false;
    const profile = user.musicianProfile;
    const hasName = typeof profile?.name === 'string' && profile.name.trim().length >= 2;
    const hasOnboarded = !!profile?.onboarded;
    return hasName && hasOnboarded;
  }, [user?.musicianProfile]);

  // Get artist name for display (works for both example and real profiles)
  // Must be called before any conditional returns (Rules of Hooks)
  const displayName = useMemo(() => {
    if (currentState === ArtistProfileState.EXAMPLE_PROFILE) {
      return selectedExampleProfile?.name || 'Example Artist';
    }
    return user?.musicianProfile?.name || 'Artist Name';
  }, [currentState, user?.musicianProfile?.name, selectedExampleProfile]);

  // Handle authentication - redirect to auth if not logged in
  useEffect(() => {
    if (!authLoading && !user && setAuthModal) {
      setAuthModal(true);
      setAuthType?.('login');
    }
  }, [authLoading, user, setAuthModal, setAuthType]);

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
    if (dashboardLoading) return;

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
  }, [hasCompleteProfile, user?.musicianProfile, dashboardLoading, isCreatingProfile]);

  // Set background image - use user's profile picture if available
  // For example profile, use selected example profile's background image or default
  // This should persist across all state changes
  useEffect(() => {
    if (currentState === ArtistProfileState.EXAMPLE_PROFILE) {
      // Use selected example profile's background image if available, otherwise use default
      setBackgroundImage(selectedExampleProfile?.backgroundImage || artistProfileBackground);
    } else if (user?.musicianProfile?.picture) {
      setBackgroundImage(user.musicianProfile.picture);
    } else {
      // Keep existing background image even if profile doesn't have one yet
      // This allows the image to persist during creation flow
      if (!backgroundImage) {
        setBackgroundImage(artistProfileBackground); // Default to example image
      }
    }
  }, [user?.musicianProfile?.picture, currentState, selectedExampleProfile]);

  // Handle transition to creation flow
  const handleBeginCreation = () => {
    setIsCreatingProfile(true);
    setCurrentState(ArtistProfileState.CREATING);
    // Update URL without page refresh
    setSearchParams({ state: ArtistProfileState.CREATING });
  };

  // Handle profile creation completion
  const handleProfileCreated = () => {
    // Refresh profile data
    refreshMusicianProfile();
    // State will automatically transition to DASHBOARD via useEffect
  };

  // Handle cancel creation (return to example view)
  const handleCancelCreation = () => {
    setIsCreatingProfile(false);
    setCurrentState(ArtistProfileState.EXAMPLE_PROFILE);
    // Clear URL state
    setSearchParams({});
  };

  // Render dashboard sub-views
  const renderDashboardView = () => {
    switch (dashboardView) {
      case DashboardView.PROFILE:
        return (
          <ProfileView 
            profileData={user?.musicianProfile}
            onBeginCreation={handleBeginCreation}
            isExample={false}
            isDarkMode={isDarkMode}
            setIsDarkMode={setIsDarkMode}
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
          />
        );
      
      case ArtistProfileState.CREATING:
        // TODO: Render profile creation flow
        // This will integrate with ProfileCreator component
        return (
          <div>
            <div>Profile Creation Flow (to be implemented)</div>
            <button onClick={handleCancelCreation}>Cancel</button>
            <button onClick={handleProfileCreated}>Complete (test)</button>
          </div>
        );
      
      case ArtistProfileState.DASHBOARD:
        // Render dashboard with sub-views
        return renderDashboardView();
      
      default:
        return <div>Loading...</div>;
    }
  };

  // Show loading state while checking auth or dashboard data
  if (authLoading || dashboardLoading) {
    return (
      <div className="artist-profile-container" style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div>Loading...</div>
      </div>
    );
  }

  return (
    <div 
      className="artist-profile-container"
      style={{
        position: 'relative',
        minHeight: '100vh',
        width: '100%',
      }}
    >
      {/* Constant background image - stays regardless of state */}
      <div
        className="artist-profile-background"
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          width: '100%',
          height: '100%',
          backgroundImage: `url(${backgroundImage || artistProfileBackground})`,
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          backgroundRepeat: 'no-repeat',
          zIndex: 0,
          opacity: 1, // Adjust opacity as needed
        }}
      />

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
        <div className="artist-profile-constants">
          {/* Exit button - top right */}
          <button 
            className="btn exit-button"
            onClick={() => navigate('/find-a-gig')}
          >
            Exit
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

