import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { GuitarsIcon, RightArrowIcon, LeftChevronIcon, NoImageIcon, LightModeIcon, LeftArrowIcon, MicrophoneLinesIcon, EditIcon, UpArrowIcon, DownArrowIcon, TrackIcon, VinylIcon, SpotifyIcon, SoundcloudIcon, WebsiteIcon, InstagramIcon, FilmIcon, PlayIcon, YoutubeIcon, TechRiderIcon, AddMember, MoreInformationIcon, TickIcon, PlusIconSolid, CloseIcon, VocalsIcon, DrumsIcon, KeysIcon, BassIcon, SaxIcon, TrumpetIcon, TromboneIcon, PlaybackIcon, MusicianIconSolid } from "../../../shared/ui/extras/Icons";
import { LoadingSpinner } from "../../../shared/ui/loading/Loading";
import { updateArtistProfileDocument, getArtistProfileMembers } from "@services/client-side/artists";
import { toast } from 'sonner';
import { useAuth } from '@hooks/useAuth';
import { ARTIST_PERM_KEYS, ARTIST_PERMS_DISPLAY, ARTIST_PERM_DEFAULTS, sanitizeArtistPermissions } from "@services/utils/permissions";
import { createArtistInvite } from "@services/api/artists";
import { sendArtistInviteEmail } from "@services/client-side/emails";

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

// Instrument types for tech rider
const INSTRUMENT_TYPES = [
  'Vocals',
  'Drums',
  'Keys',
  'Guitar',
  'Bass',
  'Tenor Sax',
  'Alto Sax',
  'Soprano Sax',
  'Trumpet',
  'Trombone',
  'Other',
  'Playback'
];

// Instrument-specific question configurations
const INSTRUMENT_QUESTIONS = {
  'Vocals': [
    { key: 'needsMic', type: 'yesno', label: 'Needs mic provided?', notes: true },
    { key: 'needsPowerSockets', type: 'number', label: 'Need power socket(s)?', notes: true },
    { key: 'extraNotes', type: 'text', label: 'Extra notes' }
  ],
  'Drums': [
    { key: 'needsDrumKit', type: 'yesno', label: 'Need drum kit provided?', notes: true },
    { key: 'needsCymbals', type: 'yesno', label: 'Need cymbals provided?', notes: true },
    { key: 'singing', type: 'yesno', label: 'Singing?', notes: false },
    { key: 'needsMic', type: 'yesno', label: 'Needs mic provided?', notes: true, dependsOn: { key: 'singing', value: true } },
    { key: 'needsPowerSockets', type: 'number', label: 'Need power socket(s)?', notes: true },
    { key: 'extraNotes', type: 'text', label: 'Extra notes' }
  ],
  'Keys': [
    { key: 'bringingKeyboard', type: 'yesno', label: 'Bringing keyboard?', notes: false },
    { key: 'needsDI', type: 'yesno', label: 'Need DI?', notes: true },
    { key: 'needsKeyboardStand', type: 'yesno', label: 'Need keyboard stand provided?', notes: true },
    { key: 'hasSeat', type: 'yesno', label: 'Need seat provided?', notes: false },
    { key: 'singing', type: 'yesno', label: 'Singing?', notes: false },
    { key: 'needsMic', type: 'yesno', label: 'Mic Needed?', notes: true, dependsOn: { key: 'singing', value: true } },
    { key: 'needsPowerSockets', type: 'number', label: 'Need power socket(s)?', notes: true },
    { key: 'extraNotes', type: 'text', label: 'Extra notes' }
  ],
  'Guitar': [
    { key: 'bringingInstrument', type: 'yesno', label: 'Bringing instrument?', notes: false },
    { key: 'needsAmp', type: 'yesno', label: 'Need amp provided?', notes: true },
    { key: 'needsDI', type: 'yesno', label: 'Need DI?', notes: true },
    { key: 'singing', type: 'yesno', label: 'Singing?', notes: false },
    { key: 'needsMic', type: 'yesno', label: 'Mic Needed?', notes: true, dependsOn: { key: 'singing', value: true } },
    { key: 'needsPowerSockets', type: 'number', label: 'Need power socket(s)?', notes: true },
    { key: 'extraNotes', type: 'text', label: 'Extra notes' }
  ],
  'Bass': [
    { key: 'bringingInstrument', type: 'yesno', label: 'Bringing instrument?', notes: false },
    { key: 'needsAmp', type: 'yesno', label: 'Need amp provided?', notes: true },
    { key: 'needsDI', type: 'yesno', label: 'Need DI?', notes: true },
    { key: 'singing', type: 'yesno', label: 'Singing?', notes: false },
    { key: 'needsMic', type: 'yesno', label: 'Mic Needed?', notes: true, dependsOn: { key: 'singing', value: true } },
    { key: 'needsPowerSockets', type: 'number', label: 'Need power socket(s)?', notes: true },
    { key: 'extraNotes', type: 'text', label: 'Extra notes' }
  ],
  'Tenor Sax': [
    { key: 'bringingInstrument', type: 'yesno', label: 'Bringing instrument?', notes: false },
    { key: 'needsMic', type: 'yesno', label: 'Need mic provided? (in case horns need amplification)', notes: true },
    { key: 'singing', type: 'yesno', label: 'Singing?', notes: false },
    { key: 'needsMicForSinging', type: 'yesno', label: 'Mic Needed?', notes: true, dependsOn: { key: 'singing', value: true } },
    { key: 'needsPowerSockets', type: 'number', label: 'Need power socket(s)?', notes: true },
    { key: 'extraNotes', type: 'text', label: 'Extra notes' }
  ],
  'Alto Sax': [
    { key: 'bringingInstrument', type: 'yesno', label: 'Bringing instrument?', notes: false },
    { key: 'needsMic', type: 'yesno', label: 'Need mic provided? (in case horns need amplification)', notes: true },
    { key: 'singing', type: 'yesno', label: 'Singing?', notes: false },
    { key: 'needsMicForSinging', type: 'yesno', label: 'Mic Needed?', notes: true, dependsOn: { key: 'singing', value: true } },
    { key: 'needsPowerSockets', type: 'number', label: 'Need power socket(s)?', notes: true },
    { key: 'extraNotes', type: 'text', label: 'Extra notes' }
  ],
  'Soprano Sax': [
    { key: 'bringingInstrument', type: 'yesno', label: 'Bringing instrument?', notes: false },
    { key: 'needsMic', type: 'yesno', label: 'Need mic provided? (in case horns need amplification)', notes: true },
    { key: 'singing', type: 'yesno', label: 'Singing?', notes: false },
    { key: 'needsMicForSinging', type: 'yesno', label: 'Mic Needed?', notes: true, dependsOn: { key: 'singing', value: true } },
    { key: 'needsPowerSockets', type: 'number', label: 'Need power socket(s)?', notes: true },
    { key: 'extraNotes', type: 'text', label: 'Extra notes' }
  ],
  'Trumpet': [
    { key: 'bringingInstrument', type: 'yesno', label: 'Bringing instrument?', notes: false },
    { key: 'needsMic', type: 'yesno', label: 'Need mic provided? (in case horns need amplification)', notes: true },
    { key: 'singing', type: 'yesno', label: 'Singing?', notes: false },
    { key: 'needsMicForSinging', type: 'yesno', label: 'Mic Needed?', notes: true, dependsOn: { key: 'singing', value: true } },
    { key: 'needsPowerSockets', type: 'number', label: 'Need power socket(s)?', notes: true },
    { key: 'extraNotes', type: 'text', label: 'Extra notes' }
  ],
  'Trombone': [
    { key: 'bringingInstrument', type: 'yesno', label: 'Bringing instrument?', notes: false },
    { key: 'needsMic', type: 'yesno', label: 'Need mic provided? (in case horns need amplification)', notes: true },
    { key: 'singing', type: 'yesno', label: 'Singing?', notes: false },
    { key: 'needsMicForSinging', type: 'yesno', label: 'Mic Needed?', notes: true, dependsOn: { key: 'singing', value: true } },
    { key: 'needsPowerSockets', type: 'number', label: 'Need power socket(s)?', notes: true },
    { key: 'extraNotes', type: 'text', label: 'Extra notes' }
  ],
  'Other': [
    { key: 'bringingInstrument', type: 'yesno', label: 'Bringing instrument?', notes: false },
    { key: 'needsAmp', type: 'yesno', label: 'Need amp provided?', notes: true },
    { key: 'needsDI', type: 'yesno', label: 'Need DI?', notes: true },
    { key: 'singing', type: 'yesno', label: 'Singing?', notes: false },
    { key: 'needsMic', type: 'yesno', label: 'Mic Needed?', notes: true, dependsOn: { key: 'singing', value: true } },
    { key: 'needsPowerSockets', type: 'number', label: 'Need power socket(s)?', notes: true },
    { key: 'extraNotes', type: 'text', label: 'Extra notes' }
  ],
  'Playback': [
    { key: 'hasPrerecordedSounds', type: 'yesno', label: 'Have pre-recorded sounds?', notes: false },
    { key: 'bringingLaptopPhone', type: 'yesno', label: 'Bringing laptop/phone and connectivity?', notes: false, dependsOn: { key: 'hasPrerecordedSounds', value: true } },
    { key: 'needsDI', type: 'yesno', label: 'Need DI?', notes: true },
    { key: 'needsPowerSockets', type: 'number', label: 'Need power socket(s)?', notes: true },
    { key: 'extraNotes', type: 'text', label: 'Extra notes' }
  ]
};

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

export const CREATION_STEP_ORDER = ["hero-image", "stage-name", "bio", "videos", "tracks", "tech-rider"];

const DEFAULT_STEP = CREATION_STEP_ORDER[0];
const STAGE_NAME_FONT_MAX = 40;
const STAGE_NAME_FONT_MIN = 20;
const STAGE_NAME_HORIZONTAL_PADDING = 32; // matches input horizontal padding
const HERO_POSITION_DEFAULT = 50;
const MEDIA_STORAGE_LIMIT_BYTES = 3 * 1024 * 1024 * 1024; // 3GB

const formatFileSize = (bytes) => {
  if (!bytes || bytes <= 0) return "0 B";
  const units = ["B", "KB", "MB", "GB", "TB"];
  const index = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  const value = bytes / Math.pow(1024, index);
  const formatted = value >= 10 ? value.toFixed(0) : value.toFixed(1);
  return `${formatted}${units[index]}`;
};

const getTrackMediaBytes = (track = {}) => {
  if (!track) return 0;
  if (typeof track.totalSizeBytes === "number") return track.totalSizeBytes;
  const audioBytes = track.audioFile?.size ?? track.audioSizeBytes ?? 0;
  const coverBytes = track.coverFile?.size ?? track.coverSizeBytes ?? 0;
  return audioBytes + coverBytes;
};

const getVideoMediaBytes = (video = {}) => {
  if (!video) return 0;
  if (typeof video.totalSizeBytes === "number") return video.totalSizeBytes;
  const videoBytes = video.videoFile?.size ?? video.videoSizeBytes ?? 0;
  let thumbnailBytes = 0;
  if (video.thumbnailFile instanceof Blob) {
    thumbnailBytes = video.thumbnailFile.size ?? 0;
  } else {
    thumbnailBytes = video.thumbnailSizeBytes ?? 0;
  }
  return videoBytes + thumbnailBytes;
};

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
  const [techRiderStage, setTechRiderStage] = useState(1);
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
  const techRiderDataRef = useRef(null);
  const currentPerformerIndexRef = useRef(0);
  const [containerHeight, setContainerHeight] = useState("auto");
  const [stageNameFontSize, setStageNameFontSize] = useState(STAGE_NAME_FONT_MAX);
  const trackUsageBytes = useMemo(
    () => tracks.reduce((total, track) => total + getTrackMediaBytes(track), 0),
    [tracks]
  );
  const videoUsageBytes = useMemo(
    () => videos.reduce((total, video) => total + getVideoMediaBytes(video), 0),
    [videos]
  );
  const totalMediaUsageBytes = trackUsageBytes + videoUsageBytes;
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
    if (initialArtistName !== artistName) {
      setArtistName(initialArtistName || "");
    }
  }, [initialArtistName, artistName]);

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

    if (displayedStep === "tech-rider") {
      // Handle tech rider stage navigation
      if (techRiderStage === 1) {
        // Validate stage 1 before advancing using TechRiderStep's validation
        if (window.__techRiderValidateStage1) {
          const isValid = window.__techRiderValidateStage1();
          if (!isValid) {
            return;
          }
        }
        setTechRiderStage(2);
      } else if (techRiderStage === 2) {
        // Validate stage 2 before advancing
        if (window.__techRiderValidateStage2) {
          const isValid = window.__techRiderValidateStage2();
          if (!isValid) {
            return;
          }
        }
        // Move to next performer or stage 3
        const techRiderData = profileData?.techRider || techRiderDataRef.current || {};
        const lineup = techRiderData.lineup || [];
        const currentIndex = currentPerformerIndexRef.current || 0;
        if (currentIndex < lineup.length - 1) {
          currentPerformerIndexRef.current = currentIndex + 1;
        } else {
          setTechRiderStage(3);
        }
      } else if (techRiderStage === 3) {
        setTechRiderStage(4);
      } else if (techRiderStage === 4) {
        // Validate stage 4 before advancing
        if (window.__techRiderValidateStage4) {
          const isValid = window.__techRiderValidateStage4();
          if (!isValid) {
            return;
          }
        }
        setTechRiderStage(5);
      } else if (techRiderStage === 5) {
        // Save and complete tech rider (stage 5 is now the final step)
        if (window.__techRiderFinishAndSave) {
          window.__techRiderFinishAndSave().then(() => {
            onCompleteCreation?.();
          });
        } else {
          onCompleteCreation?.();
        }
      }
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
    if (displayedStep === "tech-rider") {
      // Handle tech rider stage navigation
      if (techRiderStage === 1) {
        // Go back to tracks
        goToStep("tracks");
      } else if (techRiderStage === 2) {
        // Go back to previous performer or stage 1
        const currentIndex = currentPerformerIndexRef.current || 0;
        if (currentIndex > 0) {
          currentPerformerIndexRef.current = currentIndex - 1;
        } else {
          setTechRiderStage(1);
        }
      } else {
        setTechRiderStage(techRiderStage - 1);
      }
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
    const audioSizeBytes = file.size ?? 0;
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
       audioSizeBytes,
       coverSizeBytes: 0,
       totalSizeBytes: audioSizeBytes,
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
        const updatedTrack = {
          ...track,
          coverFile: file,
          coverPreviewUrl: previewUrl,
          coverSizeBytes: file.size ?? 0,
        };
        const updatedTotal =
          (updatedTrack.audioFile?.size ?? updatedTrack.audioSizeBytes ?? 0) +
          (updatedTrack.coverFile?.size ?? updatedTrack.coverSizeBytes ?? 0);
        return {
          ...updatedTrack,
          totalSizeBytes: updatedTotal,
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
    const videoSizeBytes = file.size ?? 0;
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
        videoSizeBytes,
        thumbnailSizeBytes: 0,
        totalSizeBytes: videoSizeBytes,
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

          const thumbnailFile = result?.file || null;
          const thumbnailSizeBytes = thumbnailFile ? thumbnailFile.size ?? 0 : 0;
          const baseVideoBytes = video.videoFile?.size ?? video.videoSizeBytes ?? 0;
          return {
            ...video,
            thumbnailFile,
            thumbnailPreviewUrl: result?.previewUrl || null,
            isThumbnailGenerating: false,
            thumbnailGenerationError: result?.previewUrl ? null : "Failed to generate thumbnail",
            thumbnailSizeBytes: thumbnailSizeBytes || video.thumbnailSizeBytes || 0,
            totalSizeBytes: baseVideoBytes + (thumbnailSizeBytes || video.thumbnailSizeBytes || 0),
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
          trackUsageBytes={trackUsageBytes}
          totalUsageBytes={totalMediaUsageBytes}
          storageLimitBytes={MEDIA_STORAGE_LIMIT_BYTES}
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
          videoUsageBytes={videoUsageBytes}
          totalUsageBytes={totalMediaUsageBytes}
          storageLimitBytes={MEDIA_STORAGE_LIMIT_BYTES}
          />
        );
      case "tech-rider":
        return (
          <TechRiderStep
            techRiderStage={techRiderStage}
            onTechRiderStageChange={setTechRiderStage}
            onBackToTracks={() => goToStep("tracks")}
            onCompleteCreation={onCompleteCreation}
            creationProfileId={creationProfileId}
            profileData={profileData}
            onTechRiderDataChange={(data) => {
              // Store tech rider data for navigation logic
              techRiderDataRef.current = data;
            }}
            onCurrentPerformerIndexChange={(index) => {
              currentPerformerIndexRef.current = index;
              // Force re-render to update subtitle
              setTechRiderStage(prev => prev);
            }}
            currentPerformerIndexRef={currentPerformerIndexRef}
            onValidateAndAdvance={(callback) => {
              // Expose validation function to parent
              window.__techRiderValidateAndAdvance = callback;
            }}
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

  const getTechRiderSubtitle = () => {
    if (displayedStep !== "tech-rider") return null;
    
    const techRiderData = profileData?.techRider || techRiderDataRef.current || {};
    const lineup = techRiderData.lineup || [];
    
    switch (techRiderStage) {
      case 1:
        return "Let's create your tech rider. Add any people that perform with you.";
      case 2: {
        const currentIndex = currentPerformerIndexRef.current || 0;
        const currentPerformer = lineup[currentIndex];
        if (currentPerformer) {
          const performerName = currentPerformer.performerName || `Performer ${currentIndex + 1}`;
          const instruments = currentPerformer.instruments || [];
          const instrumentsText = instruments.length > 0 ? ` (${instruments.join(', ')})` : '';
          return `${performerName}${instrumentsText}`;
        }
        return "Answer questions about this performer's requirements.";
      }
      case 3:
        return "Any extra notes to add?";
      case 4:
        return "Drag the performer(s) to their usual position on stage";
      case 5:
        return "Add performers to this artist profile";
      default:
        return "Share your technical requirements with venues.";
    }
  };

  const renderProgressDots = () => {
    // Show only 5 progress dots (first 5 steps)
    const stepsToShow = CREATION_STEP_ORDER.slice(0, 5);
    // Map tech-rider step (6th step, index 5) to the 5th dot
    const getDotIndex = (stepIndex) => {
      if (stepIndex >= 5) return 4; // tech-rider maps to 5th dot (index 4)
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
          <>
            {displayedStep === "tech-rider" && getTechRiderSubtitle() && (
              <p className="creation-step-question">
                {getTechRiderSubtitle()}
              </p>
            )}
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
          </>
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

      {(
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
                  (displayedStep === "tech-rider" && techRiderStage === 5) || (isFinalStep && displayedStep !== "tech-rider") ? (
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
            value={200 - heroBrightness}
            onChange={(e) => onHeroBrightnessChange?.(200 - Number(e.target.value))}
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

function StorageUsageBar({
  usedBytes = 0,
  totalBytes = MEDIA_STORAGE_LIMIT_BYTES,
  label = "Storage Usage",
}) {
  const limit = totalBytes || MEDIA_STORAGE_LIMIT_BYTES;
  const clampedUsed = Math.max(0, usedBytes);
  const percent = limit ? Math.min(100, (clampedUsed / limit) * 100) : 0;
  const isOverLimit = clampedUsed > limit;

  return (
    <div className={`storage-usage ${isOverLimit ? "over-limit" : ""}`}>
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
  trackUsageBytes = 0,
  totalUsageBytes = 0,
  storageLimitBytes = MEDIA_STORAGE_LIMIT_BYTES,
}) {
  const trackInputRefs = useRef(new Map());
  
  const getTrackInputRef = (trackId) => {
    if (!trackInputRefs.current.has(trackId)) {
      trackInputRefs.current.set(trackId, { current: null });
    }
    return trackInputRefs.current.get(trackId);
  };
  
  const focusTrackInput = (trackId) => {
    const ref = trackInputRefs.current.get(trackId);
    if (ref?.current) {
      ref.current.focus();
    }
  };
  const usageBar = (
    <StorageUsageBar
      usedBytes={totalUsageBytes}
      totalBytes={storageLimitBytes}
      breakdownLabel={`Tracks are using ${formatFileSize(trackUsageBytes)}`}
    />
  );

  // Show loading message if tracks are uploading
  if (tracksUploadStatus === 'uploading') {
    return (
      <>
        {usageBar}
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
        {usageBar}
        <p className="creation-step-question">
          Upload tracks that best represent your live sound.
        </p>
        <button type="button" className="creation-hero-upload track" onClick={onPrimaryUploadClick}>
          <MusicianIconSolid />
          <span>Upload Track</span>
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
      {usageBar}
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
              <div 
                className="track-name-input-container"
                onClick={() => focusTrackInput(track.id)}
                style={{ cursor: 'text' }}
              >
                <input
                  ref={(el) => {
                    const ref = getTrackInputRef(track.id);
                    if (ref) ref.current = el;
                  }}
                  type="text"
                  value={track.title}
                  onChange={(e) => onTrackTitleChange(track.id, e.target.value)}
                  placeholder="Track title"
                />
                <EditIcon 
                  onClick={(e) => {
                    e.stopPropagation();
                    focusTrackInput(track.id);
                  }}
                  style={{ cursor: 'pointer' }}
                />
              </div>
              <p>{artistName}</p>
              <p className="media-size-label">
                Size: {formatFileSize(getTrackMediaBytes(track))}
              </p>
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
        <MusicianIconSolid /> Add Another Track
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
  videoUsageBytes = 0,
  totalUsageBytes = 0,
  storageLimitBytes = MEDIA_STORAGE_LIMIT_BYTES,
}) {
  const videoInputRefs = useRef(new Map());
  
  const getVideoInputRef = (videoId) => {
    if (!videoInputRefs.current.has(videoId)) {
      videoInputRefs.current.set(videoId, { current: null });
    }
    return videoInputRefs.current.get(videoId);
  };
  
  const focusVideoInput = (videoId) => {
    const ref = videoInputRefs.current.get(videoId);
    if (ref?.current) {
      ref.current.focus();
    }
  };
  const usageBar = (
    <StorageUsageBar
      usedBytes={totalUsageBytes}
      totalBytes={storageLimitBytes}
      breakdownLabel={`Videos are using ${formatFileSize(videoUsageBytes)}`}
    />
  );

  if (videosUploadStatus === 'uploading') {
    return (
      <>
        {usageBar}
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
        {usageBar}
        <p className="creation-step-question">
          Upload short clips that capture the energy of your live show.
        </p>
        <button type="button" className="creation-hero-upload track" onClick={onPrimaryUploadClick}>
          <FilmIcon />
          <span>Upload Video</span>
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
      {usageBar}
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
                <div 
                  className="track-name-input-container"
                  onClick={() => focusVideoInput(video.id)}
                  style={{ cursor: 'text' }}
                >
                  <input
                    ref={(el) => {
                      const ref = getVideoInputRef(video.id);
                      if (ref) ref.current = el;
                    }}
                    type="text"
                    value={video.title}
                    onChange={(e) => onVideoTitleChange(video.id, e.target.value)}
                    placeholder="Video title"
                  />
                  <EditIcon 
                    onClick={(e) => {
                      e.stopPropagation();
                      focusVideoInput(video.id);
                    }}
                    style={{ cursor: 'pointer' }}
                  />
                </div>
                <p>{artistName || "Your Artist Name"}</p>
              <p className="media-size-label">
                {formatFileSize(getVideoMediaBytes(video))}
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
  const [previousVenues, setPreviousVenues] = useState('');
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
    } else if (subStep === 3 && city && travelDistance) {
      setSubStep(4);
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
    if (subStep === 4) return true; // Previous venues is optional
    return false;
  };

  const handleSave = async () => {
    if (!canAdvance() || !creationProfileId || isSaving) return;

    setIsSaving(true);
    try {
      const updates = {
        artistType: artistType || null,
        genres: selectedGenres,
        previousVenues: previousVenues || null,
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

      {/* Step 4: Previous Venues */}
      {subStep === 4 && (
        <>
          <p className="creation-step-question">List any venues you have previously performed at</p>
          <div className="input-container">
            <textarea
              className='input'
              value={previousVenues}
              onChange={(e) => setPreviousVenues(e.target.value)}
              placeholder="Enter venues you've performed at..."
              rows={6}
              style={{ 
                resize: 'none',
                minHeight: '120px',
                fontFamily: 'inherit'
              }}
            />
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
        {subStep === 4 && (
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
        {subStep < 4 && (
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

function TechRiderStep({ techRiderStage, onTechRiderStageChange, onBackToTracks, onCompleteCreation, creationProfileId, profileData, onTechRiderDataChange, onCurrentPerformerIndexChange }) {
  const { user } = useAuth();
  const [techRiderData, setTechRiderData] = useState({
    lineup: [],
    performerDetails: [],
    extraNotes: '',
    stageArrangement: {
      performers: [],
      stageWidth: null,
      stageDepth: null
    },
    isComplete: false,
    lastStage: 1
  });
  const [savingTechRider, setSavingTechRider] = useState(false);
  const [currentPerformerIndex, setCurrentPerformerIndex] = useState(0);
  const [performerInviteEmails, setPerformerInviteEmails] = useState({});
  const [sendingInviteForPerformer, setSendingInviteForPerformer] = useState(null);
  const [members, setMembers] = useState([]);

  // Load existing tech rider data from profileData if available
  useEffect(() => {
    if (profileData?.techRider) {
      const existingTechRider = profileData.techRider;
      setTechRiderData({
        lineup: existingTechRider.lineup || [],
        performerDetails: existingTechRider.performerDetails || [],
        extraNotes: existingTechRider.extraNotes || '',
        stageArrangement: existingTechRider.stageArrangement || {
          performers: [],
          stageWidth: null,
          stageDepth: null
        },
        isComplete: existingTechRider.isComplete || false,
        lastStage: existingTechRider.lastStage || 1
      });
      // Update parent's techRiderStage if we have saved data
      if (existingTechRider.lastStage && onTechRiderStageChange) {
        onTechRiderStageChange(existingTechRider.lastStage);
      }
    }
  }, [profileData?.techRider, onTechRiderStageChange]);

  // Auto-populate lineup from members when tech rider is first opened
  useEffect(() => {
    if (!creationProfileId) return;
    // Don't auto-populate if we already have tech rider data
    if (profileData?.techRider?.lineup?.length > 0) return;
    
    const fetchAndPopulate = async () => {
      try {
        const membersList = await getArtistProfileMembers(creationProfileId);
        setMembers(membersList);
        
        // Only auto-populate if lineup is empty
        setTechRiderData(prev => {
          if (prev.lineup.length > 0) return prev; // Don't overwrite if already populated
          if (membersList.length === 0) return prev; // No members to populate from
          
          const lineupFromMembers = membersList.map(member => ({
            performerId: member.userId || member.id,
            performerName: member.userName || member.userEmail || 'Unknown',
            instruments: [],
            isMember: true,
            memberId: member.id
          }));
          const detailsFromMembers = membersList.map(() => ({}));
          
          return {
            ...prev,
            lineup: lineupFromMembers,
            performerDetails: detailsFromMembers
          };
        });
      } catch (error) {
        console.error('Failed to fetch members for tech rider:', error);
      }
    };
    
    fetchAndPopulate();
  }, [creationProfileId, profileData?.techRider?.lineup?.length]);

  const validateEmail = (email) => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  };

  const handleTechRiderStageChange = (newStage) => {
    if (newStage >= 1 && newStage <= 6) {
      onTechRiderStageChange?.(newStage);
      if (newStage === 2) {
        setCurrentPerformerIndex(0);
      }
      setTechRiderData(prev => ({ ...prev, lastStage: newStage }));
    }
  };

  const validateStage1 = () => {
    const cleanedLineup = techRiderData.lineup.map(performer => ({
      ...performer,
      instruments: (performer.instruments || []).filter(inst => inst && inst.trim() !== '')
    }));

    setTechRiderData(prev => ({
      ...prev,
      lineup: cleanedLineup
    }));

    if (cleanedLineup.length === 0) {
      toast.error('Please add at least one performer');
      return false;
    }

    for (let i = 0; i < cleanedLineup.length; i++) {
      const performer = cleanedLineup[i];
      
      if (!performer.performerName || performer.performerName.trim() === '') {
        toast.error(`Performer ${i + 1} must have a name`);
        return false;
      }

      if (!performer.instruments || performer.instruments.length === 0) {
        toast.error(`${performer.performerName || `Performer ${i + 1}`} must have at least one instrument selected`);
        return false;
      }
    }

    return true;
  };

  const handleStage1Next = () => {
    if (validateStage1()) {
      handleTechRiderStageChange(2);
    }
  };

  const handleAddPerformer = () => {
    const newPerformer = {
      performerId: null,
      performerName: '',
      instruments: [],
      isMember: false,
      memberId: null
    };
    setTechRiderData(prev => ({
      ...prev,
      lineup: [...prev.lineup, newPerformer],
      performerDetails: [...prev.performerDetails, {}]
    }));
  };

  const handleRemovePerformer = (index) => {
    setTechRiderData(prev => {
      const newLineup = prev.lineup.filter((_, i) => i !== index);
      const newDetails = prev.performerDetails.filter((_, i) => i !== index);
      const newArrangement = {
        ...prev.stageArrangement,
        performers: prev.stageArrangement.performers.filter(p => p.lineupIndex !== index)
          .map(p => p.lineupIndex > index ? { ...p, lineupIndex: p.lineupIndex - 1 } : p)
      };
      return {
        ...prev,
        lineup: newLineup,
        performerDetails: newDetails,
        stageArrangement: newArrangement
      };
    });
  };

  const handleUpdatePerformer = (index, updates) => {
    setTechRiderData(prev => {
      const newLineup = [...prev.lineup];
      newLineup[index] = { ...newLineup[index], ...updates };
      return { ...prev, lineup: newLineup };
    });
  };

  const handleAddInstrument = (performerIndex) => {
    const performer = techRiderData.lineup[performerIndex];
    const currentInstruments = performer.instruments || [];
    handleUpdatePerformer(performerIndex, { instruments: [...currentInstruments, ''] });
  };

  const handleUpdateInstrument = (performerIndex, instrumentIndex, instrumentValue) => {
    const performer = techRiderData.lineup[performerIndex];
    const currentInstruments = [...(performer.instruments || [])];
    currentInstruments[instrumentIndex] = instrumentValue;
    const filteredInstruments = currentInstruments.filter(i => i !== '');
    handleUpdatePerformer(performerIndex, { instruments: filteredInstruments });
  };

  const handleRemoveInstrument = (performerIndex, instrumentIndex) => {
    const performer = techRiderData.lineup[performerIndex];
    const currentInstruments = [...(performer.instruments || [])];
    currentInstruments.splice(instrumentIndex, 1);
    handleUpdatePerformer(performerIndex, { instruments: currentInstruments });
  };

  const getInstrumentIcon = (instrument) => {
    switch (instrument) {
      case 'Vocals':
        return <VocalsIcon />;
      case 'Drums':
        return <DrumsIcon />;
      case 'Keys':
        return <KeysIcon />;
      case 'Guitar':
        return <GuitarsIcon />;
      case 'Bass':
        return <BassIcon />;
      case 'Tenor Sax':
      case 'Alto Sax':
      case 'Soprano Sax':
        return <SaxIcon />;
      case 'Trumpet':
        return <TrumpetIcon />;
      case 'Trombone':
        return <TromboneIcon />;
      case 'Playback':
        return <PlaybackIcon />;
      default:
        return <PlaybackIcon />;
    }
  };

  const handleStageDrop = (e) => {
    e.preventDefault();
    const lineupIndex = parseInt(e.dataTransfer.getData('lineupIndex'));
    if (isNaN(lineupIndex)) return;

    const stageContainer = e.currentTarget;
    const rect = stageContainer.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 100;
    const y = ((e.clientY - rect.top) / rect.height) * 100;

    const existingIndex = techRiderData.stageArrangement.performers.findIndex(
      p => p.lineupIndex === lineupIndex
    );

    setTechRiderData(prev => {
      const newPerformers = [...prev.stageArrangement.performers];
      if (existingIndex >= 0) {
        newPerformers[existingIndex] = { lineupIndex, x, y };
      } else {
        newPerformers.push({ lineupIndex, x, y });
      }
      return {
        ...prev,
        stageArrangement: {
          ...prev.stageArrangement,
          performers: newPerformers
        }
      };
    });
  };

  const handleStageDragOver = (e) => {
    e.preventDefault();
  };

  const handlePerformerDragStart = (e, lineupIndex) => {
    e.dataTransfer.setData('lineupIndex', lineupIndex.toString());
  };

  const handleRemoveFromStage = (lineupIndex) => {
    setTechRiderData(prev => ({
      ...prev,
      stageArrangement: {
        ...prev.stageArrangement,
        performers: prev.stageArrangement.performers.filter(
          p => p.lineupIndex !== lineupIndex
        )
      }
    }));
  };

  const handleUpdatePerformerDetails = (index, updates) => {
    setTechRiderData(prev => {
      const newDetails = [...prev.performerDetails];
      newDetails[index] = { ...newDetails[index], ...updates };
      return { ...prev, performerDetails: newDetails };
    });
  };

  const handleAddMemberFromLineup = async (performerIndex, email) => {
    const performer = techRiderData.lineup[performerIndex];
    if (!performer) {
      toast.error('Performer not found');
      return;
    }

    const inviteEmail = email || (performer.performerName && performer.performerName.includes('@') ? performer.performerName.trim() : null);
    
    if (!inviteEmail || !inviteEmail.includes('@')) {
      toast.error('Please enter a valid email address');
      return;
    }

    if (!validateEmail(inviteEmail)) {
      toast.error('Please enter a valid email address');
      return;
    }

    try {
      setSendingInviteForPerformer(performerIndex);
      const sanitizedPermissions = sanitizeArtistPermissions({ ...ARTIST_PERM_DEFAULTS });
      
      const invite = await createArtistInvite({
        artistProfileId: creationProfileId,
        email: inviteEmail,
        permissionsInput: sanitizedPermissions,
        invitedByName: user?.name || null,
      });

      if (invite?.inviteId) {
        const link = `${window.location.origin}/join-artist?invite=${invite.inviteId}`;
        await sendArtistInviteEmail({
          to: inviteEmail,
          artistProfile: { name: 'your artist profile' },
          link,
        });
        toast.success(`Invitation sent to ${inviteEmail}`);
        
        setPerformerInviteEmails(prev => {
          const updated = { ...prev };
          delete updated[performerIndex];
          return updated;
        });
      }
    } catch (error) {
      console.error('Error sending invite:', error);
      toast.error('Failed to send invite. Please try again.');
    } finally {
      setSendingInviteForPerformer(null);
    }
  };

  const handleSaveTechRider = async (overrideData = null, showSuccessNotification = true) => {
    if (!creationProfileId || savingTechRider) return;

    setSavingTechRider(true);
    try {
      const dataToSave = overrideData || techRiderData;
      const techRiderPayload = {
        ...dataToSave,
        lastStage: overrideData ? overrideData.lastStage : techRiderStage,
        lastUpdated: new Date().toISOString(),
        version: 1
      };

      await updateArtistProfileDocument(creationProfileId, {
        techRider: techRiderPayload
      });

      // Update state if we used override data
      if (overrideData) {
        setTechRiderData(overrideData);
      }

      if (showSuccessNotification) {
        toast.success('Tech rider saved successfully');
      }
    } catch (error) {
      console.error('Failed to save tech rider:', error);
      toast.error('Failed to save tech rider. Please try again.');
    } finally {
      setSavingTechRider(false);
    }
  };

  // Expose handleFinishAndSave for parent to call
  const handleFinishAndSave = useCallback(async () => {
    const completedData = {
      ...techRiderData,
      isComplete: true,
      lastStage: 5
    };
    // Don't show tech rider notification - profile completion will show its own
    await handleSaveTechRider(completedData, false);
  }, [techRiderData]);
  
  const validateStage2 = () => {
    // Validate that all required fields are filled for all performers
    const lineup = techRiderData.lineup || [];
    const performerDetails = techRiderData.performerDetails || [];
    
    for (let i = 0; i < lineup.length; i++) {
      const performer = lineup[i];
      const instruments = performer.instruments || [];
      const details = performerDetails[i] || {};
      
      // Check if Vocals is one of the instruments
      const hasVocals = instruments.includes('Vocals');
      
      // Collect all required questions for this performer
      const requiredQuestions = [];
      instruments.forEach((instrument) => {
        const questions = INSTRUMENT_QUESTIONS[instrument] || [];
        questions.forEach((question) => {
          // Skip singing and singing-dependent needsMic questions for non-Vocals instruments if Vocals is present
          if (hasVocals && instrument !== 'Vocals') {
            if (question.key === 'singing') return;
            if (question.key === 'needsMic' && question.dependsOn && question.dependsOn.key === 'singing') return;
          }
          
          // Check if question is required (not extraNotes)
          if (question.key !== 'extraNotes') {
            // Check dependencies
            if (question.dependsOn) {
              const instrumentDetails = details[instrument] || {};
              const dependsValue = instrumentDetails[question.dependsOn.key];
              if (dependsValue !== question.dependsOn.value) {
                // Check if any other instrument has this dependency met
                let dependencyMet = false;
                for (const inst of instruments) {
                  const instDetails = details[inst] || {};
                  if (instDetails[question.dependsOn.key] === question.dependsOn.value) {
                    dependencyMet = true;
                    break;
                  }
                }
                if (!dependencyMet) return; // Skip this question if dependency not met
              }
            }
            requiredQuestions.push({ question, instrument });
          }
        });
      });
      
      // Check that all required questions are answered
      for (const { question, instrument } of requiredQuestions) {
        const instrumentDetails = details[instrument] || {};
        const value = instrumentDetails[question.key];
        
        if (question.type === 'yesno') {
          if (value === undefined || value === null) {
            toast.error(`${performer.performerName || `Performer ${i + 1}`}: Please answer "${question.label}"`);
            return false;
          }
        } else if (question.type === 'number') {
          if (value === undefined || value === null || value === '') {
            toast.error(`${performer.performerName || `Performer ${i + 1}`}: Please provide a value for "${question.label}"`);
            return false;
          }
        }
      }
    }
    
    return true;
  };
  
  const validateStage4 = () => {
    // Validate that at least one performer is placed on stage
    const performersOnStage = techRiderData.stageArrangement?.performers || [];
    if (performersOnStage.length === 0) {
      toast.error('Please place at least one performer on the stage');
      return false;
    }
    return true;
  };
  
  // Expose validation and save functions to parent via window (temporary solution)
  useEffect(() => {
    window.__techRiderValidateStage1 = validateStage1;
    window.__techRiderValidateStage2 = validateStage2;
    window.__techRiderValidateStage4 = validateStage4;
    window.__techRiderFinishAndSave = handleFinishAndSave;
    return () => {
      delete window.__techRiderValidateStage1;
      delete window.__techRiderValidateStage2;
      delete window.__techRiderValidateStage4;
      delete window.__techRiderFinishAndSave;
    };
  }, [techRiderStage, handleFinishAndSave, techRiderData]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div style={{ flex: 1 }}>

        {/* Stage 1: Lineup */}
        {techRiderStage === 1 && (
          <div className="tech-rider-stage">
            {techRiderData.lineup.map((performer, index) => (
              <div key={index} className="tech-rider-performer-row">
                <div className="tech-rider-performer-content">
                  <div className="tech-rider-performer-name-field">
                    <label className="label tech-rider-performer-name-label">Performer Name</label>
                    <input
                      type="text"
                      className="input tech-rider-performer-name-input"
                      value={performer.performerName}
                      onChange={(e) => handleUpdatePerformer(index, { performerName: e.target.value })}
                      disabled={performer.isMember}
                      placeholder="Enter performer name or email"
                    />
                  </div>

                  <div className="tech-rider-instruments-container">
                    <div className="tech-rider-instrument-row">
                      <div className="tech-rider-instrument-field">
                        <label className="label tech-rider-instrument-label">Instrument{performer.instruments.length <= 1 ? '' : 's'}</label>
                        <select
                          className="input tech-rider-instrument-select"
                          value={(performer.instruments && performer.instruments[0]) || ''}
                          onChange={(e) => handleUpdateInstrument(index, 0, e.target.value)}
                        >
                          <option value="">Select instrument</option>
                          {INSTRUMENT_TYPES.map((inst) => (
                            <option key={inst} value={inst}>
                              {inst}
                            </option>
                          ))}
                        </select>
                      </div>
                      <button
                        className="btn icon tech-rider-add-instrument-btn"
                        onClick={() => handleAddInstrument(index)}
                        title="Add another instrument"
                      >
                        <PlusIconSolid />
                      </button>
                    </div>
                    
                    {performer.instruments && performer.instruments.length > 1 && performer.instruments.slice(1).map((instrument, instIndex) => (
                      <div key={instIndex + 1} className="tech-rider-instrument-row">
                        <div className="tech-rider-instrument-field">
                          <select
                            className="input tech-rider-instrument-select"
                            value={instrument || ''}
                            onChange={(e) => handleUpdateInstrument(index, instIndex + 1, e.target.value)}
                          >
                            <option value="">Select instrument</option>
                            {INSTRUMENT_TYPES.map((inst) => (
                              <option key={inst} value={inst}>
                                {inst}
                              </option>
                            ))}
                          </select>
                        </div>
                        <button
                          className="btn icon tech-rider-remove-instrument-btn"
                          onClick={() => handleRemoveInstrument(index, instIndex + 1)}
                          title="Remove instrument"
                        >
                          <CloseIcon />
                        </button>
                      </div>
                    ))}
                  </div>

                  {!performer.isMember && (
                    <div className="tech-rider-remove-performer-wrapper">
                      <button
                        className="btn danger small tech-rider-remove-performer-btn"
                        onClick={() => handleRemovePerformer(index)}
                        title="Remove performer"
                      >
                        Remove
                      </button>
                    </div>
                  )}
                </div>
              </div>
            ))}

            <button
              className="btn secondary tech-rider-add-performer-btn"
              onClick={handleAddPerformer}
            >
              <PlusIconSolid /> Add Performer
            </button>

          </div>
        )}

        {/* Stage 2: Performer Details */}
        {techRiderStage === 2 && (
          <div className="tech-rider-stage">
            {techRiderData.lineup.length === 0 ? (
              <div>
                <p>Please add performers in Stage 1 first.</p>
                <button
                  className="btn artist-profile"
                  onClick={() => handleTechRiderStageChange(1)}
                >
                  Go to Stage 1
                </button>
              </div>
            ) : (
              <>
                <h5 style={{ fontWeight: '600' }}>
                  {techRiderData.lineup[currentPerformerIndex]?.performerName || `Performer ${currentPerformerIndex + 1}`} {techRiderData.lineup[currentPerformerIndex]?.instruments?.length > 0 ? `(${techRiderData.lineup[currentPerformerIndex]?.instruments?.join(', ')})` : ''}
                </h5>
                
                {(() => {
                  const performer = techRiderData.lineup[currentPerformerIndex];
                  const instruments = performer?.instruments || [];
                  const details = techRiderData.performerDetails[currentPerformerIndex] || {};
                  
                  // Check if Vocals is one of the instruments
                  const hasVocals = instruments.includes('Vocals');
                  
                  const questionMap = new Map();
                  
                  instruments.forEach((instrument) => {
                    const questions = INSTRUMENT_QUESTIONS[instrument] || [];
                    const instrumentDetails = details[instrument] || {};
                    
                    questions.forEach((question) => {
                      // Skip singing and singing-dependent needsMic questions for non-Vocals instruments if Vocals is present
                      if (hasVocals && instrument !== 'Vocals') {
                        if (question.key === 'singing') {
                          return; // Skip singing question for non-Vocals instruments
                        }
                        if (question.key === 'needsMic' && question.dependsOn && question.dependsOn.key === 'singing') {
                          return; // Skip needsMic question that depends on singing for non-Vocals instruments
                        }
                      }
                      
                      if (question.dependsOn) {
                        let dependencyMet = false;
                        const dependsValue = instrumentDetails[question.dependsOn.key];
                        if (dependsValue === question.dependsOn.value) {
                          dependencyMet = true;
                        } else {
                          const existing = questionMap.get(question.key);
                          if (existing) {
                            for (const inst of existing.instruments) {
                              const instDetails = details[inst] || {};
                              if (instDetails[question.dependsOn.key] === question.dependsOn.value) {
                                dependencyMet = true;
                                break;
                              }
                            }
                          }
                        }
                        if (!dependencyMet) {
                          return;
                        }
                      }
                      
                      if (!questionMap.has(question.key)) {
                        questionMap.set(question.key, {
                          ...question,
                          instruments: [instrument],
                          currentValue: instrumentDetails[question.key],
                          instrumentDetails: instrumentDetails,
                          sourceInstrument: instrument
                        });
                      } else {
                        const existing = questionMap.get(question.key);
                        existing.instruments.push(instrument);
                        if (existing.currentValue === undefined || existing.currentValue === null || existing.currentValue === '') {
                          const thisValue = instrumentDetails[question.key];
                          if (thisValue !== undefined && thisValue !== null && thisValue !== '') {
                            existing.currentValue = thisValue;
                            existing.instrumentDetails = instrumentDetails;
                            existing.sourceInstrument = instrument;
                          }
                        }
                      }
                    });
                  });
                  
                  return Array.from(questionMap.values()).map((questionData) => {
                    const question = questionData;
                    const questionKey = `performer_${currentPerformerIndex}_${question.key}`;
                    const currentValue = questionData.currentValue;
                    const instrumentDetails = questionData.instrumentDetails;
                    const sourceInstrument = questionData.sourceInstrument;
                    const applicableInstruments = questionData.instruments;

                    const updateQuestionForAllInstruments = (value, notesValue = null) => {
                      const updatedDetails = { ...details };
                      applicableInstruments.forEach((inst) => {
                        if (!updatedDetails[inst]) {
                          updatedDetails[inst] = {};
                        }
                        updatedDetails[inst][question.key] = value;
                        if (notesValue !== null && question.notes) {
                          updatedDetails[inst][`${question.key}_notes`] = notesValue;
                        }
                      });
                      handleUpdatePerformerDetails(currentPerformerIndex, updatedDetails);
                    };

                    if (question.type === 'yesno') {
                      const isRequired = question.key !== 'extraNotes';
                      const notesValue = instrumentDetails[`${question.key}_notes`] || '';
                      return (
                        <div key={questionKey} className="tech-rider-question-field">
                          <label className="label">
                            {question.label}
                            {isRequired && <span className="required-asterisk">*</span>}
                          </label>
                          <div className={`tech-rider-yesno-radio-container ${!question.notes ? 'no-notes' : ''}`}>
                            <div className="tech-rider-yesno-radio">
                              <label className={`tech-rider-radio-option ${currentValue === true ? 'selected' : ''}`}>
                                <input
                                  type="radio"
                                  name={questionKey}
                                  checked={currentValue === true}
                                  onChange={() => updateQuestionForAllInstruments(true)}
                                />
                                <span>Yes</span>
                              </label>
                              <label className={`tech-rider-radio-option ${currentValue === false ? 'selected' : ''}`}>
                                <input
                                  type="radio"
                                  name={questionKey}
                                  checked={currentValue === false}
                                  onChange={() => updateQuestionForAllInstruments(false)}
                                />
                                <span>No</span>
                              </label>
                            </div>
                            {question.notes && (
                              <textarea
                                className="input tech-rider-notes-textarea-inline"
                                placeholder={question.key === 'needsMic' ? 'Additional notes (e.g Need mic stand, etc.)' : 'Additional Notes (optional)'}
                                value={notesValue}
                                onChange={(e) => updateQuestionForAllInstruments(currentValue, e.target.value)}
                                rows={1}
                              />
                            )}
                          </div>
                        </div>
                      );
                    }

                    if (question.type === 'number') {
                      const isRequired = question.key !== 'extraNotes';
                      const labelText = question.key === 'needsPowerSockets' 
                        ? 'Number of power sockets required'
                        : question.label;
                      const notesValue = instrumentDetails[`${question.key}_notes`] || '';
                      return (
                        <div key={questionKey} className="tech-rider-question-field">
                          <label className="label">
                            {labelText}
                            {isRequired && <span className="required-asterisk">*</span>}
                          </label>
                          <div className={`tech-rider-number-input-container ${!question.notes ? 'no-notes' : ''}`}>
                            <input
                              type="number"
                              className="input tech-rider-number-input"
                              min="0"
                              value={currentValue ?? ''}
                              onChange={(e) => {
                                const value = e.target.value === '' ? null : parseInt(e.target.value) || 0;
                                updateQuestionForAllInstruments(value);
                              }}
                            />
                            {question.notes && (
                              <textarea
                                className="input tech-rider-notes-textarea-inline"
                                placeholder="Additional Notes (optional)"
                                value={notesValue}
                                onChange={(e) => updateQuestionForAllInstruments(currentValue, e.target.value)}
                                rows={1}
                              />
                            )}
                          </div>
                        </div>
                      );
                    }

                    if (question.type === 'text') {
                      const isRequired = question.key !== 'extraNotes';
                      return (
                        <div key={questionKey} className="tech-rider-question-field">
                          <label className="label">
                            {question.label}
                            {isRequired && <span className="required-asterisk">*</span>}
                          </label>
                          <textarea
                            className="input tech-rider-extra-notes-textarea"
                            placeholder={question.key === 'extraNotes' ? 'Any more notes? e.g Preferred monitoring arrangement etc.' : ''}
                            value={currentValue || ''}
                            onChange={(e) => updateQuestionForAllInstruments(e.target.value)}
                            rows={1}
                          />
                        </div>
                      );
                    }

                    return null;
                  });
                })()}

                {techRiderData.lineup[currentPerformerIndex]?.instruments?.length === 0 && (
                  <p className="tech-rider-empty-message">
                    Please add instruments for this performer in Stage 1.
                  </p>
                )}

              </>
            )}
          </div>
        )}

        {/* Stage 3: Extra Notes */}
        {techRiderStage === 3 && (
          <div className="tech-rider-stage">
            <textarea
              className="input tech-rider-extra-notes-stage-textarea"
              value={techRiderData.extraNotes}
              onChange={(e) => setTechRiderData(prev => ({ ...prev, extraNotes: e.target.value }))}
              rows={8}
              placeholder="Preferred monitoring arrangement etc."
            />
          </div>
        )}

        {/* Stage 4: Map of Performers */}
        {techRiderStage === 4 && (
          <div className="tech-rider-stage">
            <div className="tech-rider-stage-map-container">
              {/* Performer list - horizontal above stage */}
              <div className="tech-rider-stage-performer-list">
                <h6>Performers</h6>
                <div>
                  {techRiderData.lineup.map((performer, index) => {
                    const isOnStage = techRiderData.stageArrangement.performers.some(
                      p => p.lineupIndex === index
                    );
                    const primaryInstrument = performer.instruments?.[0] || 'Other';
                    return (
                      <button
                        key={index}
                        className={`tech-rider-stage-performer-button ${isOnStage ? 'on-stage' : ''}`}
                        draggable={!isOnStage}
                        onDragStart={(e) => handlePerformerDragStart(e, index)}
                        disabled={isOnStage}
                      >
                        {getInstrumentIcon(primaryInstrument)}
                        <span>{performer.performerName || `Performer ${index + 1}`}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Stage area - full width below */}
              <div 
                className="tech-rider-stage-area"
                onDrop={handleStageDrop}
                onDragOver={handleStageDragOver}
              >
                <h6 className="tech-rider-stage-front">Front of Stage</h6>
                {techRiderData.stageArrangement.performers.map((performer) => {
                  const performerData = techRiderData.lineup[performer.lineupIndex];
                  if (!performerData) return null;
                  const primaryInstrument = performerData.instruments?.[0] || 'Other';
                  return (
                    <div
                      key={performer.lineupIndex}
                      className="tech-rider-stage-performer"
                      style={{
                        left: `${performer.x}%`,
                        top: `${performer.y}%`,
                        transform: 'translate(-50%, -50%)'
                      }}
                      draggable
                      onDragStart={(e) => handlePerformerDragStart(e, performer.lineupIndex)}
                    >
                      <div className="tech-rider-stage-performer-content">
                        {getInstrumentIcon(primaryInstrument)}
                        <span className="tech-rider-stage-performer-name">
                          {performerData.performerName || `Performer ${performer.lineupIndex + 1}`}
                        </span>
                        <button
                          className="tech-rider-stage-performer-remove"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleRemoveFromStage(performer.lineupIndex);
                          }}
                          title="Remove from stage"
                        >
                          <CloseIcon />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* Stage 5: Add Members */}
        {techRiderStage === 5 && (
          <div className="tech-rider-stage">
            <div className="members-list">
              {techRiderData.lineup.map((performer, index) => {
                const matchingMember = members.find(m => 
                  (performer.isMember && performer.memberId && m.id === performer.memberId) ||
                  (performer.performerId && (m.userId === performer.performerId || m.id === performer.performerId))
                );

                if (matchingMember) {
                  return (
                    <div key={index} className="member-item">
                      <div className="member-name">
                        {matchingMember.userName || matchingMember.userEmail || performer.performerName || 'Unknown Member'}
                        {matchingMember.role === 'owner' && (
                          <span className="member-role"> (Owner)</span>
                        )}
                      </div>
                    </div>
                  );
                } else {
                  const emailValue = performerInviteEmails[index] || (performer.performerName && performer.performerName.includes('@') ? performer.performerName : '');
                  return (
                    <div key={index} className="member-item">
                      <div className="member-name">
                        {performer.performerName || `Performer ${index + 1}`}
                      </div>
                      <div className="member-actions">
                        <input
                          type="email"
                          className="input tech-rider-invite-email-input"
                          placeholder="Enter email address"
                          value={emailValue}
                          onChange={(e) => setPerformerInviteEmails(prev => ({
                            ...prev,
                            [index]: e.target.value
                          }))}
                        />
                        <button
                          className="btn primary tech-rider-invite-btn"
                          onClick={() => handleAddMemberFromLineup(index, emailValue)}
                          disabled={sendingInviteForPerformer === index || !emailValue.trim()}
                        >
                          {sendingInviteForPerformer === index ? 'Sending...' : 'Send Invite'}
                        </button>
                      </div>
                    </div>
                  );
                }
              })}
            </div>

            {techRiderData.lineup.length === 0 && (
              <p className="tech-rider-empty-message">
                Please add performers in Stage 1 first.
              </p>
            )}

          </div>
        )}

      </div>
    </div>
  );
}
