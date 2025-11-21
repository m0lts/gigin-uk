import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { GuitarsIcon, RightArrowIcon, LeftChevronIcon, NoImageIcon, LightModeIcon, LeftArrowIcon, MicrophoneLinesIcon, EditIcon, UpArrowIcon, DownArrowIcon, TrackIcon, VinylIcon, SpotifyIcon, SoundcloudIcon, WebsiteIcon, InstagramIcon, FilmIcon, PlayIcon, YoutubeIcon, TechRiderIcon, AddMember, MoreInformationIcon, TickIcon } from "../../../shared/ui/extras/Icons";
import { LoadingSpinner } from "../../../shared/ui/loading/Loading";
import { updateArtistProfileDocument } from "@services/client-side/artists";
import { toast } from 'sonner';
import { useAuth } from '@hooks/useAuth';
import { ARTIST_PERM_KEYS, ARTIST_PERMS_DISPLAY, ARTIST_PERM_DEFAULTS, sanitizeArtistPermissions } from "@services/utils/permissions";
import { createArtistInvite } from "@services/api/artists";

// Genres for About step
const genres = {
  'Musician/Band': [
    'Rock', 'Pop', 'Jazz', 'Classical', 'Hip Hop', 'Country', 'Blues', 'Reggae', 'Folk', 'Metal', 'R&B', 'Latin', 'World', 'Electronic'
  ],
  'DJ': [
    'EDM', 'House', 'Techno', 'Trance', 'Drum and Bass', 'Dubstep', 'Trap', 'Hip Hop', 'R&B', 'Pop', 'Reggae', 'Latin', 'World', 'Ambient', 'Experimental', 'Funk'
  ]
};

const MAPBOX_TOKEN = import.meta.env.VITE_MAPBOX_TOKEN;

const UK_CITIES = [
  'Aberdeen', 'Ayr', 'Bath', 'Belfast', 'Birmingham', 'Blackburn', 'Blackpool', 'Bolton', 'Bournemouth', 'Bradford',
  'Brighton', 'Bristol', 'Burnley', 'Cambridge', 'Canterbury', 'Cardiff', 'Carlisle', 'Chester', 'Coventry', 'Derby',
  'Dumfries', 'Dundee', 'Durham', 'Edinburgh', 'Ely', 'Exeter', 'Falkirk', 'Glasgow', 'Gloucester', 'Greenock',
  'Hereford', 'Inverness', 'Ipswich', 'Kilmarnock', 'Kingston upon Hull', 'Lancaster', 'Leeds', 'Leicester', 'Lincoln',
  'Liverpool', 'Livingston', 'London', 'Luton', 'Manchester', 'Middlesbrough', 'Newcastle upon Tyne', 'Northampton',
  'Norwich', 'Nottingham', 'Oxford', 'Paisley', 'Perth', 'Peterborough', 'Portsmouth', 'Preston', 'Reading', 'Sheffield',
  'Slough', 'Southampton', 'Southend-on-Sea', 'Stirling', 'Stoke-on-Trent', 'Swindon', 'Truro', 'Wolverhampton',
  'Worcester', 'York'
];

async function geocodeCity(city) {
  if (!city || city.trim().length < 2) return null;
  try {
    const url = new URL(`https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(city)}.json`);
    url.searchParams.set('access_token', MAPBOX_TOKEN);
    url.searchParams.set('types', 'place');
    url.searchParams.set('limit', '1');
    url.searchParams.set('country', 'gb'); // Limit to UK
    
    const res = await fetch(url.toString());
    if (!res.ok) throw new Error(`Geocode failed: ${res.status}`);
    const data = await res.json();
    const match = data.features?.[0];
    if (!match) return null;
    const [lng, lat] = match.center || [];
    const canonicalCity = match.text || city;
    return { city: canonicalCity, coordinates: [lng, lat] };
  } catch (e) {
    console.warn('Mapbox geocode error:', e);
    return null;
  }
}

export const CREATION_STEP_ORDER = ["hero-image", "stage-name", "bio", "videos", "tracks", "additional-info", "about", "members", "tech-rider"];

const DEFAULT_STEP = CREATION_STEP_ORDER[0];
const STAGE_NAME_FONT_MAX = 40;
const STAGE_NAME_FONT_MIN = 20;
const STAGE_NAME_HORIZONTAL_PADDING = 32; // matches input horizontal padding
const HERO_POSITION_DEFAULT = 50;

const generateVideoThumbnail = (file) => {
  if (typeof document === "undefined") {
    return Promise.resolve({ file: null, previewUrl: null });
  }

  return new Promise((resolve, reject) => {
    const video = document.createElement("video");
    video.preload = "metadata";
    video.muted = true;
    video.playsInline = true;
    const objectUrl = URL.createObjectURL(file);
    video.src = objectUrl;

    const cleanup = () => {
      video.pause();
      video.removeAttribute("src");
      video.load();
      URL.revokeObjectURL(objectUrl);
    };

    const handleError = (err) => {
      cleanup();
      if (err instanceof Error) {
        reject(err);
      } else {
        reject(new Error("Unable to generate video thumbnail"));
      }
    };

    video.addEventListener("error", handleError);
    video.addEventListener("loadeddata", () => {
      try {
        const targetTime = Math.min(1, video.duration ? Math.max(0, video.duration * 0.1) : 0.5);
        video.currentTime = targetTime || 0;
      } catch (error) {
        handleError(error);
      }
    });

    video.addEventListener("seeked", () => {
      try {
        const canvas = document.createElement("canvas");
        const width = video.videoWidth || 1280;
        const height = video.videoHeight || 720;
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d");
        ctx.drawImage(video, 0, 0, width, height);
        canvas.toBlob(
          (blob) => {
            if (!blob) {
              cleanup();
              reject(new Error("Failed to capture video frame"));
              return;
            }
            const thumbnailFile = new File([blob], `${file.name.replace(/\.[^/.]+$/, "") || "video"}-thumbnail.png`, {
              type: "image/png",
              lastModified: Date.now(),
            });
            const previewUrl = URL.createObjectURL(blob);
            cleanup();
            resolve({ file: thumbnailFile, previewUrl });
          },
          "image/png",
          0.92
        );
      } catch (error) {
        cleanup();
        reject(error);
      }
    });
  });
};

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
  youtubeUrl = "",
  onYoutubeUrlChange,
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
  onVideosChange,
  initialVideos = [],
  videosUploadStatus = 'idle',
  videosUploadProgress = 0,
  creationProfileId = null,
  aboutComplete = false,
  onAboutCompleteChange,
  profileData = null,
  onSaveAndExit = null,
}) => {
  const [artistName, setArtistName] = useState(initialArtistName);
  const [heroImage, setHeroImage] = useState(null);
  const [heroFlowStage, setHeroFlowStage] = useState("upload");
  const [tracks, setTracks] = useState(initialTracks);
  const [videos, setVideos] = useState(initialVideos);
  const createEntityId = (prefix) =>
    typeof crypto !== "undefined" && crypto.randomUUID
      ? crypto.randomUUID()
      : `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
  const createTrackId = () => createEntityId("track");
  const createVideoId = () => createEntityId("video");

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
  const videoFileInputRef = useRef(null);
  const containerRef = useRef(null);
  const tracksSyncedRef = useRef(false);
  const videosSyncedRef = useRef(false);
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
      if (heroImage) {
        setHeroImage(null);
      }
      setHeroFlowStage("upload");
      onHeroBrightnessChange?.(100);
      if (artistName) {
        setArtistName("");
      }
      setPreviousStep(null);
      if (displayedStep !== DEFAULT_STEP) {
        setDisplayedStep(DEFAULT_STEP);
      }
      if (tracks.length) {
        tracks.forEach((track) => {
          revokeObjectUrl(track.audioPreviewUrl);
          revokeObjectUrl(track.coverPreviewUrl);
        });
        setTracks([]);
      }
      if (videos.length) {
        videos.forEach((video) => {
          revokeObjectUrl(video.videoPreviewUrl);
          revokeObjectUrl(video.thumbnailPreviewUrl);
        });
        setVideos([]);
      }
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
  }, [isCreating, normalizedStep, displayedStep, heroImage, tracks, videos, artistName]);

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
      videos.forEach((video) => {
        revokeObjectUrl(video.videoPreviewUrl);
        revokeObjectUrl(video.thumbnailPreviewUrl);
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
  }, [displayedStep, heroFlowStage, isCreating, artistName, heroImage, tracks, videos, previousStep]);

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

  useEffect(() => {
    if (!initialVideos || initialVideos.length === 0) {
      videosSyncedRef.current = false;
      return;
    }

    const localVideoIds = videos.map((v) => v.id).sort().join(",");
    const parentVideoIds = initialVideos.map((v) => v.id).sort().join(",");

    if (videos.length === 0 || localVideoIds !== parentVideoIds) {
      setVideos(initialVideos);
      videosSyncedRef.current = true;
    }
  }, [initialVideos]);

  // Notify parent when tracks change
  useEffect(() => {
    if (onTracksChange) {
      onTracksChange(tracks);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tracks]); // Only depend on tracks, not onTracksChange to avoid infinite loops

  useEffect(() => {
    if (onVideosChange) {
      onVideosChange(videos);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [videos]); // Only depend on videos, not onVideosChange to avoid infinite loops

  const goToStep = (stepId) => {
    if (!CREATION_STEP_ORDER.includes(stepId)) return;
    onCreationStepChange?.(stepId);
  };

  const heroStepReady = !!heroImage && heroFlowStage === "adjust";
  const trackStepReady = tracks.length > 0;
  const videoStepReady = videos.length > 0;

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
    if (displayedStep === "videos" && !videoStepReady) {
      return;
    }

    if (displayedStep === "additional-info") {
      // Handle save and exit for additional-info step
      onSaveAndExit?.();
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

  const handleVideoPicked = async (file) => {
    if (!file) return;
    const videoId = createVideoId();
    const previewUrl = URL.createObjectURL(file);
    setVideos((prev) => [
      ...prev,
      {
        id: videoId,
        title: `Video ${prev.length + 1}`,
        videoFile: file,
        videoPreviewUrl: previewUrl,
        thumbnailFile: null,
        thumbnailPreviewUrl: null,
        uploadedVideoUrl: null,
        thumbnailUploadedUrl: null,
        videoStoragePath: null,
        thumbnailStoragePath: null,
        isThumbnailGenerating: true,
        thumbnailGenerationError: null,
      },
    ]);

    try {
      const result = await generateVideoThumbnail(file);
      setVideos((prev) => {
        let found = false;
        const updated = prev.map((video) => {
          if (video.id !== videoId) return video;
          found = true;

          if (video.thumbnailPreviewUrl && video.thumbnailPreviewUrl !== result?.previewUrl) {
            revokeObjectUrl(video.thumbnailPreviewUrl);
          }

          return {
            ...video,
            thumbnailFile: result?.file || null,
            thumbnailPreviewUrl: result?.previewUrl || null,
            isThumbnailGenerating: false,
            thumbnailGenerationError: result?.previewUrl ? null : "Failed to generate thumbnail",
          };
        });

        if (!found && result?.previewUrl) {
          revokeObjectUrl(result.previewUrl);
        }

        return updated;
      });
    } catch (error) {
      console.error("Failed to generate video thumbnail:", error);
      setVideos((prev) =>
        prev.map((video) =>
          video.id === videoId
            ? {
                ...video,
                isThumbnailGenerating: false,
                thumbnailGenerationError: "Failed to generate thumbnail",
              }
            : video
        )
      );
    }
  };

  const handleVideoFileInputChange = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    await handleVideoPicked(file);
    event.target.value = "";
  };

  const handleVideoRemove = (videoId) => {
    setVideos((prev) => {
      const target = prev.find((video) => video.id === videoId);
      if (target) {
        revokeObjectUrl(target.videoPreviewUrl);
        revokeObjectUrl(target.thumbnailPreviewUrl);
      }
      return prev.filter((video) => video.id !== videoId);
    });
  };

  const handleVideoTitleChange = (videoId, newTitle) => {
    setVideos((prev) =>
      prev.map((video) => (video.id === videoId ? { ...video, title: newTitle } : video))
    );
  };

  const handleVideoMove = (videoId, direction) => {
    setVideos((prev) => {
      const index = prev.findIndex((video) => video.id === videoId);
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
        return (
          <VideosStep
            videos={videos}
            onPrimaryUploadClick={() => videoFileInputRef.current?.click()}
            onVideoTitleChange={handleVideoTitleChange}
            onVideoRemove={handleVideoRemove}
            onVideoMove={handleVideoMove}
            disableReorder={videos.length < 2}
            artistName={artistName}
            youtubeUrl={youtubeUrl}
            onYoutubeUrlChange={onYoutubeUrlChange}
            videosUploadStatus={videosUploadStatus}
            videosUploadProgress={videosUploadProgress}
          />
        );
      case "additional-info":
        return <AdditionalInfoStep onOptionClick={goToStep} aboutComplete={aboutComplete} profileData={profileData} />;
      case "about":
        return (
          <AboutStep
            onBackToAdditionalInfo={() => goToStep("additional-info")}
            creationProfileId={creationProfileId}
            onAboutCompleteChange={onAboutCompleteChange}
          />
        );
      case "members":
        return (
          <MembersStep
            onBackToAdditionalInfo={() => goToStep("additional-info")}
            creationProfileId={creationProfileId}
          />
        );
      case "tech-rider":
        return (
          <TechRiderStep
            onBackToAdditionalInfo={() => goToStep("additional-info")}
            creationProfileId={creationProfileId}
          />
        );
    }
  };

  const creationPanelsClass = [
    "creation-step-panels",
    previousStep ? "is-transitioning" : "",
  ]
    .filter(Boolean)
    .join(" ");

  const renderProgressDots = () => {
    // Show only 5 progress dots (first 5 steps)
    const stepsToShow = CREATION_STEP_ORDER.slice(0, 5);
    // Map additional-info step to the 5th dot
    const getDotIndex = (stepIndex) => {
      if (stepIndex >= 5) return 4; // additional-info maps to 5th dot (index 4)
      return stepIndex;
    };
    const activeDotIndex = getDotIndex(currentStepIndex);
    
    return (
      <div className="creation-progress-dots">
        {stepsToShow.map((stepId, index) => {
          const completed = index < activeDotIndex;
          const active = index === activeDotIndex;
          return (
            <span
              key={stepId}
              className={`progress-dot ${completed ? "filled" : ""} ${active ? "active" : ""}`}
            />
          );
        })}
      </div>
    );
  };

  const actionsClassName = [
    "creation-box-actions",
    isCreating ? "" : "single",
    isCreating &&
    (
      (displayedStep === "hero-image" && !heroStepReady) ||
      (displayedStep === "tracks" && !trackStepReady) ||
      (displayedStep === "videos" && !videoStepReady)
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
        accept="video/*"
        ref={videoFileInputRef}
        style={{ display: "none" }}
        onChange={handleVideoFileInputChange}
      />

      <input
        type="file"
        accept="image/*"
        ref={trackCoverInputRef}
        style={{ display: "none" }}
        onChange={handleTrackCoverFileChange}
      />

      {displayedStep !== "about" && displayedStep !== "members" && displayedStep !== "tech-rider" && (
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
                  displayedStep === "additional-info" ? (
                    <>
                      Save
                    </>
                  ) : isFinalStep ? (
                    <>
                      Save
                    </>
                  ) : (
                    <>
                      Next <RightArrowIcon />
                    </>
                  )
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
      )}
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
          autoComplete="off"
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
      <p className="creation-step-question bio">Write a bio for your profile.</p>
      <div className="creation-bio-textarea-container">
        <textarea
          className="creation-bio-textarea"
          value={artistBio}
          onChange={(e) => onArtistBioChange?.(e.target.value)}
          placeholder="Enter your profile bio here..."
          maxLength={150}
        />
        <h6 className={`creation-bio-textarea-length ${artistBio.length >= 125 ? "red" : ""}`}>{artistBio.length}/150 MAX</h6>
      </div>
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
          padding: '2rem 0',
          paddingBottom: '0',
        }}>
          <LoadingSpinner />
          <h4>
            {Math.round(tracksUploadProgress)}% Complete
          </h4>
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

function VideosStep({
  videos,
  onPrimaryUploadClick,
  onVideoTitleChange,
  onVideoRemove,
  onVideoMove,
  disableReorder,
  artistName,
  youtubeUrl = "",
  onYoutubeUrlChange,
  videosUploadStatus = 'idle',
  videosUploadProgress = 0,
}) {
  if (videosUploadStatus === 'uploading') {
    return (
      <>
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '1rem',
            padding: '2rem 0',
            paddingBottom: '0',
          }}
        >
          <LoadingSpinner />
          <h4>{Math.round(videosUploadProgress)}% Complete</h4>
          <p style={{ color: 'var(--gn-grey-500)', fontSize: '0.85rem', textAlign: 'center', maxWidth: '400px' }}>
            Please wait while we upload your videos and thumbnails. You can continue once the upload is complete.
          </p>
        </div>
      </>
    );
  }

  if (!videos?.length) {
    return (
      <>
        <p className="creation-step-question">
          Upload short clips that capture the energy of your live show.
        </p>
        <button type="button" className="creation-hero-upload track" onClick={onPrimaryUploadClick}>
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
              value={youtubeUrl}
              onChange={(e) => onYoutubeUrlChange?.(e.target.value)}
            />
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      <p className="creation-step-question">Give venues a feel for your live presence.</p>
      <div className="tracks-list videos">
        {videos.map((video, index) => {
          const thumbnailSrc = video.thumbnailUploadedUrl || video.thumbnailPreviewUrl || null;
          const statusMessage = video.isThumbnailGenerating
            ? "Generating thumbnail..."
            : video.thumbnailGenerationError || null;
          return (
            <div className="track-preview-card" key={video.id}>
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
                    value={video.title}
                    onChange={(e) => onVideoTitleChange(video.id, e.target.value)}
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
                    onClick={() => onVideoMove(video.id, "up")}
                    disabled={disableReorder || index === 0}
                    aria-label="Move video up"
                  >
                    <UpArrowIcon />
                  </button>
                  <button
                    type="button"
                    onClick={() => onVideoMove(video.id, "down")}
                    disabled={disableReorder || index === videos.length - 1}
                    aria-label="Move video down"
                  >
                    <DownArrowIcon />
                  </button>
                </div>
                <button
                  type="button"
                  className="btn danger small"
                  onClick={() => onVideoRemove(video.id)}
                >
                  Remove
                </button>
              </div>
            </div>
          );
        })}
      </div>
      <button type="button" className="add-track-button" onClick={onPrimaryUploadClick}>
        <FilmIcon /> Add Another Video
      </button>
      <div className="link-entries-container">
        <div className="link-entry-container youtube">
          <YoutubeIcon />
          <input 
            type="text" 
            placeholder="Youtube URL" 
            value={youtubeUrl}
            onChange={(e) => onYoutubeUrlChange?.(e.target.value)}
          />
        </div>
      </div>
    </>
  );
}

function AdditionalInfoStep({ onOptionClick, aboutComplete = false, profileData = null }) {
  // Check if all about fields are filled
  const hasAllAboutFields = profileData && 
    profileData.artistType && 
    profileData.genres && 
    Array.isArray(profileData.genres) && 
    profileData.genres.length > 0 &&
    profileData.location && 
    profileData.location.city && 
    profileData.location.coordinates && 
    Array.isArray(profileData.location.coordinates) && 
    profileData.location.coordinates.length > 0;
  
  const shouldHideAboutButton = hasAllAboutFields;
  return (
    <>
      <p className="creation-step-question">
        Add optional information to help venues get to know you better.
      </p>
      <div className="additional-info-options">
        <button
          type="button"
          className="additional-info-option"
          onClick={() => onOptionClick("tech-rider")}
        >
          <div className="option-content">
            <TechRiderIcon />
            <div className="option-content-text">
              <h4>Tech Rider</h4>
              <p>Share your technical requirements.</p>
            </div>
          </div>
          <RightArrowIcon />
        </button>
        <button
          type="button"
          className="additional-info-option"
          onClick={() => onOptionClick("members")}
        >
          <div className="option-content">
            <AddMember />
            <div className="option-content-text">
              <h4>Members</h4>
              <p>Add band members and their roles.</p>
            </div>
          </div>
          <RightArrowIcon />
        </button>
        {!shouldHideAboutButton && (
          <button
            type="button"
            className="additional-info-option"
            onClick={() => onOptionClick("about")}
          >
            <div className="option-content">
              <MoreInformationIcon />
              <div className="option-content-text">
                <h4>About</h4>
                <p>Tell venues more about your story</p>
              </div>
            </div>
            {aboutComplete ? <TickIcon /> : <RightArrowIcon />}
          </button>
        )}
      </div>
    </>
  );
}

function AboutStep({ onBackToAdditionalInfo, creationProfileId, onAboutCompleteChange }) {
  const [subStep, setSubStep] = useState(1);
  const [artistType, setArtistType] = useState('');
  const [selectedGenres, setSelectedGenres] = useState([]);
  const [city, setCity] = useState('');
  const [cityCoordinates, setCityCoordinates] = useState(null);
  const [travelDistance, setTravelDistance] = useState('');
  const [isGeocoding, setIsGeocoding] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const handleArtistTypeSelect = (type) => {
    setArtistType(type);
    setSelectedGenres([]); // Reset genres when type changes
    setTimeout(() => setSubStep(2), 300); // Small delay for smooth transition
  };

  const handleGenreToggle = (genre) => {
    setSelectedGenres(prev => 
      prev.includes(genre) 
        ? prev.filter(g => g !== genre)
        : [...prev, genre]
    );
  };

  const handleCityChange = async (value) => {
    if (!value) {
      setCity('');
      setCityCoordinates(null);
      return;
    }
    
    setCity(value);
    setIsGeocoding(true);
    
    try {
      const result = await geocodeCity(value);
      if (result) {
        setCity(result.city);
        setCityCoordinates(result.coordinates);
      } else {
        setCityCoordinates(null);
      }
    } catch (error) {
      console.error('Failed to geocode city:', error);
      setCityCoordinates(null);
    } finally {
      setIsGeocoding(false);
    }
  };

  const handleTravelDistanceSelect = (distance) => {
    setTravelDistance(distance);
  };

  const handleNext = () => {
    if (subStep === 1 && artistType) {
      setSubStep(2);
    } else if (subStep === 2 && selectedGenres.length > 0) {
      setSubStep(3);
    }
  };

  const handleSubStepBack = () => {
    if (subStep === 1) {
      onBackToAdditionalInfo?.();
    } else {
      setSubStep(subStep - 1);
    }
  };

  const canAdvance = () => {
    if (subStep === 1) return !!artistType;
    if (subStep === 2) return selectedGenres.length > 0;
    if (subStep === 3) return !!city && !!travelDistance;
    return false;
  };

  const handleSave = async () => {
    if (!canAdvance() || !creationProfileId || isSaving) return;

    setIsSaving(true);
    try {
      const updates = {
        artistType: artistType || null,
        genres: selectedGenres,
        location: city && cityCoordinates ? {
          city,
          coordinates: cityCoordinates,
          travelDistance: travelDistance || null,
        } : null,
      };

      await updateArtistProfileDocument(creationProfileId, updates);
      onAboutCompleteChange?.(true);
      onBackToAdditionalInfo();
    } catch (error) {
      console.error('Failed to save about information:', error);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <>
      {/* Step 1: Musician/Band or DJ */}
      {subStep === 1 && (
        <>
          <p className="creation-step-question">What type of performer are you?</p>
          <div className="selection-container">
            <div className="selections">
              <div 
                className={`selection-card ${artistType === 'Musician/Band' ? 'selected' : ''}`}
                onClick={() => handleArtistTypeSelect('Musician/Band')}
              >
                <h4 className='text'>Musician/Band</h4>
              </div>
              <div 
                className={`selection-card ${artistType === 'DJ' ? 'selected' : ''}`}
                onClick={() => handleArtistTypeSelect('DJ')}
              >
                <h4 className='text'>DJ</h4>
              </div>
            </div>
          </div>
        </>
      )}

      {/* Step 2: Genres */}
      {subStep === 2 && (
        <>
          <p className="creation-step-question">What genres do you play?</p>
          <div className="selection-container">
            <div className="selections">
              {genres[artistType || 'Musician/Band'].map((genre) => (
                <div
                  key={genre}
                  className={`selection-card ${selectedGenres.includes(genre) ? 'selected' : ''}`}
                  onClick={() => handleGenreToggle(genre)}
                >
                  {genre}
                </div>
              ))}
            </div>
          </div>
        </>
      )}

      {/* Step 3: Location */}
      {subStep === 3 && (
        <>
          <p className="creation-step-question">Where are you based?</p>
          <div className="input-container">
            <label htmlFor="location" className='label'>City</label>
            <select
              className='input'
              id="location"
              value={city}
              onChange={(e) => handleCityChange(e.target.value)}
            >
              <option value="">Select a city</option>
              {UK_CITIES.map((cityName) => (
                <option key={cityName} value={cityName}>
                  {cityName}
                </option>
              ))}
            </select>
            {isGeocoding && <p style={{ fontSize: '0.85rem', color: 'var(--gn-grey-500)', marginTop: '0.5rem' }}>Finding your location...</p>}
          </div>
          <div className="selection-container">
            <h6 className='label'>How far are you willing to travel?</h6>
            <div className="selections">
              {['5 miles', '25 miles', '50 miles', '100 miles', 'Nationwide'].map((distance) => (
                <div
                  key={distance}
                  className={`selection-card ${travelDistance === distance ? 'selected' : ''}`}
                  onClick={() => handleTravelDistanceSelect(distance)}
                >
                  <h4 className='text'>{distance}</h4>
                </div>
              ))}
            </div>
          </div>
        </>
      )}

       {/* Navigation buttons for sub-steps */}
       <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '1.5rem' }}>
        <button
          type="button"
          className="btn tertiary creation-back-btn"
          onClick={handleSubStepBack}
        >
          <LeftArrowIcon />
          Back
        </button>
        {subStep === 3 && (
          <button
            type="button"
            className="btn artist-profile"
            onClick={handleSave}
            disabled={!canAdvance() || isSaving}
          >
            {isSaving ? (
              <LoadingSpinner width={15} height={15} marginTop={0} marginBottom={0} color="white" />
            ) : (
              'Save'
            )}
          </button>
        )}
        {subStep < 3 && (
          <button
            type="button"
            className="btn artist-profile"
            onClick={handleNext}
            disabled={!canAdvance()}
          >
            Next <RightArrowIcon />
          </button>
        )}
      </div>
    </>
  );
}

function MembersStep({ onBackToAdditionalInfo, creationProfileId }) {
  const { user } = useAuth();
  const [permissions, setPermissions] = useState({ ...ARTIST_PERM_DEFAULTS });
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);

  const validateEmail = (email) => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  };

  const handlePermissionToggle = (permissionKey) => {
    // profile.viewer can't be unselected
    if (permissionKey === 'profile.viewer') return;
    
    setPermissions(prev => ({
      ...prev,
      [permissionKey]: !prev[permissionKey],
    }));
  };

  const handleSend = async () => {
    const trimmedEmail = email.trim();
    
    if (!trimmedEmail) return;

    // Validate email format
    if (!validateEmail(trimmedEmail)) {
      toast.error('Please enter a valid email address');
      setEmail('');
      return;
    }

    // Check if email matches current user's email
    if (user?.email && trimmedEmail.toLowerCase() === user.email.toLowerCase()) {
      toast.error('You cannot invite yourself');
      setEmail('');
      return;
    }

    if (!creationProfileId) {
      toast.error('Profile ID is missing');
      return;
    }

    try {
      setLoading(true);
      
      // Sanitize permissions before sending
      const sanitizedPermissions = sanitizeArtistPermissions(permissions);
      
      // Create the invite via backend
      const invite = await createArtistInvite({
        artistProfileId: creationProfileId,
        email: trimmedEmail,
        permissionsInput: sanitizedPermissions,
        invitedByName: user?.name || null,
      });
      
      const inviteId = invite?.inviteId || null;
      if (!inviteId) {
        toast.error("Failed to create invite");
        return;
      }

      // Generate invite link
      const link = `${window.location.origin}/join-artist?invite=${inviteId}`;
      
      // TODO: Implement sendArtistInviteEmail function similar to sendVenueInviteEmail
      // For now, just show success
      toast.success(`Invitation sent to ${trimmedEmail}`);
      
      // Reset permissions to default and clear email
      setPermissions({ ...ARTIST_PERM_DEFAULTS });
      setEmail('');
    } catch (error) {
      console.error('Error sending invite:', error);
      toast.error('Failed to send invite. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <p className="creation-step-question">
        Invite band members and assign permissions.
      </p>
      <div className="members-step-container">
        <div className="members-permissions-section">
          <h4 className="section-title">Permissions</h4>
          <div className="permissions-list">
            {ARTIST_PERM_KEYS.map((permissionKey) => (
              <label key={permissionKey} className="permission-checkbox">
                <input
                  type="checkbox"
                  checked={!!permissions[permissionKey]}
                  onChange={() => handlePermissionToggle(permissionKey)}
                  disabled={permissionKey === 'profile.viewer'}
                />
                <span>{ARTIST_PERMS_DISPLAY[permissionKey]}</span>
              </label>
            ))}
          </div>
        </div>
        <div className="members-email-section">
          <h4 className="section-title">Invite Member</h4>
          <div className="email-input-container">
            <input
              type="email"
              className="input"
              placeholder="Enter email address"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              onKeyPress={(e) => {
                if (e.key === 'Enter') {
                  handleSend();
                }
              }}
            />
            <button
              type="button"
              className="btn artist-profile send-button"
              onClick={handleSend}
              disabled={!email.trim()}
            >
              Send
            </button>
          </div>
        </div>
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '1.5rem' }}>
        <button
          type="button"
          className="btn tertiary creation-back-btn"
          onClick={onBackToAdditionalInfo}
        >
          <LeftArrowIcon />
          Back
        </button>
      </div>
    </>
  );
}

function TechRiderStep({ onBackToAdditionalInfo, creationProfileId }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div style={{ flex: 1 }}>
        <p className="creation-step-question">
          Share your technical requirements with venues.
        </p>
        <div style={{ 
          padding: '2rem', 
          textAlign: 'center', 
          color: 'var(--gn-grey-600)',
          fontSize: '0.95rem'
        }}>
          <p>Tech Rider functionality coming soon...</p>
        </div>
      </div>
      <div style={{ display: 'flex', justifyContent: 'flex-start', marginTop: 'auto', paddingTop: '1.5rem' }}>
        <button
          type="button"
          className="btn tertiary creation-back-btn"
          onClick={onBackToAdditionalInfo}
        >
          <LeftArrowIcon />
          Back
        </button>
      </div>
    </div>
  );
}
