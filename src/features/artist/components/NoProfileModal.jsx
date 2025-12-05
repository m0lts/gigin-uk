import React, { useEffect, useMemo, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

// Icons (replace with your actual imports)
import { GuitarsIcon, MusicianIconSolid, PeopleGroupIconSolid, CloseIcon, NewTabIcon, CameraIcon, EditIcon } from '../../shared/ui/extras/Icons';

// Firebase + services you already have wired
import { Timestamp, arrayUnion } from 'firebase/firestore';
import { v4 as uuidv4 } from 'uuid';

// Your service functions (assumed to exist as per your spec)
import { updateMusicianProfile } from '@services/client-side/artists';
import { createMusicianProfile } from '@services/client-side/artists';
import { uploadFileToStorage } from '@services/storage';
import { generateBandPassword } from '@services/utils/validation';
import { toast } from 'sonner';
import { useAuth } from '../../../hooks/useAuth';
import { uploadProfilePicture } from '../../../services/storage';
import '@styles/artists/no-profile.styles.css'
import { LoadingSpinner } from '../../shared/ui/loading/Loading';
import { useNavigate } from 'react-router-dom';
import { getUserById } from '../../../services/client-side/users';
import { getMusicianProfileByMusicianId } from '../../../services/client-side/artists';
import { updateUserArrayField } from '@services/api/users';
import { createBandProfile } from '@services/api/bands';

// Helpers
const slideVariants = {
  initialLeft: { x: -40, opacity: 0 },
  initialRight: { x: 40, opacity: 0 },
  center: { x: 0, opacity: 1 },
  exitLeft: { x: -40, opacity: 0 },
  exitRight: { x: 40, opacity: 0 },
};

const Stage = {
  SELECT: 'select',
  MUSICIAN: 'musician',
  BAND: 'band',
  LOADING: 'loading',
};

export const NoProfileModal = ({
  isOpen,
  onClose,
  noProfileModalClosable = false,
}) => {
    const { user } = useAuth();
    const navigate = useNavigate();
    const [stage, setStage] = useState(Stage.SELECT);
    const [direction, setDirection] = useState(1);
    const [selectedUserType, setSelectedUserType] = useState(null);

    const musicianProfile = useMemo(
        () => user?.musicianProfile,
        [user]
    );

    const musicianId = useMemo(
        () => musicianProfile?.id || musicianProfile?.musicianId,
        [musicianProfile]
    );
    const [musicianName, setMusicianName] = useState(musicianProfile?.name || '');
    const [musicianImageFile, setMusicianImageFile] = useState(null);
    const [musicianImagePreview, setMusicianImagePreview] = useState(null);
    const [bandId, setBandId] = useState(null);
    const [bandName, setBandName] = useState('');
    const [bandImageFile, setBandImageFile] = useState(null);
    const [bandImagePreview, setBandImagePreview] = useState(null);
    const [prevStage, setPrevStage] = useState(Stage.SELECT);
    const [loadingMessage, setLoadingMessage] = useState('Loading…');

    const wasOpen = useRef(false);

    useEffect(() => {
      if (isOpen && !wasOpen.current) {
        setStage(Stage.SELECT);
        setDirection(1);
        setSelectedUserType(null);
        setMusicianName(musicianProfile?.name || '');
        setMusicianImageFile(null);
        setMusicianImagePreview(null);
        setBandId(null);
        setBandName('');
        setBandImageFile(null);
        setBandImagePreview(null);
      }
      wasOpen.current = isOpen;
      setMusicianName(musicianProfile?.name || '');
    }, [isOpen, musicianProfile?.name]);

    useEffect(() => {
        if (stage === Stage.BAND && !bandId) {
        const newId = uuidv4();
        setBandId(newId);
        }
    }, [stage, bandId]);

    const goToStage = (nextStage) => {
        setDirection(stage === Stage.SELECT && (nextStage === Stage.MUSICIAN || nextStage === Stage.BAND) ? 1 : -1);
        if (nextStage !== Stage.LOADING) setPrevStage(nextStage);
        setStage(nextStage);
      };

    const handleSelect = (type) => {
        setSelectedUserType(type);
        if (type === 'musician') {
            goToStage(Stage.MUSICIAN);
        } else {
            goToStage(Stage.BAND);
        }
    };

    const generateSearchKeywords = (name) => {
        const lower = name.toLowerCase();
        return Array.from({ length: lower.length }, (_, i) => lower.slice(0, i + 1));
    };

    const handleSaveMusician = async () => {
        if (!musicianId) {
            toast.error('Missing musician profile ID.');
            return;
        }
        setLoadingMessage('Saving your profile…');
        setStage(Stage.LOADING);
        try {
            let pictureUrl;
            if (musicianImageFile) {
                pictureUrl = await uploadProfilePicture(musicianImageFile, musicianId)
            }
            const payload = {
                onboarded: true,
            };
            if (musicianName && musicianName !== musicianProfile?.name) {
                payload.name = musicianName;
                payload.searchKeywords = generateSearchKeywords(musicianName)
            };
            if (pictureUrl) payload.picture = pictureUrl;

            if (Object.keys(payload).length > 0) {
                await updateMusicianProfile(musicianId, payload);
            }
            toast.success('Profile updated');
            window.location.reload();
            onClose?.();
        } catch (e) {
            console.error(e);
            toast.error('Failed to save profile. Please try again.');
            setStage(Stage.MUSICIAN);
        }
    };

    const handleSkipMusician = async (redirect) => {
        setLoadingMessage('Saving…');
        setStage(Stage.LOADING);
        try {
            const payload = {
              onboarded: true,
              updatedAt: Timestamp.now(),
            };
            await updateMusicianProfile(musicianId, payload);
            if (redirect) {
                navigate(redirect);
            }
            window.location.reload();
            onClose?.();
          } catch (e) {
            console.error(e);
            toast.error('Failed to skip. Please try again.');
            setStage(Stage.MUSICIAN);
          }
    };

    const handleSaveBand = async () => {
        if (!bandName.trim()) {
          toast.error('Please enter a display name for your band.');
          return;
        }
      
        const uid = user?.uid;
        if (!uid) {
          toast.error('You must be signed in to create a band.');
          return;
        }
        const resolveProfileId = (mp) =>
          mp?.musicianId || mp?.id || null;
      
        let creatorUser = user;
        let creatorMusicianProfile = musicianProfile;
        let creatorMusicianId = resolveProfileId(creatorMusicianProfile);
      
        try {
          // Refresh user if we’re missing musician id, or if the user doc often lags
          if (!creatorMusicianId) {
            creatorUser = await getUserById(uid);
            if (!creatorUser) {
              toast.error('Failed to create band. Please try again.');
              return;
            }
            // user.musicianProfile can be: object/id/array/string depending on your app — handle defensively
            const rawMp =
              creatorUser.musicianProfile?.musicianId ||
              creatorUser.musicianProfile?.id ||
              (Array.isArray(creatorUser.musicianProfile) ? creatorUser.musicianProfile[0] : null) ||
              (typeof creatorUser.musicianProfile === 'string' ? creatorUser.musicianProfile : null);
      
            if (!rawMp) {
              toast.error('Your musician profile could not be found.');
              return;
            }
            creatorMusicianProfile = await getMusicianProfileByMusicianId(rawMp);
            creatorMusicianId = resolveProfileId(creatorMusicianProfile);
            if (!creatorMusicianProfile || !creatorMusicianId) {
              toast.error('Failed to load your musician profile. Please try again.');
              return;
            }
          }
      
          setLoadingMessage('Creating your band…');
          setStage(Stage.LOADING);
      
          // 3) Optional image upload
          let pictureUrl = '';
          if (bandImageFile) {
            pictureUrl = await uploadFileToStorage(
              bandImageFile,
              `bands/${bandId}/profileImg/${bandImageFile.name}`
            );
          }
      
          // 4) Build band (admin) doc payload
          const bandPassword = generateBandPassword();
          const bandAdminData = {
            bandId,
            name: bandName.trim(),
            picture: pictureUrl || '',
            email: creatorUser?.email || '',
            joinPassword: bandPassword,
            onboarded: true,
            admin: {
              userId: uid,
              musicianId: creatorMusicianId,
            },
            members: [
              {
                id: creatorMusicianId,
                img: creatorMusicianProfile?.picture || '',
                name: creatorMusicianProfile?.name || '',
              },
            ],
          };
      
          // 5) Create band admin profile (bands collection)
          await createBandProfile({ bandId, data: bandAdminData, userId: uid, musicianProfile: creatorMusicianProfile });
      
          // 6) Link band to user + creator’s musician profile
          await Promise.all([
            updateUserArrayField({ field: 'bands', op: 'add', value: bandId }),
            updateMusicianProfile(creatorMusicianId, {
              bands: arrayUnion(bandId),
              onboarded: true,
            }),
          ]);
      
          // 7) Create the band's *musician* profile (musicianProfiles collection)
          const keywords = generateSearchKeywords(bandName.trim());
          const bandMusicianProfileData = {
            musicianId: bandId,              // band uses its bandId as musicianId
            name: bandName.trim(),
            picture: pictureUrl || '',
            email: creatorUser?.email || '',
            musicianType: 'Band',
            bandProfile: true,
            searchKeywords: keywords,
            createdAt: Timestamp.now(),
            onboarded: true,
          };
          await createMusicianProfile(bandId, bandMusicianProfileData, uid);
      
          toast.success('Band created!');
          onClose?.();
          window.location.reload();
        } catch (e) {
          console.error('Error creating band:', e);
          toast.error('Error creating band. Please try again.');
          setStage(Stage.BAND);
        }
      };
    // --- File inputs ---
    const onFileChange = (setterFile, setterPreview) => (e) => {
        const file = e.target.files?.[0];
        setterFile(file || null);
        if (file) {
        const url = URL.createObjectURL(file);
        setterPreview(url);
        } else {
        setterPreview(null);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="modal profile-select" role="dialog" aria-modal="true">
        <div className="modal-content scrollable" onClick={(e) => e.stopPropagation()}>
            {noProfileModalClosable && (
                <button className="btn tertiary close" onClick={onClose}>Close</button>
            )}
            <AnimatePresence mode="wait" custom={direction}>
                {stage === Stage.SELECT && (
                    <motion.div
                        key="select"
                        custom={direction}
                        variants={{
                            enter: (dir) => (dir === 1 ? slideVariants.initialRight : slideVariants.initialLeft),
                            center: slideVariants.center,
                            exit: (dir) => (dir === 1 ? slideVariants.exitLeft : slideVariants.exitRight),
                        }}
                        initial="enter"
                        animate="center"
                        exit="exit"
                        transition={{ type: 'tween', duration: 0.25, ease: 'easeOut' }}
                    >
                    <div className="modal-header">
                        <GuitarsIcon />
                        <h2>Are you a Solo Performer or Band?</h2>
                        <p>
                        If you are both a solo performer and band member you can create a band,
                        or add to your solo performer profile, later in your dashboard.
                        </p>
                    </div>
                    <div className="selections">
                        <button
                            type="button"
                            className={`card ${selectedUserType === 'musician' ? 'selected' : ''}`}
                            onClick={async () => {
                                if (musicianProfile) {
                                    handleSelect('musician')
                                } else {
                                    setStage(Stage.LOADING);
                                    try {
                                        const id = uuidv4();
                                        const payload = {
                                          musicianId: id,
                                          name: user.name,
                                          email: user.email,
                                          onboarded: false,
                                          searchKeywords: generateSearchKeywords(user.name),
                                          createdAt: Timestamp.now(),
                                        };
                                        await createMusicianProfile(id, payload, user.uid);
                                        await updateUserArrayField({ field: 'musicianProfile', op: 'add', value: id });
                                        handleSelect('musician')
                                    } catch (error) {
                                        console.error(error)
                                    }
                                }
                            }}
                        >
                            <MusicianIconSolid />
                            <h4>Solo Performer</h4>
                        </button>
                        <button
                            type="button"
                            className={`card ${selectedUserType === 'band' ? 'selected' : ''}`}
                            onClick={async () => {
                                if (musicianProfile) {
                                    handleSelect('band')
                                } else {
                                    setStage(Stage.LOADING);
                                    try {                                        
                                        const id = uuidv4();
                                        const payload = {
                                          musicianId: id,
                                          name: user.name,
                                          email: user.email,
                                          onboarded: false,
                                          searchKeywords: generateSearchKeywords(user.name),
                                          createdAt: Timestamp.now(),
                                        };
                                        await createMusicianProfile(id, payload, user.uid);
                                        await updateUserArrayField({ field: 'musicianProfile', op: 'add', value: id });
                                        handleSelect('band')
                                    } catch (error) {
                                        console.error(error)
                                    }
                                }
                            }}
                        >
                            <PeopleGroupIconSolid />
                            <h4>Band</h4>
                        </button>
                    </div>
                    </motion.div>
                )}

                {stage === Stage.MUSICIAN && (
                    <motion.div
                        key="musician"
                        custom={direction}
                        variants={{
                            enter: (dir) => (dir === 1 ? slideVariants.initialRight : slideVariants.initialLeft),
                            center: slideVariants.center,
                            exit: (dir) => (dir === 1 ? slideVariants.exitLeft : slideVariants.exitRight),
                        }}
                        initial="enter"
                        animate="center"
                        exit="exit"
                        transition={{ type: 'tween', duration: 0.25, ease: 'easeOut' }}
                    >
                    <div className="modal-header">
                        <MusicianIconSolid />
                        <h2>Set up your Musician Profile (Optional)</h2>
                        <p>We recommend a full profile setup to add videos and music.</p>
                    </div>

                    {/* Profile Preview */}
                    <div className="profile-preview">
                        <div className="banner-upload">
                            <div className="banner-frame">
                                {musicianImagePreview || musicianProfile?.picture ? (
                                    <div className="banner-hero">
                                        <img
                                            src={musicianImagePreview || musicianProfile?.picture}
                                            alt="Banner preview"
                                        />
                                        {musicianName && (
                                            <h1>{musicianName}<span className='orange-dot'>.</span></h1>
                                        )}
                                    </div>
                                ) : (
                                        <label className="empty-banner">
                                            <CameraIcon /> Upload Image
                                            <input
                                                type="file"
                                                accept="image/*"
                                                hidden
                                                onChange={onFileChange(setMusicianImageFile, setMusicianImagePreview)}
                                            />
                                        </label>
                                )}
                            </div>
                            {musicianImagePreview && (
                                <label className="btn secondary" style={{ cursor: 'pointer' }}>
                                    <CameraIcon /> Change Image
                                    <input
                                        type="file"
                                        accept="image/*"
                                        hidden
                                        onChange={onFileChange(setMusicianImageFile, setMusicianImagePreview)}
                                    />
                                </label>
                            )}
                        </div>

                        <div className="display-name">
                            <label>Stage Name <EditIcon /></label>
                            <input
                                type="text"
                                value={musicianName}
                                onChange={(e) => setMusicianName(e.target.value)}
                            />
                        </div>
                    </div>

                    <div className="modal-actions">
                        <button className="btn tertiary" onClick={() => handleSkipMusician()} disabled={!musicianId}>
                            Skip
                        </button>
                        <div className="action-buttons">
                            <button className="btn secondary" onClick={() => handleSkipMusician('/dashboard/profile')}>
                                Full Profile Set Up
                            </button>
                            <button className="btn primary" onClick={handleSaveMusician} disabled={!musicianId}>
                                Save & Continue
                            </button>
                        </div>
                    </div>
                    </motion.div>
                )}

                {stage === Stage.BAND && (
                    <motion.div
                        key="band"
                        custom={direction}
                        variants={{
                            enter: (dir) => (dir === 1 ? slideVariants.initialRight : slideVariants.initialLeft),
                            center: slideVariants.center,
                            exit: (dir) => (dir === 1 ? slideVariants.exitLeft : slideVariants.exitRight),
                        }}
                        initial="enter"
                        animate="center"
                        exit="exit"
                        transition={{ type: 'tween', duration: 0.25, ease: 'easeOut' }}
                    >
                    <div className="modal-header">
                        <PeopleGroupIconSolid />
                        <h2>Create your Band</h2>
                        <p>We recommend a full profile setup to add videos and music. Complete your profile in your dashboard once you've created your band.</p>
                    </div>

                    {/* Band Preview */}
                    <div className="profile-preview">
                        <div className="banner-upload">
                            <div className="banner-frame">
                                {bandImagePreview ? (
                                    <div className="banner-hero">
                                        <img
                                            src={bandImagePreview}
                                            alt="Banner preview"
                                        />
                                        {bandName && (
                                            <h1>{bandName}<span className='orange-dot'>.</span></h1>
                                        )}
                                    </div>
                                ) : (
                                        <label className="empty-banner">
                                            <CameraIcon /> Upload Image
                                            <input
                                                type="file"
                                                accept="image/*"
                                                hidden
                                                onChange={onFileChange(setBandImageFile, setBandImagePreview)}
                                            />
                                        </label>
                                )}
                            </div>
                            {bandImagePreview && (
                                <label className="btn secondary" style={{ cursor: 'pointer' }}>
                                    <CameraIcon /> Change Image
                                    <input
                                        type="file"
                                        accept="image/*"
                                        hidden
                                        onChange={onFileChange(setBandImageFile, setBandImagePreview)}
                                    />
                                </label>
                            )}
                        </div>

                        <div className="display-name">
                            <label>Band Name*</label>
                            <input
                                type="text"
                                value={bandName}
                                onChange={(e) => setBandName(e.target.value)}
                            />
                        </div>
                    </div>

                    <div className="modal-actions single" disabled={musicianId}>
                        <button className="btn primary" onClick={handleSaveBand}>
                            Create Band
                        </button>
                    </div>
                    </motion.div>
                )}

                {/* Loading */}
                {stage === Stage.LOADING && (
                    <motion.div
                        key="loading"
                        custom={direction}
                        variants={{
                        enter: (dir) => (dir === 1 ? slideVariants.initialRight : slideVariants.initialLeft),
                        center: slideVariants.center,
                        exit: (dir) => (dir === 1 ? slideVariants.exitLeft : slideVariants.exitRight),
                        }}
                        initial="enter"
                        animate="center"
                        exit="exit"
                        transition={{ type: 'tween', duration: 0.25, ease: 'easeOut' }}
                        className="loading-stage"
                    >
                        <div className="loading-wrap">
                            <LoadingSpinner />
                            <h3>{loadingMessage}</h3>
                            <p>This usually only takes a moment.</p>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
        </div>
    );
};