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
import { createVenueProfile, deleteVenueProfile } from '@services/client-side/venues';
import { BuildingIcon, ErrorIcon, MobileIcon, SavedIcon, TickIcon, VenueBuilderIcon } from '../../shared/ui/extras/Icons';
import { uploadImageArrayWithFallback, uploadFileWithFallback, uploadFileWithProgress } from '../../../services/storage';
import { LoadingSpinner, LoadingThreeDots } from '../../shared/ui/loading/Loading';
import { toast } from 'sonner';
import { Links } from './Links';
import { geohashForLocation } from 'geofire-common';
import Portal from '../../shared/components/Portal';
import { useAuth } from '../../../hooks/useAuth';
import { clearUserArrayField, updateUserArrayField } from '@services/api/users';
import { hasVenuePerm } from '../../../services/utils/permissions';
import { useBreakpoint } from '../../../hooks/useBreakpoint';

export const VenueBuilder = ({ user, setAuthModal, setAuthClosable, setAuthType }) => {

    const { setUser } = useAuth();
    const navigate = useNavigate();
    const location = useLocation();
    const { isSmUp, isLgUp } = useBreakpoint();
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
        techRider: {
            soundSystem: {
                pa: { available: '', notes: '' },
                mixingConsole: { available: '', notes: '' },
                vocalMics: { count: '', notes: '' },
                diBoxes: { count: '', notes: '' },
                monitoring: '',
                cables: ''
            },
            backline: {
                drumKit: { available: '', notes: '' },
                bassAmp: { available: '', notes: '' },
                guitarAmp: { available: '', notes: '' },
                keyboard: { available: '', notes: '' },
                other: '',
                stageSize: ''
            },
            houseRules: {
                volumeLevel: '',
                volumeNotes: '',
                noiseCurfew: '',
                powerAccess: '',
                houseRules: ''
            }
        },
        photos: [],
        videos: [],
        extraInformation: '',
        description: '',
        accountName: user ? user.name : '',
        website: '',
        socialMedia: {
            facebook: '',
            twitter: '',
            instagram: '',
        },
        primaryImageOffsetY: 0,
        primaryImageBlur: 0,
        termsAndConditions: '',
        prs: '',
        otherDocuments: '',
    });

    useEffect(() => {
        if (!user) {
            setAuthModal(true);
            setAuthClosable(false);
            setAuthType('signup')
        }
        if (user?.musicianProfile) {
            setShowErrorModal(true);
        }
    }, [user])

    useEffect(() => {
        if (venue) {
            // Convert photos to wrapped format for the Photos component
            // But also ensure we preserve the original URLs for saving
            const photos = (venue.photos || []).map((url, i) => {
                if (i === 0) {
                    return { file: url, offsetY: venue.primaryImageOffsetY || 0, blur: venue.primaryImageBlur || 0 };
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
                techRider: venue.techRider || {
                    soundSystem: {
                        pa: { available: '', notes: '' },
                        mixingConsole: { available: '', notes: '' },
                        vocalMics: { count: '', notes: '' },
                        diBoxes: { count: '', notes: '' },
                        monitoring: '',
                        cables: ''
                    },
                    backline: {
                        drumKit: { available: '', notes: '' },
                        bassAmp: { available: '', notes: '' },
                        guitarAmp: { available: '', notes: '' },
                        keyboard: { available: '', notes: '' },
                        other: '',
                        stageSize: ''
                    },
                    houseRules: {
                        volumeLevel: '',
                        volumeNotes: '',
                        noiseCurfew: '',
                        powerAccess: '',
                        houseRules: ''
                    }
                },
                photos: photos || [],
                videos: venue.videos || [],
                extraInformation: venue.extraInformation || '',
                description: venue.description || '',
                completed: venue.completed || false,
                website: venue.website,
                socialMedia: venue.socialMedia,
                primaryImageOffsetY: venue.primaryImageOffsetY || 0,
                primaryImageBlur: venue.primaryImageBlur || 0,
                termsAndConditions: venue.termsAndConditions || '',
                prs: venue.prs || '',
                otherDocuments: venue.otherDocuments || '',
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
        // Don't clear stepError if it's a techRider update and there's already an error
        // This prevents validation errors from being cleared immediately
        if (field !== 'techRider' || !stepError) {
            setStepError(null);
        }
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
            // Validate and upload images
            const imageFiles = formData.photos || [];
            let imageUrls = [];
            
            if (imageFiles.length > 0) {
                const firstImage = imageFiles[0];
                if (firstImage?.file instanceof File) {
                    // Check if file is readable
                    if (firstImage.file.size === 0) {
                        throw new Error('The image file appears to be empty or not fully downloaded. Please ensure the file is downloaded to your computer and try again.');
                    }
                }
                imageUrls = await uploadImageArrayWithFallback(imageFiles, `venues/${formData.venueId}`);
            } else {
                // If no photos, ensure we have an empty array
                imageUrls = [];
            }
            
            // Upload videos if they exist
            let videoUrls = [];
            if (formData.videos && formData.videos.length > 0) {
                const videosFolder = `venues/${formData.venueId}/videos`;
                const videoUploadPromises = formData.videos.map(async (video) => {
                    // If video already has URLs (from previous save), preserve them
                    if (video.videoUrl && video.thumbnailUrl) {
                        return {
                            id: video.id,
                            title: video.title || 'Untitled Video',
                            videoUrl: video.videoUrl,
                            thumbnailUrl: video.thumbnailUrl,
                            videoSizeBytes: video.videoSizeBytes || 0,
                            thumbnailSizeBytes: video.thumbnailSizeBytes || 0,
                        };
                    }
                    
                    // Upload video file
                    let videoUrl = '';
                    if (video.videoFile instanceof File) {
                        const extension = video.videoFile.name?.split('.').pop() || 'mp4';
                        const filename = `video-${video.id}-${Date.now()}.${extension}`;
                        const storagePath = `${videosFolder}/${filename}`;
                        videoUrl = await uploadFileWithProgress(video.videoFile, storagePath, () => {});
                    }
                    
                    // Upload thumbnail file
                    let thumbnailUrl = '';
                    if (video.thumbnailFile instanceof File) {
                        const extension = video.thumbnailFile.name?.split('.').pop() || 'png';
                        const filename = `thumbnail-${video.id}-${Date.now()}.${extension}`;
                        const storagePath = `${videosFolder}/thumbnails/${filename}`;
                        thumbnailUrl = await uploadFileWithProgress(video.thumbnailFile, storagePath, () => {});
                    }
                    
                    return {
                        id: video.id,
                        title: video.title || 'Untitled Video',
                        videoUrl: videoUrl,
                        thumbnailUrl: thumbnailUrl,
                        videoSizeBytes: video.videoSizeBytes || 0,
                        thumbnailSizeBytes: video.thumbnailSizeBytes || 0,
                    };
                });
                
                videoUrls = await Promise.all(videoUploadPromises);
            }
            
            // Upload document files if they exist
            const documentsFolder = `venues/${formData.venueId}/documents`;
            const [termsAndConditionsUrl, prsUrl, otherDocumentsUrl] = await Promise.all([
                uploadFileWithFallback(formData.termsAndConditions, documentsFolder),
                uploadFileWithFallback(formData.prs, documentsFolder),
                uploadFileWithFallback(formData.otherDocuments, documentsFolder),
            ]);
            
            const updatedFormData = {
                ...formData,
                photos: imageUrls,
                videos: videoUrls,
                primaryImageOffsetY: formData.photos[0]?.offsetY || formData.primaryImageOffsetY,
                primaryImageBlur: formData.photos[0]?.blur || formData.primaryImageBlur || 0,
                termsAndConditions: termsAndConditionsUrl,
                prs: prsUrl,
                otherDocuments: otherDocumentsUrl,
                completed: true,
                ...getGeoField(formData.coordinates),
            };
            try {
                await createVenueProfile(formData.venueId, updatedFormData, user.uid);
            } catch (error) {
                toast.error('Please check you have been given permission to edit this venue.');
                navigate('/venues/dashboard/gigs');
                return;
            }
            await updateUserArrayField({ field: 'venueProfiles', op: 'add', value: formData.venueId });
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
                navigate('/venues/dashboard/gigs', { state: { newUser: user?.venueProfiles?.length < 2 ? true : false} });
                setUploadingProfile(false)
            }, 11000);
        } catch (error) {
            setUploadingProfile(false);
            if (error.message?.includes('empty') || error.message?.includes('not fully downloaded') || error.message?.includes('iCloud')) {
                setStepError(error.message || "The image file cannot be read. This may be an iCloud file that needs to be downloaded first. Please download the file to your computer and try again.");
                toast.error('Image file error: Please ensure your image is fully downloaded to your computer.');
            } else if (error.message?.includes('storage') || error.message?.includes('image')) {
                setStepError("Something went wrong while uploading your image. Please check your connection and try again.");
            } else if (error.message?.includes('createVenueProfile')) {
                setStepError("We couldn't save your venue profile. Please try again or contact support if the issue persists.");
            } else if (error.message?.includes('updateUserDocument')) {
                setStepError("Your venue was saved, but we couldn't link it to your account. Please refresh and check your dashboard.");
            } else {
                setStepError("We couldn't save your venue profile. Please try again or contact support if the issue persists.");
            }
            toast.error('Error creating venue profile. Please try again.')
            console.error('Error uploading image or creating venue profile: ', error);
        }
    };

    const handleSaveAndExit = async () => {
        if (formData.name === '') {
            if (Array.isArray(user.venueProfiles) && user.venueProfiles.length < 1) {
                await clearUserArrayField({ field: 'venueProfiles' });
                navigate('/')
                return;
            } else {
                navigate('/');
                return;
            }
        }
        try {
            setSaving(true);
            
            // Always process photos FIRST to convert wrapped objects back to URLs
            // This ensures existing URLs are preserved when editing
            let imageUrls = [];
            console.log('Processing photos - formData.photos:', formData.photos);
            console.log('Processing photos - venue?.photos:', venue?.photos);
            
            if (formData.photos && formData.photos.length > 0) {
                const imageFiles = formData.photos;
                // Validate images before upload (only if it's a new File)
                const firstImage = imageFiles[0];
                if (firstImage?.file instanceof File) {
                    if (firstImage.file.size === 0) {
                        throw new Error('The image file appears to be empty or not fully downloaded. Please ensure the file is downloaded to your computer and try again.');
                    }
                }
                // Upload and convert to URLs - this handles both new files and existing URLs
                console.log('Calling uploadImageArrayWithFallback with:', imageFiles);
                imageUrls = await uploadImageArrayWithFallback(imageFiles, `venues/${formData.venueId}`);
                console.log('uploadImageArrayWithFallback returned:', imageUrls);
            } else {
                // If no photos in formData, preserve existing photos from venue data
                // This prevents clearing photos when editing other fields
                if (venue?.photos && Array.isArray(venue.photos) && venue.photos.length > 0) {
                    // Ensure they're URL strings, not wrapped objects
                    imageUrls = venue.photos.map(photo => {
                        if (typeof photo === 'string') return photo;
                        if (typeof photo === 'object' && photo?.file) {
                            return typeof photo.file === 'string' ? photo.file : photo;
                        }
                        return photo;
                    });
                    console.log('Preserved photos from venue:', imageUrls);
                } else {
                    console.log('No photos found in formData or venue');
                }
            }
            
            // Now build updatedFormData with processed photos
            let updatedFormData;
            if (formData.completed) {
                updatedFormData = {
                    ...formData,
                    photos: imageUrls, // Override with processed URLs
                    completed: true,
                };
                delete updatedFormData.currentStep;
            } else {
                updatedFormData = {
                    ...formData,
                    photos: imageUrls, // Override with processed URLs
                    currentStep: currentStep,
                    completed: false,
                };
            }
            
            // Set primary image offset and blur
            if (imageUrls.length > 0) {
                updatedFormData.primaryImageOffsetY = formData.photos[0]?.offsetY || formData.primaryImageOffsetY;
                updatedFormData.primaryImageBlur = formData.photos[0]?.blur || formData.primaryImageBlur || 0;
            }
            
            // Debug log to verify photos are being set
            console.log('Saving venue with photos:', updatedFormData.photos);
            
            // Upload videos if they exist
            let videoUrls = [];
            if (formData.videos && formData.videos.length > 0) {
                const videosFolder = `venues/${formData.venueId}/videos`;
                const videoUploadPromises = formData.videos.map(async (video) => {
                    // If video already has URLs (from previous save), preserve them
                    if (video.videoUrl && video.thumbnailUrl) {
                        return {
                            id: video.id,
                            title: video.title || 'Untitled Video',
                            videoUrl: video.videoUrl,
                            thumbnailUrl: video.thumbnailUrl,
                            videoSizeBytes: video.videoSizeBytes || 0,
                            thumbnailSizeBytes: video.thumbnailSizeBytes || 0,
                        };
                    }
                    
                    // Upload video file
                    let videoUrl = '';
                    if (video.videoFile instanceof File) {
                        const extension = video.videoFile.name?.split('.').pop() || 'mp4';
                        const filename = `video-${video.id}-${Date.now()}.${extension}`;
                        const storagePath = `${videosFolder}/${filename}`;
                        videoUrl = await uploadFileWithProgress(video.videoFile, storagePath, () => {});
                    }
                    
                    // Upload thumbnail file
                    let thumbnailUrl = '';
                    if (video.thumbnailFile instanceof File) {
                        const extension = video.thumbnailFile.name?.split('.').pop() || 'png';
                        const filename = `thumbnail-${video.id}-${Date.now()}.${extension}`;
                        const storagePath = `${videosFolder}/thumbnails/${filename}`;
                        thumbnailUrl = await uploadFileWithProgress(video.thumbnailFile, storagePath, () => {});
                    }
                    
                    return {
                        id: video.id,
                        title: video.title || 'Untitled Video',
                        videoUrl: videoUrl,
                        thumbnailUrl: thumbnailUrl,
                        videoSizeBytes: video.videoSizeBytes || 0,
                        thumbnailSizeBytes: video.thumbnailSizeBytes || 0,
                    };
                });
                
                videoUrls = await Promise.all(videoUploadPromises);
            }
            
            updatedFormData.videos = videoUrls;
            
            // Upload document files if they exist
            const documentsFolder = `venues/${formData.venueId}/documents`;
            const [termsAndConditionsUrl, prsUrl, otherDocumentsUrl] = await Promise.all([
                uploadFileWithFallback(formData.termsAndConditions, documentsFolder),
                uploadFileWithFallback(formData.prs, documentsFolder),
                uploadFileWithFallback(formData.otherDocuments, documentsFolder),
            ]);
            updatedFormData.termsAndConditions = termsAndConditionsUrl;
            updatedFormData.prs = prsUrl;
            updatedFormData.otherDocuments = otherDocumentsUrl;
            try {
                await createVenueProfile(formData.venueId, updatedFormData, user.uid);
            } catch (error) {
                toast.error('Please check you have been given permission to edit this venue.');
                navigate('/venues/dashboard/gigs')
                return;
            }
            await updateUserArrayField({ field: 'venueProfiles', op: 'add', value: formData.venueId });
            if (updatedFormData.completed || (user?.venueProfiles && user?.venueProfiles?.length > 1)) {
                navigate('/venues/dashboard/gigs')
            } else {
                navigate('/');
            }
            toast.success('Venue profile saved.')
        } catch (error) {
            if (error.message?.includes('empty') || error.message?.includes('not fully downloaded') || error.message?.includes('iCloud')) {
                setStepError(error.message || "The image file cannot be read. This may be an iCloud file that needs to be downloaded first. Please download the file to your computer and try again.");
                toast.error('Image file error: Please ensure your image is fully downloaded to your computer.');
            } else if (error.message?.includes('storage') || error.message?.includes('image')) {
                setStepError("Something went wrong while uploading your image. Please check your connection and try again.");
            } else if (error.message?.includes('createVenueProfile')) {
                setStepError("We couldn't save your venue profile. Please try again or contact support if the issue persists.");
            } else if (error.message?.includes('updateUserDocument')) {
                setStepError("Your venue was saved, but we couldn't link it to your account. Please refresh and check your dashboard.");
            } else {
                setStepError("We couldn't save your venue profile. Please try again or contact support if the issue persists.");
            }
            toast.error('Error saving venue profile. Please try again.')
            console.error('Error uploading image or saving venue profile: ', error);
        } finally {
            setSaving(false);
        }
    };

    const handleDeleteSavedProfile = async () => {
        try {
          await deleteVenueProfile(savedProfile.venueId);
          await updateUserArrayField({ field: 'venueProfiles', op: 'remove', value: savedProfile.venueId });
          if (Array.isArray(user.venueProfiles) && user.venueProfiles.length < 1) {
            await clearUserArrayField({ field: 'venueProfiles' });
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
            formData.establishment
          ) {
            redirectToStep(photoStep);
          }
          return;
        }
      
        // Step 5 — additional info (only if Public Establishment)
        const finalStep = isPublic ? 5 : 4;
        if (step === finalStep) {
          const step4Valid = formData.photos.length > 0;
          if (
            formData.name &&
            formData.address &&
            formData.coordinates &&
            formData.establishment &&
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
    
    const isStep3Complete = () => {
        if (formData.type !== 'Public Establishment') {
            return true; // Step 3 doesn't exist for non-public establishments
        }
        
        // Check if all required tech rider fields are filled
        const techRider = formData.techRider || {};
        const soundSystem = techRider.soundSystem || {};
        const backline = techRider.backline || {};
        
        return (
            soundSystem.pa?.available &&
            soundSystem.mixingConsole?.available &&
            (soundSystem.vocalMics?.count !== '' && soundSystem.vocalMics?.count !== null && soundSystem.vocalMics?.count !== undefined) &&
            (soundSystem.diBoxes?.count !== '' && soundSystem.diBoxes?.count !== null && soundSystem.diBoxes?.count !== undefined) &&
            backline.drumKit?.available &&
            backline.bassAmp?.available &&
            backline.guitarAmp?.available &&
            backline.keyboard?.available
        );
    };
    
    const isStep4Complete = () => formData.photos.length > 0;
    
    const isStep5Complete = () => formData.description; // extraInformation is now optional

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

    if (!isSmUp) {
        return (
            <div className='venue-builder inaccessible'>
                <div className="body">
                    <MobileIcon />
                    <h2>Not supported on mobile</h2>
                    <p>Sorry, but you can't build a venue profile on a mobile device. Please use a desktop computer to build your venue profile.</p>
                    <button className="btn primary" onClick={() => navigate(-1)}>Go Back</button>
                </div>
            </div>
        );
    }

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
                                    Tech Rider
                                </li>
                                )}

                                <li
                                className={`step ${isStep4Complete() ? 'completed' : ''} ${getNextIncompleteStep() === (formData.type === 'Public Establishment' ? 4 : 3) ? 'active' : ''}`}
                                onClick={() => handleStepClick(formData.type === 'Public Establishment' ? 4 : 3)}
                                >
                                <div className='circle'>
                                    {isStep4Complete() ? <TickIcon /> : formData.type === 'Public Establishment' ? 4 : 3}
                                </div>
                                Upload Photo
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
                        {!isLgUp && (
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