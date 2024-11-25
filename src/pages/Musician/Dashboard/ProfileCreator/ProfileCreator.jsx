import { useState, useEffect } from 'react';
import { LeftChevronIcon, ExitIcon } from '/components/ui/Extras/Icons'
import { v4 as uuidv4 } from 'uuid';
import { useAuth } from '../../../../hooks/useAuth';
import { ProgressBar } from './ProgressBar';
import { storage, firestore } from "../../../../firebase";
import { ref, uploadBytes, getDownloadURL, uploadBytesResumable } from 'firebase/storage';
import { collection, query, where, getDocs, doc, setDoc, updateDoc, arrayUnion, deleteDoc, arrayRemove } from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { functions } from '../../../../firebase';

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
        location: { city: 'Cambridge', coordinates: [52.1951, 0.1313], travelDistance: '' },
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
    console.log(formData)

    const [uploadingProfile, setUploadingProfile] = useState(false);
    const [savingProfile, setSavingProfile] = useState(false);
    const [videoUploadProgress, setVideoUploadProgress] = useState(0);
    const [trackUploadProgress, setTrackUploadProgress] = useState(0);

    useEffect(() => {
        const checkForSavedProfile = async () => {
            if (musicianProfile) {
                setFormData(musicianProfile);
                setStage(musicianProfile.currentStep ? musicianProfile.currentStep : 1)
            }
        };

        if (musicianProfile) checkForSavedProfile();

    }, [musicianProfile]);

    // Handle the browser's back and forward buttons
    useEffect(() => {
        const handlePopState = (event) => {
            if (event.state && event.state.stage !== undefined) {
                setStage(event.state.stage);
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
            // Push the new stage to the history stack
            window.history.pushState({ stage: nextStage }, '');
        }
    };

    const handlePrevious = () => {
        if (stage > 0) {
            const prevStage = stage - 1;
            setStage(prevStage);
            // Push the previous stage to the history stack
            window.history.pushState({ stage: prevStage }, '');
        }
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
        try {
          const pictureFile = formData.picture;
          const pictureUrl = await uploadProfilePictureToFirebaseStorage(pictureFile, formData.musicianId);
          const videoFiles = formData.videos.map((video) => ({
            title: video.title,
            file: video.file,
            thumbnail: video.thumbnail,
            contentType: "video/mp4",
            type: "video",
            date: video.date,
        }));
        const trackFiles = formData.tracks.map((track) => ({
            title: track.title,
            file: track.file,
            contentType: "audio/mpeg",
            type: "track",
            date: track.date,
        }));
          const placeholderVideos = formData.videos.map((video) => ({
            ...video,
            file: "uploading...",
            thumbnail: "uploading...",
        }));
        const placeholderTracks = formData.tracks.map((track) => ({
            ...track,
            file: "uploading...",
        }));
          const updatedFormData = {
            ...formData,
            picture: pictureUrl,
            videos: placeholderVideos,
            tracks: placeholderTracks,
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
          const uploadMediaFunction = httpsCallable(functions, "uploadMediaFiles");
          uploadMediaFunction({
            musicianId: formData.musicianId,
            mediaFiles: [...videoFiles, ...trackFiles],
          });
          navigate('/dashboard');
          setUploadingProfile(false);
        } catch (error) {
          console.error("Error saving musician profile:", error);
          setUploadingProfile(false);
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
            const videoFilesToUpload = formData.videos.filter((video) => !video.file.startsWith("http"));
            const videosWithExistingUrls = formData.videos.filter((video) => video.file.startsWith("http"));
            const videoFiles = videoFilesToUpload.map((video) => ({
                title: video.title,
                file: video.file,
                thumbnail: video.thumbnail,
                contentType: "video/mp4",
                type: "video",
                date: video.date,
            }));
            const placeholderVideos = videoFilesToUpload.map((video) => ({
                ...video,
                file: "uploading...",
                thumbnail: "uploading...",
            }));
            const trackFilesToUpload = formData.tracks.filter((track) => !track.file.startsWith("http"));
            const tracksWithExistingUrls = formData.tracks.filter((track) => track.file.startsWith("http"));
            const trackFiles = trackFilesToUpload.map((track) => ({
                title: track.title,
                file: track.file,
                contentType: "audio/mpeg",
                type: "track",
                date: track.date,
            }));
            const placeholderTracks = trackFilesToUpload.map((track) => ({
                ...track,
                file: "uploading...",
            }));
            updatedFormData.videos = [...placeholderVideos, ...videosWithExistingUrls];
            updatedFormData.tracks = [...placeholderTracks, ...tracksWithExistingUrls];
            const musicianRef = doc(firestore, 'musicianProfiles', formData.musicianId);
            await setDoc(musicianRef, {
                ...updatedFormData,
                userId: user.uid,
            }, { merge: true });
            const uploadMediaFunction = httpsCallable(functions, "uploadMediaFiles");
            uploadMediaFunction({
                musicianId: formData.musicianId,
                mediaFiles: [...videoFiles, ...trackFiles],
            });
            if (updatedFormData.completed) {
                navigate('/dashboard');
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
                    <h3>This may take a while if you added any new videos or tracks.</h3>
                    <h3>Please don't refresh or leave this page.</h3>
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