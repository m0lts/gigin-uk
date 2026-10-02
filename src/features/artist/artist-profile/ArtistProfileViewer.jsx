import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArtistDashboardProvider } from '../../../context/ArtistDashboardContext';
import { ArtistProfile } from './ArtistProfile';
import { getArtistProfileById } from '../../../services/client-side/artists';
import { LoadingScreen } from '../../shared/ui/loading/LoadingScreen';
import { FEATURES } from '../../../config/features';
import { getPublicProfile } from '@services/client-side/keepProfile';
import { ProfileUnavailable, PublicArtistProfile } from '../../keep-profile/PublicProfile';

/**
 * Read-only viewer for an artist profile, used by venues and public viewers.
 * - Loads a single artistProfile by ID
 * - Wraps it in ArtistDashboardProvider so existing ArtistProfile UI can render
 * - Forces "viewer mode" so only the profile view is shown and editing is disabled
 * - Redirects venue visitors away from incomplete profiles
 */
export const ArtistProfileViewer = ({ user, setAuthModal, setAuthType }) => {
  const { artistId } = useParams();
  const navigate = useNavigate();
  const [profile, setProfile] = useState(null);
  const [publicProfile, setPublicProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    if (!artistId) return undefined;
    setLoading(true);
    setError(null);
    setProfile(null);
    setPublicProfile(null);
    const load = async () => {
      const doc = await getArtistProfileById(artistId);
      if (cancelled) return;
      if (doc) {
        if (FEATURES.publicProfile && doc.source === 'guest_keep') {
          try {
            const result = await getPublicProfile(doc.slug || artistId);
            if (cancelled) return;
            if (result?.profile) {
              setPublicProfile(result.profile);
              setLoading(false);
              return;
            }
          } catch {
            if (cancelled) return;
          }
        }
        setProfile(doc);
        setLoading(false);
        return;
      }
      if (FEATURES.publicProfile) {
        try {
          const result = await getPublicProfile(artistId);
          if (cancelled) return;
          if (result?.profile) {
            setPublicProfile(result.profile);
            setLoading(false);
            return;
          }
        } catch (err) {
          if (cancelled) return;
          if (err?.status !== 404) {
            setError('Unable to load this artist profile right now.');
            setLoading(false);
            return;
          }
        }
      }
      if (!cancelled) {
        setError('Artist profile not found.');
        setLoading(false);
      }
    };
    load().catch((err) => {
      if (cancelled) return;
      console.error('Failed to load artist profile for viewer:', err);
      setError('Unable to load this artist profile right now.');
      setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [artistId]);

  // Guard: Redirect venue visitors away from incomplete profiles
  useEffect(() => {
    if (!profile || loading) return;
    
    // Check if profile is incomplete
    const isIncomplete = profile.isComplete === false || profile.status === 'draft';
    
    if (isIncomplete) {
      // Check if user is a venue (not the owner)
      const isVenue = user?.venueProfiles && user.venueProfiles.length > 0;
      const isOwner = user?.uid && profile.userId && user.uid === profile.userId;
      
      // If venue visitor (not owner), redirect back
      if (isVenue && !isOwner) {
        // Try to go back to previous page, with fallback to find-a-gig page
        // Use replace: true to prevent them from going back to the incomplete profile
        const hasHistory = window.history.length > 1;
        if (hasHistory) {
          navigate(-1); // Go back to previous page
        } else {
          // No history (e.g., direct link), redirect to find-a-gig page
          navigate('/venues/dashboard/artists/find', { replace: true });
        }
        return;
      }
    }
  }, [profile, user, loading, navigate]);

  if (loading) {
    return <LoadingScreen />;
  }

  if (publicProfile) {
    return <PublicArtistProfile profile={publicProfile} user={user} />;
  }

  if (!FEATURES.publicProfile && profile?.source === 'guest_keep') {
    return <ProfileUnavailable />;
  }

  if (error || !profile) {
    return (
      <div className='artist-profile-viewer-error'>
        <h2>{error || 'Artist profile not found.'}</h2>
      </div>
    );
  }

  // For viewer mode, pass the real user without modifying artistProfiles
  // The profile will be handled separately in viewer mode
  return (
    <ArtistDashboardProvider user={user}>
      <ArtistProfile 
        user={user} 
        setAuthModal={setAuthModal} 
        setAuthType={setAuthType} 
        viewerMode 
        viewerProfile={profile}
      />
    </ArtistDashboardProvider>
  );
};


