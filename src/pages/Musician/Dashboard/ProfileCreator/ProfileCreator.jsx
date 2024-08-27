import { useState, useEffect } from 'react';
import { LeftChevronIcon, ExitIcon } from '/components/ui/Extras/Icons'
import { v4 as uuidv4 } from 'uuid';
import { useAuth } from '../../../../hooks/useAuth';
import { ProgressBar } from './ProgressBar';
import { storage, firestore } from "../../../../firebase";
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
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

    const mapboxToken = import.meta.env.VITE_MAPBOX_TOKEN;

    const [stage, setStage] = useState(musicianProfile ? 1 : 0);
    const [formData, setFormData] = useState({
        musicianId: uuidv4(),
        name: '',
        picture: '',
        location: { city: '', coordinates: [], travelDistance: '' },
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

    useEffect(() => {
        const checkForSavedProfile = async () => {
            if (musicianProfile) {
                setFormData(musicianProfile);
                setStage(musicianProfile.currentStep ? musicianProfile.currentStep : 1)
            }
        };

        if (musicianProfile) checkForSavedProfile();

    }, [musicianProfile]);


    const handleNext = () => {
        if (validateStage(stage)) {
            setStage(prevStage => prevStage + 1);
        }
    };

    const handlePrevious = () => {
        setStage(prevStage => prevStage - 1);
    };

    const validateStage = (currentStage) => {
        switch (currentStage) {
            case 1:
                return formData.name.trim() !== '';
            case 2:
                return formData.picture !== '';
            case 3:
                return formData.location.city.trim() !== '';
            case 4:
                return formData.musicianType.trim() !== '';
            case 5:
                return formData.genres.length > 0;
            case 6:
                return formData.musicType.trim() !== '';
            case 7:
                return formData.instruments.length > 0;
            case 8:
                return true;
            case 9:
                return formData.bio.text.trim() !== '' && formData.bio.experience.trim() !== '';
            case 10:
                return formData.videos.length > 0;
            case 11:
                return formData.tracks.length > 0;
            case 12:
                return true;
            default:
                return true;
        }
    };

    const handleChange = (name, value) => {
        setFormData({
            ...formData,
            [name]: value
        });
    };

    const uploadVideosToFirebaseStorage = async (mediaFiles, musicianId, folder) => {
        const uploadPromises = mediaFiles.map(async (media) => {
            // Check if the video file is already a URL
            let videoUrl = media.file;
            if (typeof media.file !== 'string') {
                const videoStorageRef = ref(storage, `musicians/${musicianId}/${folder}/${media.title}`);
                await uploadBytes(videoStorageRef, media.file);
                videoUrl = await getDownloadURL(videoStorageRef); // Get the download URL of the video
            }
    
            // Check if the thumbnail is already a URL
            let thumbnailUrl = media.thumbnail;
            if (typeof media.thumbnail !== 'string') {
                const thumbnailStorageRef = ref(storage, `musicians/${musicianId}/${folder}/thumbnails/${media.title}_thumbnail`);
                await uploadBytes(thumbnailStorageRef, media.thumbnail); // Upload the thumbnail
                thumbnailUrl = await getDownloadURL(thumbnailStorageRef); // Get the download URL of the thumbnail
            }
    
            return { videoUrl, thumbnailUrl }; // Return both video and thumbnail URLs
        });
    
        return Promise.all(uploadPromises); // Resolve all promises and return an array of objects containing video and thumbnail URLs
    };

    const uploadTracksToFirebaseStorage = async (mediaFiles, musicianId, folder) => {
        const uploadPromises = mediaFiles.map(async (media) => {
            // If the file is already a URL (indicating it has been uploaded before), skip re-upload
            if (typeof media.file === 'string') {
                return media.file; // Return the existing URL
            }
    
            // Otherwise, upload the file to Firebase Storage
            const storageRef = ref(storage, `musicians/${musicianId}/${folder}/${media.title}`); // Use `media.file.title` for file name
            await uploadBytes(storageRef, media.file); // Upload the actual file
            const url = await getDownloadURL(storageRef); // Get the download URL
    
            return url; // Return the newly uploaded file's URL
        });
    
        return Promise.all(uploadPromises); // Resolve all promises and return the array of URLs
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
        try {
            const pictureFile = formData.picture;
            const pictureUrl = await uploadProfilePictureToFirebaseStorage(pictureFile, formData.musicianId);

            const videoResults = await uploadVideosToFirebaseStorage(formData.videos, formData.musicianId, 'videos');

            // Create an array of video metadata with URLs
            const videoMetadata = formData.videos.map((video, index) => ({
                date: video.date,
                title: video.title,
                file: videoResults[index].videoUrl,
                thumbnail: videoResults[index].thumbnailUrl,
            }));

            const trackUrls = await uploadTracksToFirebaseStorage(formData.tracks, formData.musicianId, 'tracks');

            
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

            navigate('/musician/dashboard');
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
            <p>This should only take around 5 minutes. We advise that you have videos and tracks available to upload.</p>
        </div>,
        <NameStage data={formData.name} onChange={handleChange} user={user} />,
        <ProfilePictureStage data={formData.picture} onChange={handleChange} />,
        <LocationStage data={formData.location} onChange={handleChange} mapboxToken={mapboxToken} />,
        <MusicianTypeStage data={formData.musicianType} onChange={handleChange} />,
        <GenresStage data={formData.genres} onChange={handleChange} musicianType={formData.musicianType} />,
        <MusicTypeStage data={formData.musicType} onChange={handleChange} />,
        <InstrumentsStage data={formData.instruments} onChange={handleChange} musicianType={formData.musicianType} />,
        <EquipmentStage data={formData.equipmentRequired} onChange={handleChange} instruments={formData.instruments} />,
        <BioStage data={formData.bio} onChange={handleChange} />,
        <VideosStage data={formData.videos} onChange={handleChange} />,
        <TracksStage data={formData.tracks} onChange={handleChange} />,
        <SocialMediaStage data={formData.socialMedia} onChange={handleChange} />,
        <FinalStage data={formData} />
    ];

    return (
        <div className="profile-creator">
            {uploadingProfile ? (
                <div className='loading-state'>
                    <h1>Creating your musician profile...</h1>
                    <LoadingThreeDots />
                </div>
            ) : savingProfile ? (
                <div className='loading-state'>
                    <h1>Saving your musician profile...</h1>
                    <LoadingThreeDots />
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
        </div>
    );
};