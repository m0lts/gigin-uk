import { useEffect, useState } from "react";
import { BrowserRouter as Router, Route, Routes, useNavigate, useLocation } from "react-router-dom";
import { v4 as uuidv4 } from 'uuid';
import { NoTextLogo, WhiteBckgrdLogo } from "/components/ui/logos/Logos"
import { ExitIcon } from "/components/ui/Extras/Icons"
import { VenueDetails } from "./VenueDetails";
import { VenueType } from "./VenueType";
import { InHouseEquipment } from "./InHouseEquipment";
import { Photos } from "./Photos";
import { AdditionalDetails } from "./AdditionalDetails";
import '/styles/host/venue-builder.styles.css'
import axios from "axios";
import { UploadingProfile } from "./UploadingProfile";
import { storage, firestore } from "../../../firebase";
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { collection, query, where, getDocs, doc, setDoc, updateDoc, arrayUnion, deleteDoc, arrayRemove } from 'firebase/firestore';

export const VenueBuilder = ({ user, setAuthModal, setAuthClosable }) => {

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
        photos: [],
        extraInformation: '',
        description: '',
        accountName: user ? user.name : '',
        socialMedia: {
            facebook: '',
            twitter: '',
            instagram: '',
        },
    });

    useEffect(() => {
        if (!user) {
            navigate('/venues')
        }
        if (user.musicianProfile) {
            setShowErrorModal(true);
        }
    }, [user])

    useEffect(() => {
        if (venue) {
            setFormData({
                venueId: venue.venueId || uuidv4(),
                type: venue.type || '',
                name: venue.name || '',
                address: venue.address || '',
                coordinates: venue.coordinates || null,
                establishment: venue.establishment || '',
                equipmentAvailable: venue.equipmentAvailable || '',
                equipment: venue.equipment || [],
                photos: venue.photos || [],
                extraInformation: venue.extraInformation || '',
                description: venue.description || '',
                completed: venue.completed || false,
            });
        }
    }, [venue])

    const [uploadingProfile, setUploadingProfile] = useState(false);
    const [uploadText, setUploadText] = useState('Uploading your images...');
    const [progress, setProgress] = useState(1);
    const [completeSavedProfileModal, setCompleteSavedProfileModal] = useState(false);
    const [savedProfile, setSavedProfile] = useState();

    const handleInputChange = (field, value) => {
        setFormData({
            ...formData,
            [field]: value
        });
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

        // Only check for saved profile if the user has a profile associated with their account
        if (user && user.venueProfiles && formData.name === '') {
            checkForSavedProfile();
        }
    }, [user, setAuthModal, formData]);

    const uploadImagesToFirebaseStorage = async (images, venueId) => {
        const files = images.filter(image => typeof image !== 'string'); // Filter out URLs
        const urls = images.filter(image => typeof image === 'string'); // Extract URLs
      
        if (files.length > 0) {
          const uploadPromises = files.map(async (file) => {
            const storageRef = ref(storage, `venues/${venueId}/${file.name}`);
            await uploadBytes(storageRef, file);
            return getDownloadURL(storageRef);
          });
      
          const uploadedUrls = await Promise.all(uploadPromises);
          return [...urls, ...uploadedUrls]; // Combine original URLs with newly uploaded URLs
        }
      
        return urls; // Return the original URLs if there are no new files to upload
      };

    const handleSubmit = async () => {
        setUploadingProfile(true);
        try {
            const imageFiles = formData.photos;
            const imageUrls = await uploadImagesToFirebaseStorage(imageFiles, formData.venueId);

            const updatedFormData = {
                ...formData,
                photos: imageUrls,
                completed: true,
            };

            const venueRef = doc(firestore, 'venueProfiles', formData.venueId);
            await setDoc(venueRef, {
                ...updatedFormData,
                user: user.uid,
            }, {merge: true});

            const userRef = doc(firestore, 'users', user.uid);
                await updateDoc(userRef, {
                    venueProfiles: arrayUnion(formData.venueId),
            });

            // Update the loading text and progress at intervals
            setTimeout(() => setUploadText('Building your profile...'), 2000);
            setTimeout(() => setProgress(33), 2000);
            setTimeout(() => setUploadText('Creating your dashboard...'), 6000);
            setTimeout(() => setProgress(66), 6000);
            setTimeout(() => {
                setProgress(100);
                navigate('/venues/dashboard', { state: { newUser: true } });
            }, 9000);

        } catch (error) {
            setUploadingProfile(false);
            console.error('Error uploading images or creating venue profile: ', error);
        }
    };

    const handleSaveAndExit = async () => {
        if (formData.name === '') {
            navigate(-1);
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
                    currentStep: currentStep,
                    completed: false,
                };
            }

            if (formData.photos.length > 0) {
                const imageFiles = formData.photos;
                const imageUrls = await uploadImagesToFirebaseStorage(imageFiles, formData.venueId);

                updatedFormData.photos = imageUrls;
            }

            const venueRef = doc(firestore, 'venueProfiles', formData.venueId);
            await setDoc(venueRef, {
                ...updatedFormData,
                userId: user.uid,
            }, {merge:true});

            const accountRef = doc(firestore, 'users', user.uid);
            await updateDoc(accountRef, {
                venueProfiles: arrayUnion(formData.venueId),
            })

            navigate('/venues');

        } catch (error) {
            console.error('Error uploading images or creating venue profile: ', error);
        }
    };

    const handleDeleteSavedProfile = async () => {
        try {
            
            const venueRef = doc(firestore, 'venueProfiles', savedProfile.venueId);
            await deleteDoc(venueRef);
            
            // Update user's document to remove the venue profile ID
            const userRef = doc(firestore, 'users', user.uid);
            await updateDoc(userRef, {
                venueProfiles: arrayRemove(savedProfile.venueId),
            });

            setCompleteSavedProfileModal(false);
            setSavedProfile();

        } catch (error) {
            console.error(error);
        }
    }

    const getCurrentStep = () => {
        if (location.pathname.includes('venue-details')) return 2;
        if (location.pathname.includes('equipment')) return 3;
        if (location.pathname.includes('photos')) {
            return formData.type === 'Public Establishment' ? 4 : 3;
        }
        if (location.pathname.includes('additional-details')) {
            return formData.type === 'Public Establishment' ? 5 : 4;
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
            if (savedProfile.type === 'Public Establishment') {
                navigate('/venues/add-venue/equipment');
            } else {
                navigate('/venues/add-venue/photos');
            }
        } else if (step === 4) {
            if (savedProfile.type === 'Public Establishment') {
                navigate('/venues/add-venue/photos');
            } else {
                navigate('/venues/add-venue/additional-details');
            }
        } else if (step === 5) {
            navigate('/venues/add-venue/additional-details');
        }
    };

    return (
        <div className="venue-builder">

            {uploadingProfile ? (
                <UploadingProfile text={uploadText} progress={progress} />
            ) : (
                <>
                    <aside className="left">
                        <WhiteBckgrdLogo />
                        <div className="intro-text">
                            <h2>Let's get started.</h2>
                            <p>Build a profile for your venue. If you manage more than one venue, you can build more later.</p>
                        </div>
                        <div className="progress">
                            <ul>
                                <li className={`step ${currentStep >= 1 ? 'completed' : ''} ${currentStep === 1 ? 'active' : ''}`}>
                                    <div className="circle">1</div>Venue type
                                </li>
                                {formData.type !== '' && (
                                    <>
                                        <li className={`step ${currentStep >= 2 ? 'completed' : ''} ${currentStep === 2 ? 'active' : ''}`}>
                                            <div className="circle">2</div>Venue Details
                                        </li>
                                        {formData.type === 'Public Establishment' && (
                                            <li className={`step ${currentStep >= 3 ? 'completed' : ''} ${currentStep === 3 ? 'active' : ''}`}>
                                                <div className="circle">3</div>In House Equipment
                                            </li>
                                        )}
                                        <li className={`step ${currentStep >= (formData.type === 'Public Establishment' ? 4 : 3) ? 'completed' : ''} ${currentStep === (formData.type === 'Public Establishment' ? 4 : 3) ? 'active' : ''}`}>
                                            <div className="circle">{formData.type === 'Public Establishment' ? 4 : 3}</div>Photos
                                        </li>
                                        <li className={`step ${currentStep >= (formData.type === 'Public Establishment' ? 5 : 4) ? 'completed' : ''} ${currentStep === (formData.type === 'Public Establishment' ? 5 : 4) ? 'active' : ''}`}>
                                            <div className="circle">{formData.type === 'Public Establishment' ? 5 : 4}</div>Additional details
                                        </li>
                                    </>
                                )}
                            </ul>
                        </div>
                        <button className="btn primary" onClick={handleSaveAndExit}>
                            Save and Exit
                        </button>
                    </aside>
                    <section className="right">
                        <Routes>                    
                            <Route index element={<VenueType formData={formData} handleInputChange={handleInputChange} />} />
                            <Route path="venue-details" element={<VenueDetails formData={formData} handleInputChange={handleInputChange} />} />
                            <Route path="equipment" element={<InHouseEquipment formData={formData} handleInputChange={handleInputChange} />} />
                            <Route path="photos" element={<Photos formData={formData} handleInputChange={handleInputChange} />} />
                            <Route path="additional-details" element={<AdditionalDetails formData={formData} handleInputChange={handleInputChange} handleSubmit={handleSubmit} />} />
                        </Routes>
                    </section>
                </>
            )}


            {completeSavedProfileModal && (
                <div className="modal">
                    <div className="modal-content saved-profile">
                        <h2>Do you want to continue building '{savedProfile.name}'?</h2>
                        <p>If you click 'no', the profile will be deleted.</p>
                        <div className="two-buttons">
                            <button className="btn primary" onClick={() => {setFormData(savedProfile); setCompleteSavedProfileModal(false); redirectToStep(savedProfile.currentStep)}}>Yes</button>
                            <button className="btn secondary" onClick={handleDeleteSavedProfile}>No</button>
                        </div>
                    </div>
                </div>
            )}

            {showErrorModal && (
                <div className="modal">
                    <div className="modal-content">
                        <h3>Oops!</h3>
                        <p>You are already signed up as a musician. We don't allow two profiles for the time being, check back soon!</p>
                        <button className="btn primary" onClick={() => {setShowErrorModal(false); navigate('/find-a-gig')}}>Got it!</button>
                        <button className='btn close tertiary' onClick={() => {setShowErrorModal(false); navigate('/find-a-gig')}}>Close</button>
                    </div>
                </div>
            )}
        </div>
    )
}