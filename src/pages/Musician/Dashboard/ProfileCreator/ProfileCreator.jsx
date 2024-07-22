import { useState, useEffect } from 'react';
import { LeftChevronIcon, ExitIcon } from '/components/ui/Extras/Icons'
import { v4 as uuidv4 } from 'uuid';
import useMapboxAccessToken from "../../../../hooks/useAccessTokens";
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
import { useNavigate } from 'react-router-dom';

export const ProfileCreator = ({ musicianProfile }) => {

    const { user } = useAuth();
    const navigate = useNavigate();

    const mapboxToken = useMapboxAccessToken();

    const [stage, setStage] = useState(10);
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
            if (musicianProfile.completed !== true) {
                setFormData(musicianProfile);
                setStage(musicianProfile.currentStep)
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


    // const uploadFilesToFirebaseStorage = async (files, musicianId, folder) => {
    //     const fileUrls = files.filter(file => typeof file === 'string');
    //     const newFiles = files.filter(file => typeof file !== 'string');

    //     if (newFiles.length > 0) {
    //         const uploadPromises = newFiles.map(async (file) => {
    //             const storageRef = ref(storage, `musicians/${musicianId}/${folder}/${file.name}`);
    //             await uploadBytes(storageRef, file);
    //             return getDownloadURL(storageRef);
    //         });

    //         const uploadedUrls = await Promise.all(uploadPromises);
    //         return [...fileUrls, ...uploadedUrls];
    //     }

    //     return fileUrls;
    // };

    const uploadFilesToFirebaseStorage = async (mediaFiles, musicianId, folder) => {
        const uploadPromises = mediaFiles.map(async (media) => {
            if (typeof media.file === 'string') {
                return media;
            }
    
            const storageRef = ref(storage, `musicians/${musicianId}/${folder}/${media.file.name}`);
            await uploadBytes(storageRef, media.file);
            const url = await getDownloadURL(storageRef);
    
            return {
                ...media,
                file: url
            };
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
        try {
            const pictureFile = formData.picture;
            const pictureUrl = await uploadProfilePictureToFirebaseStorage(pictureFile, formData.musicianId);

            const videoFiles = formData.videos;
            const videoUrls = await uploadFilesToFirebaseStorage(videoFiles, formData.musicianId, 'videos');

            const trackFiles = formData.tracks;
            const trackUrls = await uploadFilesToFirebaseStorage(trackFiles, formData.musicianId, 'tracks');

            const updatedFormData = {
                ...formData,
                picture: pictureUrl[0],
                videos: videoUrls,
                tracks: trackUrls,
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
            navigate('/musician/dashboard');
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
    
            const videoFiles = formData.videos;
            const videoUrls = await uploadFilesToFirebaseStorage(videoFiles, formData.musicianId, 'videos');
            updatedFormData.videos = videoUrls;
    
            const trackFiles = formData.tracks;
            const trackUrls = await uploadFilesToFirebaseStorage(trackFiles, formData.musicianId, 'tracks');
            updatedFormData.tracks = trackUrls;
    
            const musicianRef = doc(firestore, 'musicianProfiles', formData.musicianId);
            await setDoc(musicianRef, {
                ...updatedFormData,
                userId: user.uid,
            }, { merge: true });
    
            navigate('/musician/dashboard');
            window.location.reload();
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