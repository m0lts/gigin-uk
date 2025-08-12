import { useEffect, useState } from 'react';
import '@styles/musician/musician-profile.styles.css'
import { BackgroundMusicIcon, CameraIcon, DownChevronIcon, EditIcon, ErrorIcon, FacebookIcon, InstagramIcon, MediaIcon, MicrophoneIconSolid, MicrophoneLinesIcon, MoreInformationIcon, Mp3Icon, Mp4Icon, MusicianIconSolid, ProfileIconSolid, SocialMediaIcon, SoundcloudIcon, SpotifyIcon, StarIcon, TickIcon, TwitterIcon, UpChevronIcon, VideoIcon, YoutubeIcon } from '../../../shared/ui/extras/Icons';
import { sendEmail } from '@services/emails';
import { v4 as uuidv4 } from 'uuid';
import { updateUserDocument } from '@services/users';
import { createMusicianProfile } from '@services/musicians';
import { uploadProfilePicture, uploadTracks, uploadVideosWithThumbnails } from '@services/storage';
import { useMusicianDashboard } from '../../../../context/MusicianDashboardContext';
import { arrayUnion } from 'firebase/firestore';
import { toast } from 'sonner';
import { deleteFileFromStorage, uploadFileWithProgress } from '../../../../services/storage';


const VideoModal = ({ video, onClose }) => {
    return (
        <div className='modal'>
            <div className='modal-content'>
                <span className='close' onClick={onClose}>&times;</span>
                <video className='video' controls autoPlay>
                    <source src={typeof video.url === 'string' ? video.url : URL.createObjectURL(video.url)} type='video/mp4' />
                    Your browser does not support the video tag.
                </video>
            </div>
        </div>
    );
};

export const ProfileForm = ({ user, musicianProfile, band = false }) => {
    const [preview, setPreview] = useState(musicianProfile.picture || '');
    const [formData, setFormData] = useState({
        musicianId: uuidv4(),
        email: user ? user.email : '',
        name: '',
        picture: '',
        location: { city: '', coordinates: [], travelDistance: '' },
        musicianType: '',
        genres: [],
        musicType: '',
        instruments: [],
        equipmentRequired: [],
        bio: { text: '', experience: '' },
        videos: [],
        tracks: [],
        socialMedia: {
          facebook: '',
          twitter: '',
          instagram: '',
          youtube: '',
          spotify: '',
          soundcloud: '',
        },
        bandProfile: false,
    });
    const [showModal, setShowModal] = useState(false);
    const [currentIndex, setCurrentIndex] = useState(null);
    const [expand, setExpand] = useState(['your-sound', 'media-upload', 'further-information', 'social-media']);
    const [uploadingProfile, setUploadingProfile] = useState(false);
    const [savingProfile, setSavingProfile] = useState(false);
    const [videoUploadProgress, setVideoUploadProgress] = useState(0);
    const [trackUploadProgress, setTrackUploadProgress] = useState(0);
    const [error, setError] = useState(null);
    const { setMusicianProfile } = useMusicianDashboard();

    const [uploadedVideo, setUploadedVideo] = useState(null);
    const [uploadedTrack, setUploadedTrack] = useState(null);

    const [videoUploads, setVideoUploads] = useState([]);
    const [trackUploads, setTrackUploads] = useState([]);


    useEffect(() => {
        if (!musicianProfile) return;
        const checkForSavedProfile = async () => {
          const isBand = musicianProfile.bandProfile === true;
          setFormData((prev) => ({
            ...prev,
            ...musicianProfile,
            bandProfile: isBand,
          }));
          // Setup videoUploads from existing videos
            const existingVideos = (musicianProfile.videos || []).map((video) => ({
                title: video.title,
                url: video.file,
                thumbnail: video.thumbnail || '',
                progress: 100,
                error: null,
            }));
            setVideoUploads(existingVideos);
        
            // Setup trackUploads from existing tracks
            const existingTracks = (musicianProfile.tracks || []).map((track) => ({
                title: track.title,
                url: track.file,
                progress: 100,
                error: null,
            }));
            setTrackUploads(existingTracks);
        };
        checkForSavedProfile();
    }, [musicianProfile]);

      
    const handleChange = (field, value) => {
        setFormData((prev) => ({
            ...prev,
            [field]: value,
        }));
    };
      
    const handleNestedChange = (section, field, value) => {
        setFormData((prev) => ({
            ...prev,
            [section]: {
            ...prev[section],
            [field]: value,
            },
        }));
    };

    const generateThumbnail = (file) => {
        return new Promise((resolve) => {
            const video = document.createElement('video');
            video.src = URL.createObjectURL(file);
            video.addEventListener('loadeddata', () => {
                video.currentTime = 1; // Seek to 1 second
            });
            video.addEventListener('seeked', () => {
                const canvas = document.createElement('canvas');
                canvas.width = video.videoWidth;
                canvas.height = video.videoHeight;
                const ctx = canvas.getContext('2d');
                ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    
                // Convert the canvas to a Blob and then to a File
                canvas.toBlob((blob) => {
                    const thumbnailFile = new File([blob], `${file.name}_thumbnail.png`, {
                        type: 'image/png',
                        lastModified: Date.now(),
                    });
                    resolve(thumbnailFile); // Resolve with the File object
                }, 'image/png');
            });
        });
    };


    const handleFileChange = async (event) => {
        const file = event.target.files[0];
        if (!file) return;
    
        const title = file.name;
        const thumbnail = await generateThumbnail(file);
    
        // Start with 0% progress
        const newUpload = { title, progress: 0, url: null, thumbnail: null, error: null };
        setVideoUploads((prev) => [...prev, newUpload]);
    
        const uploadIndex = videoUploads.length;
    
        // Upload video
        const videoPath = `musicians/${musicianProfile.musicianId}/videos/${title}`;
        const thumbPath = `musicians/${musicianProfile.musicianId}/videos/thumbnails/${title}_thumbnail`;
    
        try {
            const videoUrl = await uploadFileWithProgress(file, videoPath, (progress) => {
                setVideoUploads((prev) => {
                    const updated = [...prev];
                    updated[uploadIndex].progress = progress;
                    return updated;
                });
            });
        
            const thumbnailUrl = await uploadFileWithProgress(thumbnail, thumbPath);
        
            setVideoUploads((prev) => {
                const updated = [...prev];
                updated[uploadIndex].progress = 100;
                updated[uploadIndex].url = videoUrl;
                updated[uploadIndex].thumbnail = thumbnailUrl;
                return updated;
              });

            const today = new Date().toISOString().split('T')[0];

            const videoData = {
                title,
                file: videoUrl,
                thumbnail: thumbnailUrl,
                date: today,
            };

            setFormData((prev) => ({
                ...prev,
                videos: [...(prev.videos || []), videoData],
              }));
        
        } catch (error) {
            setVideoUploads((prev) => {
                const updated = [...prev];
                updated[uploadIndex].error = error.message;
                return updated;
            });
        }
    };

    const handleAudioUpload = async (event) => {
        const file = event.target.files[0];
        if (!file) return;
      
        const title = file.name;
        const today = new Date().toISOString().split('T')[0];
        const newUpload = { title, progress: 0, url: null, error: null };
        const uploadIndex = trackUploads.length;
      
        setTrackUploads((prev) => [...prev, newUpload]);
      
        const audioPath = `musicians/${musicianProfile.musicianId}/tracks/${title}`;
      
        try {
          const audioUrl = await uploadFileWithProgress(file, audioPath, (progress) => {
            setTrackUploads((prev) => {
              const updated = [...prev];
              updated[uploadIndex].progress = progress;
              return updated;
            });
          });
      
          setTrackUploads((prev) => {
            const updated = [...prev];
            updated[uploadIndex].progress = 100;
            updated[uploadIndex].url = audioUrl;
            return updated;
          });
      
          const trackData = {
            title,
            file: audioUrl,
            date: today,
          };
      
          setFormData((prev) => ({
            ...prev,
            tracks: [...(prev.tracks || []), trackData],
          }));

        } catch (error) {
          setTrackUploads((prev) => {
            const updated = [...prev];
            updated[uploadIndex].error = error.message;
            return updated;
          });
        }
    };

    const handleRemoveVideo = async (uploadIndex, videoUrl, thumbnailUrl, title) => {
        try {
          // Delete both files from Cloud Storage
          await Promise.all([
            videoUrl ? deleteFileFromStorage(videoUrl) : Promise.resolve(),
            thumbnailUrl ? deleteFileFromStorage(thumbnailUrl) : Promise.resolve(),
          ]);
      
          // Remove from local UI state
          setVideoUploads((prev) => prev.filter((_, idx) => idx !== uploadIndex));
      
          // Remove from form data
          handleNestedChange(
            'videos',
            formData.videos?.filter((video) => video.title !== title)
          );
        } catch (err) {
          console.error('Failed to delete media:', err);
        }
    };

    const handleRemoveTrack = async (uploadIndex, audioUrl, title) => {
        try {
          await deleteFileFromStorage(audioUrl);
      
          setTrackUploads((prev) => prev.filter((_, idx) => idx !== uploadIndex));
      
          handleNestedChange(
            'tracks',
            formData.tracks?.filter((track) => track.title !== title)
          );
        } catch (err) {
          console.error('Failed to delete track:', err);
        }
    };

    const handleMediaMetaChange = (type, index, field, value) => {
        setFormData((prev) => {
          const list = Array.isArray(prev[type]) ? [...prev[type]] : [];
          if (!list[index]) return prev;
      
          list[index] = {
            ...list[index],
            [field]: value,
          };
      
          return {
            ...prev,
            [type]: list,
          };
        });
      };

      const handleSetShowcaseVideo = (index) => {
        setFormData((prev) => {
          if (!prev.videos || prev.videos.length <= index) return prev;
      
          const selected = prev.videos[index];
          const reorderedVideos = [
            selected,
            ...prev.videos.filter((_, i) => i !== index),
          ];
      
          return {
            ...prev,
            videos: reorderedVideos,
          };
        });
      
        setVideoUploads((prev) => {
          if (!prev || prev.length <= index) return prev;
      
          const selected = prev[index];
          const reorderedUploads = [
            selected,
            ...prev.filter((_, i) => i !== index),
          ];
      
          return reorderedUploads;
        });
      };

    const genres = {
        'Musician': [
            'Rock', 'Alternative Rock', 'Classic Rock', 'Indie Rock', 'Punk Rock', 'Hard Rock', 'Soft Rock', 'Progressive Rock',
            'Pop', 'Dance Pop', 'Teen Pop', 'Synth-pop', 'Indie Pop',
            'Jazz', 'Smooth Jazz', 'Bebop', 'Swing', 'Cool Jazz', 'Jazz Fusion', 'Free Jazz',
            'Classical', 'Baroque', 'Romantic', 'Contemporary Classical', 'Chamber Music', 'Opera', 'Symphonic',
            'Hip Hop', 'Rap', 'Trap', 'Boom Bap', 'Conscious Hip Hop', 'Gangsta Rap',
            'Country', 'Traditional Country', 'Country Rock', 'Bluegrass', 'Country Pop', 'Americana',
            'Blues', 'Delta Blues', 'Chicago Blues', 'Electric Blues', 'Blues Rock',
            'Reggae', 'Dancehall', 'Dub', 'Ska',
            'Folk', 'Contemporary Folk', 'Traditional Folk', 'Folk Rock', 'Folk Pop',
            'Metal', 'Heavy Metal', 'Thrash Metal', 'Death Metal', 'Black Metal', 'Power Metal', 'Progressive Metal',
            'R&B', 'Soul', 'Neo-Soul', 'Funk', 'Contemporary R&B',
            'Latin', 'Salsa', 'Bachata', 'Merengue', 'Reggaeton', 'Latin Pop',
            'World', 'Afrobeat', 'Bhangra', 'Celtic', 'K-pop', 'J-pop',
            'Electronic', 'Synthwave', 'Electro Pop'
        ],
        'Musician/Band': [
            'Rock', 'Alternative Rock', 'Classic Rock', 'Indie Rock', 'Punk Rock', 'Hard Rock', 'Soft Rock', 'Progressive Rock',
            'Pop', 'Dance Pop', 'Teen Pop', 'Synth-pop', 'Indie Pop',
            'Jazz', 'Smooth Jazz', 'Bebop', 'Swing', 'Cool Jazz', 'Jazz Fusion', 'Free Jazz',
            'Classical', 'Baroque', 'Romantic', 'Contemporary Classical', 'Chamber Music', 'Opera', 'Symphonic',
            'Hip Hop', 'Rap', 'Trap', 'Boom Bap', 'Conscious Hip Hop', 'Gangsta Rap',
            'Country', 'Traditional Country', 'Country Rock', 'Bluegrass', 'Country Pop', 'Americana',
            'Blues', 'Delta Blues', 'Chicago Blues', 'Electric Blues', 'Blues Rock',
            'Reggae', 'Dancehall', 'Dub', 'Ska',
            'Folk', 'Contemporary Folk', 'Traditional Folk', 'Folk Rock', 'Folk Pop',
            'Metal', 'Heavy Metal', 'Thrash Metal', 'Death Metal', 'Black Metal', 'Power Metal', 'Progressive Metal',
            'R&B', 'Soul', 'Neo-Soul', 'Funk', 'Contemporary R&B',
            'Latin', 'Salsa', 'Bachata', 'Merengue', 'Reggaeton', 'Latin Pop',
            'World', 'Afrobeat', 'Bhangra', 'Celtic', 'K-pop', 'J-pop',
            'Electronic', 'Synthwave', 'Electro Pop'
        ],
        'Band': [
            'Rock', 'Alternative Rock', 'Classic Rock', 'Indie Rock', 'Punk Rock', 'Hard Rock', 'Soft Rock', 'Progressive Rock',
            'Pop', 'Dance Pop', 'Teen Pop', 'Synth-pop', 'Indie Pop',
            'Jazz', 'Smooth Jazz', 'Bebop', 'Swing', 'Cool Jazz', 'Jazz Fusion', 'Free Jazz',
            'Classical', 'Baroque', 'Romantic', 'Contemporary Classical', 'Chamber Music', 'Opera', 'Symphonic',
            'Hip Hop', 'Rap', 'Trap', 'Boom Bap', 'Conscious Hip Hop', 'Gangsta Rap',
            'Country', 'Traditional Country', 'Country Rock', 'Bluegrass', 'Country Pop', 'Americana',
            'Blues', 'Delta Blues', 'Chicago Blues', 'Electric Blues', 'Blues Rock',
            'Reggae', 'Dancehall', 'Dub', 'Ska',
            'Folk', 'Contemporary Folk', 'Traditional Folk', 'Folk Rock', 'Folk Pop',
            'Metal', 'Heavy Metal', 'Thrash Metal', 'Death Metal', 'Black Metal', 'Power Metal', 'Progressive Metal',
            'R&B', 'Soul', 'Neo-Soul', 'Funk', 'Contemporary R&B',
            'Latin', 'Salsa', 'Bachata', 'Merengue', 'Reggaeton', 'Latin Pop',
            'World', 'Afrobeat', 'Bhangra', 'Celtic', 'K-pop', 'J-pop',
            'Electronic', 'Synthwave', 'Electro Pop'
        ],
        DJ: [
            'Electronic Dance Music (EDM)', 'House', 'Deep House', 'Tech House', 'Progressive House',
            'Techno', 'Minimal Techno', 'Detroit Techno',
            'Trance', 'Progressive Trance', 'Psytrance',
            'Drum and Bass', 'Liquid Drum and Bass', 'Neurofunk',
            'Dubstep', 'Brostep', 'Chillstep',
            'Trap', 'Festival Trap', 'Chill Trap',
            'Hip Hop', 'Turntablism', 'Rap', 'Trap',
            'R&B', 'Contemporary R&B', 'Neo-Soul',
            'Pop', 'Dance Pop', 'Synth-pop',
            'Reggae', 'Dancehall', 'Dub',
            'Latin', 'Reggaeton', 'Latin House', 'Moombahton',
            'World', 'Afro House', 'K-pop', 'Bollywood',
            'Ambient', 'Chillout', 'Downtempo', 'Ambient House',
            'Experimental', 'Glitch', 'IDM (Intelligent Dance Music)',
            'Funk', 'Disco', 'Nu-Disco', 'Funky House'
        ]
    };

    const instruments = {
        'Musician': [
            'Singer', 'Guitar', 'Bass', 'Drums', 'Piano', 'Keyboard', 'Violin', 'Saxophone', 'Trumpet', 'Flute', 'Cello',
            'Harmonica', 'Banjo', 'Mandolin', 'Harp', 'Accordion'
        ],
        'Musician/Band': [
            'Singer', 'Guitar', 'Bass', 'Drums', 'Piano', 'Keyboard', 'Violin', 'Saxophone', 'Trumpet', 'Flute', 'Cello',
            'Harmonica', 'Banjo', 'Mandolin', 'Harp', 'Accordion'
        ],
        'Band': [
            'Singer', 'Guitar', 'Bass', 'Drums', 'Piano', 'Keyboard', 'Violin', 'Saxophone', 'Trumpet', 'Flute', 'Cello',
            'Harmonica', 'Banjo', 'Mandolin', 'Harp', 'Accordion'
        ],
        'DJ': [
            'Turntable', 'Mixer', 'Controller', 'Synthesizer', 'Drum Machine', 'Sampler', 'Laptop', 'Speakers',
            'Headphones', 'Microphone', 'Lighting', 'DJ Software'
        ]
    };

    const equipmentMapping = {
        Singer: ['Amplifier', 'Microphone', 'Microphone Stand'],
        Guitar: ['Amplifier', 'Guitar Stand'],
        Bass: ['Bass Amplifier', 'Bass Stand'],
        Drums: ['Drum Kit', 'Drum Sticks'],
        Piano: ['Piano Bench', 'Piano'],
        Keyboard: ['Keyboard Stand', 'Keyboard Amplifier'],
        Violin: ['Music Stand'],
        Saxophone: ['Music Stand'],
        Trumpet: ['Music Stand'],
        Flute: ['Music Stand'],
        Cello: ['Music Stand', 'Cello Stand'],
        Harmonica: ['Microphone'],
        Banjo: ['Banjo Stand'],
        Mandolin: ['Mandolin Stand'],
        Harp: ['Harp Stand'],
        Accordion: ['Accordion Stand'],
        Turntable: ['Turntable', 'Mixer'],
        Mixer: ['Mixer', 'Speakers'],
        Controller: ['Controller', 'Laptop Stand'],
        Synthesizer: ['Synthesizer Stand'],
        'Drum Machine': ['Drum Machine Stand'],
        Sampler: ['Sampler Stand'],
        Laptop: ['Laptop Stand'],
        Speakers: ['Speakers'],
        Headphones: ['Headphones'],
        Microphone: ['Microphone', 'Microphone Stand'],
        Lighting: ['Lighting'],
        'DJ Software': ['Laptop']
    };
    const getRequiredEquipment = (selectedInstruments) => {
        if (!Array.isArray(selectedInstruments)) return [];
      
        const requiredEquipment = new Set();
      
        selectedInstruments.forEach((instrument) => {
          const equipmentList = equipmentMapping[instrument];
          if (Array.isArray(equipmentList)) {
            equipmentList.forEach(item => requiredEquipment.add(item));
          }
        });
      
        return Array.from(requiredEquipment);
      };

    const requiredEquipment = getRequiredEquipment(formData.instruments || []);

    const platformIcon = (platform) => {
        if (platform === 'facebook') {
            return <FacebookIcon />
        } else if (platform === 'twitter') {
            return <TwitterIcon />
        } else if (platform === 'instagram') {
            return <InstagramIcon />
        } else if (platform === 'spotify') {
            return <SpotifyIcon />
        } else if (platform === 'soundcloud') {
            return <SoundcloudIcon />
        } else {
            return <YoutubeIcon />
        }
    }

    const [testimonialEmail, setTestimonialEmail] = useState('');
    const [testimonialMessage, setTestimonialMessage] = useState(null);

    const handleSendTestimonialRequest = async () => {
        const email = testimonialEmail.trim();
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

        if (!emailRegex.test(email)) {
            setTestimonialMessage({
            type: 'error',
            message: 'Invalid email address. Please enter a valid email.'
            });
            setTimeout(() => setTestimonialMessage(null), 2500);
            return;
        }

        try {
            await sendEmail({
            to: email,
            subject: `Gigin Testimonial Request From ${formData.name}`,
            text: `${formData.name} has asked if you could provide a testimonial for them on Gigin.`,
            html: `
                <p>${formData.name} has asked if you could provide a testimonial for them on Gigin.</p>
                <p>You can provide your testimonial by clicking the link below:</p>
                <a href='https://gigin.ltd/testimonials?musicianId=${formData.musicianId}&musicianName=${encodeURIComponent(formData.name)}' target='_blank'>Provide Testimonial</a>
            `
            });

            setTestimonialMessage({
            type: 'success',
            message: `Email sent to ${email}`
            });
            setTestimonialEmail('');
        } catch (err) {
            console.error('Error sending testimonial email:', err);
            setTestimonialMessage({
            type: 'error',
            message: 'Failed to send email. Please try again later.'
            });
        }

        setTimeout(() => setTestimonialMessage(null), 3000);
    };

    const generateSearchKeywords = (name) => {
        const lower = name.toLowerCase();
        return Array.from({ length: lower.length }, (_, i) => lower.slice(0, i + 1));
    };


    const handleSubmit = async () => {
        setUploadingProfile(true);
        setVideoUploadProgress(0);
        setTrackUploadProgress(0);
        try {
            let updatedFormData;
            if (formData.name && formData.picture) {
                updatedFormData = {
                    ...formData,
                    completed: true,
                };
            } else {
                updatedFormData = {
                    ...formData,
                    completed: false,
                };
            }
            const pictureFile = formData.picture;
            const pictureUrl = await uploadProfilePicture(pictureFile, formData.musicianId);
            const videoResults = await uploadVideosWithThumbnails(
                formData.videos,
                formData.musicianId,
                'videos',
                setVideoUploadProgress
            );
            const videoMetadata = formData.videos.map((video, index) => ({
                date: video.date,
                title: video.title,
                file: videoResults[index].videoUrl,
                thumbnail: videoResults[index].thumbnailUrl,
            }));
            const trackUrls = await uploadTracks(
                formData.tracks,
                formData.musicianId,
                'tracks',
                setTrackUploadProgress
            );
            const trackMetadata = formData.tracks.map((track, index) => ({
                date: track.date,
                title: track.title,
                file: trackUrls[index],
            }));
            const keywords = generateSearchKeywords(formData.name);
            updatedFormData = {
                ...formData,
                picture: pictureUrl,
                videos: videoMetadata,
                tracks: trackMetadata,
                searchKeywords: keywords,
                email: user?.email,
            };
            await createMusicianProfile(formData.musicianId, updatedFormData, user.uid);
            await updateUserDocument(user.uid, {
                musicianProfile: arrayUnion(formData.musicianId)
            })
            setUploadingProfile(false);
            toast.success('Musician Profile Saved')
        } catch (error) {
            setUploadingProfile(false);
            console.error('Error uploading files or creating musician profile: ', error);
            toast.error('Error saving profile. Please try again.')
        }
    };


    const openModal = (index) => {
        setCurrentIndex(index);
        setShowModal(true);
    };

    const closeModal = () => {
        setShowModal(false);
    };

    const toggleSection = (section) => {
        setExpand(prev =>
          prev.includes(section) ? prev.filter(s => s !== section) : [...prev, section]
        );
      };

    const isPrimaryOpen = expand.includes('primary-information');

    return (
        <>
            <div className={`profile-form ${band ? 'band' : ''}`}>
                <div className="profile-section">

                    {/* COLLAPSED HEADER (shown when NOT expanded) */}
                    {!isPrimaryOpen && (
                    <button
                        className="btn secondary"
                        onClick={() => toggleSection('primary-information')}
                        aria-expanded={false}
                        aria-controls="primary-information-panel"
                    >
                        Edit Name and Profile Picture
                        <EditIcon />
                    </button>
                    )}

                    {/* EXPANDED CONTENT */}
                    {isPrimaryOpen && (
                    <>
                        <div className="section-header">
                        <ProfileIconSolid />
                        <h3>Primary Information</h3>
                        <p>
                            Enter your profile name and picture below. You must complete this section in order to apply to gigs.
                        </p>
                        </div>

                        <div className="input-container name">
                        <label htmlFor="name" className="label">Whats your stage name?</label>
                        <input
                            className="input name"
                            type="text"
                            id="name"
                            value={formData.name}
                            onChange={(e) => handleChange('name', e.target.value)}
                        />
                        {!band && (
                            <button
                            className="btn tertiary"
                            onClick={() => handleChange('name', user.name)}
                            >
                            Use Account Name: {user.name}
                            </button>
                        )}
                        </div>

                        <div className="input-container photo">
                        <h6 className="label">Upload a Profile Picture</h6>
                        {preview && (
                            <div className="image-preview" style={{ backgroundImage: `url(${preview})` }} />
                        )}
                        <label htmlFor="profilePicture" className="upload-button">
                            <CameraIcon className="icon" />
                            {preview ? 'Change Profile Picture' : 'Upload a Profile Picture Here'}
                        </label>
                        <input
                            id="profilePicture"
                            className="hidden-file-input"
                            type="file"
                            accept="image/*"
                            onChange={(e) => {
                            const file = e.target.files[0];
                            if (file) {
                                const url = URL.createObjectURL(file);
                                setPreview(url);
                                handleChange('picture', file);
                            }
                            }}
                        />
                        </div>
                    </>
                    )}

                </div>
                <div className="profile-section">
                    <div className="section-header">
                        <MicrophoneLinesIcon />
                        <h3>Your Sound</h3>
                        <p>Select which genres, instruments and type of music you play.</p>
                    </div>
                    {!band && (
                        <div className="selection-container">
                            <h6 className="label">What type of performer are you?</h6>
                            <div className="selections">
                                <div 
                                    className={`selection-card ${formData.musicianType === 'Musician' ? 'selected' : ''}`}
                                    onClick={() => handleChange('musicianType', 'Musician')}
                                >
                                    <h4 className='text'>Musician</h4>
                                </div>
                                <div 
                                    className={`selection-card ${formData.musicianType === 'DJ' ? 'selected' : ''}`}
                                    onClick={() => handleChange('musicianType', 'DJ')}
                                >
                                    <h4 className='text'>DJ</h4>
                                </div>
                            </div>
                        </div>
                    )}
                    <div className="selection-container">
                        <h6 className="label">What genres do you play?</h6>
                        <div className="selections">
                            {genres[formData.musicianType || 'Musician'].map((g) => (
                                <div
                                    key={g}
                                    className={`selection-card ${formData.genres.includes(g) ? 'selected' : ''}`}
                                    onClick={() =>
                                    handleChange('genres',
                                        formData.genres.includes(g)
                                        ? formData.genres.filter(genre => genre !== g)
                                        : [...formData.genres, g]
                                    )
                                    }
                                >
                                    {g}
                                </div>
                            ))}
                        </div>
                    </div>
                    <div className="selection-container">
                        {band ? (
                            <h6 className="label">What instruments do your band members play?</h6>
                        ) : (
                            <h6 className="label">What instruments do you play?</h6>
                        )}
                        <div className="selections">
                            {instruments[formData.musicianType || 'Musician'].map((i) => (
                                <div
                                    key={i}
                                    className={`selection-card ${formData.instruments.includes(i) ? 'selected' : ''}`}
                                    onClick={() =>
                                    handleChange('instruments',
                                        formData.instruments.includes(i)
                                        ? formData.instruments.filter(instrument => instrument !== i)
                                        : [...formData.instruments, i]
                                    )
                                    }
                                >
                                    {i}
                                </div>
                            ))}
                        </div>
                    </div>
                    <div className="selection-container">
                        <h6 className="label">What type of music do you play?</h6>
                        <div className="selections">
                            {['Covers', 'Originals', 'Both'].map((type) => (
                                <div
                                    key={type}
                                    className={`selection-card ${formData.musicType === type ? 'selected' : ''}`}
                                    onClick={() => handleChange('musicType', type)}
                                >
                                    <h4 className='text'>{type}</h4>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
                <div className="profile-section media">
                    <div className="section-header">
                        <MediaIcon />
                        <h3>Media Upload</h3>
                        {band ? (
                            <p>Upload some videos and tracks of your band playing. Select which video you'd like as your 'showcase' video. This is what the viewers of your profile will see first.</p>
                        ) : (
                            <p>Upload some videos and tracks of yourself. Select which video you'd like as your 'showcase' video. This is what the viewers of your profile will see first.</p>
                        )}
                    </div>

                    <div className="upload-options-container">
                        <div className="upload-option">
                            <input
                                type="file"
                                accept="video/*"
                                id="videoInput"
                                className="hidden-file-input"
                                onChange={handleFileChange}
                            />
                            <label htmlFor="videoInput" className="media-upload-label">
                                <VideoIcon />
                                <span>Video Upload</span>
                            </label>
                        </div>
                        <div className="upload-option">
                            <input
                                type="file"
                                accept="audio/*"
                                id="audioInput"
                                className="hidden-file-input"
                                onChange={handleAudioUpload}
                            />
                            <label htmlFor="audioInput" className="media-upload-label">
                                <MusicianIconSolid />
                                <span>Track Upload</span>
                            </label>
                        </div>
                    </div>

                    {/* Video Section */}
                    <div className="media-section">
                        {videoUploads.length > 0 && (
                            <h6 className="label">Your Videos</h6>
                        )}

                    <div className="upload-progress-list">
                        {videoUploads.map((upload, index) => (
                            <div key={index} className="upload-item">
                                {upload.progress === 100 ? (
                                    <>
                                        <div className='upload-item-top'>
                                            {upload.url ? (
                                                <>
                                                <div className='upload-item-meta'>
                                                    {upload.thumbnail ? (
                                                        <img
                                                            className="media-preview"
                                                            src={upload.thumbnail}
                                                            alt={upload.title}
                                                            onClick={() => openModal(index)}
                                                        />
                                                    ) : (
                                                        <div className="media-preview no-preview" onClick={() => openModal(index)}>
                                                            <Mp4Icon />
                                                        </div>
                                                    )}
                    
                                                    {/* Editable fields */}
                                                    <div className="editable-meta-container">
                                                        <div className='editable-meta'>
                                                            <input
                                                                name='title'
                                                                id='title'
                                                                type="text"
                                                                placeholder='Title this video...'
                                                                value={
                                                                    formData.videos?.[index]?.title || ''
                                                                }
                                                                onChange={(e) =>
                                                                    handleMediaMetaChange('videos', index, 'title', e.target.value)
                                                                }
                                                            />
                                                            <EditIcon />
                                                        </div>
                        
                                                        <div className='editable-meta'>
                                                            <input
                                                                name='date'
                                                                id='date'
                                                                type="date"
                                                                value={
                                                                    formData.videos?.[index]?.date || ''
                                                                }
                                                                onChange={(e) =>
                                                                    handleMediaMetaChange('videos', index, 'date', e.target.value)
                                                                }
                                                            />
                                                            <EditIcon />
                                                        </div>
                                                    </div>
                                                </div>
                                                <div className='media-buttons'>
                                                    <button
                                                    className={`btn showcase ${index === 0 ? 'active' : ''}`}
                                                    onClick={() => handleSetShowcaseVideo(index)}
                                                    >
                                                        {index === 0 && (
                                                                <StarIcon />
                                                        )}
                                                        {index === 0 ? 'Showcase Video' : 'Set Showcase'}
                                                    </button>
                                                    <button
                                                        className="btn danger small"
                                                        onClick={() =>
                                                            handleRemoveVideo(
                                                                index,
                                                                upload.url,
                                                                formData.videos?.find((v) => v.title === upload.title)?.thumbnail,
                                                                upload.title
                                                            )
                                                        }
                                                    >
                                                        Remove
                                                    </button>
                                                </div>
                                                </>
                                            ) : (
                                                <h4>Processing...</h4>
                                            )}
                                        </div>
                                        <div className="upload-item-bottom">
                                            <div className="progress-bar">
                                            <div
                                                className="progress-bar-fill"
                                                style={{ width: `${upload.progress}%` }}
                                            />
                                            </div>
                                            <p>{Math.floor(upload.progress)}%</p>
                                        </div>
                                    </>
                                ) : (
                                    <div className='uploading-item'>
                                        <h4>Uploading media...</h4>
                                        {upload.error ? (
                                            <p className="error">Error: {upload.error}</p>
                                        ) : (
                                            <div className="upload-item-bottom">
                                                <div className="progress-bar">
                                                <div
                                                    className="progress-bar-fill"
                                                    style={{ width: `${upload.progress}%` }}
                                                />
                                                </div>
                                                <p>{Math.floor(upload.progress)}%</p>
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                            ))}
                        </div>
                    </div>

                    <div className="media-section">
                        {trackUploads.length > 0 && (
                            <h6 className="label">Your Tracks</h6>
                        )}

                        <div className="upload-progress-list">
                            {trackUploads.map((upload, index) => (
                            <div key={index} className="upload-item">
                                {upload.progress === 100 ? (
                                <>
                                    <div className="upload-item-top">
                                    <div className="upload-item-meta">
                                        <div className="media-preview no-preview">
                                            <Mp3Icon />
                                        </div>
                                        <div className="editable-meta-container">
                                        <div className="editable-meta">
                                            <input
                                            name="title"
                                            id="track-title"
                                            type="text"
                                            placeholder="Title this track..."
                                            value={formData.tracks?.[index]?.title || ''}
                                            onChange={(e) =>
                                                handleMediaMetaChange('tracks', index, 'title', e.target.value)
                                            }
                                            />
                                            <EditIcon />
                                        </div>

                                        <div className="editable-meta">
                                            <input
                                            name="date"
                                            id="track-date"
                                            type="date"
                                            value={formData.tracks?.[index]?.date || ''}
                                            onChange={(e) =>
                                                handleMediaMetaChange('tracks', index, 'date', e.target.value)
                                            }
                                            />
                                            <EditIcon />
                                        </div>
                                        </div>
                                    </div>

                                        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem'}}>
                                            <audio className="track-preview" src={upload.url} controls />
                                            <button
                                                className="btn danger"
                                                onClick={() =>
                                                handleRemoveTrack(index, upload.url, upload.title)
                                                }
                                            >
                                                Remove
                                            </button>
                                        </div>
                                    </div>


                                    <div className="upload-item-bottom">
                                    <div className="progress-bar">
                                        <div
                                        className="progress-bar-fill"
                                        style={{ width: `${upload.progress}%` }}
                                        />
                                    </div>
                                    <p>{Math.floor(upload.progress)}%</p>
                                    </div>

                                </>
                                ) : (
                                <div className="uploading-item">
                                    <h4>Uploading media...</h4>
                                    {upload.error ? (
                                    <p className="error">Error: {upload.error}</p>
                                    ) : (
                                    <div className="upload-item-bottom">
                                        <div className="progress-bar">
                                        <div
                                            className="progress-bar-fill"
                                            style={{ width: `${upload.progress}%` }}
                                        />
                                        </div>
                                        <p>{Math.floor(upload.progress)}%</p>
                                    </div>
                                    )}
                                </div>
                                )}
                            </div>
                            ))}
                        </div>
                    </div>

                </div>
                <div className="profile-section">
                    <div className="section-header">
                        <MoreInformationIcon />
                        <h3>Further Information</h3>
                        <p>Let's get some more details. The more information you upload, the more chance venues will accept your gig applications.</p>
                    </div>
                    <div className="selection-container">
                        <h6 className="label">What equipment can you take to gigs with you?</h6>
                        <div className="selections">
                            {requiredEquipment.map((equipment, index) => (
                                <div key={index} className={`selection-card`}>
                                    {equipment}
                                </div>
                            ))}
                        </div>
                    </div>
                    <div className="section-inputs">
                        <div className="input-container">
                            <label htmlFor="location" className='label'>Where are you based?</label>
                            <input
                                type='text'
                                className='input'
                                value={formData.location.city}
                                onChange={(e) => handleNestedChange('location', 'city', e.target.value)}
                            />
                        </div>
                        <div className="selection-container">
                            <h6 className='label'>How far are you willing to travel?</h6>
                            <div className="selections">
                                {['5 miles', '25 miles', '50 miles', '100 miles', 'Nationwide'].map((distance) => (
                                    <div
                                        key={distance}
                                        className={`selection-card ${formData.location.travelDistance === distance ? 'selected' : ''}`}
                                        onClick={() => handleNestedChange('location', 'travelDistance', distance)}
                                    >
                                        <h4 className='text'>{distance}</h4>
                                    </div>
                                ))}
                            </div>
                        </div>
                        <div className="input-container">
                            <label htmlFor="bio" className='label'>Write a bio for your profile</label>
                            <textarea
                                className='input bio'
                                style={{ width: '50%', height: '200px', minWidth: 300, resize: 'none' }}
                                
                                value={formData.bio.text}
                                onChange={(e) => handleNestedChange('bio', 'text', e.target.value)}
                            />
                        </div>
                        <div className="selection-container">
                            <h6 className='label'>How long have you been performing?</h6>
                            <div className="selections">
                                {['Less than 1 year', '1-2 years', '2-5 years', '5+ years'].map((exp) => (
                                    <div
                                        key={exp}
                                        className={`selection-card ${formData.bio.experience === exp ? 'selected' : ''}`}
                                        onClick={() => handleNestedChange('bio', 'experience', exp)}
                                    >
                                        <h4 className='text'>{exp}</h4>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>
                <div className="profile-section">
                    <div className="section-header">
                        <SocialMediaIcon />
                        <h3>Social Media and Testimonials</h3>
                        <p>Link your social media accounts and request for fans, friends or family to testify your performing.</p>
                    </div>
                    <div className="section-inputs">
                        <div className='input-container'>
                            <label htmlFor='email' className="label">Send a testimonial request to someone</label>
                            {testimonialMessage ? (
                                <p className={`message ${testimonialMessage.type}`}>
                                {testimonialMessage.type === 'error' ? <ErrorIcon /> : <TickIcon />}
                                {testimonialMessage.message}
                                </p>
                            ) : (
                                <>
                                <input
                                    type='email'
                                    className='input email'
                                    name='email'
                                    id='email'
                                    value={testimonialEmail}
                                    onChange={(e) => setTestimonialEmail(e.target.value)}
                                    placeholder='Enter email address for testimonial'
                                />
                                <button className='btn tertiary' onClick={handleSendTestimonialRequest}>Send</button>
                                </>
                            )}
                        </div>
                        <div className="input-container">
                            <h6 className="label">Add links to your social media accounts</h6>
                            <div className='inputs'>
                                {Object.keys(formData.socialMedia).map((platform) => (
                                    <div key={platform} className='social-media-input'>
                                        <label htmlFor={platform} className={`${platform}-icon`}>{platformIcon(platform)}</label>
                                        <input
                                            type='url'
                                            className='input'
                                            id={platform}
                                            value={formData.socialMedia[platform]}
                                            onChange={(e) => handleNestedChange('socialMedia', platform, e.target.value)}
                                            placeholder={`Enter your ${platform} URL`}
                                        />
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>
                <div className="action-buttons">
                    <button className="btn primary" onClick={handleSubmit}>
                        Save
                    </button>
                    <button className="btn tertiary" onClick={() => setFormData(musicianProfile)}>
                        Discard Changes
                    </button>
                </div>
                {showModal && <VideoModal video={videoUploads[currentIndex]} onClose={closeModal} />}
            </div>
        </>
    );
};
