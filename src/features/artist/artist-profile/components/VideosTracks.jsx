import { useState, useEffect, useRef } from 'react';
import { FilmIcon, PlayIcon, VinylIcon, TrackIcon, SpotifyIcon, SoundcloudIcon } from '../../../shared/ui/extras/Icons';

/**
 * VideosTracks Component
 * Stacked layout showing videos and tracks
 * Clicking brings the selected section to the front with WeTransfer-style animation
 */

// Helper function to normalize URLs and prepend https:// if needed
const normalizeUrl = (url) => {
  if (!url) return '';
  const trimmed = url.trim();
  if (!trimmed) return '';
  // If it already starts with http:// or https://, return as is
  if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
    return trimmed;
  }
  // Otherwise prepend https://
  return `https://${trimmed}`;
};

const handleLinkClick = (e, url) => {
  e.preventDefault();
  const normalizedUrl = normalizeUrl(url);
  if (normalizedUrl) {
    window.open(normalizedUrl, '_blank', 'noopener,noreferrer');
  }
};

export const VideosTracks = ({ videos = [], tracks = [], defaultActiveSection, spotifyUrl = "", soundcloudUrl = "" }) => {
  // Determine initial active section: use defaultActiveSection if provided,
  // otherwise default to 'tracks' if there are tracks but no videos,
  // otherwise default to 'videos'
  const getInitialActiveSection = () => {
    if (defaultActiveSection) return defaultActiveSection;
    if (tracks.length > 0 && videos.length === 0) return 'tracks';
    return 'videos';
  };
  
  const [activeSection, setActiveSection] = useState(getInitialActiveSection);
  const containerRef = useRef(null);
  const videosRef = useRef(null);
  const tracksRef = useRef(null);

  // Update container height based on active card
  useEffect(() => {
    if (!containerRef.current) return;

    const updateHeight = () => {
      const activeCard = activeSection === 'videos' ? videosRef.current : tracksRef.current;
      if (activeCard) {
        // Get the height of the active card
        const cardHeight = activeCard.offsetHeight;
        // Account for the top offset (2rem = 32px) from CSS for active card position
        const topOffset = 32;
        // Account for margin-top (2rem = 32px) on .videos-tracks-inner
        const marginTop = 24;
        // Account for inactive header space (60px) that extends above
        const inactiveHeaderSpace = 0;
        
        // Inner container height: top offset + card height
        const innerHeight = topOffset + cardHeight;
        // Parent container height: margin-top + inactive header space + top offset + card height
        const totalHeight = marginTop + inactiveHeaderSpace + topOffset + cardHeight;
        
        // Update inner container height
        containerRef.current.style.height = `${innerHeight}px`;
        
        // Update the parent container height
        const parentContainer = containerRef.current.closest('.videos-tracks-card-container');
        if (parentContainer) {
          parentContainer.style.height = `${totalHeight}px`;
        }
      }
    };

    // Use requestAnimationFrame to ensure DOM has updated
    requestAnimationFrame(() => {
      requestAnimationFrame(updateHeight);
    });
  }, [activeSection, videos, tracks]);

  // Switch to tracks if videos section becomes empty and we're on videos
  useEffect(() => {
    if (activeSection === 'videos' && videos.length === 0 && tracks.length > 0) {
      setActiveSection('tracks');
    }
  }, [activeSection, videos.length, tracks.length]);

  // Hide videos section if there are no videos
  const hasVideos = videos.length > 0;

  console.log('tracks', tracks);
  
  return (
    <div ref={containerRef} className="videos-tracks-inner">
      {/* Videos Section */}
      {hasVideos && (
        <div 
          ref={videosRef}
          className={`videos-section ${activeSection === 'videos' ? 'active' : 'inactive'}`}
        >
          {activeSection === 'videos' ? (
            <div 
              className="section-header"           >
              <FilmIcon />
              <h3>Videos</h3>
            </div>
          ) : (
            <div 
              className="section-header" 
              onClick={() => setActiveSection('videos')}
              style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
            >
              <h4>Show Videos</h4>
            </div>
          )}
        <div className="section-content">
          <div className="videos-grid">
            {videos.map((video, index) => (
              <div key={index} className="video-thumbnail">
                {video.thumbnail ? (
                  <img src={video.thumbnail} alt={video.title || 'Video'} />
                ) : (
                  <div className="video-placeholder">Video {index + 1}</div>
                )}
                <div className="play-icon"><PlayIcon /></div>
              </div>
            ))}
          </div>
        </div>
        </div>
      )}

      {/* Tracks Section */}
      <div 
        ref={tracksRef}
        className={`tracks-section ${activeSection === 'tracks' ? 'active' : 'inactive'}`}
      >
        {activeSection === 'tracks' ? (
          <div className="section-header">
            <div className="title">
              <VinylIcon />
              <h3>Tracks</h3>
            </div>
            <div className="external-links">
              {spotifyUrl && (
                <a 
                  href={spotifyUrl} 
                  onClick={(e) => handleLinkClick(e, spotifyUrl)}
                  className="external-link spotify"
                  aria-label="Open Spotify profile"
                >
                  <SpotifyIcon />
                  Spotify
                </a>
              )}
              {soundcloudUrl && (
                <a 
                  href={soundcloudUrl} 
                  onClick={(e) => handleLinkClick(e, soundcloudUrl)}
                  className="external-link soundcloud"
                  aria-label="Open SoundCloud profile"
                >
                  <SoundcloudIcon />
                  SoundCloud
                </a>
              )}
            </div>
          </div>
        ) : (
          <div 
            className="section-header" 
            onClick={() => setActiveSection('tracks')}
            style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
          >
            <h4>Show Tracks</h4>
          </div>
        )}
        <div className="section-content">
          <div className="tracks-list">
            {tracks.map((track, index) => (
              <div key={index} className="track-item">
                <div className="track-thumbnail">
                  {track.thumbnail ? (
                    <img src={track.thumbnail} alt={track.title || 'Track'} />
                  ) : (
                    <div className="track-thumbnail-placeholder">
                      <TrackIcon />
                    </div>
                  )}
                </div>
                <div className="track-info">
                  <h4>{track.title}</h4>
                  {track.artist && <p>{track.artist}</p>}
                </div>
                <button className="btn icon play-track">
                  <PlayIcon />
                </button>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

