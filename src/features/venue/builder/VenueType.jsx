import { useNavigate } from 'react-router-dom';
import { PeopleRoofIcon, HouseIcon } from '@features/shared/ui/extras/Icons';

export const VenueType = ({ formData, handleInputChange }) => {

    const navigate = useNavigate();

    const handleNext = () => {
        if (formData.type === '') return;
        navigate('/venues/add-venue/venue-details');
    };

    return (
        <div className='stage type'>
            <h3>Tell us what type of venue you are.</h3>
            <div className='selections'>
                <button className={`card large ${formData.type === 'Public Establishment' && 'selected'}`} onClick={() => handleInputChange('type', 'Public Establishment')}>
                    <PeopleRoofIcon />
                    <span className='title'>Public Establishment</span>
                    e.g. Pub, Music venue, Restaurant, Church
                </button>
                <button className={`card large ${formData.type === 'Personal Space' && 'selected'}`} onClick={() => handleInputChange('type', 'Personal Space')}>
                    <HouseIcon />
                    <span className='title'>Personal Space</span>
                    e.g. House, Wedding, Private party
                </button>
            </div>
            <div className='controls single'>
                <button className='btn primary' onClick={handleNext}>
                    Continue
                </button>
            </div>
        </div>
    );
};