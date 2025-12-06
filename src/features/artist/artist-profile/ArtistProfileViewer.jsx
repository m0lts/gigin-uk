import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { ArtistDashboardProvider } from '../../../context/ArtistDashboardContext';
import { ArtistProfile } from './ArtistProfile';
import { getArtistProfileById } from '../../../services/client-side/artists';
import { LoadingScreen } from '../../shared/ui/loading/LoadingScreen';

/**
 * Read-only viewer for an artist profile, used by venues and public viewers.
 * - Loads a single artistProfile by ID
 * - Wraps it in ArtistDashboardProvider so existing ArtistProfile UI can render
 * - Forces "viewer mode" so only the profile view is shown and editing is disabled
 */
export const ArtistProfileViewer = ({ user, setAuthModal, setAuthType }) => {
  const { artistId } = useParams();
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      try {
        setLoading(true);
        const doc = await getArtistProfileById(artistId);
        if (cancelled) return;
        if (!doc) {
          setError('Artist profile not found.');
        } else {
          setProfile(doc);
        }
      } catch (err) {
        if (!cancelled) {
          console.error('Failed to load artist profile for viewer:', err);
          setError('Unable to load this artist profile right now.');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    if (artistId) run();
    return () => {
      cancelled = true;
    };
  }, [artistId]);

  if (loading) {
    return <LoadingScreen />;
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


