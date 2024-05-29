import { useEffect, useState } from "react";
import { BrowserRouter as Router, Route, Routes, useNavigate, useLocation } from "react-router-dom";
import { WhiteBckgrdLogo } from "../../../components/ui/logos/Logos"
import { VenueDetails } from "./VenueDetails";
import { VenueType } from "./VenueType";
import { InHouseEquipment } from "./InHouseEquipment";
import { Photos } from "./Photos";
import { AdditionalDetails } from "./AdditionalDetails";
import '/styles/host/venue-builder.styles.css'
import { ExitIcon } from "../../../components/ui/Icons/Icons";

export const VenueBuilder = () => {

    const [formData, setFormData] = useState({
        venueType: '',
        venueName: '',
        venueAddress: '',
        equipmentAvailable: '',
        equipmentType: [],
        photos: [],
        additionalDetails: ''
    });
    const navigate = useNavigate();
    const location = useLocation();

    const handleInputChange = (field, value) => {
        setFormData({
            ...formData,
            [field]: value
        });
    };

    useEffect(() => {
        console.log(formData)
    }, [formData])

    const handleSaveAndExit = () => {
        navigate('/host')
    }

    const getCurrentStep = () => {
        if (location.pathname.includes('venue-type')) return 1;
        if (location.pathname.includes('venue-details')) return 2;
        if (location.pathname.includes('equipment')) return 3;
        if (location.pathname.includes('photos')) {
            return formData.venueType === 'Public Establishment' ? 4 : 3;
        }
        if (location.pathname.includes('additional-details')) {
            return formData.venueType === 'Public Establishment' ? 5 : 4;
        }        return 1;
    };

    const currentStep = getCurrentStep();

    return (
        <div className="venue-builder">
            <aside className="left">
                <WhiteBckgrdLogo />
                <div className="text">
                    <h2>Let's get started.</h2>
                    <p>Build a profile for your venue. If you manage more than one venue, you can build more later.</p>
                </div>
                <div className="progress">
                    <ul>
                        <li className={`step ${currentStep >= 1 ? 'completed' : ''} ${currentStep === 1 ? 'active' : ''}`}>
                            <div className="circle">1</div>Venue type
                        </li>
                        {formData.venueType !== '' && (
                            <>
                                <li className={`step ${currentStep >= 2 ? 'completed' : ''} ${currentStep === 2 ? 'active' : ''}`}>
                                    <div className="circle">2</div>Venue Details
                                </li>
                                {formData.venueType === 'Public Establishment' && (
                                    <li className={`step ${currentStep >= 3 ? 'completed' : ''} ${currentStep === 3 ? 'active' : ''}`}>
                                        <div className="circle">3</div>In House Equipment
                                    </li>
                                )}
                                <li className={`step ${currentStep >= (formData.venueType === 'Public Establishment' ? 4 : 3) ? 'completed' : ''} ${currentStep === (formData.venueType === 'Public Establishment' ? 4 : 3) ? 'active' : ''}`}>
                                    <div className="circle">{formData.venueType === 'Public Establishment' ? 4 : 3}</div>Photos of performing space
                                </li>
                                <li className={`step ${currentStep >= (formData.venueType === 'Public Establishment' ? 5 : 4) ? 'completed' : ''} ${currentStep === (formData.venueType === 'Public Establishment' ? 5 : 4) ? 'active' : ''}`}>
                                    <div className="circle">{formData.venueType === 'Public Establishment' ? 5 : 4}</div>Additional details
                                </li>
                            </>
                        )}
                    </ul>
                </div>
                <button className="btn text" onClick={handleSaveAndExit}>
                    <ExitIcon />
                    Save and Exit
                </button>
            </aside>
            <section className="right">
                <Routes>                    
                    <Route index element={<VenueType formData={formData} handleInputChange={handleInputChange} />} />
                    <Route path="venue-details" element={<VenueDetails formData={formData} handleInputChange={handleInputChange} />} />
                    <Route path="equipment" element={<InHouseEquipment formData={formData} handleInputChange={handleInputChange} />} />
                    <Route path="photos" element={<Photos formData={formData} handleInputChange={handleInputChange} />} />
                    <Route path="additional-details" element={<AdditionalDetails formData={formData} handleInputChange={handleInputChange} />} />
                </Routes>
            </section>
        </div>
    )
}