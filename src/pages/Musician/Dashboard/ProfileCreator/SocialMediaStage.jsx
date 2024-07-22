import { FacebookIcon, InstagramIcon, SoundcloudIcon, SpotifyIcon, TwitterIcon, YoutubeIcon } from "../../../../components/ui/Extras/Icons";

export const SocialMediaStage = ({ data, onChange }) => {

    const handleInputChange = (platform, value) => {
        onChange('socialMedia', { ...data, [platform]: value });
    };

    const platformIcon = (platform) => {
        if (platform === 'facebook') {
            return <FacebookIcon />
        } else if (platform === 'twitter') {
            return <TwitterIcon />
        } else if (platform === 'instagram') {
            return <InstagramIcon />
        } else if (platform === 'spotify') {
            return <SpotifyIcon />
        } else if (platform === 'soundcloud') {
            return <SoundcloudIcon />
        } else {
            return <YoutubeIcon />
        }
    }

    return (
        <div className="stage social-media">
            <h3 className="section-title">Content</h3>
            <div className="body">
                <h1>Add links to your social media accounts.</h1>
                <div className="social-media-inputs">
                    {Object.keys(data).map(platform => (
                        <div key={platform} className="social-media-input">
                            <label htmlFor={platform} className={`${platform}-icon`}>{platformIcon(platform)}</label>
                            <input
                                type="url"
                                className="input"
                                id={platform}
                                value={data[platform] || ''}
                                onChange={(e) => handleInputChange(platform, e.target.value)}
                                placeholder={`Enter your ${platform} URL`}
                            />
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
};