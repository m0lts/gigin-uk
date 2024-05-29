import { useNavigate } from 'react-router-dom';
import { LeftChevronIcon } from '/components/ui/Icons/Icons';

export const AdditionalDetails = ({ formData, handleInputChange }) => {

    const navigate = useNavigate();

    const handleFinish = () => {
        // Here you would send the formData to your database
        console.log(formData);
    };

    return (
        <div>
            <h1>Additional details.</h1>
            <textarea
                placeholder="Any additional details?"
                value={formData.additionalDetails}
                onChange={(e) => handleInputChange('additionalDetails', e.target.value)}
            />
            <button onClick={() => navigate(-1)}>
                <LeftChevronIcon />
            </button>
            <button onClick={handleFinish}>Finish</button>
        </div>
    );
};