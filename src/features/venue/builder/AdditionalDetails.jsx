import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
    FacebookIcon,
    InstagramIcon,
    TwitterIcon,
    LeftChevronIcon } from '@features/shared/ui/extras/Icons';

export const AdditionalDetails = ({ formData, handleInputChange, handleSubmit, stepError, setStepError }) => {

    const navigate = useNavigate();
    const [fieldError, setFieldError] = useState(null);

    const handleVenueSubmission = () => {
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
        handleSubmit();
    }

    useEffect(() => {
        if (formData.type === '') {
            navigate('/venues/add-venue');
        }
    }, [formData])

    const handleSocialMediaChange = (platform, value) => {
        handleInputChange('socialMedia', {
          ...(formData.socialMedia || {}),
          [platform]: value
        });
      };

    const platformIcon = (platform) => {
        if (platform === 'facebook') {
            return <FacebookIcon />;
        } else if (platform === 'twitter') {
            return <TwitterIcon />;
        } else if (platform === 'instagram') {
            return <InstagramIcon />;
        }
    };

    return (
        <div className='stage extra-details'>
            <div className="stage-content">
                <div className="stage-definition">
                    <h1>Almost There! Just a Few Final Details</h1>
                    <p className='stage-copy'>Add any extra information that will help musicians understand the vibe, layout, or unique qualities of your space.</p>
                </div>
                <div className='input-group large-text'>
                    <label htmlFor='description' className='input-label'>Describe your venue. Give us a sense of the place's character</label>
                    <textarea
                        className={`${stepError && fieldError === 'description' ? 'error' : ''}`}
                        id='description'
                        placeholder='E.g. Cozy 18th century pub, with a warm and friendly group of regulars from the village.'
                        value={formData.description}
                        onChange={(e) => handleInputChange('description', e.target.value)}
                        onClick={() => {setStepError(null); setFieldError(null)}}
                    />
                </div>
                <div className='input-group large-text margin'>
                    <label htmlFor='information' className='input-label'>Finally, add any practical information about the place</label>
                    <textarea
                        className={`${stepError && fieldError === 'extraInfo' ? 'error' : ''}`}
                        id='information'
                        placeholder='Such as: Notes on performance space, how to find you, parking etc'
                        value={formData.extraInformation}
                        onChange={(e) => handleInputChange('extraInformation', e.target.value)}
                        onClick={() => {setStepError(null); setFieldError(null)}}
                    />
                </div>
                <div className="input-group margin">
                    <label htmlFor='website' className='input-label'>Add your venue's website link here</label>
                    <input
                        className='input'
                        type='text'
                        id='website'
                        placeholder='www.myvenue.com'
                        value={formData.website}
                        onChange={(e) => handleInputChange('website', e.target.value)}
                        onClick={() => {setStepError(null); setFieldError(null)}}
                    />
                </div>
                <div className='social-medias margin'>
                    <h6>Add Your Venue's Social Media Links</h6>
                    <div className='social-media-inputs'>
                        {Object.keys(
                        formData.socialMedia && typeof formData.socialMedia === 'object'
                            ? formData.socialMedia
                            : { facebook: '', twitter: '', instagram: '' }
                        ).map((platform) => (
                        <div key={platform} className='input-group socials'>
                            <label htmlFor={platform} className='icon-label'>{platformIcon(platform)}</label>
                            <input
                            type='url'
                            className='input-box'
                            id={platform}
                            value={formData.socialMedia?.[platform] ?? ''}
                            onChange={(e) => handleSocialMediaChange(platform, e.target.value)}
                            placeholder={`Enter your ${platform} URL`}
                            />
                        </div>
                        ))}
                    </div>
                    </div>
                </div>
            <div className='stage-controls'>
                <button className='btn secondary' onClick={() => navigate(-1)}>
                    Back
                </button>
                <button className='btn primary' onClick={() => handleVenueSubmission()}>Get me on Gigin</button>
            </div>
        </div>
    );
};