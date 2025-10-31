import { useState } from 'react';
import '@styles/musician/musician-profile.styles.css'
import { ProfileForm } from './profile-form/ProfileForm';
import { MusicianProfile } from '../components/MusicianProfile';
import { NoImageIcon, VerifiedIcon } from '../../shared/ui/extras/Icons';
import { useLocation } from 'react-router-dom';
import { useBreakpoint } from '../../../hooks/useBreakpoint';


export const Profile = ({ musicianProfile, user }) => {
    const {isMdUp} = useBreakpoint();
    const location = useLocation();
    const state = location.state;
    const [showPreview, setShowPreview] = useState(state?.preview === false ? false : true);
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
                {musicianProfile?.picture ? (
                    <img src={musicianProfile?.picture} alt={musicianProfile.name} className='background-image' />
                ) : (
                    <div className="background-image empty">
                        <NoImageIcon />
                        <h4>No Artist Image</h4>
                    </div>
                )}
                <div className="primary-information">
                    {musicianProfile?.verified && isMdUp && (
                        <div className="verified-tag">
                            <VerifiedIcon />
                            <h4>Verified Artist</h4>
                        </div>
                    )}
                    <h1 className="venue-name">
                        {musicianProfile?.name}
                        <span className='orange-dot'>.</span>
                    </h1>
                    {isMdUp && (
                        <>
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
                                ) : !showPreview && (
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
                        </>
                    )}
                </div>
            </div>
            {!showPreview ? (
                <div className="body profile">
                    {!isMdUp && (
                        <div className='top-section'>
                            <div className="action-buttons">
                                <button className="btn secondary" onClick={() => setShowPreview(!showPreview)}>
                                    {showPreview ? (
                                        'Edit Profile'
                                    ) : (
                                        'View Profile'
                                    )}
                                </button>

                                {/* COLLAPSED HEADER (shown when NOT expanded) */}
                                {isPrimaryOpen && !showPreview ? (
                                    <button
                                        className="btn secondary"
                                        onClick={() => toggleSection('primary-information')}
                                        aria-expanded={false}
                                        aria-controls="primary-information-panel"
                                    >
                                        Hide Name and Profile Picture
                                    </button>
                                ) : !showPreview && (
                                        <button
                                        className="btn secondary"
                                        onClick={() => toggleSection('primary-information')}
                                        aria-expanded={false}
                                        aria-controls="primary-information-panel"
                                    >
                                        Edit Name and Profile Picture
                                    </button>
                                )}
                            </div>
                        </div>
                    )}
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
                    {!isMdUp && (
                        <div className='top-section'>
                            {musicianProfile?.verified && (
                                <div className="verified-tag">
                                    <VerifiedIcon />
                                    <h4>Verified Artist</h4>
                                </div>
                            )}
                            <div className="action-buttons">
                                <button className="btn secondary" onClick={() => setShowPreview(!showPreview)}>
                                    {showPreview ? (
                                        'Edit Musician Profile'
                                    ) : (
                                        'View Musician Profile'
                                    )}
                                </button>
                            </div>
                        </div>
                    )}
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