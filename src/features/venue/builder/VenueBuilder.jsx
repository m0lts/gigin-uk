import { useEffect, useState } from 'react';
import { BrowserRouter as Router, Route, Routes, useNavigate, useLocation } from 'react-router-dom';
import { v4 as uuidv4 } from 'uuid';
import { VenueDetails } from './VenueDetails';
import { VenueType } from './VenueType';
import { InHouseEquipment } from './InHouseEquipment';
import { Photos } from './Photos';
import { AdditionalDetails } from './AdditionalDetails';
import '@styles/host/venue-builder.styles.css'
import { UploadingProfile } from './UploadingProfile';
import { arrayUnion, arrayRemove, GeoPoint, deleteField } from 'firebase/firestore';
import { createVenueProfile, deleteVenueProfile } from '@services/venues';
import { updateUserDocument } from '@services/users';
import { useResizeEffect } from '@hooks/useResizeEffect';
import { BuildingIcon, SavedIcon, TickIcon, VenueBuilderIcon } from '../../shared/ui/extras/Icons';
import { uploadImageArrayWithFallback } from '../../../services/storage';
import { LoadingSpinner, LoadingThreeDots } from '../../shared/ui/loading/Loading';
import { toast } from 'sonner';
import { Links } from './Links';
import { geohashForLocation } from 'geofire-common';
import Portal from '../../shared/components/Portal';
import { useAuth } from '../../../hooks/useAuth';
import { deleteVenueProfileInUserDocument } from '../../../services/users';

export const VenueBuilder = ({ user, setAuthModal, setAuthClosable }) => {

    const { setUser } = useAuth();
    const navigate = useNavigate();
    const location = useLocation();
    const { venue } = location.state || {};
    const [showErrorModal, setShowErrorModal] = useState(false);

    const [formData, setFormData] = useState({
        venueId: uuidv4(),
        email: user ? user.email : '',
        type: '',
        name: '',
        address: '',
        coordinates: null,
        establishment: '',
        equipmentAvailable: '',
        equipment: [],
        equipmentInformation: '',
        photos: [],
        extraInformation: '',
        description: '',
        accountName: user ? user.name : '',
        website: '',
        socialMedia: {
            facebook: '',
            twitter: '',
            instagram: '',
        },
    });
    const [windowWidth, setWindowWidth] = useState(window.innerWidth);

    useResizeEffect((width) => {
        setWindowWidth(width);
      });

    useEffect(() => {
        if (!user) {
            navigate('/venues')
        }
        if (user?.musicianProfile) {
            setShowErrorModal(true);
        }
    }, [user])

    useEffect(() => {
        if (venue) {
            const photos = (venue.photos || []).map((url, i) => {
                if (i === 0) {
                    return { file: url, offsetY: venue.primaryImageOffsetY || 0 };
                }
                return url;
            });
            setFormData({
                venueId: venue.venueId || uuidv4(),
                type: venue.type || '',
                name: venue.name || '',
                address: venue.address || '',
                coordinates: venue.coordinates || null,
                establishment: venue.establishment || '',
                equipmentAvailable: venue.equipmentAvailable || '',
                equipment: venue.equipment || [],
                equipmentInformation: venue.equipmentInformation || '',
                photos: photos || [],
                extraInformation: venue.extraInformation || '',
                description: venue.description || '',
                completed: venue.completed || false,
                website: venue.website,
                socialMedia: venue.socialMedia,
                primaryImageOffsetY: venue.primaryImageOffsetY,
            });
        }
    }, [venue])

    const [uploadingProfile, setUploadingProfile] = useState(false);
    const [uploadText, setUploadText] = useState(`Adding ${formData?.name} To The Gigin Map`);
    const [progress, setProgress] = useState(1);
    const [completeSavedProfileModal, setCompleteSavedProfileModal] = useState(false);
    const [savedProfile, setSavedProfile] = useState();
    const [stepError, setStepError] = useState(null);
    const [saving, setSaving] = useState(false);

    const handleInputChange = (field, value) => {
        setFormData({
            ...formData,
            [field]: value
        });
        setStepError(null)
    };

    useEffect(() => {
        const checkForSavedProfile = async () => {        
            if (user.venueProfiles && user.venueProfiles.some(profile => !profile.completed)) {
                const savedProfile = user.venueProfiles.find(profile => !profile.completed);
                if (savedProfile) {
                    setSavedProfile(savedProfile);
                    setCompleteSavedProfileModal(true);
                }
                }
        };
        if (user && user.venueProfiles && formData.name === '') {
            checkForSavedProfile();
        }
    }, [user, setAuthModal, formData]);

    const getGeoField = (coordinates) => {
        if (!coordinates || coordinates.length !== 2) return null;
        const [lng, lat] = coordinates;
        const geopoint = new GeoPoint(lat, lng);
        const geohash = geohashForLocation([lat, lng]).substring(0, 8);
        return {
          geopoint,
          geohash,
        };
    };

    const handleSubmit = async () => {
        setUploadText(`Adding ${formData?.name} To The Gigin Map`);
        setUploadingProfile(true);
        try {
            const imageFiles = formData.photos;
            const imageUrls = await uploadImageArrayWithFallback(imageFiles, `venues/${formData.venueId}`);
            const updatedFormData = {
                ...formData,
                photos: imageUrls,
                primaryImageOffsetY: formData.photos[0]?.offsetY,
                completed: true,
                ...getGeoField(formData.coordinates),
            };
            await createVenueProfile(formData.venueId, updatedFormData, user.uid);
            await updateUserDocument(user.uid, {
                venueProfiles: arrayUnion(formData.venueId),
            });
            const progressIntervals = [11, 22, 33, 44, 55, 66, 77, 88, 100];
            progressIntervals.forEach((value, index) => {
                setTimeout(() => setProgress(value), 1000 * (index + 1));
            });
            setUser(prev => {
                if (!prev) return prev;
              
                const prevProfiles = Array.isArray(prev.venueProfiles) ? prev.venueProfiles : [];
              
                const newProfile = {
                  ...updatedFormData,
                  id: formData.venueId,
                  venueId: formData.venueId,
                };
              
                const idx = prevProfiles.findIndex(p => (p?.id ?? p?.venueId) === formData.venueId);
              
                const nextProfiles =
                  idx >= 0
                    ? [
                        ...prevProfiles.slice(0, idx),
                        { ...prevProfiles[idx], ...newProfile },
                        ...prevProfiles.slice(idx + 1),
                      ]
                    : [...prevProfiles, newProfile];
              
                return {
                  ...prev,
                  venueProfiles: nextProfiles,
                  lastUpdatedAt: Date.now(),
                };
              });
            setTimeout(() => {
                navigate('/venues/dashboard/gigs', { state: { newUser: true } });
                setUploadingProfile(false)
            }, 11000);
    
        } catch (error) {
            setUploadingProfile(false);
            if (error.message?.includes('storage') || error.message?.includes('image')) {
                setStepError("Something went wrong while uploading your images. Please check your connection and try again.");
            } else if (error.message?.includes('createVenueProfile')) {
                setStepError("We couldn't save your venue profile. Please try again or contact support if the issue persists.");
            } else if (error.message?.includes('updateUserDocument')) {
                setStepError("Your venue was saved, but we couldn’t link it to your account. Please refresh and check your dashboard.");
            } else {
                setStepError("We couldn't save your venue profile. Please try again or contact support if the issue persists.");
            }
            toast.error('Error creating venue profile. Please try again.')
            console.error('Error uploading images or creating venue profile: ', error);
        }
    };

    const handleSaveAndExit = async () => {
        if (formData.name === '') {
            if (Array.isArray(user.venueProfiles) && user.venueProfiles.length < 1) {
                await deleteVenueProfileInUserDocument(user.uid);
                window.location.href = '/';
                return;
            } else {
                navigate(-1);
                return;
            }
        }
        try {
            setSaving(true);
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
                    currentStep: currentStep,
                    completed: false,
                };
            }
            if (formData.photos.length > 0) {
                const imageFiles = formData.photos;
                const imageUrls = await uploadImageArrayWithFallback(imageFiles, `venues/${formData.venueId}`);
                updatedFormData.photos = imageUrls;
                updatedFormData.primaryImageOffsetY = formData.photos[0]?.offsetY;
            }
            await createVenueProfile(formData.venueId, updatedFormData, user.uid);
            await updateUserDocument(user.uid, {
                venueProfiles: arrayUnion(formData.venueId),
            });
            if (updatedFormData.completed || (user?.venueProfiles && user?.venueProfiles?.length > 1)) {
                navigate('/venues/dashboard/gigs')
            } else {
                navigate('/venues');
            }
            toast.success('Venue profile saved.')
        } catch (error) {
            if (error.message?.includes('storage') || error.message?.includes('image')) {
                setStepError("Something went wrong while uploading your images. Please check your connection and try again.");
            } else if (error.message?.includes('createVenueProfile')) {
                setStepError("We couldn't save your venue profile. Please try again or contact support if the issue persists.");
            } else if (error.message?.includes('updateUserDocument')) {
                setStepError("Your venue was saved, but we couldn’t link it to your account. Please refresh and check your dashboard.");
            } else {
                setStepError("We couldn't save your venue profile. Please try again or contact support if the issue persists.");
            }
            toast.error('Error saving venue profile. Please try again.')
            console.error('Error uploading images or saving venue profile: ', error);
        } finally {
            setSaving(false);
        }
    };

    const handleDeleteSavedProfile = async () => {
        try {
          await deleteVenueProfile(savedProfile.venueId);
          await updateUserDocument(user.uid, {
            venueProfiles: arrayRemove(savedProfile.venueId),
          });
          if (Array.isArray(user.venueProfiles) && user.venueProfiles.length < 1) {
            console.log('running delete')
            await deleteVenueProfileInUserDocument(user.uid);
          }
          setCompleteSavedProfileModal(false);
          setSavedProfile(undefined);
          toast.info('Saved profile deleted.');
        } catch (error) {
          toast.error('Failed to delete saved profile.');
          console.error(error);
        }
      };

    const getCurrentStep = () => {
        if (location.pathname.includes('venue-details')) return 2;
        if (location.pathname.includes('equipment')) return 3;
        if (location.pathname.includes('photos')) {
            return formData.type === 'Public Establishment' ? 4 : 3;
        }
        if (location.pathname.includes('additional-details')) {
            return formData.type === 'Public Establishment' ? 5 : 4;
        }
        if (location.pathname.includes('links')) {
            return formData.type === 'Public Establishment' ? 6 : 5;
        }
        return 1;
    };

    const currentStep = getCurrentStep();

    const redirectToStep = (step) => {
        if (step === 1) {
            navigate('/venues/add-venue/');
        } else if (step === 2) {
            navigate('/venues/add-venue/venue-details');
        } else if (step === 3) {
            if (savedProfile?.type === 'Public Establishment' || formData.type === 'Public Establishment') {
                navigate('/venues/add-venue/equipment');
            } else {
                navigate('/venues/add-venue/photos');
            }
        } else if (step === 4) {
            if (savedProfile?.type === 'Public Establishment' || formData.type === 'Public Establishment') {
                navigate('/venues/add-venue/photos');
            } else {
                navigate('/venues/add-venue/additional-details');
            }
        } else if (step === 5) {
            navigate('/venues/add-venue/additional-details');
        } else if (step === 6 || (!isPublic && step === 5)) {
            navigate('/venues/add-venue/links');
        }
    };

    const handleStepClick = (step) => {
        const isPublic = formData.type === 'Public Establishment';
            
        // Step 1 — always allowed
        if (step === 1) {
          redirectToStep(1);
          return;
        }
      
        // Step 2 — requires step 1: `type`
        if (step === 2 && formData.type) {
          redirectToStep(2);
          return;
        }
      
        // Step 3 — only for Public Establishment, requires:
        // type + name, address, coordinates, establishment
        if (step === 3 && isPublic) {
          const step2Complete =
            formData.name &&
            formData.address &&
            formData.coordinates &&
            formData.establishment;
      
          if (step2Complete) {
            redirectToStep(3);
          }
      
          return;
        }
      
        // Step 4 — photos
        const photoStep = isPublic ? 4 : 3;
        if (step === photoStep) {
          if (
            formData.name &&
            formData.address &&
            formData.coordinates &&
            formData.establishment &&
            (!isPublic || (formData.equipmentAvailable))
          ) {
            redirectToStep(photoStep);
          }
          return;
        }
      
        // Step 5 — additional info (only if Public Establishment)
        const finalStep = isPublic ? 5 : 4;
        if (step === finalStep) {
          const step3Valid = !isPublic || (formData.equipmentAvailable);
          const step4Valid = formData.photos.length > 0;
          if (
            formData.name &&
            formData.address &&
            formData.coordinates &&
            formData.establishment &&
            step3Valid &&
            step4Valid
          ) {
            redirectToStep(finalStep);
          }
          return;
        }

        if (step === 6 || (!isPublic && step === 5)) {
            const step4Valid = formData.photos.length > 0;
            const step5Valid = formData.extraInformation && formData.description;
            if (
              formData.name &&
              formData.address &&
              formData.coordinates &&
              formData.establishment &&
              (!isPublic || formData.equipmentAvailable) &&
              step4Valid &&
              step5Valid
            ) {
              redirectToStep(step);
            }
            return;
          }

      };

    const isStep1Complete = () => formData.type;

    const isStep2Complete = () => {
        const baseValid =
          formData.name &&
          formData.address &&
          formData.coordinates;
      
        if (formData.type === 'Public Establishment') {
          return baseValid && formData.establishment;
        }
      
        return baseValid;
      };
    
    const isStep3Complete = () =>
    formData.type === 'Public Establishment'
        ? formData.equipmentAvailable
        : true;
    
    const isStep4Complete = () => formData.photos.length > 0;
    
    const isStep5Complete = () => formData.extraInformation && formData.description;

    const isStep6Complete = () => {
        if (formData.completed) {
            return true;
        } else if (currentStep === 6 && formData.type === 'Public Establishment') {
            return true;
        } else if (currentStep === 5) {
            return true;
        }
    };

    const getNextIncompleteStep = () => {
        const isPublic = formData.type === 'Public Establishment';
      
        if (!isStep1Complete()) return 1;
        if (!isStep2Complete()) return 2;
        if (isPublic && !isStep3Complete()) return 3;
        if (!isStep4Complete()) return isPublic ? 4 : 3;
        if (!isStep5Complete()) return isPublic ? 5 : 4;
        if (!isStep6Complete()) return isPublic ? 6 : 5;
        // All complete
        return null;
    };

    const isPublic = formData.type === 'Public Establishment';
    const totalSteps = isPublic ? 6 : 5;
    
    const completedSteps = [
        isStep1Complete(),
        isStep2Complete(),
        ...(isPublic ? [isStep3Complete()] : []),
        isStep4Complete(),
        isStep5Complete(),
        isStep6Complete()
      ].filter(Boolean).length;
    
    const percentComplete = totalSteps === 0 ? 0 : Math.round((completedSteps / totalSteps) * 100);

    return (
        <div className={`venue-builder ${uploadingProfile || saving ? 'upload-screen' : ''}`}>
            {uploadingProfile ? (
                <UploadingProfile text={uploadText} progress={progress} />
            ) : saving ? (
                <UploadingProfile text={'Saving...'} progress={null} />
            ) : (
                <>
                    <aside className='left'>
                        <div className='intro-text'>
                            <h2>Let's Add Your Venue!</h2>
                            {/* <p>Build a profile for your venue. If you manage more than one venue, you can build more later.</p> */}
                        </div>
                        <div className="progress-bar-container">
                        <div className="progress-bar-wrapper">
                            <div
                                className="progress-bar"
                                style={{
                                width: `${percentComplete}%`,
                                }}
                            />
                            </div>
                            <span className="progress-label">
                            {percentComplete}%
                            </span>
                        </div>
                        <div className='progress'>
                            <ul>
                                <li
                                className={`step ${isStep1Complete() ? 'completed' : ''} ${getNextIncompleteStep() === 1 ? 'active' : ''}`}
                                onClick={() => handleStepClick(1)}
                                >
                                <div className='circle'>{isStep1Complete() ? <TickIcon /> : 1}</div>
                                Choose Venue Type
                                </li>

                                <li
                                className={`step ${isStep2Complete() ? 'completed' : ''} ${getNextIncompleteStep() === 2 ? 'active' : ''}`}
                                onClick={() => handleStepClick(2)}
                                >
                                <div className='circle'>{isStep2Complete() ? <TickIcon /> : 2}</div>
                                Add Venue Details
                                </li>

                                {formData.type === 'Public Establishment' && (
                                <li
                                    className={`step ${isStep3Complete() ? 'completed' : ''} ${getNextIncompleteStep() === 3 ? 'active' : ''}`}
                                    onClick={() => handleStepClick(3)}
                                >
                                    <div className='circle'>{isStep3Complete() ? <TickIcon /> : 3}</div>
                                    Any In House Equipment?
                                </li>
                                )}

                                <li
                                className={`step ${isStep4Complete() ? 'completed' : ''} ${getNextIncompleteStep() === (formData.type === 'Public Establishment' ? 4 : 3) ? 'active' : ''}`}
                                onClick={() => handleStepClick(formData.type === 'Public Establishment' ? 4 : 3)}
                                >
                                <div className='circle'>
                                    {isStep4Complete() ? <TickIcon /> : formData.type === 'Public Establishment' ? 4 : 3}
                                </div>
                                Upload Photos
                                </li>

                                <li
                                className={`step ${isStep5Complete() ? 'completed' : ''} ${getNextIncompleteStep() === (formData.type === 'Public Establishment' ? 5 : 4) ? 'active' : ''}`}
                                onClick={() => handleStepClick(formData.type === 'Public Establishment' ? 5 : 4)}
                                >
                                <div className='circle'>
                                    {isStep5Complete() ? <TickIcon /> : formData.type === 'Public Establishment' ? 5 : 4}
                                </div>
                                Additional Details
                                </li>
                                <li
                                className={`step ${isStep6Complete() ? 'completed' : ''} ${getNextIncompleteStep() === (formData.type === 'Public Establishment' ? 6 : 5) ? 'active' : ''}`}
                                onClick={() => handleStepClick(formData.type === 'Public Establishment' ? 6 : 5)}
                                >
                                <div className='circle'>
                                    {isStep6Complete() ? <TickIcon /> : formData.type === 'Public Establishment' ? 6 : 5}
                                </div>
                                Links (Optional)
                                </li>
                            </ul>
                            {stepError && (
                                <div className="step-error-box">
                                    <p>{stepError}</p>
                                </div>
                            )}
                            </div>
                            <button className='btn secondary' onClick={handleSaveAndExit}>
                                Save and Exit
                            </button>
                    </aside>
                    <section className='right'>
                        {windowWidth < 1000 && (
                            <button className='btn secondary save-and-exit' onClick={handleSaveAndExit}>
                                Save and Exit
                            </button>
                        )}
                        <Routes>                    
                            <Route index element={<VenueType formData={formData} handleInputChange={handleInputChange} setStepError={setStepError} stepError={stepError} />} />
                            <Route path='venue-details' element={<VenueDetails formData={formData} handleInputChange={handleInputChange} setStepError={setStepError} stepError={stepError} />} />
                            <Route path='equipment' element={<InHouseEquipment formData={formData} handleInputChange={handleInputChange} setStepError={setStepError} stepError={stepError} />} />
                            <Route path='photos' element={<Photos formData={formData} handleInputChange={handleInputChange} setStepError={setStepError} stepError={stepError} />} />
                            <Route path='additional-details' element={<AdditionalDetails formData={formData} handleInputChange={handleInputChange} setStepError={setStepError} stepError={stepError} />} />
                            <Route path='links' element={<Links formData={formData} handleInputChange={handleInputChange} handleSubmit={handleSubmit} setStepError={setStepError} stepError={stepError} />} />
                        </Routes>
                    </section>
                </>
            )}


            {completeSavedProfileModal && (
                <Portal>
                    <div className='modal' onClick={handleDeleteSavedProfile}>
                        <div className="modal-padding" onClick={(e) => e.stopPropagation()}>
                            <div className='modal-content saved-profile'>
                                <div className="modal-header">
                                    <BuildingIcon />
                                    <h2>Continue Building {savedProfile?.name}?</h2>
                                </div>
                                <div
                                    className="saved-profile-card"
                                    onClick={() => {
                                        setFormData(savedProfile);
                                        setCompleteSavedProfileModal(false);
                                        redirectToStep(savedProfile.currentStep);
                                    }}
                                    role="button"
                                    tabIndex={0}
                                    onKeyDown={(e) => {
                                        if (e.key === 'Enter' || e.key === ' ') {
                                            setFormData(savedProfile);
                                            setCompleteSavedProfileModal(false);
                                            redirectToStep(savedProfile.currentStep);
                                        }
                                    }}
                                >
                                    {savedProfile?.photos[0] ? (
                                        <div className="img-thumbnail">
                                            <img src={savedProfile.photos[0]} alt={savedProfile.name} />
                                        </div>
                                    ) : (
                                        <div className="img-thumbnail">
                                            <h1>?</h1>
                                        </div>
                                    )}
                                    <div className="details">
                                        <h3>{savedProfile.name}</h3>
                                        <h4>{savedProfile?.address}</h4>
                                    </div>
                                </div>
                            </div>
                            <button className='btn text bottom-text' onClick={handleDeleteSavedProfile}>No, delete the profile.</button>
                        </div>
                    </div>
                </Portal>
            )}

            {showErrorModal && (
                <Portal>
                    <div className='modal venue-builder-error' onClick={() => {setShowErrorModal(false); navigate('/find-a-gig')}}>
                        <div className='modal-content' onClick={(e) => e.stopPropagation()}>
                            <div>
                                <h2>Oops! You’re Already a Musician</h2>
                                <p>
                                    It looks like you’ve already signed up with a musician profile.
                                    For now, we only support one type of profile per account.
                                    Venue support is coming soon — stay tuned!
                                </p>
                            </div>
                            <button className='btn primary' onClick={() => {setShowErrorModal(false); navigate('/find-a-gig')}}>Go Back</button>
                        </div>
                    </div>
                </Portal>
            )}
        </div>
    )
}