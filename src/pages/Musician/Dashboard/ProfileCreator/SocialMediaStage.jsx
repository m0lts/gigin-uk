export const SocialMediaStage = ({ data, onChange }) => {
    const handleInputChange = (platform, value) => {
        onChange('socialMedia', { ...data, [platform]: value });
    };

    return (
        <div className="stage">
            <h2>Stage 12: Social Media</h2>
            <div className="social-media-inputs">
                {Object.keys(data).map(platform => (
                    <div key={platform} className="social-media-input">
                        <label htmlFor={platform}>{platform.charAt(0).toUpperCase() + platform.slice(1)}</label>
                        <input
                            type="url"
                            id={platform}
                            value={data[platform] || ''}
                            onChange={(e) => handleInputChange(platform, e.target.value)}
                            placeholder={`Enter your ${platform} URL`}
                        />
                    </div>
                ))}
            </div>
        </div>
    );
};