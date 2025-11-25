import { useMemo, useEffect, useRef, useState } from 'react';
import { Bio } from './Bio';
import { VideosTracks } from './VideosTracks';
import { DarkModeToggle } from './DarkModeToggle';
import { ProfileCreationBox, CREATION_STEP_ORDER } from './ProfileCreationBox';
import { AdditionalInfoSection } from './AdditionalInfoSection';
import { useScrollFade } from '@hooks/useScrollFade';
import { AddMember, MoreInformationIcon, PeopleGroupIconSolid, TechRiderIcon, NoImageIcon, LightModeIcon, EditIcon } from '../../../shared/ui/extras/Icons';
import { toast } from 'sonner';
import { LoadingSpinner } from '../../../shared/ui/loading/Loading';

/**
 * ProfileView Component
 * Main view for the Profile state showing all sub-components
 * 
 * @param {Object} profileData - The artist profile data (can be example or real)
 * @param {Function} onBeginCreation - Callback when user clicks to start creating profile
 * @param {boolean} isExample - Whether this is showing example data
 */

// Example artist profiles - randomly selected when user views example profile
const EXAMPLE_PROFILES = [
  {
    name: 'Childish Gambino',
    bio: 'Donald McKinley Glover Jr., formerly known by his musical stage name Childish Gambino, is an American musician, rapper, singer, actor, comedian, and filmmaker.',
    videos: [
      { thumbnail: 'https://www.horizonsmusic.co.uk/cdn/shop/products/1_2bd57201-d43c-4c11-a4c3-bf3797e8fc9e.jpg?v=1647448351', title: '3005' },
      { thumbnail: 'https://upload.wikimedia.org/wikipedia/en/1/10/Childish_Gambino_-_Awaken%2C_My_Love%21.png', title: 'Redbone' }
    ],
    tracks: [
      { title: '3005', artist: 'Childish Gambino', thumbnail: 'https://www.horizonsmusic.co.uk/cdn/shop/products/1_2bd57201-d43c-4c11-a4c3-bf3797e8fc9e.jpg?v=1647448351' },
      { title: 'Redbone', artist: 'Childish Gambino', thumbnail: 'https://upload.wikimedia.org/wikipedia/en/1/10/Childish_Gambino_-_Awaken%2C_My_Love%21.png' }
    ],
    backgroundImage: 'https://altcitizen.com/wp-content/uploads/2020/03/donald.jpg'
  },
  {
    name: 'Olivia Dean',
    bio: 'Olivia Lauryn Dean is an English singer and songwriter. In 2021, Dean was named the breakthrough artist of the year by Amazon Music',
    videos: [
      { thumbnail: 'https://upload.wikimedia.org/wikipedia/en/b/bf/Olivia_Dean_-_The_Art_of_Loving.png', title: 'The Art of Loving' },
      { thumbnail: 'https://f4.bcbits.com/img/a1894279631_16.jpg', title: 'Dive' }
    ],
    tracks: [
      { title: 'The Art of Loving', artist: 'Olivia Dean', thumbnail: 'https://upload.wikimedia.org/wikipedia/en/b/bf/Olivia_Dean_-_The_Art_of_Loving.png' },
      { title: 'Dive', artist: 'Olivia Dean', thumbnail: 'https://f4.bcbits.com/img/a1894279631_16.jpg' }
    ],
    backgroundImage: 'https://atwoodmagazine.com/wp-content/uploads/2025/10/Olivia-Dean-The-Art-of-Loving-by-Lola-Mansell-5a.jpeg'
  },
  {
    name: '10cc',
    bio: "10cc is an English pop rock band formed in 1972 in Manchester, England. The band is best known for their hit songs 'I'm Not in Love' and 'The Things We Do for Love.'",
    videos: [
      { thumbnail: 'https://m.media-amazon.com/images/I/91YU2uIDqEL._UF894,1000_QL80_.jpg', title: 'I\'m Not in Love' },
      { thumbnail: 'https://i.scdn.co/image/ab67616d0000b273f93159d78849714fcf118bb3', title: 'The Things We Do for Love' }
    ],
    tracks: [
      { title: 'I\'m Not in Love', artist: '10cc', thumbnail: 'https://m.media-amazon.com/images/I/91YU2uIDqEL._UF894,1000_QL80_.jpg' },
      { title: 'The Things We Do for Love', artist: '10cc', thumbnail: 'https://i.scdn.co/image/ab67616d0000b273f93159d78849714fcf118bb3' }
    ],
    backgroundImage: 'https://recordstore.co.uk/cdn/shop/files/SharedImage-146581.jpg?v=1748043470'
  },
  {
    name: 'Paolo Nutini',
    bio: 'Paul John Nutini is a Scottish singer-songwriter. He rose to fame in 2006 with the release of his debut album, "These Streets."',
    videos: [
      { thumbnail: 'https://upload.wikimedia.org/wikipedia/en/9/9f/These_Streets.jpg', title: 'These Streets' },
      { thumbnail: 'https://upload.wikimedia.org/wikipedia/en/e/e6/NutiniSSU.jpg', title: 'Sunny Side Up' }
    ],
    tracks: [
      { title: 'These Streets', artist: 'Paolo Nutini', thumbnail: 'https://upload.wikimedia.org/wikipedia/en/9/9f/These_Streets.jpg' },
      { title: 'Sunny Side Up', artist: 'Paolo Nutini', thumbnail: 'https://upload.wikimedia.org/wikipedia/en/e/e6/NutiniSSU.jpg' }
    ],
    backgroundImage: 'https://www.kcuk.org.uk/wp-content/uploads/2023/02/paolo-nutini-04.jpg'
  },
  {
    name: 'Gorillaz',
    bio: 'Gorillaz is a British virtual band created in 1998 by Damon Albarn and Jamie Hewlett. The band is known for their unique blend of electronic music and animated music videos.',
    videos: [
      { thumbnail: 'https://i1.sndcdn.com/artworks-000348116745-pt1e0h-t500x500.jpg', title: 'Clint Eastwood' },
      { thumbnail: 'https://images.genius.com/57bd806e697500ff0608d24b4bd4f0c1.1000x1000x1.png', title: 'Feel Good Inc.' }
    ],
    tracks: [
      { title: 'Clint Eastwood', artist: 'Gorillaz', thumbnail: 'https://i1.sndcdn.com/artworks-000348116745-pt1e0h-t500x500.jpg' },
      { title: 'Feel Good Inc.', artist: 'Gorillaz', thumbnail: 'https://images.genius.com/57bd806e697500ff0608d24b4bd4f0c1.1000x1000x1.png' }
    ],
    backgroundImage: 'https://gorillaz.com/wp-content/themes/gorillaz/assets/IMG/the-mountain-large.webp?v=1'
  }
];

export const ProfileView = ({
  profileData,
  onBeginCreation,
  isExample = false,
  isDarkMode,
  setIsDarkMode,
  onExampleProfileSelected,
  isCreationLoading = false,
  isCreatingProfile = false,
  creationStep = CREATION_STEP_ORDER[0],
  onCreationStepChange,
  onCompleteCreation,
  onHeroImageUpdate,
  initialHeroImage,
  heroBrightness = 100,
  onHeroBrightnessChange,
  heroPosition = 50,
  onHeroPositionChange,
  isRepositioningHero = false,
  onHeroRepositionToggle,
  initialArtistName = "",
  onArtistNameChange,
  creationArtistBio = "",
  onArtistBioChange,
  creationWebsiteUrl = "",
  onWebsiteUrlChange,
  creationInstagramUrl = "",
  onInstagramUrlChange,
  creationSpotifyUrl = "",
  onSpotifyUrlChange,
  creationSoundcloudUrl = "",
  onSoundcloudUrlChange,
  creationYoutubeUrl = "",
  onYoutubeUrlChange,
  heroUploadStatus = 'idle',
  heroUploadProgress = 0,
  creationTracks = [],
  onTracksChange,
  tracksUploadStatus = 'idle',
  tracksUploadProgress = 0,
  videoUploadStatus = 'idle',
  videoUploadProgress = 0,
  creationVideos = [],
  onVideosChange,
  scrollContainerRef,
  creationProfileId = null,
  aboutComplete = false,
  onAboutCompleteChange,
  onSaveAndExit = null,
  profileId = null,
  onHeroImageEdit = null,
  onNameEdit = null,
  onBioEdit = null,
  onWebsiteUrlEdit = null,
  onInstagramUrlEdit = null,
  currentHeroImage = null,
  currentHeroBrightness = 100,
  currentHeroPosition = 50,
  currentArtistName = "",
  isEditingHero = false,
  onHeroRepositionToggleEdit = null,
  onEditingNameChange = null,
  onEditingHeroImageChange = null,
  onEditingHeroBrightnessChange = null,
  onEditingHeroPositionChange = null,
  editingHeroPosition = null,
  editingHeroBrightness = null,
  onTracksSave = null,
  onVideosSave = null,
}) => {
  // Randomly select an example profile once when component mounts (only for example profiles)
  const exampleData = useMemo(() => {
    if (!isExample) return null;
    const randomIndex = Math.floor(Math.random() * EXAMPLE_PROFILES.length);
    return EXAMPLE_PROFILES[randomIndex];
  }, [isExample]);

  // Notify parent component of selected profile in useEffect (not during render)
  useEffect(() => {
    if (isExample && exampleData && onExampleProfileSelected) {
      onExampleProfileSelected(exampleData);
    }
  }, [isExample, exampleData, onExampleProfileSelected]);

  const data = isExample ? exampleData : profileData;

  // State for edit components (must be defined before use)
  const [isEditingBackground, setIsEditingBackground] = useState(false);
  const [isEditingName, setIsEditingName] = useState(false);
  const [isEditingTracks, setIsEditingTracks] = useState(false);
  const [isEditingVideos, setIsEditingVideos] = useState(false);
  const [editHeroImage, setEditHeroImage] = useState(null);
  const [editHeroBrightness, setEditHeroBrightness] = useState(currentHeroBrightness);
  const [editHeroPosition, setEditHeroPosition] = useState(currentHeroPosition);
  const [editArtistName, setEditArtistName] = useState(currentArtistName);
  const [editHeroUploadStatus, setEditHeroUploadStatus] = useState('idle');
  const [editHeroUploadProgress, setEditHeroUploadProgress] = useState(0);
  const [editingTracks, setEditingTracks] = useState([]);
  const [editingVideos, setEditingVideos] = useState([]);
  const [editSpotifyUrl, setEditSpotifyUrl] = useState("");
  const [editSoundcloudUrl, setEditSoundcloudUrl] = useState("");
  const [editYoutubeUrl, setEditYoutubeUrl] = useState("");

  const profileContentClassNames = [
    'profile-state-content',
    isDarkMode ? 'dark-mode' : '',
    isCreatingProfile ? 'creating-transition' : '',
  ]
    .filter(Boolean)
    .join(' ');

  const liveBioContent = (isCreatingProfile && creationArtistBio?.trim())
    ? creationArtistBio
    : data?.bio;

  // Only show bio if:
  // 1. Not in creation mode (show if data exists), OR
  // 2. In creation mode AND we've reached bio step AND there's a bio value entered
  // When in creation mode, never show bio from example/existing data until bio step is reached
  let shouldShowBio = false;
  if (isCreatingProfile) {
    // In creation mode: only show if we've reached bio step AND user has entered a bio
    shouldShowBio = Boolean(creationArtistBio?.trim());
  } else {
    // Not in creation mode: show if bio data exists
    shouldShowBio = Boolean(data?.bio);
  }
  const persistedVideos = data?.videos || [];
  const tracks = data?.tracks || [];
  
  // Use creation tracks if available, otherwise use profile data tracks
  // Transform tracks to ensure they have the expected format (thumbnail field)
  const displayTracks = isCreatingProfile && creationTracks.length > 0
    ? creationTracks
    : tracks;

  // Initialize editing tracks when entering edit mode
  useEffect(() => {
    if (isEditingTracks && tracks.length > 0 && editingTracks.length === 0) {
      // Convert Firestore tracks to editing format
      const tracksForEdit = tracks.map(track => {
        const audioSizeBytes = track.audioSizeBytes ?? track.audioBytes ?? 0;
        const coverSizeBytes = track.coverSizeBytes ?? 0;
        const totalSizeBytes = track.totalSizeBytes ?? audioSizeBytes + coverSizeBytes;
        return {
          id: track.id || `track-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
          title: track.title || '',
          artist: track.artist || '',
          audioFile: null,
          audioPreviewUrl: track.audioUrl || null,
          coverFile: null,
          coverPreviewUrl: track.coverUrl || null,
          uploadedAudioUrl: track.audioUrl || null,
          audioUrl: track.audioUrl || null,
          coverUploadedUrl: track.coverUrl || null,
          coverUrl: track.coverUrl || null,
          audioStoragePath: track.audioStoragePath || null,
          coverStoragePath: track.coverStoragePath || null,
          audioSizeBytes,
          coverSizeBytes,
          totalSizeBytes,
        };
      });
      setEditingTracks(tracksForEdit);
    }
  }, [isEditingTracks, tracks, editingTracks.length]);

  // Initialize editing videos when entering edit mode
  useEffect(() => {
    if (isEditingVideos && persistedVideos.length > 0 && editingVideos.length === 0) {
      // Convert Firestore videos to editing format
      const videosForEdit = persistedVideos.map(video => {
        const videoSizeBytes = video.videoSizeBytes ?? video.fileSize ?? 0;
        const thumbnailSizeBytes = video.thumbnailSizeBytes ?? 0;
        const totalSizeBytes = video.totalSizeBytes ?? videoSizeBytes + thumbnailSizeBytes;
        return {
          id: video.id || `video-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
          title: video.title || '',
          videoFile: null,
          videoPreviewUrl: video.videoUrl || null,
          thumbnailFile: null,
          thumbnailPreviewUrl: video.thumbnail || video.thumbnailUrl || null,
          uploadedVideoUrl: video.videoUrl || null,
          videoUrl: video.videoUrl || null,
          thumbnailUploadedUrl: video.thumbnail || video.thumbnailUrl || null,
          thumbnail: video.thumbnail || video.thumbnailUrl || null,
          videoStoragePath: video.videoStoragePath || null,
          thumbnailStoragePath: video.thumbnailStoragePath || null,
          isThumbnailGenerating: false,
          thumbnailGenerationError: null,
          videoSizeBytes,
          thumbnailSizeBytes,
          totalSizeBytes,
        };
      });
      setEditingVideos(videosForEdit);
    }
  }, [isEditingVideos, persistedVideos, editingVideos.length]);

  // Track editing handlers
  const createEntityId = (prefix) =>
    typeof crypto !== "undefined" && crypto.randomUUID
      ? crypto.randomUUID()
      : `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
  const createTrackId = () => createEntityId("track");

  const revokeObjectUrl = (url) => {
    if (url && url.startsWith("blob:")) {
      URL.revokeObjectURL(url);
    }
  };

  const handleTrackPrimaryUpload = () => {
    trackFileInputRef.current?.click();
  };

  const handleTrackFileInputChange = (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const previewUrl = URL.createObjectURL(file);
    const audioSizeBytes = file.size ?? 0;
    const newTrack = {
      id: createTrackId(),
      title: `Track ${editingTracks.length + 1}`,
      artist: currentArtistName || "",
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
    setEditingTracks((prev) => [...prev, newTrack]);
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
    setEditingTracks((prev) =>
      prev.map((track) => {
        if (track.id !== trackId) return track;
        revokeObjectUrl(track.coverPreviewUrl);
        const coverSizeBytes = file.size ?? 0;
        const audioSizeBytes = track.audioFile?.size ?? track.audioSizeBytes ?? 0;
        return {
          ...track,
          coverFile: file,
          coverPreviewUrl: previewUrl,
          coverSizeBytes,
          totalSizeBytes: audioSizeBytes + coverSizeBytes,
        };
      })
    );
    pendingCoverTrackIdRef.current = null;
    event.target.value = "";
  };

  const handleTrackRemove = (trackId) => {
    setEditingTracks((prev) => {
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
    setEditingTracks((prev) =>
      prev.map((track) => (track.id === trackId ? { ...track, title: newTitle } : track))
    );
  };

  const handleTrackMove = (trackId, direction) => {
    setEditingTracks((prev) => {
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

  const handleTracksEdit = () => {
    setIsEditingTracks(true);
  };

  const handleTracksCancel = () => {
    setIsEditingTracks(false);
    setEditingTracks([]);
    // Reset URLs will be handled by the useEffect that syncs with spotifyUrl/soundcloudUrl
  };

  // Video editing handlers
  const createVideoId = () => createEntityId("video");

  const handleVideoPrimaryUpload = () => {
    videoFileInputRef.current?.click();
  };

  const handleVideoFileInputChange = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const previewUrl = URL.createObjectURL(file);
    const videoId = createVideoId();
    const videoSizeBytes = file.size ?? 0;
    const newVideo = {
      id: videoId,
      title: `Video ${editingVideos.length + 1}`,
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
    };
    setEditingVideos((prev) => [...prev, newVideo]);
    event.target.value = "";

    // Generate thumbnail (similar to ProfileCreationBox)
    try {
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
              canvas.width = video.videoWidth;
              canvas.height = video.videoHeight;
              const ctx = canvas.getContext("2d");
              ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
              canvas.toBlob(
                (blob) => {
                  cleanup();
                  if (!blob) {
                    resolve({ file: null, previewUrl: null });
                    return;
                  }
                  const thumbnailFile = new File([blob], `${file.name}_thumbnail.png`, {
                    type: "image/png",
                    lastModified: Date.now(),
                  });
                  const previewUrl = URL.createObjectURL(thumbnailFile);
                  resolve({ file: thumbnailFile, previewUrl });
                },
                "image/png"
              );
            } catch (error) {
              handleError(error);
            }
          });
        });
      };

      const result = await generateVideoThumbnail(file);
      setEditingVideos((prev) =>
        prev.map((video) => {
          if (video.id !== videoId) return video;
          const thumbnailFile = result?.file || null;
          const thumbnailSizeBytes = thumbnailFile?.size ?? video.thumbnailSizeBytes ?? 0;
          const videoSizeBytes = video.videoFile?.size ?? video.videoSizeBytes ?? 0;
          return {
            ...video,
            thumbnailFile,
            thumbnailPreviewUrl: result?.previewUrl || null,
            isThumbnailGenerating: false,
            thumbnailGenerationError: result?.previewUrl ? null : 'Failed to generate thumbnail',
            thumbnailSizeBytes,
            totalSizeBytes: videoSizeBytes + thumbnailSizeBytes,
          };
        })
      );
    } catch (error) {
      console.error('Failed to generate thumbnail:', error);
      setEditingVideos((prev) =>
        prev.map((video) =>
          video.id === videoId
            ? {
                ...video,
                isThumbnailGenerating: false,
                thumbnailGenerationError: 'Failed to generate thumbnail',
              }
            : video
        )
      );
    }
  };

  const handleVideoRemove = (videoId) => {
    setEditingVideos((prev) => {
      const target = prev.find((video) => video.id === videoId);
      if (target) {
        revokeObjectUrl(target.videoPreviewUrl);
        revokeObjectUrl(target.thumbnailPreviewUrl);
      }
      return prev.filter((video) => video.id !== videoId);
    });
  };

  const handleVideoTitleChange = (videoId, newTitle) => {
    setEditingVideos((prev) =>
      prev.map((video) => (video.id === videoId ? { ...video, title: newTitle } : video))
    );
  };

  const handleVideoMove = (videoId, direction) => {
    setEditingVideos((prev) => {
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

  const handleVideosEdit = () => {
    setIsEditingVideos(true);
  };

  const handleVideosCancel = () => {
    setIsEditingVideos(false);
    setEditingVideos([]);
  };

  const displayVideos = isCreatingProfile && creationVideos.length > 0
    ? creationVideos
    : persistedVideos;
  
  const shouldShowVideosTracks = displayVideos.length > 0 || displayTracks.length > 0;
  
  // Use creation URLs if in creation mode, otherwise use profile data URLs
  const spotifyUrl = isCreatingProfile ? creationSpotifyUrl : (data?.spotifyUrl || "");
  const soundcloudUrl = isCreatingProfile ? creationSoundcloudUrl : (data?.soundcloudUrl || "");
  const youtubeUrl = isCreatingProfile ? creationYoutubeUrl : (data?.youtubeUrl || "");
  const websiteUrl = isCreatingProfile ? creationWebsiteUrl : (data?.websiteUrl || "");
  const instagramUrl = isCreatingProfile ? creationInstagramUrl : (data?.instagramUrl || "");

  // Sync edit URLs with props
  useEffect(() => {
    if (!isEditingTracks) {
      setEditSpotifyUrl(spotifyUrl);
      setEditSoundcloudUrl(soundcloudUrl);
    }
    if (!isEditingVideos) {
      setEditYoutubeUrl(youtubeUrl);
    }
  }, [spotifyUrl, soundcloudUrl, youtubeUrl, isEditingTracks, isEditingVideos]);

  const bioCardClassNames = [
    'bio-card-container',
    shouldShowBio ? 'is-visible' : 'is-hidden',
  ]
    .filter(Boolean)
    .join(' ');

  const mediaCardClassNames = [
    'videos-tracks-card-container',
    shouldShowVideosTracks ? 'is-visible' : 'is-hidden',
  ]
    .filter(Boolean)
    .join(' ');

  // State for additional info section
  const [selectedAdditionalInfo, setSelectedAdditionalInfo] = useState(null);
  
  const heroFileInputRef = useRef(null);
  const trackFileInputRef = useRef(null);
  const trackCoverInputRef = useRef(null);
  const videoFileInputRef = useRef(null);
  const pendingCoverTrackIdRef = useRef(null);
  const editHeroContainerRef = useRef(null);
  const editNameContainerRef = useRef(null);
  const { opacity: editHeroOpacity, scale: editHeroScale } = useScrollFade(editHeroContainerRef, scrollContainerRef, 30);
  const { opacity: editNameOpacity, scale: editNameScale } = useScrollFade(editNameContainerRef, scrollContainerRef, 30);

  // Refs for containers to apply scroll fade effect
  const bioContainerRef = useRef(null);
  const mediaContainerRef = useRef(null);
  const additionalInfoContainerRef = useRef(null);
  const { opacity: bioOpacity, scale: bioScale } = useScrollFade(bioContainerRef, scrollContainerRef, 30);
  const { opacity: mediaOpacity, scale: mediaScale } = useScrollFade(mediaContainerRef, scrollContainerRef, 30);
  const { opacity: additionalInfoOpacity, scale: additionalInfoScale } = useScrollFade(additionalInfoContainerRef, scrollContainerRef, 30);

  // Track if we've initialized editing to prevent re-initialization
  const hasInitializedEditingRef = useRef(false);
  const lastEditingStateRef = useRef(false);
  
  // Initialize edit state from props - only when editing starts
  useEffect(() => {
    // If we just started editing (transitioned from false to true)
    if (isEditingBackground && !lastEditingStateRef.current) {
      // Initialize with current values
      if (currentHeroImage) {
        setEditHeroImage({
          previewUrl: currentHeroImage,
          file: null,
          storagePath: profileData?.heroMedia?.storagePath || null,
        });
        // Set editing image for real-time preview
        if (onEditingHeroImageChange) {
          onEditingHeroImageChange(currentHeroImage);
        }
      }
      // Initialize brightness and position for editing - this is critical for repositioning to work
      if (onEditingHeroBrightnessChange) {
        onEditingHeroBrightnessChange(currentHeroBrightness);
      }
      if (onEditingHeroPositionChange) {
        onEditingHeroPositionChange(currentHeroPosition);
      }
      hasInitializedEditingRef.current = true;
    } else if (!isEditingBackground && lastEditingStateRef.current) {
      // We just stopped editing - clear all editing states
      hasInitializedEditingRef.current = false;
      if (onEditingHeroImageChange) {
        onEditingHeroImageChange(null);
      }
      if (onEditingHeroBrightnessChange) {
        onEditingHeroBrightnessChange(null);
      }
      if (onEditingHeroPositionChange) {
        onEditingHeroPositionChange(null);
      }
    }
    
    // Update the ref to track the current editing state
    lastEditingStateRef.current = isEditingBackground;
  }, [isEditingBackground, currentHeroImage, currentHeroBrightness, currentHeroPosition, profileData?.heroMedia?.storagePath, onEditingHeroImageChange, onEditingHeroBrightnessChange, onEditingHeroPositionChange]);

  // Don't sync brightness when editing - it will reset user's changes
  // Only sync when not editing or when editing first starts
  useEffect(() => {
    // Only sync if we're not currently editing (to avoid resetting during editing)
    if (!isEditingBackground) {
      setEditHeroBrightness(currentHeroBrightness);
    }
  }, [currentHeroBrightness, isEditingBackground]);

  // Don't sync position when user is actively repositioning - it will reset their drag
  // Only sync when not editing or when editing first starts
  useEffect(() => {
    // Only sync if we're not currently editing (to avoid resetting during drag)
    if (!isEditingBackground) {
      setEditHeroPosition(currentHeroPosition);
    }
  }, [currentHeroPosition, isEditingBackground]);

  // Track if we're repositioning to avoid resetting position when brightness changes
  const isRepositioningRef = useRef(false);
  useEffect(() => {
    isRepositioningRef.current = isRepositioningHero;
  }, [isRepositioningHero]);

  // Notify parent when editing brightness changes for real-time display
  // This should NOT affect the position - brightness and position are independent
  useEffect(() => {
    if (isEditingBackground && onEditingHeroBrightnessChange) {
      onEditingHeroBrightnessChange(editHeroBrightness);
    } else if (!isEditingBackground && onEditingHeroBrightnessChange) {
      onEditingHeroBrightnessChange(null);
    }
  }, [editHeroBrightness, isEditingBackground, onEditingHeroBrightnessChange]);

  // Notify parent when editing position changes for real-time display
  // BUT: Only notify when the position is changed by the user in THIS component (e.g., via slider)
  // NOT when it's changed by dragging (which updates the parent directly)
  useEffect(() => {
    // Don't notify parent if we're repositioning - the parent handles that directly
    if (isRepositioningRef.current) {
      return;
    }
    
    if (isEditingBackground && onEditingHeroPositionChange) {
      onEditingHeroPositionChange(editHeroPosition);
    } else if (!isEditingBackground && onEditingHeroPositionChange) {
      onEditingHeroPositionChange(null);
    }
  }, [editHeroPosition, isEditingBackground, onEditingHeroPositionChange]);

  useEffect(() => {
    setEditArtistName(currentArtistName || data?.name || "");
  }, [currentArtistName, data?.name, isEditingName]);

  // Notify parent when editing name changes for real-time display
  useEffect(() => {
    if (isEditingName && onEditingNameChange) {
      onEditingNameChange(editArtistName);
    } else if (!isEditingName && onEditingNameChange) {
      // Clear editing state when not editing
      onEditingNameChange(null);
    }
  }, [editArtistName, isEditingName, onEditingNameChange]);

  const handleHeroImageSelect = () => {
    heroFileInputRef.current?.click();
  };

  const handleHeroFileInputChange = (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    
    // Revoke old blob URL if it exists
    if (editHeroImage?.previewUrl && editHeroImage.previewUrl.startsWith('blob:')) {
      URL.revokeObjectURL(editHeroImage.previewUrl);
    }
    
    // Create new blob URL for preview
    const previewUrl = URL.createObjectURL(file);
    
    // Update local state
    setEditHeroImage({
      file,
      previewUrl,
      storagePath: null,
    });
    setEditHeroUploadStatus('idle');
    setEditHeroUploadProgress(0);
    
    // CRITICAL: Update background image in real-time - call this FIRST
    // This should immediately update the background image
    if (onEditingHeroImageChange) {
      onEditingHeroImageChange(previewUrl);
    }
    
    // Reset file input so same file can be selected again
    event.target.value = '';
  };

  const handleSaveBackgroundImage = async () => {
    if (!profileId || !onHeroImageEdit) {
      return;
    }
    
    // Get the current editing position from parent (may have been updated via drag)
    // If parent has editingHeroPosition, use that; otherwise use local editHeroPosition
    const currentEditingPosition = editingHeroPosition !== null ? editingHeroPosition : editHeroPosition;
    const currentEditingBrightness = editingHeroBrightness !== null ? editingHeroBrightness : editHeroBrightness;
    
    const hasChanges = editHeroImage?.file || 
      currentEditingBrightness !== currentHeroBrightness || 
      currentEditingPosition !== currentHeroPosition;
    
    if (!hasChanges) {
      // Cancel repositioning if active
      if (isRepositioningHero && onHeroRepositionToggleEdit) {
        onHeroRepositionToggleEdit(false);
      }
      setIsEditingBackground(false);
      return;
    }
    
    if (editHeroImage?.file) {
      setEditHeroUploadStatus('uploading');
      setEditHeroUploadProgress(0);
      
      try {
        await onHeroImageEdit({
          file: editHeroImage.file,
          previewUrl: editHeroImage.previewUrl,
          brightness: currentEditingBrightness,
          position: currentEditingPosition,
          onProgress: setEditHeroUploadProgress,
        });
        
        setEditHeroUploadStatus('complete');
        // Cancel repositioning if active
        if (isRepositioningHero && onHeroRepositionToggleEdit) {
          onHeroRepositionToggleEdit(false);
        }
        setIsEditingBackground(false);
        toast.success('Background image updated successfully');
      } catch (error) {
        console.error('Failed to update background image:', error);
        setEditHeroUploadStatus('error');
        toast.error('Failed to update background image');
      }
    } else {
      // Just update brightness/position if no new file
      try {
        await onHeroImageEdit({
          brightness: currentEditingBrightness,
          position: currentEditingPosition,
        });
        // Cancel repositioning if active
        if (isRepositioningHero && onHeroRepositionToggleEdit) {
          onHeroRepositionToggleEdit(false);
        }
        setIsEditingBackground(false);
        toast.success('Background settings updated successfully');
      } catch (error) {
        console.error('Failed to update background settings:', error);
        toast.error('Failed to update background settings');
      }
    }
  };

  const handleCancelBackgroundImage = () => {
    // Cancel repositioning mode if active
    if (isRepositioningHero && onHeroRepositionToggleEdit) {
      onHeroRepositionToggleEdit(false);
    }
    
    // Revoke blob URL if a new image was selected (not saved)
    if (editHeroImage?.previewUrl && editHeroImage.previewUrl.startsWith('blob:') && editHeroImage.file) {
      URL.revokeObjectURL(editHeroImage.previewUrl);
    }
    
    // Reset editing states to original values before closing
    if (onEditingHeroImageChange && currentHeroImage) {
      // Reset to original image
      onEditingHeroImageChange(currentHeroImage);
    } else if (onEditingHeroImageChange) {
      onEditingHeroImageChange(null);
    }
    if (onEditingHeroBrightnessChange) {
      onEditingHeroBrightnessChange(currentHeroBrightness);
    }
    if (onEditingHeroPositionChange) {
      // Reset to original position
      onEditingHeroPositionChange(currentHeroPosition);
    }
    
    // Close the edit box - this will trigger the useEffect to clear editing states
    setIsEditingBackground(false);
    setEditHeroImage(null);
    setEditHeroBrightness(currentHeroBrightness);
    setEditHeroPosition(currentHeroPosition);
    setEditHeroUploadStatus('idle');
    setEditHeroUploadProgress(0);
  };

  const handleSaveName = async () => {
    if (!profileId || !onNameEdit) return;
    
    try {
      await onNameEdit(editArtistName);
      setIsEditingName(false);
      // Clear editing state (will be cleared by handleNameEdit, but clear here too for safety)
      if (onEditingNameChange) {
        onEditingNameChange(null);
      }
      toast.success('Name updated successfully');
    } catch (error) {
      console.error('Failed to update name:', error);
      toast.error('Failed to update name');
    }
  };

  const handleCancelName = () => {
    setIsEditingName(false);
    const originalName = currentArtistName || data?.name || "";
    setEditArtistName(originalName);
    // Reset display name to original
    if (onEditingNameChange) {
      onEditingNameChange(originalName);
    }
  };

  return (
    <div className={profileContentClassNames}>
      <div className='profile-sections-stack'>
        <div 
          ref={bioContainerRef}
          className={bioCardClassNames} 
          aria-hidden={!shouldShowBio}
          style={{ 
            opacity: bioOpacity,
            transform: `scale(${bioScale})`,
            transformOrigin: 'top center',
            transition: 'opacity 0.2s ease-out, transform 0.2s ease-out',
          }}
        >
          <Bio 
            bio={liveBioContent}
            websiteUrl={websiteUrl}
            instagramUrl={instagramUrl}
            onBioEdit={onBioEdit}
            onWebsiteUrlEdit={onWebsiteUrlEdit}
            onInstagramUrlEdit={onInstagramUrlEdit}
            isEditable={!isCreatingProfile && !isExample}
          />
        </div>

        <div 
          ref={mediaContainerRef}
          className={mediaCardClassNames} 
          aria-hidden={!shouldShowVideosTracks}
          style={{ 
            opacity: mediaOpacity,
            transform: `scale(${mediaScale})`,
            transformOrigin: 'top center',
            transition: 'opacity 0.2s ease-out, transform 0.2s ease-out',
          }}
        >
          {shouldShowVideosTracks && (
            <VideosTracks 
              videos={displayVideos}
              tracks={displayTracks}
              defaultActiveSection={isCreatingProfile && creationTracks.length > 0 ? 'tracks' : undefined}
              spotifyUrl={spotifyUrl}
              soundcloudUrl={soundcloudUrl}
              youtubeUrl={youtubeUrl}
              mediaUsageBytes={data?.mediaUsageBytes || 0}
              isEditable={!isCreatingProfile && !isExample}
              editingTracks={editingTracks}
              tracksSource={tracks}
              videosSource={persistedVideos}
              artistName={currentArtistName}
              onTracksEdit={handleTracksEdit}
              onTrackPrimaryUpload={handleTrackPrimaryUpload}
              onTrackCoverUpload={handleTrackCoverUploadClick}
              onTrackTitleChange={handleTrackTitleChange}
              onTrackRemove={handleTrackRemove}
              onTrackMove={handleTrackMove}
              onSpotifyUrlChange={(url) => setEditSpotifyUrl(url)}
              onSoundcloudUrlChange={(url) => setEditSoundcloudUrl(url)}
              onTracksSave={onTracksSave}
              onTracksCancel={handleTracksCancel}
              tracksUploadStatus={tracksUploadStatus}
              tracksUploadProgress={tracksUploadProgress}
              editingVideos={editingVideos}
              onVideosEdit={handleVideosEdit}
              onVideoPrimaryUpload={handleVideoPrimaryUpload}
              onVideoTitleChange={handleVideoTitleChange}
              onVideoRemove={handleVideoRemove}
              onVideoMove={handleVideoMove}
              onYoutubeUrlChange={(url) => setEditYoutubeUrl(url)}
              onVideosSave={onVideosSave}
              onVideosCancel={handleVideosCancel}
              videosUploadStatus={videoUploadStatus}
              videosUploadProgress={videoUploadProgress}
              allowPlayback={!isExample}
            />
          )}
          {/* Hidden file inputs for track and video editing */}
          {!isCreatingProfile && !isExample && (
            <>
              <input
                ref={trackFileInputRef}
                type="file"
                accept="audio/*"
                style={{ display: 'none' }}
                onChange={handleTrackFileInputChange}
              />
              <input
                ref={trackCoverInputRef}
                type="file"
                accept="image/*"
                style={{ display: 'none' }}
                onChange={handleTrackCoverFileChange}
              />
              <input
                ref={videoFileInputRef}
                type="file"
                accept="video/*"
                style={{ display: 'none' }}
                onChange={handleVideoFileInputChange}
              />
            </>
          )}
        </div>

        {/* Additional Info Section */}
        {!isCreatingProfile && !isExample && (
          <div 
            ref={additionalInfoContainerRef}
            className={`additional-info-card-container ${selectedAdditionalInfo ? 'is-visible' : 'is-hidden'}`}
            aria-hidden={!selectedAdditionalInfo}
            style={{ 
              opacity: selectedAdditionalInfo ? additionalInfoOpacity : 0,
              transform: `scale(${selectedAdditionalInfo ? additionalInfoScale : 0.96})`,
              transformOrigin: 'top center',
              transition: 'opacity 0.2s ease-out, transform 0.2s ease-out',
            }}
          >
            {selectedAdditionalInfo && (
              <AdditionalInfoSection 
                type={selectedAdditionalInfo}
                onClose={() => setSelectedAdditionalInfo(null)}
                profileData={data}
                profileId={!isExample && !isCreatingProfile ? (profileData?.profileId || profileData?.id) : null}
              />
            )}
          </div>
        )}
      </div>

      {/* Additional Info Buttons - only show when viewing profile (not creating) */}
      {!isCreatingProfile && !isExample && (
        <div className="additional-info-buttons-container">
          <button
            className="btn additional-info-btn"
            onClick={() => setSelectedAdditionalInfo(selectedAdditionalInfo === 'tech-rider' ? null : 'tech-rider')}
          >
            <TechRiderIcon />
            Tech Rider
          </button>
          <button
            className="btn additional-info-btn"
            onClick={() => setSelectedAdditionalInfo(selectedAdditionalInfo === 'members' ? null : 'members')}
          >
            <PeopleGroupIconSolid />
            Members
          </button>
          <button
            className="btn additional-info-btn"
            onClick={() => setSelectedAdditionalInfo(selectedAdditionalInfo === 'about' ? null : 'about')}
          >
            <MoreInformationIcon />
            About
          </button>
        </div>
      )}

      {/* Edit Background Image Component */}
      {!isCreatingProfile && !isExample && (
        <div 
          ref={editHeroContainerRef}
          className={`creation-box-container edit-box ${isEditingBackground ? 'is-visible' : 'is-hidden'}`}
          aria-hidden={!isEditingBackground}
          style={{ 
            opacity: isEditingBackground ? editHeroOpacity : 0,
            transform: `scale(${isEditingBackground ? editHeroScale : 0.96})`,
            transformOrigin: 'top center',
            transition: 'opacity 0.2s ease-out, transform 0.2s ease-out',
            marginTop: isEditingBackground ? '1rem' : '0',
          }}
        >
          {isEditingBackground && (
            <div className="artist-profile-creation-box">
              <h3 style={{ marginBottom: '1rem' }}>Edit Background Image</h3>
              {!editHeroImage ? (
                <button type="button" className="creation-hero-upload" onClick={handleHeroImageSelect}>
                  <NoImageIcon className="upload-icon" />
                  <span>Choose Image</span>
                </button>
              ) : (
                <div className="creation-hero-adjust">
                  <div className="hero-image-actions">
                    <button type="button" className="hero-edit-button" onClick={handleHeroImageSelect}>
                      <span>Change Image</span>
                    </button>
                    <button
                      type="button"
                      className={`hero-edit-button ${isEditingHero ? "active" : ""}`}
                      onClick={() => {
                        if (!isEditingHero) {
                          // Ensure position is initialized - set it immediately
                          const positionToSet = editHeroPosition || currentHeroPosition;
                          if (onEditingHeroPositionChange) {
                            onEditingHeroPositionChange(positionToSet);
                          }
                          // Toggle reposition mode - call directly, don't delay
                          onHeroRepositionToggleEdit?.(true);
                        } else {
                          // When saving position, sync local editHeroPosition with parent's editingHeroPosition
                          // This prevents the position from reverting when repositioning is turned off
                          if (editingHeroPosition !== null) {
                            setEditHeroPosition(editingHeroPosition);
                          }
                          onHeroRepositionToggleEdit?.(false);
                        }
                      }}
                    >
                      <span>{isEditingHero ? "Save Position" : "Reposition Image"}</span>
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
                      value={editHeroBrightness}
                      onChange={(e) => {
                        const newBrightness = Number(e.target.value);
                        setEditHeroBrightness(newBrightness);
                        // Real-time update
                        if (onEditingHeroBrightnessChange) {
                          onEditingHeroBrightnessChange(newBrightness);
                        }
                      }}
                    />
                  </div>
                </div>
              )}
              {editHeroUploadStatus === 'uploading' && (
                <div style={{ marginTop: '1rem', textAlign: 'center' }}>
                  <LoadingSpinner />
                </div>
              )}
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: '0.75rem', marginTop: '1rem' }}>
                <button
                  className="btn tertiary"
                  onClick={handleCancelBackgroundImage}
                  disabled={editHeroUploadStatus === 'uploading'}
                >
                  Cancel
                </button>
                <button
                  className="btn artist-profile"
                  onClick={handleSaveBackgroundImage}
                  disabled={editHeroUploadStatus === 'uploading' || (!editHeroImage?.file && (editingHeroBrightness ?? editHeroBrightness) === currentHeroBrightness && (editingHeroPosition ?? editHeroPosition) === currentHeroPosition)}
                >
                  {editHeroUploadStatus === 'uploading' ? 'Uploading...' : 'Save'}
                </button>
              </div>
              <input
                ref={heroFileInputRef}
                type="file"
                accept="image/*"
                style={{ display: 'none' }}
                onChange={handleHeroFileInputChange}
              />
            </div>
          )}
        </div>
      )}

      {/* Edit Name Component */}
      {!isCreatingProfile && !isExample && (
        <div 
          ref={editNameContainerRef}
          className={`creation-box-container edit-box ${isEditingName ? 'is-visible' : 'is-hidden'}`}
          aria-hidden={!isEditingName}
          style={{ 
            opacity: isEditingName ? editNameOpacity : 0,
            transform: `scale(${isEditingName ? editNameScale : 0.96})`,
            transformOrigin: 'top center',
            transition: 'opacity 0.2s ease-out, transform 0.2s ease-out',
            marginTop: isEditingName ? '1rem' : '0',
          }}
        >
          {isEditingName && (
            <div className="artist-profile-creation-box">
              <h3>Edit Stage Name</h3>
              <div className="creation-stage-name-wrapper">
                <input
                  type="text"
                  value={editArtistName}
                  onChange={(e) => setEditArtistName(e.target.value)}
                  placeholder="Stage Name"
                  autoComplete="off"
                  className="creation-stage-name-input"
                />
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: '0.75rem', marginTop: '0rem' }}>
                <button
                  className="btn tertiary"
                  onClick={handleCancelName}
                >
                  Cancel
                </button>
                <button
                  className="btn artist-profile"
                  onClick={handleSaveName}
                  disabled={!editArtistName.trim() || editArtistName.trim() === (currentArtistName || data?.name || "")}
                >
                  Save
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Edit Buttons and Dark Mode Toggle */}
      {!isCreatingProfile && !isExample && (
        <div className="bottom-buttons-container">
          <div className="edit-buttons-container">
            <button
              className={`btn secondary edit-btn ${isEditingBackground ? 'active' : ''}`}
              onClick={() => {
                setIsEditingBackground(!isEditingBackground);
                setIsEditingName(false);
              }}
            >
              <EditIcon />
              Edit Background
            </button>
            <button
              className={`btn secondary edit-btn ${isEditingName ? 'active' : ''}`}
              onClick={() => {
                setIsEditingName(!isEditingName);
                setIsEditingBackground(false);
              }}
            >
              <EditIcon />
              Edit Name
            </button>
          </div>
          <div className="dark-mode-toggle-container">
            <DarkModeToggle isDarkMode={isDarkMode} setIsDarkMode={setIsDarkMode} />
          </div>
        </div>
      )}

      {isCreatingProfile && (
        <div className="dark-mode-toggle-container">
          <DarkModeToggle isDarkMode={isDarkMode} setIsDarkMode={setIsDarkMode} />
        </div>
      )}

      {/* Profile creation box */}
      {(isExample || isCreatingProfile) && (
        <div className="creation-box-container">
          <ProfileCreationBox
            onStartJourney={onBeginCreation}
            isLoading={isCreationLoading}
            isCreating={isCreatingProfile}
            creationStep={creationStep}
            onCreationStepChange={onCreationStepChange}
            onCompleteCreation={onCompleteCreation}
            onHeroImageUpdate={onHeroImageUpdate}
            initialHeroImage={initialHeroImage}
            heroBrightness={heroBrightness}
            onHeroBrightnessChange={onHeroBrightnessChange}
            heroPosition={heroPosition}
            onHeroPositionChange={onHeroPositionChange}
            isRepositioningHero={isRepositioningHero}
            onHeroRepositionToggle={onHeroRepositionToggle}
            initialArtistName={initialArtistName}
            onArtistNameChange={onArtistNameChange}
            artistBio={creationArtistBio}
            onArtistBioChange={onArtistBioChange}
            spotifyUrl={creationSpotifyUrl}
            onSpotifyUrlChange={onSpotifyUrlChange}
            soundcloudUrl={creationSoundcloudUrl}
            onSoundcloudUrlChange={onSoundcloudUrlChange}
            heroUploadStatus={heroUploadStatus}
            heroUploadProgress={heroUploadProgress}
            onTracksChange={onTracksChange}
            tracksUploadStatus={tracksUploadStatus}
            tracksUploadProgress={tracksUploadProgress}
            initialTracks={creationTracks}
            initialVideos={creationVideos}
            onVideosChange={onVideosChange}
            videosUploadStatus={videoUploadStatus}
            videosUploadProgress={videoUploadProgress}
            youtubeUrl={youtubeUrl}
            onYoutubeUrlChange={onYoutubeUrlChange}
            creationWebsiteUrl={creationWebsiteUrl}
            onWebsiteUrlChange={onWebsiteUrlChange}
            creationInstagramUrl={creationInstagramUrl}
            onInstagramUrlChange={onInstagramUrlChange}
            creationProfileId={creationProfileId}
            aboutComplete={aboutComplete}
            onAboutCompleteChange={onAboutCompleteChange}
            profileData={data}
            onSaveAndExit={onSaveAndExit}
          />
        </div>
      )}

    </div>
  );
};

