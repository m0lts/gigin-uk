import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
    FacebookIcon,
    InstagramIcon,
    TwitterIcon,
    LeftChevronIcon } from '@features/shared/ui/extras/Icons';
import { InvoiceIcon } from '../../shared/ui/extras/Icons';

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
        // Practical information is now optional, so we don't validate it
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
                    <label htmlFor='description' className='input-label'>Bio <span className='required' style={{ color: 'var(--gn-red)' }}>*</span></label>
                    <div className="creation-bio-textarea-container">
                        <textarea
                            className={`creation-bio-textarea ${stepError && fieldError === 'description' ? 'error' : ''}`}
                            id='description'
                            placeholder="We're a venue housed in a history brewery built in..."
                            value={formData.description}
                            maxLength={300}
                            onChange={(e) => handleInputChange('description', e.target.value)}
                            onClick={() => {setStepError(null); setFieldError(null)}}
                        />
                        <h6 className={`creation-bio-textarea-length ${formData.description.length === 300 ? "red" : ""}`}>
                            {formData.description.length}/300 MAX
                        </h6>
                    </div>
                </div>
                <div className='input-group large-text margin'>
                    <label htmlFor='information' className='input-label'>Practical Information</label>
                    <div className="creation-bio-textarea-container">
                        <textarea
                            className={`creation-bio-textarea ${stepError && fieldError === 'extraInfo' ? 'error' : ''}`}
                            id='information'
                            placeholder='Any details musicians should know about parking, the performance space etc.'
                            value={formData.extraInformation}
                            maxLength={1000}
                            onChange={(e) => handleInputChange('extraInformation', e.target.value)}
                            onClick={() => {setStepError(null); setFieldError(null)}}
                        />
                        <h6 className={`creation-bio-textarea-length ${formData.extraInformation.length === 1000 ? "red" : ""}`}>
                            {formData.extraInformation.length}/1000 MAX
                        </h6>
                    </div>
                </div>
                
                {/* File Upload Fields */}
                <div className='input-group large-text margin' style={{ width: '100%' }}>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '1rem', width: '60%', minWidth: '250px', justifyContent: 'space-between'}}>
                        <div>
                            <label htmlFor='termsAndConditions' className='input-label'>Venue Terms and Conditions (optional)</label>
                            <div className='file-upload-container'>
                                <input
                                    type='file'
                                    id='termsAndConditions'
                                    className='file-input'
                                    accept='.pdf,.doc,.docx'
                                    onChange={(e) => {
                                        const file = e.target.files?.[0] || null;
                                        handleInputChange('termsAndConditions', file);
                                        setStepError(null);
                                    }}
                                />
                                <label htmlFor='termsAndConditions' className='file-upload-label'>
                                    <InvoiceIcon />
                                    {formData.termsAndConditions && typeof formData.termsAndConditions === 'object' 
                                        ? formData.termsAndConditions.name 
                                        : formData.termsAndConditions 
                                            ? 'File uploaded' 
                                            : 'Choose file'}
                                </label>
                            </div>
                        </div>
                        
                        <div>
                            <label htmlFor='prs' className='input-label'>Venue's PRS for artists to fill (optional)</label>
                            <div className='file-upload-container'>
                                <input
                                    type='file'
                                    id='prs'
                                    className='file-input'
                                    accept='.pdf,.doc,.docx'
                                    onChange={(e) => {
                                        const file = e.target.files?.[0] || null;
                                        handleInputChange('prs', file);
                                        setStepError(null);
                                    }}
                                />
                                <label htmlFor='prs' className='file-upload-label'>
                                    <InvoiceIcon />
                                    {formData.prs && typeof formData.prs === 'object' 
                                        ? formData.prs.name 
                                        : formData.prs 
                                            ? 'File uploaded' 
                                            : 'Choose file'}
                                </label>
                            </div>
                        </div>
                        
                        <div>
                            <label htmlFor='otherDocuments' className='input-label'>Other Documents (optional)</label>
                            <div className='file-upload-container'>
                                <input
                                    type='file'
                                    id='otherDocuments'
                                    className='file-input'
                                    accept='.pdf,.doc,.docx'
                                    onChange={(e) => {
                                        const file = e.target.files?.[0] || null;
                                        handleInputChange('otherDocuments', file);
                                        setStepError(null);
                                    }}
                                />
                                <label htmlFor='otherDocuments' className='file-upload-label'>
                                    <InvoiceIcon />
                                    {formData.otherDocuments && typeof formData.otherDocuments === 'object' 
                                        ? formData.otherDocuments.name 
                                        : formData.otherDocuments 
                                            ? 'File uploaded' 
                                            : 'Choose file'}
                                </label>
                            </div>
                        </div>
                    </div>
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