import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { LeftChevronIcon } from '/components/ui/Extras/Icons';
import { FacebookIcon, InstagramIcon, TwitterIcon } from '../../../components/ui/Extras/Icons';

export const AdditionalDetails = ({ formData, handleInputChange, handleSubmit }) => {

    const navigate = useNavigate();


    useEffect(() => {
        if (formData.type === '') {
            navigate('/venues/add-venue');
        }
    }, [formData])

    const handleSocialMediaChange = (platform, value) => {
        handleInputChange('socialMedia', { ...formData.socialMedia, [platform]: value });
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
            <h3>Finally, provide some details of the venue.</h3>
            <div className="input-group">
                <label htmlFor="description" className='input-label'>Describe your venue. Give us a sense of the place's character.</label>
                <textarea
                    id='description'
                    placeholder="E.g. Cozy 18th century pub, with a warm and friendly group of regulars from the village."
                    value={formData.description}
                    onChange={(e) => handleInputChange('description', e.target.value)}
                />
            </div>
            <div className="input-group">
                <label htmlFor="information" className='input-label'>Finally, add any practical information about the place.</label>
                <textarea
                    id='information'
                    placeholder="Such as: Notes on performance space, how to find you, parking etc"
                    value={formData.extraInformation}
                    onChange={(e) => handleInputChange('extraInformation', e.target.value)}
                />
            </div>
            <div className="social-medias">
                <h6>Add Venue Social Media Links</h6>
                <div className="social-media-inputs">
                    {Object.keys(formData.socialMedia || {}).map((platform) => (
                        <div key={platform} className="input-group socials">
                            <label htmlFor={platform} className={`icon-label`}>{platformIcon(platform)}</label>
                            <input
                                type="url"
                                className="input-box"
                                id={platform}
                                value={formData.socialMedia[platform] || ''}
                                onChange={(e) => handleSocialMediaChange(platform, e.target.value)}
                                placeholder={`Enter your ${platform} URL`}
                            />
                        </div>
                    ))}
                </div>
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