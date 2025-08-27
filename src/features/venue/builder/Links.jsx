import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
    FacebookIcon,
    InstagramIcon,
    TwitterIcon,
    LeftChevronIcon } from '@features/shared/ui/extras/Icons';

export const Links = ({ formData, handleInputChange, handleSubmit }) => {

    const navigate = useNavigate();

    const handleVenueSubmission = () => {
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
                    <h1>Let's Link Up!</h1>
                    <p className='stage-copy'>If you have a website and social media pages, now's the time to add them.</p>
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
                <button className='btn primary' onClick={() => handleVenueSubmission()}>
                    {formData.completed ? (
                        'Save And Exit'
                    ) : (
                        'Get Me On Gigin'
                    )}
                </button>
            </div>
        </div>
    );
};