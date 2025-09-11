import React, { useEffect, useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

// Icons (replace with your actual imports)
import { GuitarsIcon, MusicianIconSolid, PeopleGroupIconSolid, CloseIcon, NewTabIcon, CameraIcon, EditIcon } from '../../shared/ui/extras/Icons';

// Firebase + services you already have wired
import { Timestamp, arrayUnion } from 'firebase/firestore';
import { v4 as uuidv4 } from 'uuid';

// Your service functions (assumed to exist as per your spec)
import { updateMusicianProfile } from '@services/musicians';
import { createBandProfile } from '@services/bands';
import { createMusicianProfile } from '@services/musicians';
import { updateUserDocument } from '@services/users';
import { uploadFileToStorage } from '@services/storage';
import { generateBandPassword } from '@services/utils/validation';
import { toast } from 'sonner';
import { useAuth } from '../../../hooks/useAuth';
import { uploadProfilePicture } from '../../../services/storage';
import '@styles/musician/no-profile.styles.css'
import { LoadingSpinner } from '../../shared/ui/loading/Loading';
import { useNavigate } from 'react-router-dom';

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
  noProfileModalClosable = false
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

    useEffect(() => {
        if (!isOpen) return;
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
    }, [isOpen, musicianProfile]);

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
                await uploadProfilePicture(musicianImageFile, musicianId)
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
              searchKeywords: generateSearchKeywords(musicianName),
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
        if (!user?.uid || !musicianProfile?.id && !musicianProfile?.musicianId) {
            toast.error('Missing user or musician profile.');
            return;
        }
        setLoadingMessage('Creating your band…');
        setStage(Stage.LOADING);
        try {
            const pictureFile = bandImageFile;
            let pictureUrl = '';
            if (pictureFile) {
                pictureUrl = await uploadFileToStorage(
                    pictureFile,
                    `bands/${bandId}/profileImg/${pictureFile.name}`
                );
            }
            const bandPassword = generateBandPassword();
            const updatedFormData = {
                bandId,
                name: bandName.trim(),
                picture: pictureUrl || '',
                email: user?.email || '',
                joinPassword: bandPassword,
                onboarded: true,
                admin: {
                    userId: user?.uid,
                    musicianId: musicianProfile.id || musicianProfile.musicianId,
                },
                members: [
                    {
                        id: musicianProfile.id || musicianProfile.musicianId,
                        img: musicianProfile?.picture || '',
                        name: musicianProfile.name || '',
                    }
                ]
            };
            await createBandProfile(bandId, updatedFormData, user.uid, musicianProfile);
            await updateUserDocument(user.uid, { bands: arrayUnion(bandId) });
            await updateMusicianProfile(musicianProfile.id || musicianProfile.musicianId, {
                bands: arrayUnion(bandId),
                onboarded: true,
            })
            const keywords = generateSearchKeywords(bandName.trim());
            const musicianProfileData = {
                musicianId: bandId,
                name: bandName.trim(),
                picture: pictureUrl || '',
                email: user?.email || '',
                musicianType: 'Band',
                bandProfile: true,
                searchKeywords: keywords,
                createdAt: Timestamp.now(),
                onboarded:true,
            };
            await createMusicianProfile(bandId, musicianProfileData, user.uid);
            toast.success('Band created!');
            window.location.reload();
            onClose?.();
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
                                        await updateUserDocument(user.uid, {
                                            musicianProfile: arrayUnion(id)
                                        })
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
                                        await updateUserDocument(user.uid, {
                                            musicianProfile: arrayUnion(id)
                                        })
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
                        <button className="btn tertiary" onClick={handleSkipMusician} disabled={!musicianId}>
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
                            <LoadingSpinner width={40} height={40} />
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