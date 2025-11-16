import { useState, useEffect, useRef } from 'react';
import { FilmIcon, PlayIcon, VinylIcon } from '../../../shared/ui/extras/Icons';

/**
 * VideosTracks Component
 * Stacked layout showing videos and tracks
 * Clicking brings the selected section to the front with WeTransfer-style animation
 */

export const VideosTracks = ({ videos = [], tracks = [] }) => {
  const [activeSection, setActiveSection] = useState('videos'); // 'videos' or 'tracks'
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

  return (
    <div ref={containerRef} className="videos-tracks-inner">
      {/* Videos Section */}
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

      {/* Tracks Section */}
      <div 
        ref={tracksRef}
        className={`tracks-section ${activeSection === 'tracks' ? 'active' : 'inactive'}`}
      >
        {activeSection === 'tracks' ? (
          <div 
            className="section-header">
            <VinylIcon />
            <h3>Tracks</h3>
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
                {track.thumbnail && (
                  <div className="track-thumbnail">
                    <img src={track.thumbnail} alt={track.title || 'Track'} />
                  </div>
                )}
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

