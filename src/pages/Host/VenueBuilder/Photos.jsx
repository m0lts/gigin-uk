import { useNavigate } from "react-router-dom";
import { LeftChevronIcon } from '/components/ui/Icons/Icons';

export const Photos = ({ formData, handleInputChange }) => {

    const navigate = useNavigate();

    const handleNext = () => {
        if (formData.photos.length < 1) return;
        navigate('/host/venue-builder/additional-details');
    };

    const handleFileChange = (e) => {
        handleInputChange('photos', [...formData.photos, ...Array.from(e.target.files)]);
    };

    return (
        <div>
            <h1>Upload photos of the performing space.</h1>
            <input
                type="file"
                multiple
                onChange={handleFileChange}
            />
            <button onClick={() => navigate(-1)}>
                <LeftChevronIcon />
            </button>
            <button onClick={handleNext}>Continue</button>
        </div>
    );
};