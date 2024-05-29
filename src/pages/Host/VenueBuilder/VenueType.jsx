import { useNavigate } from 'react-router-dom';

export const VenueType = ({ formData, handleInputChange }) => {

    const navigate = useNavigate();

    const handleNext = () => {
        if (formData.venueType === '') return;
        navigate('/host/venue-builder/venue-details');
    };

    return (
        <div>
            <h1>Tell us what type of venue you are.</h1>
            <button onClick={() => handleInputChange('venueType', 'Public Establishment')}>
                Public Establishment
            </button>
            <button onClick={() => handleInputChange('venueType', 'Personal Space')}>
                Personal Space
            </button>
            <button onClick={handleNext}>
                Continue
            </button>
        </div>
    );
};