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
import { createMusicianProfile } from '@services/client-side/musicians';
import { uploadProfilePicture } from '@services/storage';
import { ProfileIconSolid, SuccessIcon } from '../../shared/ui/extras/Icons';
import { toast } from 'sonner';
import Portal from '../../shared/components/Portal';
import { LoadingSpinner } from '../../shared/ui/loading/Loading';
import { updateUserArrayField } from '@services/api/users';

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
      await updateUserArrayField('musicianProfiles', 'add', formData.musicianId);
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
          <Portal>
            <div className="modal" onClick={handleModalClose}>
                <div className='modal-content profile-creator' onClick={(e) => e.stopPropagation()}>
                    {saving && !saved ? (
                        <div className='loading-state'>
                            <h2>Saving Your Profile</h2>
                            <LoadingSpinner />
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
          </Portal>
        )}

        {showErrorModal && (
          <Portal>
            <div className='modal' onClick={() => showErrorModal(false)}>
              <div className='modal-content' onClick={(e) => e.stopPropagation()}>
                <div className="modal-header">
                  <h2>Oops!</h2>
                  <p>
                  You are already signed up as a venue. We don't allow two profiles for the time being, check back soon!
                  </p>
                </div>
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
          </Portal>
        )}

        {saved && !saving && (
          <Portal>
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
          </Portal>
        )}
    </>
  );
};