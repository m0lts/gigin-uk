import { useEffect, useState } from 'react';
import { EditIcon, StarIcon } from '@features/shared/ui/extras/Icons';
import '@styles/musician/musician-profile.styles.css'
import { OverviewTab } from '@features/musician/profile/OverviewTab';
import { MusicTab } from '@features/musician/profile/MusicTab';
import { ReviewsTab } from '@features/musician/profile/ReviewsTab';
import { useLocation, useNavigate } from 'react-router-dom';
import { updateMusicianProfile } from '@services/musicians';
import { BackgroundMusicIcon, CameraIcon, ErrorIcon, FacebookIcon, InstagramIcon, SoundcloudIcon, SpotifyIcon, TickIcon, TwitterIcon, VideoIcon, YoutubeIcon } from '../../shared/ui/extras/Icons';
import { sendEmail } from '@services/emails';
import { v4 as uuidv4 } from 'uuid';
import { updateUserDocument } from '@services/users';
import { createMusicianProfile } from '@services/musicians';
import { uploadProfilePicture, uploadTracks, uploadVideosWithThumbnails } from '@services/storage';
import { useMusicianDashboard } from '../../../context/MusicianDashboardContext';
import { arrayUnion } from 'firebase/firestore';
import { toast } from 'sonner';


export const ProfileTab = ({ user, musicianProfile }) => {
    const [activeTab, setActiveTab] = useState('overview');
    const [editingMedia, setEditingMedia] = useState(false);
    const [localVideos, setLocalVideos] = useState(musicianProfile.videos || []);
    const [localTracks, setLocalTracks] = useState(musicianProfile.tracks || []);
    const [preview, setPreview] = useState('');
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
      const [showErrorModal, setShowErrorModal] = useState(false);
      const [uploadingProfile, setUploadingProfile] = useState(false);
      const [savingProfile, setSavingProfile] = useState(false);
      const [videoUploadProgress, setVideoUploadProgress] = useState(0);
      const [trackUploadProgress, setTrackUploadProgress] = useState(0);
      const [error, setError] = useState(null);
      const { setMusicianProfile } = useMusicianDashboard();

      useEffect(() => {
        if (!musicianProfile) return;
        const checkForSavedProfile = async () => {
          const isBand = musicianProfile.bandProfile === true;
          setFormData((prev) => ({
            ...prev,
            ...musicianProfile,
            bandProfile: isBand,
          }));
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

    const renderActiveTabContent = () => {
        switch (activeTab) {
            case 'overview':
                return <OverviewTab musicianData={musicianProfile} />; 
            case 'music':
                return <MusicTab 
                videos={localVideos}
                tracks={localTracks}
                setVideos={setLocalVideos}
                setTracks={setLocalTracks}
                musicianId={musicianProfile.musicianId} 
                editingMedia={editingMedia} 
                setEditingMedia={setEditingMedia}
                
                />;
            case 'reviews':
                return <ReviewsTab profile={musicianProfile} />;
            default:
                return null;
        }        
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


    return (
        <>
            <div className="head">
                <h1>Your Musician Profile</h1>
            </div>
            <div className='body profile'>
                <div className="profile-section">
                    <div className="section-header">
                        <h3>Primary Information</h3>
                        <p>Enter your profile name and picture below. You must fill this in in order to apply to gigs.</p>
                    </div>
                    <div className="section-inputs">
                        <div className="input-container">
                            <label htmlFor="name" className='label'>Whats your stage name?</label>
                            <input
                                className='input name'
                                type='text'
                                id='name'
                                value={formData.name}
                                onChange={(e) => handleChange('name', e.target.value)}
                            />
                            <button className='btn secondary' onClick={() => handleChange('name', user.name)}>
                                Use Account Name
                            </button>
                        </div>
                        <div className='image-container'>
                            <label htmlFor="profilePicture" className='label'>Upload a Profile Picture</label>
                            <input
                                className='input photo'
                                type='file'
                                accept='image/*'
                                onChange={(e) => {
                                    const file = e.target.files[0];
                                    if (file) {
                                    const url = URL.createObjectURL(file);
                                    setPreview(url);
                                    handleChange('picture', file);
                                    }
                                }}
                            />
                            <div className='image-preview' style={{ backgroundImage: `url(${preview})` }}>
                                {!preview && (
                                    <CameraIcon />
                                )}
                            </div>
                        </div>
                    </div>
                </div>
                <div className="profile-section">
                    <div className="section-header">
                        <h3>Your Sound</h3>
                        <p>Select which genres, instruments and type of music you play.</p>
                    </div>
                    <div className="selection-container">
                        <h6 className="label">What type of performer are you?</h6>
                        <div 
                            className={`selection-card ${formData.musicianType === 'Musician' ? 'selected' : ''}`}
                            onClick={() => handleChange('musicianType', 'Musician')}
                        >
                            <h4 className='text'>Musician</h4>
                        </div>
                        <div 
                            className={`selection-card ${formData.musicianType === 'Band' ? 'selected' : ''}`}
                            onClick={() => handleChange('musicianType', 'Band')}
                        >
                            <h4 className='text'>Band</h4>
                        </div>
                        <div 
                            className={`selection-card ${formData.musicianType === 'DJ' ? 'selected' : ''}`}
                            onClick={() => handleChange('musicianType', 'DJ')}
                        >
                            <h4 className='text'>DJ</h4>
                        </div>
                    </div>
                    <div className="selection-container">
                        <h6 className="label">What genres do you play?</h6>
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
                    <div className="selection-container">
                        <h6 className="label">What instruments do you play?</h6>
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
                    <div className="selection-container">
                        <h6 className="label">What type of music do you play?</h6>
                        {['Covers', 'Originals', 'Both'].map((type) => (
                            <div
                                className={`selection-card ${formData.musicType === type ? 'selected' : ''}`}
                                onClick={() => handleChange('musicType', type)}
                            >
                                <h4 className='text'>{type}</h4>
                            </div>
                        ))}
                    </div>
                </div>
                <div className="profile-section">
                    <div className="section-header">
                        <h3>Media Upload</h3>
                        <p>Upload some videos and tracks of yourself.</p>
                    </div>
                    <div className="section-inputs">
                        <div className="media-upload">
                            <input
                                type='file'
                                accept='video/*'
                                // onChange={handleFileChange}
                                style={{ display: 'none' }}
                                id='fileInput'
                            />
                            <label htmlFor='fileInput' className='media-upload-label'>
                                <VideoIcon />
                                <span>Upload Video...</span>
                            </label>
                        </div>
                        <div className="media-upload">
                            <input
                                type='file'
                                accept='audio/*'
                                // onChange={handleFileChange}
                                style={{ display: 'none' }}
                                id='fileInput'
                            />
                            <label htmlFor='fileInput' className='media-upload-label'>
                                <BackgroundMusicIcon />
                                <span>Upload Track...</span>
                            </label>
                        </div>
                    </div>
                </div>
                <div className="profile-section">
                    <div className="section-header">
                        <h3>Further Information</h3>
                        <p>Let's get some more details. The more information you upload, the more chance venues will accept your gig applications.</p>
                    </div>
                    <div className="selection-container">
                        <h6 className="label">What equipment can you take to gigs with you?</h6>
                        {requiredEquipment.map((equipment, index) => (
                            <div key={index} className={`selection-card`}>
                                {equipment}
                            </div>
                        ))}
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
                        <div className="input-container">
                            <h6 className='label'>How far are you willing to travel?</h6>
                            {['5 miles', '25 miles', '50 miles', '100 miles', 'Nationwide'].map((distance) => (
                                <div
                                    className={`selection-card ${formData.location.travelDistance === distance ? 'selected' : ''}`}
                                    onClick={() => handleNestedChange('location', 'travelDistance', distance)}
                                >
                                    <h4 className='text'>{distance}</h4>
                                </div>
                            ))}
                        </div>
                        <div className="input-container">
                            <label htmlFor="bio" className='label'>Write a bio for your profile.</label>
                            <textarea
                                className='input bio'
                                value={formData.bio.text}
                                onChange={(e) => handleNestedChange('bio', 'text', e.target.value)}
                            />
                        </div>
                        <div className="input-container">
                            <h6 className='label'>How long have you been performing?</h6>
                            {['Less than 1 year', '1-2 years', '2-5 years', '5+ years'].map((exp) => (
                                <div
                                    className={`selection-card ${formData.bio.experience === exp ? 'selected' : ''}`}
                                    onClick={() => handleNestedChange('bio', 'experience', exp)}
                                >
                                    <h4 className='text'>{exp}</h4>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
                <div className="profile-section">
                    <div className="section-header">
                        <h3>Social Media and Testimonials</h3>
                        <p>Link your social media accounts and request for fans, friends or family to testify your performing.</p>
                    </div>
                    <div className="section-inputs">
                        <div className='input-container'>
                            <label htmlFor='email' className="label">Send a testimonial request to someone.</label>
                            {testimonialMessage ? (
                                <p className={`message ${testimonialMessage.type}`}>
                                {testimonialMessage.type === 'error' ? <ErrorIcon /> : <TickIcon />}
                                {testimonialMessage.message}
                                </p>
                            ) : (
                                <>
                                <input
                                    type='email'
                                    className='input'
                                    name='email'
                                    id='email'
                                    value={testimonialEmail}
                                    onChange={(e) => setTestimonialEmail(e.target.value)}
                                    placeholder='Enter email address for testimonial'
                                />
                                <button className='btn primary' onClick={handleSendTestimonialRequest}>Send</button>
                                </>
                            )}
                        </div>
                        <div className="input-container">
                            <h6 className="label">Add links to your social media accounts.</h6>
                            <div className='social-media-inputs'>
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
            </div>
        </>
    );
};

// export const ProfileTab = ({ musicianProfile }) => {
//     const [activeTab, setActiveTab] = useState('overview');
//     const [editingMedia, setEditingMedia] = useState(false);
//     const [localVideos, setLocalVideos] = useState(musicianProfile.videos || []);
//     const [localTracks, setLocalTracks] = useState(musicianProfile.tracks || []);

//     const navigate = useNavigate();
//     const location = useLocation();

//     const renderActiveTabContent = () => {
//         switch (activeTab) {
//             case 'overview':
//                 return <OverviewTab musicianData={musicianProfile} />; 
//             case 'music':
//                 return <MusicTab 
//                 videos={localVideos}
//                 tracks={localTracks}
//                 setVideos={setLocalVideos}
//                 setTracks={setLocalTracks}
//                 musicianId={musicianProfile.musicianId} 
//                 editingMedia={editingMedia} 
//                 setEditingMedia={setEditingMedia}
                
//                 />;
//             case 'reviews':
//                 return <ReviewsTab profile={musicianProfile} />;
//             default:
//                 return null;
//         }        
//     };    

//     const editMusicianProfileRedirect = () => {
//         if (!musicianProfile) return;
//         const { ref, ...safeProfile } = musicianProfile;
//         navigate('/create-profile', { state: { musicianProfile: safeProfile } });
//       };


//     const saveChanges = async () => {
//         try {
//             await updateMusicianProfile(musicianProfile.musicianId, {
//                 videos: localVideos,
//                 tracks: localTracks,
//               });
//             setEditingMedia(false);
//         } catch (error) {
//             console.error('Error saving changes:', error);
//             alert('Failed to save changes. Please try again. If the issue persists, contact support.');
//         }
//     };


//     return (
//         <>
//             <div className="head">
//                 <h1>Your Profile</h1>
//             </div>
//             <div className='body profile'>
//                 <div className='profile-view'>
//                     <div className='profile-banner' style={{
//                             padding: location.pathname.includes('dashboard') ? '2rem 5%' : '2rem 0',
//                         }}>
//                         <div className='profile-information'>
//                             <figure className='profile-picture'>
//                                 <img src={musicianProfile.picture} alt={`${musicianProfile.name}'s Profile Picture`} />
//                             </figure>
//                             <div className='profile-details'>
//                                 <div className='name'>
//                                     <h1>{musicianProfile.name}</h1>
//                                     <h4>Musician</h4>
//                                     <button className='btn icon' onClick={editMusicianProfileRedirect}>
//                                         <EditIcon />
//                                     </button>
//                                 </div>
//                                 <div className='data'>
//                                     {musicianProfile.avgReviews && (
//                                         <h6><StarIcon /> {musicianProfile.avgReviews.avgRating} ({musicianProfile.avgReviews.totalReviews})</h6>
//                                     )}
//                                     <h6>{musicianProfile.clearedFees && musicianProfile.clearedFees.length || '0'} gigs played</h6>
//                                 </div>
//                                 <div className='genre-tags'>
//                                     {musicianProfile.genres && musicianProfile.genres.map((genre, index) => (
//                                         <div className='genre-tag' key={index}>
//                                             {genre}
//                                         </div>
//                                     ))}
//                                 </div>
//                             </div>
//                         </div>
//                         {editingMedia && (
//                             <button className='btn primary' onClick={saveChanges}>
//                                 Save Changes
//                             </button>
//                         )}
//                     </div>
//                     <nav className='profile-tabs' style={{
//                             margin: location.pathname.includes('dashboard') ? '0 5%' : undefined,
//                         }}>
//                         <p onClick={() => setActiveTab('overview')} className={`profile-tab ${activeTab === 'overview' ? 'active' : ''}`}>
//                             Overview
//                         </p>
//                         <p onClick={() => setActiveTab('music')} className={`profile-tab ${activeTab === 'music' ? 'active' : ''}`}>
//                             Music
//                         </p>
//                         <p onClick={() => setActiveTab('reviews')} className={`profile-tab ${activeTab === 'reviews' ? 'active' : ''}`}>
//                             Reviews
//                         </p>
//                     </nav>
//                     <div className='profile-sections' style={{
//                             margin: location.pathname.includes('dashboard') ? '0 5%' : undefined,
//                         }}>
//                         {renderActiveTabContent()}
//                     </div>
//                 </div>
//             </div>
//         </>
//     );
// };