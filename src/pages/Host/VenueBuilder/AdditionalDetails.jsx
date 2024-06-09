import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { LeftChevronIcon } from '/components/ui/Icons/Icons';

export const AdditionalDetails = ({ formData, handleInputChange, handleSubmit }) => {

    const navigate = useNavigate();


    useEffect(() => {
        if (formData.type === '') {
            navigate('/host/venue-builder');
        }
    }, [formData])

    return (
        <div className='stage extra-details'>
            <h3>Finally, provide some details of the venue.</h3>
            <div className="input-group">
                <label htmlFor="information">Provide as much information that would be beneficial to musicians.</label>
                <textarea
                    id='information'
                    placeholder="E.g. Travel and parking info, how to find you, details about the performing space..."
                    value={formData.extraInformation}
                    onChange={(e) => handleInputChange('extraInformation', e.target.value)}
                />
            </div>
            <div className="input-group">
                <label htmlFor="description">Describe your venue. Give a sense of the venue's character.</label>
                <textarea
                    id='description'
                    placeholder="E.g. Cozy 18th century pub, with a warm and friendly group of regulars from the village."
                    value={formData.description}
                    onChange={(e) => handleInputChange('description', e.target.value)}
                />
            </div>
            <div className="controls">
                <button className='btn secondary' onClick={() => navigate(-1)}>
                    <LeftChevronIcon />
                </button>
                <button className='btn primary' onClick={handleSubmit}>Get me on Gigin</button>
            </div>
        </div>
    );
};