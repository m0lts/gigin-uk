import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
    FacebookIcon,
    InstagramIcon,
    TwitterIcon,
    LeftChevronIcon } from '@features/shared/ui/extras/Icons';

export const AdditionalDetails = ({ formData, handleInputChange, stepError, setStepError }) => {

    const navigate = useNavigate();
    const [fieldError, setFieldError] = useState(null);

    useEffect(() => {
        if (formData.type === '') {
            navigate('/venues/add-venue');
        }
    }, [formData])

    const handleNext = () => {
        if (formData.description === '') {
            setFieldError('description')
            setStepError('Please provide a description of your venue.')
            return;
        }
        if (formData.extraInformation === '') {
            setFieldError('extraInfo')
            setStepError('Please provide some extra information about your venue.')
            return;
        }
        navigate('/venues/add-venue/links');
    };

    return (
        <div className='stage extra-details'>
            <div className="stage-content">
                <div className="stage-definition">
                    <h1>Almost There! Just a Few Final Details</h1>
                    <p className='stage-copy'>Add any extra information that will help musicians understand the vibe, layout, or unique qualities of your space.</p>
                </div>
                <div className='input-group large-text'>
                    <label htmlFor='description' className='input-label'>Bio</label>
                    <textarea
                        className={`${stepError && fieldError === 'description' ? 'error' : ''}`}
                        id='description'
                        placeholder="We're a venue housed in a history brewery built in..."
                        value={formData.description}
                        onChange={(e) => handleInputChange('description', e.target.value)}
                        onClick={() => {setStepError(null); setFieldError(null)}}
                    />
                </div>
                <div className='input-group large-text margin'>
                    <label htmlFor='information' className='input-label'>Practical Information</label>
                    <textarea
                        className={`${stepError && fieldError === 'extraInfo' ? 'error' : ''}`}
                        id='information'
                        placeholder='Any details musicians should know about parking, the performance space etc.'
                        value={formData.extraInformation}
                        onChange={(e) => handleInputChange('extraInformation', e.target.value)}
                        onClick={() => {setStepError(null); setFieldError(null)}}
                    />
                </div>
            </div>
            <div className='stage-controls'>
                <button className='btn secondary' onClick={() => navigate(-1)}>
                    Back
                </button>
                <button className='btn primary' onClick={() => handleNext()}>Continue</button>
            </div>
        </div>
    );
};