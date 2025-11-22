import { useState, useEffect, useRef } from 'react';
import { FilmIcon, PlayIcon, VinylIcon, TrackIcon, SpotifyIcon, SoundcloudIcon, YoutubeIcon, EditIcon, NoImageIcon, UpArrowIcon, DownArrowIcon } from '../../../shared/ui/extras/Icons';
import { LoadingSpinner } from '../../../shared/ui/loading/Loading';

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

export const VideosTracks = ({ 
  videos = [], 
  tracks = [], 
  defaultActiveSection, 
  spotifyUrl = "", 
  soundcloudUrl = "", 
  youtubeUrl = "",
  // Editing props
  isEditable = false,
  editingTracks = [],
  artistName = "",
  onTracksEdit,
  onTrackPrimaryUpload,
  onTrackCoverUpload,
  onTrackTitleChange,
  onTrackArtistChange,
  onTrackRemove,
  onTrackMove,
  onSpotifyUrlChange,
  onSoundcloudUrlChange,
  onTracksSave,
  onTracksCancel,
  tracksUploadStatus = 'idle',
  tracksUploadProgress = 0,
  // Video editing props
  editingVideos = [],
  onVideosEdit,
  onVideoPrimaryUpload,
  onVideoTitleChange,
  onVideoRemove,
  onVideoMove,
  onYoutubeUrlChange,
  onVideosSave,
  onVideosCancel,
  videosUploadStatus = 'idle',
  videosUploadProgress = 0,
}) => {
  // Determine initial active section: use defaultActiveSection if provided,
  // otherwise default to 'videos' if there are videos,
  // otherwise default to 'tracks'
  const getInitialActiveSection = () => {
    if (defaultActiveSection) return defaultActiveSection;
    if (videos.length > 0) return 'videos';
    return 'tracks';
  };
  
  const [activeSection, setActiveSection] = useState(getInitialActiveSection);
  const [isEditingTracks, setIsEditingTracks] = useState(false);
  const [isEditingVideos, setIsEditingVideos] = useState(false);
  const [editSpotifyUrl, setEditSpotifyUrl] = useState(spotifyUrl);
  const [editSoundcloudUrl, setEditSoundcloudUrl] = useState(soundcloudUrl);
  const [editYoutubeUrl, setEditYoutubeUrl] = useState(youtubeUrl);
  const containerRef = useRef(null);
  const videosRef = useRef(null);
  const tracksRef = useRef(null);

  // Sync edit URLs with props
  useEffect(() => {
    setEditSpotifyUrl(spotifyUrl);
    setEditSoundcloudUrl(soundcloudUrl);
    setEditYoutubeUrl(youtubeUrl);
  }, [spotifyUrl, soundcloudUrl, youtubeUrl]);

  // Use editing tracks if in edit mode, otherwise use display tracks
  const displayTracksForEdit = isEditingTracks ? editingTracks : tracks;
  // Use editing videos if in edit mode, otherwise use display videos
  const displayVideosForEdit = isEditingVideos ? editingVideos : videos;

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
        
        const marginTop = 26;
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
  }, [activeSection, videos, tracks, isEditingTracks, editingTracks, isEditingVideos, editingVideos]);

  // Track previous tracks length to detect when tracks are added/removed
  const prevTracksLengthRef = useRef(tracks.length);
  
  // Switch to tracks when tracks are first uploaded, switch back to videos when all tracks are removed
  useEffect(() => {
    const prevLength = prevTracksLengthRef.current;
    const currentLength = tracks.length;
    
    // Only auto-switch to tracks when tracks go from 0 to > 0 (first track added)
    if (prevLength === 0 && currentLength > 0) {
      setActiveSection('tracks');
    } 
    // Switch back to videos if tracks become empty and we're currently on tracks
    else if (currentLength === 0 && activeSection === 'tracks') {
      setActiveSection('videos');
    }
    
    // Update the ref for next comparison
    prevTracksLengthRef.current = currentLength;
  }, [tracks.length, activeSection]);

  // Hide videos section if there are no videos
  const hasVideos = videos.length > 0;

  return (
    <div ref={containerRef} className="videos-tracks-inner">
      {/* Videos Section */}
      {hasVideos && (
        <div 
          ref={videosRef}
          className={`videos-section ${activeSection === 'videos' ? 'active' : 'inactive'}`}
        >
          {activeSection === 'videos' ? (
            <div className="section-header">
              <div className="title">
                <FilmIcon />
                <h3>Videos</h3>
              </div>
              <div className="external-links" style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                {!isEditingVideos && youtubeUrl && (
                  <a
                    href={youtubeUrl}
                    onClick={(e) => handleLinkClick(e, youtubeUrl)}
                    className="external-link youtube"
                    aria-label="Open YouTube channel"
                  >
                    <YoutubeIcon />
                    YouTube
                  </a>
                )}
                {isEditable && !isEditingVideos && (
                  <button
                    type="button"
                    className="btn component-edit-btn"
                    onClick={() => {
                      setIsEditingVideos(true);
                      onVideosEdit?.();
                    }}
                  >
                    <EditIcon />
                    Edit
                  </button>
                )}
                {isEditable && isEditingVideos && (
                  <button
                    type="button"
                    className="btn artist-profile component-save-btn"
                    onClick={() => {
                      onVideosSave?.({
                        videos: editingVideos,
                        youtubeUrl: editYoutubeUrl,
                      });
                      setIsEditingVideos(false);
                    }}
                  >
                    Save
                  </button>
                )}
              </div>
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
          {videosUploadStatus === 'uploading' ? (
            <div style={{ 
              display: 'flex', 
              flexDirection: 'column', 
              alignItems: 'center', 
              gap: '1rem',
              padding: '2rem 0',
            }}>
              <LoadingSpinner />
              <h4>Uploading Videos...</h4>
            </div>
          ) : isEditingVideos ? (
            <>
              {displayVideosForEdit.length === 0 ? (
                <>
                  <p className="creation-step-question">
                    Upload short clips that capture the energy of your live show.
                  </p>
                  <button 
                    type="button" 
                    className="creation-hero-upload track" 
                    onClick={onVideoPrimaryUpload}
                  >
                    <FilmIcon />
                    <span>Upload Video</span>
                    <small>MP4, MOV or WEBM up to 200MB</small>
                  </button>
                  <div className="link-entries-container">
                    <div className="link-entry-container youtube">
                      <YoutubeIcon />
                      <input 
                        type="text" 
                        placeholder="Youtube URL"
                        value={editYoutubeUrl}
                        onChange={(e) => {
                          setEditYoutubeUrl(e.target.value);
                          onYoutubeUrlChange?.(e.target.value);
                        }}
                      />
                    </div>
                  </div>
                </>
              ) : (
                <>
                  <div className="tracks-list videos">
                    {displayVideosForEdit.map((video, index) => {
                      const thumbnailSrc = video.thumbnailUploadedUrl || video.thumbnailPreviewUrl || video.thumbnail || null;
                      const statusMessage = video.isThumbnailGenerating
                        ? "Generating thumbnail..."
                        : video.thumbnailGenerationError || null;
                      return (
                        <div className="track-preview-card" key={video.id || index}>
                          <div className="track-cover-button video" aria-label="Video thumbnail">
                            {thumbnailSrc ? (
                              <img src={thumbnailSrc} alt={`${video.title} thumbnail`} />
                            ) : (
                              <div className="track-thumbnail-placeholder">
                                <LoadingSpinner />
                              </div>
                            )}
                            <div className="video-play-icon">
                              <PlayIcon />
                            </div>
                          </div>
                          <div className="track-meta">
                            <div className="track-name-input-container">
                              <input
                                type="text"
                                value={video.title || ''}
                                onChange={(e) => onVideoTitleChange?.(video.id, e.target.value)}
                                placeholder="Video title"
                              />
                              <EditIcon />
                            </div>
                            <p>{artistName || "Your Artist Name"}</p>
                            {statusMessage && (
                              <p className={`video-thumbnail-status ${video.thumbnailGenerationError ? "error" : ""}`}>
                                {statusMessage}
                              </p>
                            )}
                          </div>
                          <div className="track-actions">
                            <div className="track-reorder-buttons">
                              <button
                                type="button"
                                onClick={() => onVideoMove?.(video.id, "up")}
                                disabled={index === 0}
                                aria-label="Move video up"
                              >
                                <UpArrowIcon />
                              </button>
                              <button
                                type="button"
                                onClick={() => onVideoMove?.(video.id, "down")}
                                disabled={index === displayVideosForEdit.length - 1}
                                aria-label="Move video down"
                              >
                                <DownArrowIcon />
                              </button>
                            </div>
                            <button
                              type="button"
                              className="btn danger small"
                              onClick={() => onVideoRemove?.(video.id)}
                            >
                              Remove
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                  <button 
                    type="button" 
                    className="add-track-button" 
                    onClick={onVideoPrimaryUpload}
                  >
                    <FilmIcon /> Add Another Video
                  </button>
                  <div className="link-entries-container">
                    <div className="link-entry-container youtube">
                      <YoutubeIcon />
                      <input 
                        type="text" 
                        placeholder="Youtube URL" 
                        value={editYoutubeUrl}
                        onChange={(e) => {
                          setEditYoutubeUrl(e.target.value);
                          onYoutubeUrlChange?.(e.target.value);
                        }}
                      />
                    </div>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '1rem' }}>
                    <button
                      type="button"
                      className="btn tertiary"
                      onClick={() => {
                        setIsEditingVideos(false);
                        setEditYoutubeUrl(youtubeUrl);
                        onVideosCancel?.();
                      }}
                    >
                      Cancel
                    </button>
                  </div>
                </>
              )}
            </>
          ) : (
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
          )}
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
            <div className="external-links" style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              {!isEditingTracks && spotifyUrl && (
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
              {!isEditingTracks && soundcloudUrl && (
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
              {isEditable && !isEditingTracks && (
                <button
                  type="button"
                  className="btn component-edit-btn"
                  onClick={() => {
                    setIsEditingTracks(true);
                    onTracksEdit?.();
                  }}
                >
                  <EditIcon />
                  Edit
                </button>
              )}
              {isEditable && isEditingTracks && (
                <button
                  type="button"
                  className="btn artist-profile component-save-btn"
                  onClick={() => {
                    onTracksSave?.({
                      tracks: editingTracks,
                      spotifyUrl: editSpotifyUrl,
                      soundcloudUrl: editSoundcloudUrl,
                    });
                    setIsEditingTracks(false);
                  }}
                >
                  Save
                </button>
              )}
            </div>
          </div>
        ) : (
          tracks.length > 0 && (
            <div 
              className="section-header" 
              onClick={() => setActiveSection('tracks')}
              style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
            >
              <h4>Show Tracks</h4>
            </div>
          )
        )}
        <div className="section-content">
          {tracksUploadStatus === 'uploading' ? (
            <div style={{ 
              display: 'flex', 
              flexDirection: 'column', 
              alignItems: 'center', 
              gap: '1rem',
              padding: '2rem 0',
            }}>
              <LoadingSpinner />
              <h4>Uploading Tracks...</h4>
            </div>
          ) : isEditingTracks ? (
            <>
              {displayTracksForEdit.length === 0 ? (
                <>
                  <p className="creation-step-question">
                    Upload tracks that best represent your live sound.
                  </p>
                  <button 
                    type="button" 
                    className="creation-hero-upload track" 
                    onClick={onTrackPrimaryUpload}
                  >
                    <VinylIcon />
                    <span>Upload Track</span>
                    <small>MP3 or WAV up to 20MB</small>
                  </button>
                  <div className="link-entries-container">
                    <div className="link-entry-container spotify">
                      <SpotifyIcon />
                      <input 
                        type="text" 
                        placeholder="Spotify URL" 
                        value={editSpotifyUrl}
                        onChange={(e) => {
                          setEditSpotifyUrl(e.target.value);
                          onSpotifyUrlChange?.(e.target.value);
                        }}
                      />
                    </div>
                    <div className="link-entry-container soundcloud">
                      <SoundcloudIcon />
                      <input 
                        type="text" 
                        placeholder="Soundcloud URL" 
                        value={editSoundcloudUrl}
                        onChange={(e) => {
                          setEditSoundcloudUrl(e.target.value);
                          onSoundcloudUrlChange?.(e.target.value);
                        }}
                      />
                    </div>
                  </div>
                </>
              ) : (
                <>
                  <div className="tracks-list">
                    {displayTracksForEdit.map((track, index) => (
                      <div className="track-preview-card" key={track.id || index}>
                        <button
                          type="button"
                          className="track-cover-button"
                          onClick={() => onTrackCoverUpload?.(track.id)}
                        >
                          {track.coverUploadedUrl || track.coverPreviewUrl || track.coverUrl || track.thumbnail ? (
                            <img
                              src={track.coverUploadedUrl || track.coverPreviewUrl || track.coverUrl || track.thumbnail}
                              alt={`${track.title} cover art`}
                            />
                          ) : (
                            <>
                              <NoImageIcon className="upload-icon" />
                              <span>Add Image</span>
                            </>
                          )}
                        </button>
                        <div className="track-meta">
                          <div className="track-name-input-container">
                            <input
                              type="text"
                              value={track.title || ''}
                              onChange={(e) => onTrackTitleChange?.(track.id, e.target.value)}
                              placeholder="Track title"
                            />
                            <EditIcon />
                          </div>
                          <p>{artistName || track.artist || ''}</p>
                        </div>
                        <div className="track-actions">
                          <div className="track-reorder-buttons">
                            <button
                              type="button"
                              onClick={() => onTrackMove?.(track.id, "up")}
                              disabled={index === 0}
                              aria-label="Move track up"
                            >
                              <UpArrowIcon />
                            </button>
                            <button
                              type="button"
                              onClick={() => onTrackMove?.(track.id, "down")}
                              disabled={index === displayTracksForEdit.length - 1}
                              aria-label="Move track down"
                            >
                              <DownArrowIcon />
                            </button>
                          </div>
                          <button
                            type="button"
                            className="btn danger small"
                            onClick={() => onTrackRemove?.(track.id)}
                          >
                            Remove
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                  <button
                    type="button"
                    className="add-track-button"
                    onClick={onTrackPrimaryUpload}
                  >
                    <VinylIcon /> Add Another Track
                  </button>
                  <div className="link-entries-container">
                    <div className="link-entry-container spotify">
                      <SpotifyIcon />
                      <input 
                        type="text" 
                        placeholder="Spotify URL" 
                        value={editSpotifyUrl}
                        onChange={(e) => {
                          setEditSpotifyUrl(e.target.value);
                          onSpotifyUrlChange?.(e.target.value);
                        }}
                      />
                    </div>
                    <div className="link-entry-container soundcloud">
                      <SoundcloudIcon />
                      <input 
                        type="text" 
                        placeholder="Soundcloud URL" 
                        value={editSoundcloudUrl}
                        onChange={(e) => {
                          setEditSoundcloudUrl(e.target.value);
                          onSoundcloudUrlChange?.(e.target.value);
                        }}
                      />
                    </div>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '1rem' }}>
                    <button
                      type="button"
                      className="btn tertiary"
                      onClick={() => {
                        setIsEditingTracks(false);
                        setEditSpotifyUrl(spotifyUrl);
                        setEditSoundcloudUrl(soundcloudUrl);
                        onTracksCancel?.();
                      }}
                    >
                      Cancel
                    </button>
                  </div>
                </>
              )}
            </>
          ) : (
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
          )}
        </div>
      </div>
    </div>
  );
};

