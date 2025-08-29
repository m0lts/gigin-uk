import { useState, useEffect } from 'react';
import { LeftChevronIcon } from '@features/shared/ui/extras/Icons';
import { v4 as uuidv4 } from 'uuid';
import { ProgressBar } from './ProgressBar';
import { Timestamp, arrayUnion } from 'firebase/firestore';

import '@styles/musician/profile-creator.styles.css';

import { NameStage } from './NameStage';
import { ProfilePictureStage } from './ProfilePictureStage';

import { LoadingThreeDots } from '@features/shared/ui/loading/Loading';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { updateUserDocument } from '@services/users';
import { createMusicianProfile } from '@services/musicians';
import { uploadProfilePicture } from '@services/storage';
import { ProfileIconSolid, SuccessIcon } from '../../shared/ui/extras/Icons';
import { toast } from 'sonner';

export const ProfileCreator = ({ user, setShowModal, closable = true }) => {
  const navigate = useNavigate();
  const location = useLocation();

  const existingProfile = user.musicianProfile || null;

  const [stage, setStage] = useState(0);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [showErrorModal, setShowErrorModal] = useState(false);
  const [error, setError] = useState(null);

  const [formData, setFormData] = useState({
    musicianId: existingProfile?.musicianId || uuidv4(),
    email: user ? user.email : '',
    name: existingProfile?.name || '',
    picture: existingProfile?.picture || '',
    basicsComplete: !!(existingProfile?.name && existingProfile?.picture),
    completed: false,
  });

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
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  const handleChange = (name, value) => {
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const getStageValidationError = (currentStage, data) => {
    switch (currentStage) {
      case 0:
        return data.name.trim() === '' ? 'name' : null;
      case 1:
        return !data.picture ? 'picture' : null;
      default:
        return null;
    }
  };

  const currentStageError = getStageValidationError(stage, formData);
  const canContinue = stage === 0 && currentStageError === null;
  const canFinish = getStageValidationError(0, formData) === null &&
                    getStageValidationError(1, formData) === null;

  const handleNext = () => {
    const err = getStageValidationError(stage, formData);
    setError(err);
    if (err) return;
    const nextStage = Math.min(stage + 1, 1);
    setStage(nextStage);
    window.history.pushState({ stage: nextStage }, '');
  };
  
  const handlePrevious = () => {
    if (stage === 0) return;
    const prevStage = Math.max(stage - 1, 0);
    setError(null);
    setStage(prevStage);
    window.history.pushState({ stage: prevStage }, '');
  };

  const generateSearchKeywords = (name) => {
    const lower = name.toLowerCase();
    return Array.from({ length: lower.length }, (_, i) => lower.slice(0, i + 1));
  };

  const uploadPictureIfNeeded = async (picture, musicianId) => {
    if (picture && typeof picture !== 'string') {
      return await uploadProfilePicture(picture, musicianId);
    }
    return picture || '';
  };

  const saveBasics = async ({ finalize = false } = {}) => {
    if (finalize) {
      const err0 = getStageValidationError(0, formData);
      const err1 = getStageValidationError(1, formData);
      setError(err0 || err1);
      if (err0 || err1) return;
    } else {
      if (!formData.name) {
        setShowModal(false);
        return;
      }
    }
    setSaving(true);
    try {
      const pictureUrl = formData.picture
        ? await uploadPictureIfNeeded(formData.picture, formData.musicianId)
        : '';
      const keywords = generateSearchKeywords(formData.name);
      const payload = {
        musicianId: formData.musicianId,
        email: user?.email || '',
        name: formData.name,
        onboarded:true,
        picture: pictureUrl,
        searchKeywords: keywords,
        updatedAt: Timestamp.now(),
        ...(existingProfile ? {} : { createdAt: Timestamp.now() }),
      };
      await createMusicianProfile(formData.musicianId, payload, user.uid);
      await updateUserDocument(user.uid, { musicianProfile: arrayUnion(formData.musicianId) });
      setFormData(prev => ({
        ...prev,
        picture: pictureUrl || prev.picture,
      }));
      setSaved(true);
      toast.success('Profile Saved!')
    } catch (err) {
        console.error('Error saving basics:', err);
        toast.error('Error saving profile. Please try again.')
    } finally {
        setSaving(false);
    }
  };

  const stages = [
    <NameStage
      data={formData.name}
      onChange={handleChange}
      user={user}
      error={error}
      setError={setError}
    />,
    <ProfilePictureStage
      data={formData.picture}
      onChange={handleChange}
      error={error}
      setError={setError}
    />,
  ];

  const handleModalClose = () => {
    if (!closable) return;
    if (saving) return;
    if (formData.name || formData.picture) {
      const confirmSave = window.confirm(
        'You have unsaved information.\nClick OK to save or Cancel to discard.'
      );
      if (confirmSave) {
        saveBasics({ finalize: false });
      } else {
        setShowModal(false);
      }
    } else {
      setShowModal(false);
    }
  };

  return (
    <>  
        {!saved && (
            <div className="modal" onClick={handleModalClose}>
                <div className='modal-content profile-creator' onClick={(e) => e.stopPropagation()}>
                    {saving && !saved ? (
                        <div className='loading-state'>
                            <h1>Saving Your Profile</h1>
                            <LoadingThreeDots />
                        </div>
                    ) : (
                        <>
                            <div className='top'>
                                {stage < 1 && closable && (
                                    <button className='btn secondary save-and-exit' onClick={() => saveBasics({ finalize: false })}>
                                        Save and Exit
                                    </button>
                                )}
                            </div>

                            {stages[stage]}

                            <div className='bottom'>
                                <div className={`${stage === 0 && 'single'} controls`}>
                                {stage > 0 && (
                                    <button className='btn secondary' onClick={handlePrevious}>
                                        <LeftChevronIcon />
                                    </button>
                                )}

                                {stage < 1 ? (
                                    <button className='btn primary' onClick={handleNext} disabled={!canContinue || saving}>Continue</button>
                                ) : (
                                    <button className='btn primary' onClick={() => saveBasics({ finalize: true })} disabled={!canFinish || saving}>
                                        Save Profile
                                    </button>
                                )}
                                </div>
                            </div>
                        </>
                    )}

                </div>
            </div>
        )}

        {showErrorModal && (
            <div className='modal'>
            <div className='modal-content'>
                <h3>Oops!</h3>
                <p>
                You are already signed up as a venue. We don't allow two profiles for the time being, check back soon!
                </p>
                <button
                className='btn primary'
                onClick={() => {
                    setShowErrorModal(false);
                    setShowModal(false);
                    navigate('/venues/dashboard/gigs');
                }}
                >
                Got it!
                </button>
                <button
                className='btn close tertiary'
                onClick={() => {
                    setShowErrorModal(false);
                    setShowModal(false);
                    navigate('/venues/dashboard/gigs');
                }}
                >
                Close
                </button>
            </div>
            </div>
        )}

        {saved && !saving && (
            <div className="modal" onClick={() => setShowModal(false)}>
                <div className="modal-content" onClick={(e) => e.stopPropagation()}>
                    <div className="modal-header">
                        <SuccessIcon />
                        <h2>Musician Profile Created!</h2>
                        <p>
                            We have saved your musician profile information, you can now apply to gigs! 
                            <br /> 
                            {!location.pathname.includes('dashboard') ? (
                                <>
                                    However, we recommend that you complete your musician profile in the <Link to={'/dashboard/profile'} onClick={() => setShowModal(false)}>dashboard</Link> to show venues your talents.
                                </>
                            ) : (
                                <>
                                    However, we recommend that you <Link to={'/dashboard/profile'} onClick={() => setShowModal(false)}>complete your musician profile</Link> to show venues your talents.
                                </>
                            )}
                        </p>
                    </div>
                    <div className="modal-buttons">
                        <button className="btn primary" onClick={() => setShowModal(false)}>Got It!</button>
                    </div>
                </div>
            </div>
        )}
    </>
  );
};








// import { useState, useEffect } from 'react';
// import { LeftChevronIcon} from '@features/shared/ui/extras/Icons';
// import { v4 as uuidv4 } from 'uuid';
// import { useAuth } from '@hooks/useAuth';
// import { ProgressBar } from './ProgressBar';
// import { arrayUnion } from 'firebase/firestore';

// import '@styles/musician/profile-creator.styles.css'

// // Importing stage components
// import { NameStage } from './NameStage';
// import { ProfilePictureStage } from './ProfilePictureStage';
// import { LocationStage } from './LocationStage';
// import { GenresStage } from './GenresStage';
// import { MusicTypeStage } from './MusicTypeStage';
// import { InstrumentsStage } from './InstrumentsStage';
// import { EquipmentStage } from './EquipmentStage';
// import { BioStage } from './BioStage';
// import { VideosStage } from './VideosStage';
// import { TracksStage } from './TracksStage';
// import { SocialMediaStage } from './SocialMediaStage';
// import { FinalStage } from './FinalStage';
// import { MusicianTypeStage } from './MusicianTypeStage';
// import { LoadingThreeDots } from '@features/shared/ui/loading/Loading';
// import { useLocation, useNavigate } from 'react-router-dom';
// import { updateUserDocument } from '@services/users';
// import { createMusicianProfile } from '@services/musicians';
// import { uploadProfilePicture, uploadTracks, uploadVideosWithThumbnails } from '@services/storage';

// export const ProfileCreator = () => {

//     const { user } = useAuth();
//     const location = useLocation();
//     const musicianProfile = location.state?.musicianProfile;
//     const band = location.state?.musicianProfile.bandProfile;
//     const navigate = useNavigate();
//     const [showErrorModal, setShowErrorModal] = useState(false);

//     const mapboxToken = import.meta.env.VITE_MAPBOX_TOKEN;

//     const [stage, setStage] = useState(musicianProfile ? 1 : 0);
//     const [formData, setFormData] = useState({
//         musicianId: uuidv4(),
//         email: user ? user.email : '',
//         name: '',
//         picture: '',
//         location: { city: 'Cambridge', coordinates: [0.1313, 52.1951], travelDistance: '' },
//         musicianType: '',
//         genres: [],
//         musicType: '',
//         instruments: [],
//         equipmentRequired: [],
//         bio: {
//             text: '',
//             experience: '',
//         },
//         videos: [],
//         tracks: [],
//         socialMedia: {
//             facebook: '',
//             twitter: '',
//             instagram: '',
//             youtube: '',
//             spotify: '',
//             soundcloud: '',
//         },
//         bandProfile: false,
//     });
//     const [uploadingProfile, setUploadingProfile] = useState(false);
//     const [savingProfile, setSavingProfile] = useState(false);
//     const [videoUploadProgress, setVideoUploadProgress] = useState(0);
//     const [trackUploadProgress, setTrackUploadProgress] = useState(0);
//     const [error, setError] = useState(null);

//     useEffect(() => {
//         if (!musicianProfile) return;
//         const checkForSavedProfile = async () => {
//           const isBand = musicianProfile.bandProfile === true;
//           setFormData((prev) => ({
//             ...prev,
//             ...musicianProfile,
//             bandProfile: isBand,
//           }));
//           const startingStep = isBand ? 3 : (musicianProfile.currentStep || 1);
//           setStage(startingStep);
//         };
//         checkForSavedProfile();
//       }, [musicianProfile]);

//     useEffect(() => {
//         if (user?.venueProfiles && user.venueProfiles.length > 0) {
//             setShowErrorModal(true);
//         }
//     }, [user]);

//     useEffect(() => {
//         const handlePopState = (event) => {
//             if (event.state && event.state.stage !== undefined) {
//                 setStage(event.state.stage);
//                 setError(null);
//             }
//         };
//         window.addEventListener('popstate', handlePopState);
//         return () => {
//             window.removeEventListener('popstate', handlePopState);
//         };
//     }, []);

//     const handleNext = () => {
//         if (validateStage(stage)) {
//             const nextStage = stage + 1;
//             setStage(nextStage);
//             setError(null);
//             window.history.pushState({ stage: nextStage }, '');
//         }
//     };

//     const handlePrevious = () => {
//         if (stage > 0) {
//             const prevStage = stage - 1;
//             setStage(prevStage);
//             setError(null);
//             window.history.pushState({ stage: prevStage }, '');
//         }
//     };

//     const validateStage = (currentStage) => {
//         let validationError = null;
//         switch (currentStage) {
//             case 1:
//                 if (formData.name.trim() === '') validationError = 'name';
//                 break;
//             case 2:
//                 if (formData.picture === '') validationError = 'picture';
//                 break;
//             case 3:
//                 if (formData.location.city.trim() === '') validationError = 'city';
//                 if (formData.location.travelDistance.trim() === '') validationError = 'travelDistance';
//                 break;
//             case 4:
//                 if (formData.musicianType.trim() === '') validationError = 'musicianType';
//                 break;
//             case 5:
//                 if (formData.genres.length === 0) validationError = 'genres';
//                 break;
//             case 6:
//                 if (formData.musicType.trim() === '') validationError = 'musicType';
//                 break;
//             case 7:
//                 if (formData.instruments.length === 0) validationError = 'instruments';
//                 break;
//             case 9:
//                 if (formData.bio.text.trim() === '') validationError = 'bio.text';
//                 if (formData.bio.experience.trim() === '') validationError = 'bio.experience';
//                 break;
//             case 10:
//                 if (formData.videos.length === 0) validationError = 'videos';
//                 break;
//             default:
//                 break;
//         }
//         if (error !== validationError) {
//             setError(validationError);
//         }
//         return validationError === null;
//     };


//     const handleChange = (name, value) => {
//         setFormData({
//             ...formData,
//             [name]: value
//         });
//     };

//     const generateSearchKeywords = (name) => {
//         const lower = name.toLowerCase();
//         return Array.from({ length: lower.length }, (_, i) => lower.slice(0, i + 1));
//     };

//     const handleSubmit = async () => {
//         setUploadingProfile(true);
//         setVideoUploadProgress(0);
//         setTrackUploadProgress(0);
//         try {
//             const pictureFile = formData.picture;
//             const pictureUrl = await uploadProfilePicture(pictureFile, formData.musicianId);
//             const videoResults = await uploadVideosWithThumbnails(
//                 formData.videos,
//                 formData.musicianId,
//                 'videos',
//                 setVideoUploadProgress
//             );
//             const videoMetadata = formData.videos.map((video, index) => ({
//                 date: video.date,
//                 title: video.title,
//                 file: videoResults[index].videoUrl,
//                 thumbnail: videoResults[index].thumbnailUrl,
//             }));
//             const trackUrls = await uploadTracks(
//                 formData.tracks,
//                 formData.musicianId,
//                 'tracks',
//                 setTrackUploadProgress
//             );
//             const trackMetadata = formData.tracks.map((track, index) => ({
//                 date: track.date,
//                 title: track.title,
//                 file: trackUrls[index],
//             }));
//             const keywords = generateSearchKeywords(formData.name);
//             const updatedFormData = {
//                 ...formData,
//                 picture: pictureUrl,
//                 videos: videoMetadata,
//                 tracks: trackMetadata,
//                 completed: true,
//                 searchKeywords: keywords,
//                 email: user?.email,
//             };
//             await createMusicianProfile(formData.musicianId, updatedFormData, user.uid);
//             await updateUserDocument(user.uid, {
//                 musicianProfile: arrayUnion(formData.musicianId)
//             })
//             const redirectTo = location.state?.redirectToInvite;
//             if (redirectTo) {
//                 navigate(`/join-band?invite=${redirectTo}`);
//                 window.location.reload();
//             } else {
//                 navigate('/find-a-gig', { state: { newUser: true } });
//                 window.location.reload();
//             }
//             setUploadingProfile(false);
//         } catch (error) {
//             setUploadingProfile(false);
//             console.error('Error uploading files or creating musician profile: ', error);
//         }
//     };

//     const handleSaveAndExit = async () => {
//         setSavingProfile(true);
//         if (formData.name === '') {
//             navigate('/find-a-gig');
//             setSavingProfile(false);
//             return;
//         }
//         try {
//             let updatedFormData;
//             if (formData.completed) {
//                 updatedFormData = {
//                     ...formData,
//                     completed: true,
//                 };
//                 delete formData.currentStep;
//             } else {
//                 updatedFormData = {
//                     ...formData,
//                     currentStep: stage,
//                     completed: false,
//                 };
//             }
//             const pictureFile = formData.picture;
//             const pictureUrl = await uploadProfilePicture(pictureFile, formData.musicianId);
//             updatedFormData.picture = pictureUrl;
//             const videoResults = await uploadVideosWithThumbnails(
//                 formData.videos,
//                 formData.musicianId,
//                 'videos',
//                 setVideoUploadProgress
//             );
//             const videoMetadata = formData.videos.map((video, index) => ({
//                 date: video.date,
//                 title: video.title,
//                 file: videoResults[index].videoUrl,
//                 thumbnail: videoResults[index].thumbnailUrl,
//             }));
//             updatedFormData.videos = videoMetadata;
//             const trackUrls = await uploadTracks(
//                 formData.tracks,
//                 formData.musicianId,
//                 'tracks',
//                 setTrackUploadProgress
//             );
//             const trackMetadata = formData.tracks.map((track, index) => ({
//                 date: track.date,
//                 title: track.title,
//                 file: trackUrls[index],
//             }));
//             const keywords = generateSearchKeywords(formData.name);
//             updatedFormData.tracks = trackMetadata;
//             updatedFormData.searchKeywords = keywords;
//             await createMusicianProfile(formData.musicianId, updatedFormData, user.uid);    
//             if (updatedFormData.completed) {
//                 navigate('/dashboard')
//             } else {
//                 navigate('/find-a-gig');
//             }
//             setSavingProfile(false);
//         } catch (error) {
//             console.error('Error uploading files or saving musician profile: ', error);
//             setSavingProfile(false);
//         }
//     };


//     const stages = [
//         <div className='stage intro'>
//             <h1>Welcome to the musician profile creator!</h1>
//             <h4>Before you apply to gigs on Gigin, you need to show the venue your talent!</h4>
//             <p>This should only take around 5 minutes. We advise that you have a showcase video ready to upload.</p>
//         </div>,
//         <NameStage data={formData.name} onChange={handleChange} user={user} error={error} setError={setError} band={band} />,
//         <ProfilePictureStage data={formData.picture} onChange={handleChange} error={error} setError={setError} band={band} />,
//         <LocationStage data={formData.location} onChange={handleChange} mapboxToken={mapboxToken} error={error} setError={setError} band={band} />,
//         <MusicianTypeStage data={formData.musicianType} onChange={handleChange} error={error} setError={setError} band={band} />,
//         <GenresStage data={formData.genres} onChange={handleChange} musicianType={formData.musicianType} error={error} setError={setError} band={band} />,
//         <MusicTypeStage data={formData.musicType} onChange={handleChange} error={error} setError={setError} band={band} />,
//         <InstrumentsStage data={formData.instruments} onChange={handleChange} musicianType={formData.musicianType} error={error} setError={setError} band={band} />,
//         <EquipmentStage data={formData.equipmentRequired} onChange={handleChange} instruments={formData.instruments} error={error} setError={setError} band={band} />,
//         <BioStage data={formData.bio} onChange={handleChange} error={error} setError={setError} band={band} />,
//         <VideosStage data={formData.videos} onChange={handleChange} error={error} setError={setError} band={band} />,
//         <SocialMediaStage data={formData.socialMedia} onChange={handleChange} error={error} setError={setError} band={band} />,
//         <FinalStage musicianName={formData.name} musicianId={formData.musicianId} error={error} setError={setError} band={band} />
//     ];

//     return (
//         <div className='profile-creator'>
//             {uploadingProfile ? (
//                 <div className='loading-state'>
//                     <h1>Creating your musician profile...</h1>
//                     <h3>Uploading videos: {videoUploadProgress}%</h3>
//                     <progress value={videoUploadProgress} max='100' style={{ width: '100%', maxWidth: '250px' }}></progress>                    
//                     <LoadingThreeDots />
//                     <h3>Please don't refresh or leave this page. You will be redirected automatically.</h3>
//                 </div>
//             ) : savingProfile ? (
//                 <div className='loading-state'>
//                     <h1>Saving your musician profile...</h1>
//                     <h3>This may take a while if you added any new videos or tracks.</h3>
//                     <LoadingThreeDots />
//                     <h3>Please don't refresh or leave this page.</h3>
//                 </div>
//             ) : (
//                 <>
//                     <div className='top'>
//                         <button className='btn secondary save-and-exit' onClick={handleSaveAndExit}>
//                             Save and Exit
//                         </button>
//                     </div>
//                     {stages[stage]}
//                     <div className='bottom'>
//                         <ProgressBar currentStage={stage} totalStages={stages.length} />
//                         <div className={`${stage === 0 && 'single'} controls`}>
//                             {stage > 0 && (
//                                 <button className='btn secondary' onClick={handlePrevious}>
//                                     <LeftChevronIcon />
//                                 </button>
//                             )}
//                             {stage < stages.length - 1 ? (
//                                 <button className='btn primary' onClick={handleNext} disabled={!validateStage(stage)}>Continue</button>
//                             ) : (
//                                 stage > 0 && <button className='btn primary' onClick={() => handleSubmit()} disabled={!validateStage(stage)}>Submit</button>
//                             )}
//                         </div>
//                     </div>
//                 </>
//             )}
//             {showErrorModal && (
//                 <div className='modal'>
//                     <div className='modal-content'>
//                         <h3>Oops!</h3>
//                         <p>You are already signed up as a venue. We don't allow two profiles for the time being, check back soon!</p>
//                         <button className='btn primary' onClick={() => {setShowErrorModal(false); navigate('/venues/dashboard')}}>Got it!</button>
//                         <button className='btn close tertiary' onClick={() => {setShowErrorModal(false); navigate('/venues/dashboard')}}>Close</button>
//                     </div>
//                 </div>
//             )}
//         </div>
//     );
// };


