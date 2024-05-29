import { useNavigate } from 'react-router-dom';
import { LeftChevronIcon } from '/components/ui/Icons/Icons';

export const VenueDetails = ({ formData, handleInputChange }) => {

    const navigate = useNavigate();

    const handleNext = () => {
        if (formData.venueName === '') return;
        if (formData.venueAddress === '') return;
        if (formData.venueType === 'Public Establishment') {
            navigate('/host/venue-builder/equipment');
        } else {
            navigate('/host/venue-builder/photos');
        }
    };

    return (
        <div>
            <h1>Give some information so the musicians can find you.</h1>
            <input
                type="text"
                placeholder="Name for this venue"
                value={formData.venueName}
                onChange={(e) => handleInputChange('venueName', e.target.value)}
            />
            <input
                type="text"
                placeholder="Venue Address"
                value={formData.venueAddress}
                onChange={(e) => handleInputChange('venueAddress', e.target.value)}
            />
            {formData.venueType === 'Public Establishment' && (
                <h2>public establishment</h2>
            )}
            <button onClick={() => navigate(-1)}>
                <LeftChevronIcon />
            </button>
            <button onClick={handleNext}>Continue</button>
        </div>
    );
};