import { useEffect, useState } from "react";
import { BrowserRouter as Router, Route, Routes, useNavigate, useLocation } from "react-router-dom";
import { v4 as uuidv4 } from 'uuid';
import { NoTextLogo, WhiteBckgrdLogo } from "/components/ui/logos/Logos"
import { VenueDetails } from "./VenueDetails";
import { VenueType } from "./VenueType";
import { InHouseEquipment } from "./InHouseEquipment";
import { Photos } from "./Photos";
import { AdditionalDetails } from "./AdditionalDetails";
import '/styles/host/venue-builder.styles.css'
import axios from "axios";
import { UploadingProfile } from "./UploadingProfile";

const bucketName = "gigin-users-media";
const region = "eu-west-2";

export const VenueBuilder = ({ user, setAuthModal }) => {

    const navigate = useNavigate();
    const location = useLocation();
    const { venue } = location.state || {};

    const [formData, setFormData] = useState({
        venueId: uuidv4(),
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
    });

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
            try {
                const response = await axios.post('/api/venues/findVenue', {
                    userId: user.userId,
                    requestType: 'Incomplete',
                });

                if (response.data.incompleteProfile) {
                    delete response.data.incompleteProfile._id;
                    setSavedProfile(response.data.incompleteProfile);
                    setCompleteSavedProfileModal(true);
                }

            } catch (error) {
                console.error('Error checking for saved profile:', error);
            }
        };

        if (!user) {
            setAuthModal(true);
        }
        if (user && formData.name === '') {
            checkForSavedProfile();
        }
    }, [user, setAuthModal, formData]);

    const uploadImagesToS3 = async (images, venueId) => {
        const files = images.filter(image => typeof image !== 'string'); // Filter out URLs
        const urls = images.filter(image => typeof image === 'string'); // Extract URLs
    
        if (files.length > 0) {
            const response = await fetch('/api/s3-functions/getSignedUrls', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ files: files.map(file => file.name), venueId }),
            });
    
            const { signedUrls } = await response.json();
    
            const uploadPromises = signedUrls.map(({ url, imageName }, index) => {
                return fetch(url, {
                    method: 'PUT',
                    body: files[index],
                }).then(() => `https://${bucketName}.s3.${region}.amazonaws.com/${imageName}`);
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
            const imageUrls = await uploadImagesToS3(imageFiles, formData.venueId);

            const updatedFormData = {
                ...formData,
                photos: imageUrls,
                completed: true,
            };

            const response = await fetch('/api/venues/uploadVenue', { 
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    userId: user.userId,
                    venueData: updatedFormData,
                }),
            });

            if (!response.ok) {
                setUploadingProfile(false);
                throw new Error('Failed to create venue profile');
            }

            // Update the loading text and progress at intervals
            setTimeout(() => setUploadText('Building your profile...'), 3000);
            setTimeout(() => setProgress(33), 3000);
            setTimeout(() => setUploadText('Creating your dashboard...'), 9000);
            setTimeout(() => setProgress(66), 9000);
            setTimeout(() => {
                setProgress(100);
                navigate('/host/dashboard');
            }, 12000);

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
            let updatedFormData = {
                ...formData,
                currentStep: currentStep,
                completed: false,
            };

            if (formData.photos.length > 0) {
                const imageFiles = formData.photos;
                const imageUrls = await uploadImagesToS3(imageFiles, formData.venueId);

                updatedFormData.photos = imageUrls;
            }

            const response = await axios.post('/api/venues/uploadVenue', {
                userId: user.userId,
                venueData: updatedFormData,
            }, {
                headers: {
                    'Content-Type': 'application/json',
                }
            });

            if (response.status !== 200) {
                throw new Error('Failed to create venue profile');
            }

            navigate(-1);

        } catch (error) {
            console.error('Error uploading images or creating venue profile: ', error);
        }
    };

    const handleDeleteSavedProfile = async () => {
        try {
            const response = await axios.post('/api/venues/deleteVenue', {
                venueId: savedProfile.venueId,
                userId: user.userId,
            }, {
                headers: {
                    'Content-Type': 'application/json',
                }
            });

            if (response.status !== 200) {
                throw new Error('Failed to delete venue profile');
            }

            if (response.status === 200) {
                setCompleteSavedProfileModal(false);
                setSavedProfile();
            }
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
            navigate('/host/venue-builder/');
        } else if (step === 2) {
            navigate('/host/venue-builder/venue-details');
        } else if (step === 3) {
            if (savedProfile.type === 'Public Establishment') {
                navigate('/host/venue-builder/equipment');
            } else {
                navigate('/host/venue-builder/photos');
            }
        } else if (step === 4) {
            if (savedProfile.type === 'Public Establishment') {
                navigate('/host/venue-builder/photos');
            } else {
                navigate('/host/venue-builder/additional-details');
            }
        } else if (step === 5) {
            navigate('/host/venue-builder/additional-details');
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
                                            <div className="circle">{formData.type === 'Public Establishment' ? 4 : 3}</div>Photos of performing space
                                        </li>
                                        <li className={`step ${currentStep >= (formData.type === 'Public Establishment' ? 5 : 4) ? 'completed' : ''} ${currentStep === (formData.type === 'Public Establishment' ? 5 : 4) ? 'active' : ''}`}>
                                            <div className="circle">{formData.type === 'Public Establishment' ? 5 : 4}</div>Additional details
                                        </li>
                                    </>
                                )}
                            </ul>
                        </div>
                        <button className="btn text" onClick={handleSaveAndExit}>
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
        </div>
    )
}