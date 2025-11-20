import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { GuitarsIcon, RightArrowIcon, LeftChevronIcon, NoImageIcon, LightModeIcon, LeftArrowIcon, MicrophoneLinesIcon, EditIcon, UpArrowIcon, DownArrowIcon, TrackIcon, VinylIcon, SpotifyIcon, SoundcloudIcon, WebsiteIcon, InstagramIcon } from "../../../shared/ui/extras/Icons";
import { LoadingSpinner } from "../../../shared/ui/loading/Loading";

export const CREATION_STEP_ORDER = ["hero-image", "stage-name", "bio", "tracks", "videos", "ready"];

const DEFAULT_STEP = CREATION_STEP_ORDER[0];
const STAGE_NAME_FONT_MAX = 40;
const STAGE_NAME_FONT_MIN = 20;
const STAGE_NAME_HORIZONTAL_PADDING = 32; // matches input horizontal padding
const HERO_POSITION_DEFAULT = 50;

export const ProfileCreationBox = ({
  onStartJourney,
  isLoading = false,
  isCreating = false,
  creationStep = DEFAULT_STEP,
  onCreationStepChange,
  onCompleteCreation,
  onHeroImageUpdate,
  initialHeroImage = null,
  heroBrightness = 100,
  onHeroBrightnessChange,
  heroPosition = 50,
  onHeroPositionChange,
  isRepositioningHero = false,
  onHeroRepositionToggle,
  initialArtistName = "",
  onArtistNameChange,
  artistBio = "",
  onArtistBioChange,
  creationWebsiteUrl = "",
  onWebsiteUrlChange,
  creationInstagramUrl = "",
  onInstagramUrlChange,
  spotifyUrl = "",
  onSpotifyUrlChange,
  soundcloudUrl = "",
  onSoundcloudUrlChange,
  heroUploadStatus = 'idle',
  heroUploadProgress = 0,
  onTracksChange,
  tracksUploadStatus = 'idle',
  tracksUploadProgress = 0,
  initialTracks = [],
}) => {
  const [artistName, setArtistName] = useState(initialArtistName);
  const [heroImage, setHeroImage] = useState(null);
  const [heroFlowStage, setHeroFlowStage] = useState("upload");
  const [tracks, setTracks] = useState(initialTracks);
  const createTrackId = () =>
    typeof crypto !== "undefined" && crypto.randomUUID
      ? crypto.randomUUID()
      : `track-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;

  const revokeObjectUrl = (url) => {
    if (url && url.startsWith("blob:")) {
      URL.revokeObjectURL(url);
    }
  };
  const [displayedStep, setDisplayedStep] = useState(() =>
    CREATION_STEP_ORDER.includes(creationStep) ? creationStep : DEFAULT_STEP
  );
  const [previousStep, setPreviousStep] = useState(null);
  const [transitionDirection, setTransitionDirection] = useState("forward");
  const transitionTimeoutRef = useRef(null);
  const heroFileInputRef = useRef(null);
  const trackFileInputRef = useRef(null);
  const trackCoverInputRef = useRef(null);
  const pendingCoverTrackIdRef = useRef(null);
  const containerRef = useRef(null);
  const tracksSyncedRef = useRef(false);
  const contentWrapperRef = useRef(null);
  const stageNameWrapperRef = useRef(null);
  const textMeasureContextRef = useRef(null);
  const [containerHeight, setContainerHeight] = useState("auto");
  const [stageNameFontSize, setStageNameFontSize] = useState(STAGE_NAME_FONT_MAX);
  const ensureMeasureContext = () => {
    if (textMeasureContextRef.current) return textMeasureContextRef.current;
    const canvas = document.createElement("canvas");
    textMeasureContextRef.current = canvas.getContext("2d");
    return textMeasureContextRef.current;
  };

  const recalculateStageNameFontSize = useCallback(() => {
    const wrapper = stageNameWrapperRef.current;
    const context = ensureMeasureContext();
    if (!wrapper || !context) return;

    const availableWidth = wrapper.clientWidth - STAGE_NAME_HORIZONTAL_PADDING;
    if (availableWidth <= 0) {
      setStageNameFontSize(STAGE_NAME_FONT_MIN);
      return;
    }

    const displayValue = artistName?.trim()?.length ? artistName : "Stage Name";
    let fontSize = STAGE_NAME_FONT_MAX;

    while (fontSize > STAGE_NAME_FONT_MIN) {
      context.font = `600 ${fontSize}px "Inter", "Clash Display", sans-serif`;
      const metrics = context.measureText(displayValue);
      if (metrics.width <= availableWidth) break;
      fontSize -= 1;
    }

    setStageNameFontSize(Math.max(fontSize, STAGE_NAME_FONT_MIN));
  }, [artistName]);

  useEffect(() => {
    recalculateStageNameFontSize();
  }, [artistName, recalculateStageNameFontSize]);

  useEffect(() => {
    const wrapper = stageNameWrapperRef.current;
    if (!wrapper) return;
    const observer = new ResizeObserver(() => {
      recalculateStageNameFontSize();
    });
    observer.observe(wrapper);
    return () => observer.disconnect();
  }, [recalculateStageNameFontSize]);

  const normalizedStep = useMemo(
    () => (CREATION_STEP_ORDER.includes(creationStep) ? creationStep : DEFAULT_STEP),
    [creationStep]
  );

  const resolveStepIndex = (step) => {
    const idx = CREATION_STEP_ORDER.indexOf(step);
    return idx === -1 ? 0 : idx;
  };

  const currentStepIndex = resolveStepIndex(displayedStep);
  const totalSteps = CREATION_STEP_ORDER.length;
  const isFinalStep = currentStepIndex === totalSteps - 1;

  useEffect(() => {
    if (initialArtistName !== artistName && initialArtistName) {
      setArtistName(initialArtistName);
    }
  }, [initialArtistName]);

  useEffect(() => {
    if (!initialHeroImage) return;
    if (
      !heroImage ||
      heroImage.previewUrl !== initialHeroImage.previewUrl ||
      heroImage.storagePath !== initialHeroImage.storagePath
    ) {
      setHeroImage(initialHeroImage);
      setHeroFlowStage(initialHeroImage.mode || "adjust");
    }
  }, [initialHeroImage, heroImage]);

  useEffect(() => {
    if (isCreating) return;
    if (heroImage?.file && heroImage.previewUrl) {
      revokeObjectUrl(heroImage.previewUrl);
    }
    if (initialHeroImage) {
      setHeroImage(initialHeroImage);
      setHeroFlowStage(initialHeroImage.mode || "adjust");
    } else {
      setHeroImage(null);
      setHeroFlowStage("upload");
    }
  }, [isCreating, initialHeroImage, heroImage]);

  useEffect(() => {
    if (!isCreating) {
      if (heroImage?.previewUrl) {
        revokeObjectUrl(heroImage.previewUrl);
      }
      setHeroImage(null);
      setHeroFlowStage("upload");
      onHeroBrightnessChange?.(100);
      setArtistName("");
      setPreviousStep(null);
      setDisplayedStep(DEFAULT_STEP);
      tracks.forEach((track) => {
        revokeObjectUrl(track.audioPreviewUrl);
        revokeObjectUrl(track.coverPreviewUrl);
      });
      setTracks([]);
      return;
    }

    if (normalizedStep === displayedStep) return;

    const direction =
      resolveStepIndex(normalizedStep) >= resolveStepIndex(displayedStep)
        ? "forward"
        : "backward";

    setTransitionDirection(direction);
    setPreviousStep(displayedStep);
    setDisplayedStep(normalizedStep);

    if (transitionTimeoutRef.current) {
      clearTimeout(transitionTimeoutRef.current);
    }
    transitionTimeoutRef.current = setTimeout(() => {
      setPreviousStep(null);
    }, 350);
  }, [isCreating, normalizedStep, displayedStep, heroImage, tracks]);

  useEffect(() => {
    return () => {
      if (transitionTimeoutRef.current) {
        clearTimeout(transitionTimeoutRef.current);
      }

      if (heroImage?.previewUrl) {
        revokeObjectUrl(heroImage.previewUrl);
      }
      tracks.forEach((track) => {
        revokeObjectUrl(track.audioPreviewUrl);
        revokeObjectUrl(track.coverPreviewUrl);
      });
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Measure and update container height for smooth transitions
  useEffect(() => {
    if (!contentWrapperRef.current) return;

    const wrapper = contentWrapperRef.current;
    let rafId = null;

    const updateHeight = () => {
      if (!wrapper || !containerRef.current) return;
      
      // Measure the wrapper's natural height
      const naturalHeight = wrapper.scrollHeight;
      
      // Set the height on the container (this will trigger the CSS transition)
      setContainerHeight(`${naturalHeight}px`);
    };

    // Use ResizeObserver for automatic height detection
    const resizeObserver = new ResizeObserver((entries) => {
      if (rafId) cancelAnimationFrame(rafId);
      rafId = requestAnimationFrame(updateHeight);
    });

    resizeObserver.observe(wrapper);

    // Initial measurement with a small delay to ensure DOM is ready
    const initialTimeout = setTimeout(() => {
      updateHeight();
    }, 50);

    return () => {
      if (rafId) cancelAnimationFrame(rafId);
      clearTimeout(initialTimeout);
      resizeObserver.disconnect();
    };
  }, [displayedStep, heroFlowStage, isCreating, artistName, heroImage, tracks, previousStep]);

  // Sync local tracks with parent's initialTracks when they're loaded from database
  // This handles both initial load and when navigating back to tracks step
  useEffect(() => {
    if (!initialTracks || initialTracks.length === 0) {
      tracksSyncedRef.current = false;
      return;
    }

    // Check if tracks need to be synced
    // Sync if: local tracks are empty, OR parent tracks have different IDs (loaded from DB)
    const localTrackIds = tracks.map(t => t.id).sort().join(',');
    const parentTrackIds = initialTracks.map(t => t.id).sort().join(',');
    
    if (tracks.length === 0 || localTrackIds !== parentTrackIds) {
      // Parent has tracks that should be displayed (either initial load or DB load)
      setTracks(initialTracks);
      tracksSyncedRef.current = true;
    }
  }, [initialTracks]); // Only depend on initialTracks to avoid loops

  // Notify parent when tracks change
  useEffect(() => {
    if (onTracksChange) {
      onTracksChange(tracks);
    }
  }, [tracks, onTracksChange]);

  const goToStep = (stepId) => {
    if (!CREATION_STEP_ORDER.includes(stepId)) return;
    onCreationStepChange?.(stepId);
  };

  const heroStepReady = !!heroImage && heroFlowStage === "adjust";
  const trackStepReady = tracks.length > 0;

  const handleAdvance = () => {
    if (!isCreating) {
      onStartJourney?.();
      return;
    }

    if (displayedStep === "hero-image" && !heroStepReady) {
      return;
    }

    if (displayedStep === "tracks" && !trackStepReady) {
      return;
    }

    if (isFinalStep) {
      onCompleteCreation?.();
      return;
    }

    const nextStep = CREATION_STEP_ORDER[currentStepIndex + 1];
    goToStep(nextStep);
  };

  const handleBack = () => {
    if (displayedStep === "hero-image" && heroFlowStage === "adjust") {
      setHeroFlowStage("upload");
      return;
    }
    if (!isCreating || currentStepIndex === 0) return;
    const previous = CREATION_STEP_ORDER[currentStepIndex - 1];
    goToStep(previous);
  };

  const handleHeroImagePicked = (file) => {
    if (!file) return;
    if (heroImage?.previewUrl) {
      URL.revokeObjectURL(heroImage.previewUrl);
    }
    const previewUrl = URL.createObjectURL(file);
    setHeroImage({ file, previewUrl });
    setHeroFlowStage("adjust");
    onHeroBrightnessChange?.(100);
    onHeroImageUpdate?.({ previewUrl, file });
  };

  const handleHeroFileInputChange = (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    handleHeroImagePicked(file);
  };

  const handleTrackPicked = (file) => {
    if (!file) return;
    const previewUrl = URL.createObjectURL(file);
    const newTrack = {
      id: createTrackId(),
      title: `Track ${tracks.length + 1}`,
      artist: artistName || "",
      audioFile: file,
      audioPreviewUrl: previewUrl,
      coverFile: null,
      coverPreviewUrl: null,
      uploadedAudioUrl: null,
      coverUploadedUrl: null,
    };
    setTracks((prev) => [...prev, newTrack]);
  };

  const handleTrackFileInputChange = (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    handleTrackPicked(file);
    event.target.value = "";
  };

  const handleTrackCoverUploadClick = (trackId) => {
    pendingCoverTrackIdRef.current = trackId;
    trackCoverInputRef.current?.click();
  };

  const handleTrackCoverFileChange = (event) => {
    const file = event.target.files?.[0];
    const trackId = pendingCoverTrackIdRef.current;
    if (!file || !trackId) return;
    const previewUrl = URL.createObjectURL(file);
    setTracks((prev) =>
      prev.map((track) => {
        if (track.id !== trackId) return track;
        revokeObjectUrl(track.coverPreviewUrl);
        return {
          ...track,
          coverFile: file,
          coverPreviewUrl: previewUrl,
        };
      })
    );
    pendingCoverTrackIdRef.current = null;
    event.target.value = "";
  };

  const handleTrackRemove = (trackId) => {
    setTracks((prev) => {
      const target = prev.find((track) => track.id === trackId);
      if (target) {
        revokeObjectUrl(target.audioPreviewUrl);
        revokeObjectUrl(target.coverPreviewUrl);
      }
      return prev.filter((track) => track.id !== trackId);
    });
    if (pendingCoverTrackIdRef.current === trackId) {
      pendingCoverTrackIdRef.current = null;
    }
  };

  const handleTrackTitleChange = (trackId, newTitle) => {
    setTracks((prev) =>
      prev.map((track) => (track.id === trackId ? { ...track, title: newTitle } : track))
    );
  };

  const handleTrackArtistChange = (trackId, newArtist) => {
    setTracks((prev) =>
      prev.map((track) => (track.id === trackId ? { ...track, artist: newArtist } : track))
    );
  };

  const handleTrackMove = (trackId, direction) => {
    setTracks((prev) => {
      const index = prev.findIndex((track) => track.id === trackId);
      if (index === -1) return prev;
      const newIndex = direction === "up" ? index - 1 : index + 1;
      if (newIndex < 0 || newIndex >= prev.length) return prev;
      const updated = [...prev];
      const [item] = updated.splice(index, 1);
      updated.splice(newIndex, 0, item);
      return updated;
    });
  };

  const handleArtistNameChange = (newName) => {
    setArtistName(newName);
    onArtistNameChange?.(newName);
  };

  const renderStepPanel = (stepKey) => {
    switch (stepKey) {
      case "hero-image":
        return (
          <HeroImageStep
            heroImage={heroImage}
            heroMode={heroFlowStage}
            heroBrightness={heroBrightness}
            heroPosition={heroPosition}
            onHeroPositionChange={onHeroPositionChange}
            onHeroImageSelect={() => heroFileInputRef.current?.click()}
            onHeroBrightnessChange={onHeroBrightnessChange}
            isRepositioningHero={isRepositioningHero}
            onHeroRepositionToggle={onHeroRepositionToggle}
            heroUploadStatus={heroUploadStatus}
            heroUploadProgress={heroUploadProgress}
          />
        );
      case "stage-name":
        return (
          <StageNameStep
            artistName={artistName}
            onArtistNameChange={handleArtistNameChange}
            stageNameFontSize={stageNameFontSize}
            stageNameWrapperRef={stageNameWrapperRef}
          />
        );
      case "bio":
        return <BioStep artistBio={artistBio} onArtistBioChange={onArtistBioChange} websiteUrl={creationWebsiteUrl} onWebsiteUrlChange={onWebsiteUrlChange} instagramUrl={creationInstagramUrl} onInstagramUrlChange={onInstagramUrlChange} />;
      case "tracks":
        return (
          <TracksStep
            tracks={tracks}
            onPrimaryUploadClick={() => trackFileInputRef.current?.click()}
            onTrackCoverUpload={handleTrackCoverUploadClick}
            onTrackTitleChange={handleTrackTitleChange}
            onTrackArtistChange={handleTrackArtistChange}
            onTrackRemove={handleTrackRemove}
            onTrackMove={handleTrackMove}
            disableReorder={tracks.length < 2}
            artistName={artistName}
            spotifyUrl={spotifyUrl}
            onSpotifyUrlChange={onSpotifyUrlChange}
            soundcloudUrl={soundcloudUrl}
            onSoundcloudUrlChange={onSoundcloudUrlChange}
            tracksUploadStatus={tracksUploadStatus}
            tracksUploadProgress={tracksUploadProgress}
          />
        );
      case "videos":
        return <VideosStep />;
      case "ready":
        return <ReviewStep artistName={artistName} />;
      default:
        return <PlaceholderStep />;
    }
  };

  const creationPanelsClass = [
    "creation-step-panels",
    previousStep ? "is-transitioning" : "",
  ]
    .filter(Boolean)
    .join(" ");

  const renderProgressDots = () => (
    <div className="creation-progress-dots">
      {CREATION_STEP_ORDER.map((stepId, index) => {
        const completed = index < currentStepIndex;
        const active = index === currentStepIndex;
        return (
          <span
            key={stepId}
            className={`progress-dot ${completed ? "filled" : ""} ${active ? "active" : ""}`}
          />
        );
      })}
    </div>
  );

  const actionsClassName = [
    "creation-box-actions",
    isCreating ? "" : "single",
    isCreating &&
    (
      (displayedStep === "hero-image" && !heroStepReady) ||
      (displayedStep === "tracks" && !trackStepReady)
    )
      ? "hidden"
      : "",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div 
      className="artist-profile-creation-box"
      ref={containerRef}
      style={{ height: containerHeight }}
    >
      <div ref={contentWrapperRef}>
        <div className="creation-box-header">
          <div className="creation-box-title">
            <GuitarsIcon />
            <h3>Your Artist Profile</h3>
          </div>
          {isCreating && renderProgressDots()}
        </div>
        <div className="creation-box-content">
        {!isCreating ? (
          <p>
            This is what your profile could look like. Create your own artist profile and start connecting with venues, booking gigs, and building your music career today!
          </p>
        ) : (
          <div className={creationPanelsClass}>
            {previousStep && (
              <div className={`creation-step-panel exit ${transitionDirection}`}>
                {renderStepPanel(previousStep)}
              </div>
            )}
            <div
              key={displayedStep}
              className={`creation-step-panel enter ${transitionDirection} ${
                previousStep ? "animating" : ""
              }`}
            >
              {renderStepPanel(displayedStep)}
            </div>
          </div>
        )}
      </div>

      <input
        type="file"
        accept="image/*"
        ref={heroFileInputRef}
        style={{ display: "none" }}
        onChange={handleHeroFileInputChange}
      />

      <input
        type="file"
        accept="audio/*"
        ref={trackFileInputRef}
        style={{ display: "none" }}
        onChange={handleTrackFileInputChange}
      />

      <input
        type="file"
        accept="image/*"
        ref={trackCoverInputRef}
        style={{ display: "none" }}
        onChange={handleTrackCoverFileChange}
      />

      <div className={actionsClassName}>
        {isCreating ? (
          <>
            <button
              className="btn tertiary creation-back-btn"
              type="button"
              onClick={handleBack}
              disabled={currentStepIndex === 0}
            >
              <LeftArrowIcon />
              Back
            </button>
            <button
              className="btn artist-profile"
              type="button"
              onClick={handleAdvance}
              disabled={isLoading}
            >
              {isLoading ? (
                <LoadingSpinner width={15} height={15} marginTop={0} marginBottom={0} color="white" />
              ) : (
                <>
                  {isFinalStep ? "Finish Profile" : "Next"} <RightArrowIcon />
                </>
              )}
            </button>
          </>
        ) : (
          <button className="btn artist-profile" onClick={handleAdvance} disabled={isLoading}>
            {!isLoading ? (
              <>
                Create Your Artist Profile <RightArrowIcon />
              </>
            ) : (
              <LoadingSpinner width={15} height={15} marginTop={0} marginBottom={0} color="white" />
            )}
          </button>
        )}
      </div>
      </div>
    </div>
  );
};

function HeroImageStep({
  heroImage,
  heroMode,
  heroBrightness,
  heroPosition,
  onHeroPositionChange,
  onHeroImageSelect,
  onHeroBrightnessChange,
  isRepositioningHero,
  onHeroRepositionToggle,
  heroUploadStatus,
  heroUploadProgress,
}) {
  if (!heroImage || heroMode === "upload") {
    return (
      <>
        <p className="creation-step-question">Upload your hero image. The best image you can find of you!</p>
        <button type="button" className="creation-hero-upload" onClick={onHeroImageSelect}>
          <NoImageIcon className="upload-icon" />
          <span>Choose Image</span>
        </button>
      </>
    );
  }

  return (
    <>
      <p className="creation-step-question">
        How does it look? Adjust the brightness of the image to your liking.
      </p>
      <div className="creation-hero-adjust">
        <div className="hero-image-actions">
          <button type="button" className="hero-edit-button" onClick={onHeroImageSelect}>
            <span>Change Image</span>
          </button>
          <button
            type="button"
            className={`hero-edit-button ${isRepositioningHero ? "active" : ""}`}
            onClick={() => onHeroRepositionToggle?.(!isRepositioningHero)}
          >
            <span>{isRepositioningHero ? "Save Position" : "Reposition Image"}</span>
          </button>
        </div>
        <div className="hero-brightness-control">
          <div className="brightness-header">
            <LightModeIcon />
            <span>Brightness</span>
          </div>
          <input
            className="hero-brightness-slider"
            type="range"
            min={60}
            max={140}
            value={heroBrightness}
            onChange={(e) => onHeroBrightnessChange?.(Number(e.target.value))}
          />
        </div>
      </div>
    </>
  );
}

function StageNameStep({
  artistName,
  onArtistNameChange,
  stageNameFontSize,
  stageNameWrapperRef,
}) {
  return (
    <>
      <p className="creation-step-question">What's your stage name?</p>
      <div className="creation-stage-name-wrapper" ref={stageNameWrapperRef}>
        <input
          id="artist-name-input"
          type="text"
          value={artistName}
          onChange={(e) => onArtistNameChange(e.target.value)}
          placeholder="Stage Name"
          className="creation-stage-name-input"
          style={{ fontSize: `${stageNameFontSize}px` }}
        />
      </div>
    </>
  );
}

function BioStep({ artistBio, onArtistBioChange, websiteUrl, onWebsiteUrlChange, instagramUrl, onInstagramUrlChange }) {
  return (
    <>
      <p className="creation-step-question">Write a bio for your profile.</p>
      <textarea
        className="creation-bio-textarea"
        value={artistBio}
        onChange={(e) => onArtistBioChange?.(e.target.value)}
        placeholder="Enter your profile bio here..."
        maxLength={150}
      />
      <div className="link-entries-container">
        <div className="link-entry-container website">
          <WebsiteIcon />
          <input 
            type="text" 
            placeholder="Your Website URL"
            value={websiteUrl}
            onChange={(e) => onWebsiteUrlChange?.(e.target.value)}
          />
        </div>
        <div className="link-entry-container instagram">
          <InstagramIcon />
          <input 
            type="text" 
            placeholder="Instagram URL" 
            value={instagramUrl}
            onChange={(e) => onInstagramUrlChange?.(e.target.value)}
          />
        </div>
      </div>
    </>
  );
}

function TracksStep({
  tracks,
  onPrimaryUploadClick,
  onTrackCoverUpload,
  onTrackTitleChange,
  onTrackArtistChange,
  onTrackRemove,
  onTrackMove,
  disableReorder,
  artistName,
  spotifyUrl = "",
  onSpotifyUrlChange,
  soundcloudUrl = "",
  onSoundcloudUrlChange,
  tracksUploadStatus = 'idle',
  tracksUploadProgress = 0,
}) {
  // Show loading message if tracks are uploading
  if (tracksUploadStatus === 'uploading') {
    return (
      <>
        <div style={{ 
          display: 'flex', 
          flexDirection: 'column', 
          alignItems: 'center', 
          gap: '1rem',
          padding: '2rem 0'
        }}>
          <LoadingSpinner />
          <p style={{ color: 'var(--gn-grey-600)', fontSize: '0.9rem' }}>
            {Math.round(tracksUploadProgress)}% Complete
          </p>
          <p style={{ color: 'var(--gn-grey-500)', fontSize: '0.85rem', textAlign: 'center', maxWidth: '400px' }}>
            Please wait while we upload your tracks and cover images. You can continue once the upload is complete.
          </p>
        </div>
      </>
    );
  }

  if (!tracks?.length) {
    return (
      <>
        <p className="creation-step-question">
          Upload tracks that best represent your live sound.
        </p>
        <button type="button" className="creation-hero-upload track" onClick={onPrimaryUploadClick}>
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
              value={spotifyUrl}
              onChange={(e) => onSpotifyUrlChange?.(e.target.value)}
            />
          </div>
          <div className="link-entry-container soundcloud">
            <SoundcloudIcon />
            <input 
              type="text" 
              placeholder="Soundcloud URL" 
              value={soundcloudUrl}
              onChange={(e) => onSoundcloudUrlChange?.(e.target.value)}
            />
          </div>
        </div>
        </>
    );
  }

  return (
    <>
      <p className="creation-step-question">Give them a listen and keep building your setlist.</p>
      <div className="tracks-list">
        {tracks.map((track, index) => (
          <div className="track-preview-card" key={track.id}>
            <button
              type="button"
              className="track-cover-button"
              onClick={() => onTrackCoverUpload(track.id)}
            >
              {track.coverUploadedUrl || track.coverPreviewUrl ? (
                <img
                  src={track.coverUploadedUrl || track.coverPreviewUrl}
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
                  value={track.title}
                  onChange={(e) => onTrackTitleChange(track.id, e.target.value)}
                  placeholder="Track title"
                />
                <EditIcon />
              </div>
              <p>{artistName}</p>
            </div>
            <div className="track-actions">
              <div className="track-reorder-buttons">
                <button
                  type="button"
                  onClick={() => onTrackMove(track.id, "up")}
                  disabled={disableReorder || index === 0}
                  aria-label="Move track up"
                >
                  <UpArrowIcon />
                </button>
                <button
                  type="button"
                  onClick={() => onTrackMove(track.id, "down")}
                  disabled={disableReorder || index === tracks.length - 1}
                  aria-label="Move track down"
                >
                  <DownArrowIcon />
                </button>
              </div>
              <button
                type="button"
                className="btn danger small"
                onClick={() => onTrackRemove(track.id)}
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
        onClick={onPrimaryUploadClick}
      >
        <VinylIcon /> Add Another Track
      </button>
      <div className="link-entries-container">
        <div className="link-entry-container spotify">
          <SpotifyIcon />
          <input 
            type="text" 
            placeholder="Spotify URL" 
            value={spotifyUrl}
            onChange={(e) => onSpotifyUrlChange?.(e.target.value)}
          />
        </div>
        <div className="link-entry-container soundcloud">
          <SoundcloudIcon />
          <input 
            type="text" 
            placeholder="Soundcloud URL" 
            value={soundcloudUrl}
            onChange={(e) => onSoundcloudUrlChange?.(e.target.value)}
          />
        </div>
      </div>
    </>
  );
}

function VideosStep() {
  return (
    <>
      <p className="creation-step-question">Upload or link two standout videos.</p>
      <ul className="creation-tip-list">
        <li>Short clips (under 60s) keep venues engaged.</li>
        <li>Use Vimeo, YouTube or direct MP4 links.</li>
        <li>You can reorder media later.</li>
      </ul>
    </>
  );
}

function ReviewStep({ artistName }) {
  return (
    <>
      <p className="creation-step-question">Nice! Give everything a quick review before publishing.</p>
      <div className="creation-summary">
        <p><strong>Artist name:</strong> {artistName || "Not set yet"}</p>
        <p><strong>Media:</strong> Add videos & tracks next.</p>
      </div>
    </>
  );
}

function PlaceholderStep() {
  return (
    <div className="creation-placeholder-card">
      This step is on its way. Sit tight!
    </div>
  );
}
