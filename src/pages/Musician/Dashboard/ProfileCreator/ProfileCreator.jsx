import { useState, useEffect } from 'react';
import { LeftChevronIcon, ExitIcon } from '/components/ui/Extras/Icons'
import { v4 as uuidv4 } from 'uuid';
import { useAuth } from '../../../../hooks/useAuth';
import { ProgressBar } from './ProgressBar';
import { storage, firestore } from "../../../../firebase";
import { ref, uploadBytes, getDownloadURL, uploadBytesResumable } from 'firebase/storage';
import { collection, query, where, getDocs, doc, setDoc, updateDoc, arrayUnion, deleteDoc, arrayRemove } from 'firebase/firestore';

import '/styles/musician/profile-creator.styles.css'

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
import { LoadingThreeDots } from '../../../../components/ui/loading/Loading';
import { useLocation, useNavigate } from 'react-router-dom';

export const ProfileCreator = () => {

    const { user } = useAuth();
    const location = useLocation();
    const musicianProfile = location.state?.musicianProfile;
    const navigate = useNavigate();
    const [showErrorModal, setShowErrorModal] = useState(false);

    const mapboxToken = import.meta.env.VITE_MAPBOX_TOKEN;

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
        }
    });
    const [uploadingProfile, setUploadingProfile] = useState(false);
    const [savingProfile, setSavingProfile] = useState(false);
    const [videoUploadProgress, setVideoUploadProgress] = useState(0);
    const [trackUploadProgress, setTrackUploadProgress] = useState(0);
    const [error, setError] = useState(null);

    useEffect(() => {
        const checkForSavedProfile = async () => {
            if (musicianProfile) {
                setFormData(musicianProfile);
                setStage(musicianProfile.currentStep ? musicianProfile.currentStep : 1)
            }
        };
        if (musicianProfile) checkForSavedProfile();
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

    const uploadVideosToFirebaseStorage = async (mediaFiles, musicianId, folder, setVideoUploadProgress) => {
        let totalBytesTransferred = 0;
        let totalBytes = mediaFiles.reduce((acc, media) => acc + media.file.size, 0);
    
        const uploadPromises = mediaFiles.map(async (media) => {
            let videoUrl = media.file;
    
            if (typeof media.file !== 'string') {
                const videoStorageRef = ref(storage, `musicians/${musicianId}/${folder}/${media.title}`);
                const uploadTask = uploadBytesResumable(videoStorageRef, media.file);
    
                uploadTask.on('state_changed', (snapshot) => {
                    totalBytesTransferred += snapshot.bytesTransferred;
                    const progress = (totalBytesTransferred / totalBytes) * 100;
                    setVideoUploadProgress(Math.min(Math.round(progress), 100)); // Ensure it does not exceed 100
                });
    
                await uploadTask;
                videoUrl = await getDownloadURL(videoStorageRef);
            }
    
            let thumbnailUrl = media.thumbnail;
            if (typeof media.thumbnail !== 'string') {
                const thumbnailStorageRef = ref(storage, `musicians/${musicianId}/${folder}/thumbnails/${media.title}_thumbnail`);
                const uploadTask = uploadBytesResumable(thumbnailStorageRef, media.thumbnail);
    
                uploadTask.on('state_changed', (snapshot) => {
                    totalBytesTransferred += snapshot.bytesTransferred;
                    const progress = (totalBytesTransferred / totalBytes) * 100;
                    setVideoUploadProgress(Math.min(Math.round(progress), 100));
                });
    
                await uploadTask;
                thumbnailUrl = await getDownloadURL(thumbnailStorageRef);
            }
    
            return { videoUrl, thumbnailUrl };
        });
    
        return Promise.all(uploadPromises);
    };

    const uploadTracksToFirebaseStorage = async (mediaFiles, musicianId, folder, setTrackUploadProgress) => {
        let totalBytesTransferred = 0;
        let totalBytes = mediaFiles.reduce((acc, media) => acc + media.file.size, 0);
    
        const uploadPromises = mediaFiles.map(async (media) => {
            if (typeof media.file === 'string') {
                return media.file;
            }
    
            const storageRef = ref(storage, `musicians/${musicianId}/${folder}/${media.title}`);
            const uploadTask = uploadBytesResumable(storageRef, media.file);
    
            uploadTask.on('state_changed', (snapshot) => {
                totalBytesTransferred += snapshot.bytesTransferred;
                const progress = (totalBytesTransferred / totalBytes) * 100;
                setTrackUploadProgress(Math.min(Math.round(progress), 100));
            });
    
            await uploadTask;
            const url = await getDownloadURL(storageRef);
            return url;
        });
    
        return Promise.all(uploadPromises);
    };

    const uploadProfilePictureToFirebaseStorage = async (picture, musicianId) => {
        if (typeof picture === 'string') {
            return picture;
        }
    
        const storageRef = ref(storage, `musicians/${musicianId}/profileImg/${picture.name}`);
        await uploadBytes(storageRef, picture);
        return getDownloadURL(storageRef);
    };

    const handleSubmit = async () => {
        setUploadingProfile(true);
        setVideoUploadProgress(0);
        setTrackUploadProgress(0);
        try {
            const pictureFile = formData.picture;
            const pictureUrl = await uploadProfilePictureToFirebaseStorage(pictureFile, formData.musicianId);

            const videoResults = await uploadVideosToFirebaseStorage(formData.videos, formData.musicianId, 'videos', setVideoUploadProgress);

            // Create an array of video metadata with URLs
            const videoMetadata = formData.videos.map((video, index) => ({
                date: video.date,
                title: video.title,
                file: videoResults[index].videoUrl,
                thumbnail: videoResults[index].thumbnailUrl,
            }));

            const trackUrls = await uploadTracksToFirebaseStorage(formData.tracks, formData.musicianId, 'tracks', setTrackUploadProgress);

            
            // Create an array of track metadata with URLs
            const trackMetadata = formData.tracks.map((track, index) => ({
                date: track.date,
                title: track.title,
                file: trackUrls[index], // Attach the corresponding URL
            }));
            
            const updatedFormData = {
                ...formData,
                picture: pictureUrl, // Store as a string
                videos: videoMetadata, // Store as an array of metadata objects
                tracks: trackMetadata, // Store as an array of metadata objects
                completed: true,
                email: user?.email,
            };

            const musicianRef = doc(firestore, 'musicianProfiles', formData.musicianId);
            await setDoc(musicianRef, {
                ...updatedFormData,
                userId: user.uid,
            }, { merge: true });

            const userRef = doc(firestore, 'users', user.uid);
            await updateDoc(userRef, {
                musicianProfile: arrayUnion(formData.musicianId),
            });

            navigate('/find-a-gig', { state: { newUser: true } });
            window.location.reload();
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
            const pictureUrl = await uploadProfilePictureToFirebaseStorage(pictureFile, formData.musicianId);
            updatedFormData.picture = pictureUrl;
    
            // Upload videos and create metadata
            const videoResults = await uploadVideosToFirebaseStorage(formData.videos, formData.musicianId, 'videos');
            const videoMetadata = formData.videos.map((video, index) => ({
                date: video.date,
                title: video.title,
                file: videoResults[index].videoUrl,
                thumbnail: videoResults[index].thumbnailUrl,
            }));
            updatedFormData.videos = videoMetadata;

            // Upload tracks and create metadata
            const trackUrls = await uploadTracksToFirebaseStorage(formData.tracks, formData.musicianId, 'tracks');
            const trackMetadata = formData.tracks.map((track, index) => ({
                date: track.date,
                title: track.title,
                file: trackUrls[index], // Attach the corresponding URL
            }));
            updatedFormData.tracks = trackMetadata;    
            
            const musicianRef = doc(firestore, 'musicianProfiles', formData.musicianId);
            await setDoc(musicianRef, {
                ...updatedFormData,
                userId: user.uid,
                email: user?.email,
            }, { merge: true });
    
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
            <h1>Welcome to the profile creator.</h1>
            <h4>Before you apply to gigs on Gigin, you need to show the venue your talent!</h4>
            <p>This should only take around 5 minutes. We advise that you have a showcase video ready to upload.</p>
        </div>,
        <NameStage data={formData.name} onChange={handleChange} user={user} error={error} setError={setError} />,
        <ProfilePictureStage data={formData.picture} onChange={handleChange} error={error} setError={setError} />,
        <LocationStage data={formData.location} onChange={handleChange} mapboxToken={mapboxToken} error={error} setError={setError} />,
        <MusicianTypeStage data={formData.musicianType} onChange={handleChange} error={error} setError={setError} />,
        <GenresStage data={formData.genres} onChange={handleChange} musicianType={formData.musicianType} error={error} setError={setError} />,
        <MusicTypeStage data={formData.musicType} onChange={handleChange} error={error} setError={setError} />,
        <InstrumentsStage data={formData.instruments} onChange={handleChange} musicianType={formData.musicianType} error={error} setError={setError} />,
        <EquipmentStage data={formData.equipmentRequired} onChange={handleChange} instruments={formData.instruments} error={error} setError={setError} />,
        <BioStage data={formData.bio} onChange={handleChange} error={error} setError={setError} />,
        <VideosStage data={formData.videos} onChange={handleChange} error={error} setError={setError} />,
        <SocialMediaStage data={formData.socialMedia} onChange={handleChange} error={error} setError={setError} />,
        <FinalStage musicianName={formData.name} musicianId={formData.musicianId} error={error} setError={setError} />
    ];

    return (
        <div className="profile-creator">
            {uploadingProfile ? (
                <div className='loading-state'>
                    <h1>Creating your musician profile...</h1>
                    <h3>Uploading videos: {videoUploadProgress}%</h3>
                    <progress value={videoUploadProgress} max="100"></progress>                    
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
                    <div className="top">
                        <button className="btn secondary save-and-exit" onClick={handleSaveAndExit}>
                            Save and Exit
                        </button>
                    </div>
                    {stages[stage]}
                    <div className="bottom">
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
                <div className="modal">
                    <div className="modal-content">
                        <h3>Oops!</h3>
                        <p>You are already signed up as a venue. We don't allow two profiles for the time being, check back soon!</p>
                        <button className="btn primary" onClick={() => {setShowErrorModal(false); navigate('/venues/dashboard')}}>Got it!</button>
                        <button className='btn close tertiary' onClick={() => {setShowErrorModal(false); navigate('/venues/dashboard')}}>Close</button>
                    </div>
                </div>
            )}
        </div>
    );
};


