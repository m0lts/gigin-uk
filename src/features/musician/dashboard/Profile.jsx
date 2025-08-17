import { useState } from 'react';
import '@styles/musician/musician-profile.styles.css'
import { ProfilePreview } from './profile-preview/ProfilePreview';
import { ProfileForm } from './profile-form/ProfileForm';
import { MusicianProfile } from '../components/MusicianProfile';
import { VerifiedIcon } from '../../shared/ui/extras/Icons';


export const Profile = ({ musicianProfile, user }) => {
    const [showPreview, setShowPreview] = useState(true);
    const [expand, setExpand] = useState(['your-sound', 'media-upload', 'further-information', 'social-media']);
    const isPrimaryOpen = expand.includes('primary-information');
    const toggleSection = (section) => {
        setExpand(prev =>
          prev.includes(section) ? prev.filter(s => s !== section) : [...prev, section]
        );
      };

    return (
        <>
            <div className="musician-profile-hero">
                <img src={musicianProfile?.picture} alt={musicianProfile.name} className='background-image' />
                <div className="primary-information">
                    {!musicianProfile?.verified && (
                        <div className="verified-tag">
                            <VerifiedIcon />
                            <p>Verified Musician</p>
                        </div>
                    )}
                    <h1 className="venue-name">
                        {musicianProfile?.name}
                        <span className='orange-dot'>.</span>
                    </h1>
                    <h4 className="number-of-gigs">
                        {musicianProfile?.gigsPerformed} Gigs Performed
                    </h4>
                    <div className="action-buttons">
                        <button className="btn quaternary" onClick={() => setShowPreview(!showPreview)}>
                            {showPreview ? (
                                'Edit Profile'
                            ) : (
                                'View Profile'
                            )}
                        </button>

                    {/* COLLAPSED HEADER (shown when NOT expanded) */}
                    {isPrimaryOpen && !showPreview ? (
                        <button
                            className="btn quaternary"
                            onClick={() => toggleSection('primary-information')}
                            aria-expanded={false}
                            aria-controls="primary-information-panel"
                        >
                            Hide Name and Profile Picture
                        </button>
                        ) : !showPreview &&(
                            <button
                            className="btn quaternary"
                            onClick={() => toggleSection('primary-information')}
                            aria-expanded={false}
                            aria-controls="primary-information-panel"
                        >
                            Edit Name and Profile Picture
                        </button>
                        )}
                    </div>
                </div>
            </div>
            {!showPreview ? (
                <div className="body profile">
                    <ProfileForm
                        user={user}
                        musicianProfile={musicianProfile}
                        setShowPreview={setShowPreview}
                        expand={expand}
                        setExpand={setExpand}
                    />
                </div>
            ) : (
                <div className="body profile-preview">
                    <MusicianProfile
                        musicianProfile={musicianProfile}
                        viewingOwnProfile={true}
                        setShowPreview={setShowPreview}
                    />
                </div>
            )}
        </>
    );
};