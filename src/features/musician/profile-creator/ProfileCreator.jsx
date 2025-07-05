import { useState, useEffect } from 'react';
import { LeftChevronIcon} from '@features/shared/ui/extras/Icons';
import { v4 as uuidv4 } from 'uuid';
import { useAuth } from '@hooks/useAuth';
import { ProgressBar } from './ProgressBar';
import { arrayUnion } from 'firebase/firestore';

import '@styles/musician/profile-creator.styles.css'

// Importing stage components
import { NameStage } from './NameStage';
import { ProfilePictureStage } from './ProfilePictureStage';
import { LocationStage } from './LocationStage';
import { GenresStage } from './GenresStage';
import { MusicTypeStage } from './MusicTypeStage';
import { InstrumentsStage } from './InstrumentsStage';
import { EquipmentStage } from './EquipmentStage';
import { BioStage } from './BioStage';
import { VideosStage } from './VideosStage';
import { TracksStage } from './TracksStage';
import { SocialMediaStage } from './SocialMediaStage';
import { FinalStage } from './FinalStage';
import { MusicianTypeStage } from './MusicianTypeStage';
import { LoadingThreeDots } from '@features/shared/ui/loading/Loading';
import { useLocation, useNavigate } from 'react-router-dom';
import { updateUserDocument } from '@services/users';
import { createMusicianProfile } from '@services/musicians';
import { uploadProfilePicture, uploadTracks, uploadVideosWithThumbnails } from '@services/storage';

export const ProfileCreator = () => {

    const { user } = useAuth();
    const location = useLocation();
    const musicianProfile = location.state?.musicianProfile;
    const band = location.state?.musicianProfile.bandProfile;
    const navigate = useNavigate();
    const [showErrorModal, setShowErrorModal] = useState(false);

    const mapboxToken = import.meta.env.DEV ? 
    'pk.eyJ1IjoiZ2lnaW4iLCJhIjoiY2xwNDQ2ajFwMWRuNzJxczZqNHlvbHg3ZCJ9.nR_HaL-dWRkUhOgBnmbyjg'
    : import.meta.env.VITE_MAPBOX_TOKEN;

    const [stage, setStage] = useState(musicianProfile ? 1 : 0);
    const [formData, setFormData] = useState({
        musicianId: uuidv4(),
        email: user ? user.email : '',
        name: '',
        picture: '',
        location: { city: 'Cambridge', coordinates: [0.1313, 52.1951], travelDistance: '' },
        musicianType: '',
        genres: [],
        musicType: '',
        instruments: [],
        equipmentRequired: [],
        bio: {
            text: '',
            experience: '',
        },
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
    const [uploadingProfile, setUploadingProfile] = useState(false);
    const [savingProfile, setSavingProfile] = useState(false);
    const [videoUploadProgress, setVideoUploadProgress] = useState(0);
    const [trackUploadProgress, setTrackUploadProgress] = useState(0);
    const [error, setError] = useState(null);

    useEffect(() => {
        if (!musicianProfile) return;
      
        const checkForSavedProfile = async () => {
          const isBand = musicianProfile.bandProfile === true;
      
          setFormData((prev) => ({
            ...prev,
            ...musicianProfile,
            bandProfile: isBand,
          }));
      
          const startingStep = isBand ? 3 : (musicianProfile.currentStep || 1);
          setStage(startingStep);
        };
      
        checkForSavedProfile();
      }, [musicianProfile]);

    useEffect(() => {
        if (user?.venueProfiles && user.venueProfiles.length > 0) {
            setShowErrorModal(true);
        }
    }, [user]);

    useEffect(() => {
        const handlePopState = (event) => {
            if (event.state && event.state.stage !== undefined) {
                setStage(event.state.stage);
                setError(null);
            }
        };
        window.addEventListener('popstate', handlePopState);
        return () => {
            window.removeEventListener('popstate', handlePopState);
        };
    }, []);

    const handleNext = () => {
        if (validateStage(stage)) {
            const nextStage = stage + 1;
            setStage(nextStage);
            setError(null);
            window.history.pushState({ stage: nextStage }, '');
        }
    };

    const handlePrevious = () => {
        if (stage > 0) {
            const prevStage = stage - 1;
            setStage(prevStage);
            setError(null);
            window.history.pushState({ stage: prevStage }, '');
        }
    };

    const validateStage = (currentStage) => {
        let validationError = null;
        switch (currentStage) {
            case 1:
                if (formData.name.trim() === '') validationError = 'name';
                break;
            case 2:
                if (formData.picture === '') validationError = 'picture';
                break;
            case 3:
                if (formData.location.city.trim() === '') validationError = 'city';
                if (formData.location.travelDistance.trim() === '') validationError = 'travelDistance';
                break;
            case 4:
                if (formData.musicianType.trim() === '') validationError = 'musicianType';
                break;
            case 5:
                if (formData.genres.length === 0) validationError = 'genres';
                break;
            case 6:
                if (formData.musicType.trim() === '') validationError = 'musicType';
                break;
            case 7:
                if (formData.instruments.length === 0) validationError = 'instruments';
                break;
            case 9:
                if (formData.bio.text.trim() === '') validationError = 'bio.text';
                if (formData.bio.experience.trim() === '') validationError = 'bio.experience';
                break;
            case 10:
                if (formData.videos.length === 0) validationError = 'videos';
                break;
            default:
                break;
        }
        if (error !== validationError) {
            setError(validationError);
        }
        return validationError === null;
    };


    const handleChange = (name, value) => {
        setFormData({
            ...formData,
            [name]: value
        });
    };

    const handleSubmit = async () => {
        setUploadingProfile(true);
        setVideoUploadProgress(0);
        setTrackUploadProgress(0);
        try {
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
            const updatedFormData = {
                ...formData,
                picture: pictureUrl,
                videos: videoMetadata,
                tracks: trackMetadata,
                completed: true,
                email: user?.email,
            };
            await createMusicianProfile(formData.musicianId, updatedFormData, user.uid);
            await updateUserDocument(user.uid, {
                musicianProfile: arrayUnion(formData.musicianId)
            })
            const redirectTo = location.state?.redirectToInvite;
            if (redirectTo) {
                navigate(`/join-band?invite=${redirectTo}`);
                window.location.reload();
            } else {
                navigate('/find-a-gig', { state: { newUser: true } });
                window.location.reload();
            }
            setUploadingProfile(false);
        } catch (error) {
            setUploadingProfile(false);
            console.error('Error uploading files or creating musician profile: ', error);
        }
    };

    const handleSaveAndExit = async () => {
        setSavingProfile(true);
        if (formData.name === '') {
            navigate('/find-a-gig');
            setSavingProfile(false);
            return;
        }
        try {
            let updatedFormData;
            if (formData.completed) {
                updatedFormData = {
                    ...formData,
                    completed: true,
                };
                delete formData.currentStep;
            } else {
                updatedFormData = {
                    ...formData,
                    currentStep: stage,
                    completed: false,
                };
            }
            const pictureFile = formData.picture;
            const pictureUrl = await uploadProfilePicture(pictureFile, formData.musicianId);
            updatedFormData.picture = pictureUrl;
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
            updatedFormData.videos = videoMetadata;
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
            updatedFormData.tracks = trackMetadata;    
            await createMusicianProfile(formData.musicianId, updatedFormData, user.uid);    
            if (updatedFormData.completed) {
                navigate('/dashboard')
            } else {
                navigate('/find-a-gig');
            }
            setSavingProfile(false);
        } catch (error) {
            console.error('Error uploading files or saving musician profile: ', error);
            setSavingProfile(false);
        }
    };


    const stages = [
        <div className='stage intro'>
            <h1>Welcome to the musician profile creator!</h1>
            <h4>Before you apply to gigs on Gigin, you need to show the venue your talent!</h4>
            <p>This should only take around 5 minutes. We advise that you have a showcase video ready to upload.</p>
        </div>,
        <NameStage data={formData.name} onChange={handleChange} user={user} error={error} setError={setError} band={band} />,
        <ProfilePictureStage data={formData.picture} onChange={handleChange} error={error} setError={setError} band={band} />,
        <LocationStage data={formData.location} onChange={handleChange} mapboxToken={mapboxToken} error={error} setError={setError} band={band} />,
        <MusicianTypeStage data={formData.musicianType} onChange={handleChange} error={error} setError={setError} band={band} />,
        <GenresStage data={formData.genres} onChange={handleChange} musicianType={formData.musicianType} error={error} setError={setError} band={band} />,
        <MusicTypeStage data={formData.musicType} onChange={handleChange} error={error} setError={setError} band={band} />,
        <InstrumentsStage data={formData.instruments} onChange={handleChange} musicianType={formData.musicianType} error={error} setError={setError} band={band} />,
        <EquipmentStage data={formData.equipmentRequired} onChange={handleChange} instruments={formData.instruments} error={error} setError={setError} band={band} />,
        <BioStage data={formData.bio} onChange={handleChange} error={error} setError={setError} band={band} />,
        <VideosStage data={formData.videos} onChange={handleChange} error={error} setError={setError} band={band} />,
        <SocialMediaStage data={formData.socialMedia} onChange={handleChange} error={error} setError={setError} band={band} />,
        <FinalStage musicianName={formData.name} musicianId={formData.musicianId} error={error} setError={setError} band={band} />
    ];

    return (
        <div className='profile-creator'>
            {uploadingProfile ? (
                <div className='loading-state'>
                    <h1>Creating your musician profile...</h1>
                    <h3>Uploading videos: {videoUploadProgress}%</h3>
                    <progress value={videoUploadProgress} max='100' style={{ width: '100%', maxWidth: '250px' }}></progress>                    
                    <LoadingThreeDots />
                    <h3>Please don't refresh or leave this page. You will be redirected automatically.</h3>
                </div>
            ) : savingProfile ? (
                <div className='loading-state'>
                    <h1>Saving your musician profile...</h1>
                    <h3>This may take a while if you added any new videos or tracks.</h3>
                    <LoadingThreeDots />
                    <h3>Please don't refresh or leave this page.</h3>
                </div>
            ) : (
                <>
                    <div className='top'>
                        <button className='btn secondary save-and-exit' onClick={handleSaveAndExit}>
                            Save and Exit
                        </button>
                    </div>
                    {stages[stage]}
                    <div className='bottom'>
                        <ProgressBar currentStage={stage} totalStages={stages.length} />
                        <div className={`${stage === 0 && 'single'} controls`}>
                            {stage > 0 && (
                                <button className='btn secondary' onClick={handlePrevious}>
                                    <LeftChevronIcon />
                                </button>
                            )}
                            {stage < stages.length - 1 ? (
                                <button className='btn primary' onClick={handleNext} disabled={!validateStage(stage)}>Continue</button>
                            ) : (
                                stage > 0 && <button className='btn primary' onClick={() => handleSubmit()} disabled={!validateStage(stage)}>Submit</button>
                            )}
                        </div>
                    </div>
                </>
            )}
            {showErrorModal && (
                <div className='modal'>
                    <div className='modal-content'>
                        <h3>Oops!</h3>
                        <p>You are already signed up as a venue. We don't allow two profiles for the time being, check back soon!</p>
                        <button className='btn primary' onClick={() => {setShowErrorModal(false); navigate('/venues/dashboard')}}>Got it!</button>
                        <button className='btn close tertiary' onClick={() => {setShowErrorModal(false); navigate('/venues/dashboard')}}>Close</button>
                    </div>
                </div>
            )}
        </div>
    );
};


