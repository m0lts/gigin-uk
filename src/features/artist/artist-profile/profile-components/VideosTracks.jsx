import { useState, useEffect, useRef, useMemo } from 'react';
import { FilmIcon, PlayIcon, PauseIcon, VinylIcon, TrackIcon, SpotifyIcon, SoundcloudIcon, YoutubeIcon, EditIcon, NoImageIcon, UpArrowIcon, DownArrowIcon, ExitIcon, CloseIcon } from '../../../shared/ui/extras/Icons';
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

const MEDIA_STORAGE_LIMIT_BYTES = 3 * 1024 * 1024 * 1024; // 3GB

const formatFileSize = (bytes) => {
  if (!bytes || bytes <= 0) return '0B';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  const index = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  const value = bytes / Math.pow(1024, index);
  const formatted = value >= 10 ? value.toFixed(0) : value.toFixed(1);
  return `${formatted}${units[index]}`;
};

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
  const thumbnailBytes =
    video.thumbnailFile instanceof Blob
      ? video.thumbnailFile.size ?? 0
      : video.thumbnailSizeBytes ?? 0;
  return videoBytes + thumbnailBytes;
};

const StorageUsageBar = ({
  usedBytes = 0,
  totalBytes = MEDIA_STORAGE_LIMIT_BYTES,
  label = 'Storage Usage',
}) => {
  const limit = totalBytes || MEDIA_STORAGE_LIMIT_BYTES;
  const clampedUsed = Math.max(0, usedBytes);
  const percent = limit ? Math.min(100, (clampedUsed / limit) * 100) : 0;
  const isOverLimit = clampedUsed > limit;

  return (
    <div className={`storage-usage ${isOverLimit ? 'over-limit' : ''}`}>
      <div className="storage-usage-header">
        <span>{label}</span>
        <span>
          {formatFileSize(clampedUsed)} / {formatFileSize(limit)}
        </span>
      </div>
      <div className="storage-usage-bar">
        <div className="storage-usage-bar-fill" style={{ width: `${Math.min(percent, 100)}%` }} />
      </div>
    </div>
  );
};

export const VideosTracks = ({ 
  videos = [], 
  tracks = [], 
  defaultActiveSection, 
  spotifyUrl = "", 
  soundcloudUrl = "", 
  youtubeUrl = "",
  mediaUsageBytes = 0,
  // Editing props
  isEditable = false,
  editingTracks = [],
  tracksSource = [],
  videosSource = [],
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
  allowPlayback = true,
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
  const [activeVideoId, setActiveVideoId] = useState(null);
  const containerRef = useRef(null);
  const videosRef = useRef(null);
  const tracksRef = useRef(null);
  const [remoteTrackSizes, setRemoteTrackSizes] = useState({});
  const [remoteVideoSizes, setRemoteVideoSizes] = useState({});
  const [activeTrackId, setActiveTrackId] = useState(null);
  const [trackProgress, setTrackProgress] = useState({ currentTime: 0, duration: 0 });
  const [isTrackPlaying, setIsTrackPlaying] = useState(false);
  const [isTrackScrubbing, setIsTrackScrubbing] = useState(false);
  const trackAudioRef = useRef(null);
  const trackProgressBarRef = useRef(null);
  const trackSizeFetchRef = useRef(new Set());
  const videoSizeFetchRef = useRef(new Set());
  const tracksForUsage = isEditingTracks
    ? editingTracks
    : (tracksSource.length ? tracksSource : tracks);
  const videosForUsage = isEditingVideos
    ? editingVideos
    : (videosSource.length ? videosSource : videos);
  const needsTrackUsage = isEditingTracks || isEditingVideos;
  const needsVideoUsage = isEditingTracks || isEditingVideos;

  // Base track dataset from source or props
  const baseTrackDataset = tracksSource.length ? tracksSource : tracks;
  
  // Get uploading tracks from editingTracks (tracks with audioFile but no uploaded URL)
  const uploadingTracks = editingTracks.filter(
    (track) => track.audioFile && !track.uploadedAudioUrl
  );
  
  // Merge uploading tracks into dataset for viewing mode
  // Only include uploading tracks that aren't already in the dataset
  const trackDataset = useMemo(() => {
    const existingIds = new Set(baseTrackDataset.map((t) => t.id));
    const newUploadingTracks = uploadingTracks.filter((t) => !existingIds.has(t.id));
    return [...baseTrackDataset, ...newUploadingTracks];
  }, [baseTrackDataset, uploadingTracks]);

  const getTrackSizeEstimate = (track) => {
    const directSize = getTrackMediaBytes(track);
    if (directSize > 0) return directSize;
    return remoteTrackSizes[track.id] || 0;
  };

  const getVideoSizeEstimate = (video) => {
    const directSize = getVideoMediaBytes(video);
    if (directSize > 0) return directSize;
    return remoteVideoSizes[video.id] || 0;
  };

  const resolveVideoSource = (video) =>
    video.uploadedVideoUrl ||
    video.videoPreviewUrl ||
    video.videoUrl ||
    '';

  const resolveVideoPoster = (video) =>
    video.thumbnailUploadedUrl ||
    video.thumbnailPreviewUrl ||
    video.thumbnail ||
    video.thumbnailUrl ||
    null;

  const resolveTrackCover = (track) =>
    track.coverUploadedUrl ||
    track.coverPreviewUrl ||
    track.coverUrl ||
    track.thumbnail ||
    null;

  const resolveTrackAudio = (track) =>
    track.uploadedAudioUrl ||
    track.audioUploadedUrl ||
    track.audioPreviewUrl ||
    track.audioUrl ||
    '';

  // Base video dataset from source or props
  const baseVideoDataset = videosSource.length ? videosSource : videos;
  
  // Get uploading videos from editingVideos (videos with file but no uploaded URL)
  const uploadingVideos = editingVideos.filter(
    (video) => video.videoFile && !video.uploadedVideoUrl
  );
  
  // Merge uploading videos into dataset for viewing mode
  // Only include uploading videos that aren't already in the dataset
  const videoDataset = useMemo(() => {
    const existingIds = new Set(baseVideoDataset.map((v) => v.id));
    const newUploadingVideos = uploadingVideos.filter((v) => !existingIds.has(v.id));
    return [...baseVideoDataset, ...newUploadingVideos];
  }, [baseVideoDataset, uploadingVideos]);

  const trackUsageBytes = useMemo(
    () => tracksForUsage.reduce((total, track) => total + getTrackSizeEstimate(track), 0),
    [tracksForUsage, remoteTrackSizes]
  );
  const videoUsageBytes = useMemo(
    () => videosForUsage.reduce((total, video) => total + getVideoSizeEstimate(video), 0),
    [videosForUsage, remoteVideoSizes]
  );
  const derivedUsageBytes = trackUsageBytes + videoUsageBytes;
  const combinedUsageBytes = Math.max(mediaUsageBytes || 0, derivedUsageBytes);
  const trackUsageBar = isEditingTracks ? (
    <StorageUsageBar usedBytes={combinedUsageBytes} totalBytes={MEDIA_STORAGE_LIMIT_BYTES} />
  ) : null;
  const videoUsageBar = isEditingVideos ? (
    <StorageUsageBar usedBytes={combinedUsageBytes} totalBytes={MEDIA_STORAGE_LIMIT_BYTES} />
  ) : null;

  const fetchFileSize = async (url) => {
    if (!url) return 0;
    try {
      const response = await fetch(url, { method: 'HEAD' });
      const header = response.headers.get('content-length');
      const size = header ? parseInt(header, 10) : 0;
      return Number.isFinite(size) ? size : 0;
    } catch (error) {
      console.error('Failed to fetch file size', error);
      return 0;
    }
  };

  useEffect(() => {
    if (!needsTrackUsage) return;
    let cancelled = false;

    tracksForUsage.forEach((track) => {
      if (!track || !track.id) return;
      const existingSize = getTrackMediaBytes(track);
      if (existingSize > 0 || remoteTrackSizes[track.id]) return;
      if (trackSizeFetchRef.current.has(track.id)) return;

      const audioUrl = track.uploadedAudioUrl || track.audioUrl;
      const coverUrl = track.coverUploadedUrl || track.coverUrl;
      if (!track.audioFile && !audioUrl && !track.coverFile && !coverUrl) return;
      trackSizeFetchRef.current.add(track.id);

      (async () => {
        const audioSize =
          track.audioFile?.size ??
          track.audioSizeBytes ??
          (audioUrl ? await fetchFileSize(audioUrl) : 0);
        const coverSize =
          track.coverFile?.size ??
          track.coverSizeBytes ??
          (coverUrl ? await fetchFileSize(coverUrl) : 0);
        const total = audioSize + coverSize;
        if (!cancelled) {
          setRemoteTrackSizes((prev) => ({
            ...prev,
            [track.id]: total,
          }));
        }
      })()
        .catch((error) => {
          console.error('Failed to resolve track size', error);
        })
        .finally(() => {
          trackSizeFetchRef.current.delete(track.id);
        });
    });

    return () => {
      cancelled = true;
    };
  }, [needsTrackUsage, tracksForUsage, remoteTrackSizes]);

  useEffect(() => {
    if (!needsVideoUsage) return;
    let cancelled = false;

    videosForUsage.forEach((video) => {
      if (!video || !video.id) return;
      const existingSize = getVideoMediaBytes(video);
      if (existingSize > 0 || remoteVideoSizes[video.id]) return;
      if (videoSizeFetchRef.current.has(video.id)) return;

      const videoUrl = video.uploadedVideoUrl || video.videoUrl;
      const thumbnailUrl = video.thumbnailUploadedUrl || video.thumbnailUrl || video.thumbnail;
      if (!video.videoFile && !videoUrl && !video.thumbnailFile && !thumbnailUrl) return;
      videoSizeFetchRef.current.add(video.id);

      (async () => {
        const mainSize =
          video.videoFile?.size ??
          video.videoSizeBytes ??
          (videoUrl ? await fetchFileSize(videoUrl) : 0);
        const thumbSize =
          video.thumbnailFile?.size ??
          video.thumbnailSizeBytes ??
          (thumbnailUrl ? await fetchFileSize(thumbnailUrl) : 0);
        const total = mainSize + thumbSize;
        if (!cancelled) {
          setRemoteVideoSizes((prev) => ({
            ...prev,
            [video.id]: total,
          }));
        }
      })()
        .catch((error) => {
          console.error('Failed to resolve video size', error);
        })
        .finally(() => {
          videoSizeFetchRef.current.delete(video.id);
        });
    });

    return () => {
      cancelled = true;
    };
  }, [needsVideoUsage, videosForUsage, remoteVideoSizes]);

  const getVideoIdentifier = (video, index) => video.id || `video-${index}`;
  const getTrackIdentifier = (track, index) => track.id || `track-${index}`;

  const handleVideoPlayRequest = (videoKey) => {
    if (!allowPlayback) return;
    setActiveVideoId(videoKey);
  };

  const handleTrackPlayRequest = (trackKey) => {
    if (!allowPlayback) return;
    setActiveTrackId(trackKey);
  };

  const scrubTrackToClientX = (clientX) => {
    if (!trackAudioRef.current || !trackProgressBarRef.current) return;
    const rect = trackProgressBarRef.current.getBoundingClientRect();
    const percent = Math.min(Math.max((clientX - rect.left) / rect.width, 0), 1);
    const duration = trackAudioRef.current.duration || trackProgress.duration || 0;
    const newTime = percent * duration;
    trackAudioRef.current.currentTime = newTime;
    setTrackProgress({
      currentTime: newTime,
      duration,
    });
  };

  const handleTrackProgressPointerDown = (event) => {
    if (!trackAudioRef.current || !trackProgressBarRef.current) return;
    event.preventDefault();
    setIsTrackScrubbing(true);
    scrubTrackToClientX(event.clientX);

    const handlePointerMove = (moveEvent) => {
      moveEvent.preventDefault();
      scrubTrackToClientX(moveEvent.clientX);
    };

    const handlePointerUp = () => {
      setIsTrackScrubbing(false);
      document.removeEventListener('pointermove', handlePointerMove);
      document.removeEventListener('pointerup', handlePointerUp);
    };

    document.addEventListener('pointermove', handlePointerMove);
    document.addEventListener('pointerup', handlePointerUp);
  };

  const activeVideoData = useMemo(() => {
    if (!activeVideoId) return null;
    const sourceList = videoDataset.length ? videoDataset : videos;
    return (
      sourceList.find((video, index) => getVideoIdentifier(video, index) === activeVideoId) || null
    );
  }, [activeVideoId, videoDataset, videos]);

  const activeTrackData = useMemo(() => {
    if (!activeTrackId) return null;
    const sourceList = trackDataset.length ? trackDataset : tracks;
    return (
      sourceList.find((track, index) => getTrackIdentifier(track, index) === activeTrackId) || null
    );
  }, [activeTrackId, trackDataset, tracks]);

  useEffect(() => {
    if (activeVideoId && !activeVideoData) {
      setActiveVideoId(null);
    }
  }, [activeVideoId, activeVideoData]);

  useEffect(() => {
    if (isEditingVideos) {
      setActiveVideoId(null);
    }
  }, [isEditingVideos]);

  useEffect(() => {
    if (activeTrackId && !activeTrackData) {
      setActiveTrackId(null);
    }
  }, [activeTrackId, activeTrackData]);

  useEffect(() => {
    if (isEditingTracks) {
      setActiveTrackId(null);
      setIsTrackPlaying(false);
      setTrackProgress({ currentTime: 0, duration: 0 });
      if (trackAudioRef.current) {
        trackAudioRef.current.pause();
        trackAudioRef.current.currentTime = 0;
      }
    }
  }, [isEditingTracks]);

  useEffect(() => {
    if (!activeTrackData) {
      setIsTrackPlaying(false);
      setTrackProgress({ currentTime: 0, duration: 0 });
      if (trackAudioRef.current) {
        trackAudioRef.current.pause();
        trackAudioRef.current.currentTime = 0;
      }
    }
  }, [activeTrackData]);

  useEffect(() => {
    if (!allowPlayback) {
      setActiveVideoId(null);
      setActiveTrackId(null);
      setIsTrackPlaying(false);
      setTrackProgress({ currentTime: 0, duration: 0 });
      if (trackAudioRef.current) {
        trackAudioRef.current.pause();
        trackAudioRef.current.currentTime = 0;
      }
    }
  }, [allowPlayback]);

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
        const topOffset = 30;
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
  }, [
    activeSection,
    videos,
    tracks,
    isEditingTracks,
    editingTracks,
    isEditingVideos,
    editingVideos,
    activeVideoId,
    activeTrackId,
  ]);

  const prevTracksLengthRef = useRef(tracks.length);

  // Switch to tracks when tracks are first uploaded, switch back to videos when all tracks are removed
  useEffect(() => {
    const prevLength = prevTracksLengthRef.current;
    const currentLength = tracks.length;

    if (prevLength === 0 && currentLength > 0) {
      setActiveSection('tracks');
    } else if (currentLength === 0 && activeSection === 'tracks') {
      setActiveSection('videos');
    }

    prevTracksLengthRef.current = currentLength;
  }, [tracks.length, activeSection]);

  useEffect(() => {
    if (activeSection === 'videos') {
      setIsEditingVideos(false);
      setActiveVideoId(null);
    } else if (activeSection === 'tracks') {
      setIsEditingTracks(false);
      setActiveTrackId(null);
    }
  }, [activeSection]);

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
            <>
              {isEditingVideos && videoUsageBar}
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
            </>
          ) : isEditingVideos ? (
            <>
              {videoUsageBar}
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
                            <p className="media-size-label">
                              {formatFileSize(getVideoSizeEstimate(video))}
                            </p>
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
            <>
              {activeVideoData ? (
                <div className="video-expanded-wrapper">
                  <div className="video-expanded-header">
                    <h4>{activeVideoData.title || 'Video'}</h4>
                    <button
                      type="button"
                      className="btn icon"
                      onClick={() => setActiveVideoId(null)}
                    >
                      <CloseIcon />
                    </button>
                  </div>
                  <div className="video-expanded-player">
                    {resolveVideoSource(activeVideoData) ? (
                      <video
                        controls
                        poster={resolveVideoPoster(activeVideoData) || undefined}
                        src={resolveVideoSource(activeVideoData)}
                      />
                    ) : (
                      <div className="video-placeholder large">Video unavailable</div>
                    )}
                  </div>
                </div>
              ) : (
                <div className="videos-grid">
                  {videoDataset.map((video, index) => {
                    const videoKey = getVideoIdentifier(video, index);
                    const thumbnail =
                      video.thumbnailUploadedUrl ||
                      video.thumbnailPreviewUrl ||
                      video.thumbnail ||
                      video.thumbnailUrl ||
                      null;
                    // Check if video is uploading (has file but no uploaded URL yet)
                    const isUploading = !!(video.videoFile && !video.uploadedVideoUrl);
                    
                    return (
                      <div key={videoKey} className="video-thumbnail">
                        {isUploading ? (
                          <div className="video-placeholder uploading" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}>
                            <LoadingSpinner />
                            <h5 style={{ fontSize: '0.875rem', color: 'var(--gn-grey-600)' }}>Uploading Video...</h5>
                          </div>
                        ) : thumbnail ? (
                          <img src={thumbnail} alt={video.title || `Video ${index + 1}`} />
                        ) : (
                          <div className="video-placeholder">Video {index + 1}</div>
                        )}
                        {!isUploading && (
                          <button
                            type="button"
                            className="play-icon-button"
                            onClick={() => handleVideoPlayRequest(videoKey)}
                            disabled={!allowPlayback}
                            aria-label={`Play ${video.title || `video ${index + 1}`}`}
                          >
                            <PlayIcon />
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </>
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
            <>
              {isEditingTracks && trackUsageBar}
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
            </>
          ) : isEditingTracks ? (
            <>
              {trackUsageBar}
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
                          <p className="media-size-label">
                            Size: {formatFileSize(getTrackSizeEstimate(track))}
                          </p>
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
            <>
              {activeTrackData ? (
                <div className="track-expanded-wrapper">
                  <div className="track-expanded-header">
                    <h4>{activeTrackData.title || 'Track'}</h4>
                    <button
                      type="button"
                      className="btn icon close"
                      onClick={() => setActiveTrackId(null)}
                    >
                      <CloseIcon />
                    </button>
                  </div>
                  <div className="track-expanded-cover">
                    {resolveTrackCover(activeTrackData) ? (
                      <img
                        src={resolveTrackCover(activeTrackData)}
                        alt={activeTrackData.title || 'Track cover art'}
                      />
                    ) : (
                      <div className="track-placeholder large">No cover</div>
                    )}
                  </div>
                  <div className="track-player">
                    <button
                      type="button"
                      className="btn icon track-player-toggle"
                      onClick={() => {
                        if (!trackAudioRef.current) return;
                        if (isTrackPlaying) {
                          trackAudioRef.current.pause();
                        } else {
                          trackAudioRef.current.play().catch(() => {});
                        }
                      }}
                      aria-label={isTrackPlaying ? 'Pause track' : 'Play track'}
                      disabled={!resolveTrackAudio(activeTrackData)}
                    >
                      {isTrackPlaying ? <PauseIcon /> : <PlayIcon />}
                    </button>
                    <div
                      className="track-progress-bar"
                      ref={trackProgressBarRef}
                      onPointerDown={handleTrackProgressPointerDown}
                    >
                      <div
                        className="track-progress-fill"
                        style={{
                          width:
                            trackProgress.duration > 0
                              ? `${(trackProgress.currentTime / trackProgress.duration) * 100}%`
                              : '0%',
                        }}
                      />
                      <div
                        className={`track-progress-handle ${isTrackScrubbing ? 'scrubbing' : ''}`}
                        style={{
                          left:
                            trackProgress.duration > 0
                              ? `${(trackProgress.currentTime / trackProgress.duration) * 100}%`
                              : '0%',
                        }}
                      />
                    </div>
                    {resolveTrackAudio(activeTrackData) ? (
                      <audio
                        ref={trackAudioRef}
                        src={resolveTrackAudio(activeTrackData)}
                        onTimeUpdate={(e) =>
                          setTrackProgress({
                            currentTime: e.target.currentTime,
                            duration: e.target.duration || 0,
                          })
                        }
                        onLoadedMetadata={(e) =>
                          setTrackProgress({
                            currentTime: e.target.currentTime,
                            duration: e.target.duration || 0,
                          })
                        }
                        onPlay={() => setIsTrackPlaying(true)}
                        onPause={() => setIsTrackPlaying(false)}
                        onEnded={() => {
                          setIsTrackPlaying(false);
                          setTrackProgress((prev) => ({ ...prev, currentTime: prev.duration }));
                        }}
                        style={{ display: 'none' }}
                      />
                    ) : (
                      <div className="audio-placeholder">Audio unavailable</div>
                    )}
                  </div>
                </div>
              ) : (
                <div className="tracks-list playable">
                  {trackDataset.map((track, index) => {
                    const trackKey = getTrackIdentifier(track, index);
                    const cover = resolveTrackCover(track);
                    // Check if track is uploading (has audioFile but no uploaded URL yet)
                    const isUploading = !!(track.audioFile && !track.uploadedAudioUrl);
                    
                    return (
                      <div key={trackKey} className="track-item playable">
                        <div className="track-thumbnail">
                          {isUploading ? (
                            <div className="track-thumbnail-placeholder uploading">
                              <LoadingSpinner />
                            </div>
                          ) : cover ? (
                            <img src={cover} alt={track.title || 'Track'} />
                          ) : (
                            <div className="track-thumbnail-placeholder">
                              <TrackIcon />
                            </div>
                          )}
                        </div>
                        <div className="track-info">
                          {isUploading ? (
                            <>
                            <h4>Uploading Track...</h4>
                            <p style={{ fontSize: '0.875rem', color: 'var(--gn-grey-600)' }}>Don't leave this page...</p>
                            </>
                          ) : (
                            <>
                              <h4>{track.title || `Track ${index + 1}`}</h4>
                              {track.artist && <p>{track.artist}</p>}
                            </>
                          )}
                        </div>
                        {!isUploading && (
                          <button
                            type="button"
                            className="btn icon play-track"
                            onClick={() => handleTrackPlayRequest(trackKey)}
                            disabled={!allowPlayback}
                            aria-label={`Play ${track.title || `track ${index + 1}`}`}
                          >
                            <PlayIcon />
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
};

