import { useState } from 'react';
import '@styles/musician/musician-profile.styles.css'
import { ProfilePreview } from './profile-preview/ProfilePreview';
import { ProfileForm } from './profile-form/ProfileForm';


export const Profile = ({ musicianProfile, user }) => {
    const [showPreview, setShowPreview] = useState(false);

    return (
        <>
            <div className="head">
                <div className="profile-primary-info">
                    <img src={musicianProfile.picture} alt={musicianProfile.name} />
                    <h1 className='title'>{musicianProfile.name}</h1>
                </div>
                <button className="btn tertiary" onClick={() => setShowPreview(!showPreview)}>
                    {!showPreview ? (
                        'Preview Profile'
                    ) : (
                        'Edit Profile'
                    )}
                </button>
            </div>
            {!showPreview ? (
                <div className="body profile">
                    <ProfileForm
                        user={user}
                        musicianProfile={musicianProfile}
                    />
                </div>
            ) : (
                <div className="body profile">
                    <ProfilePreview
                        musicianProfile={musicianProfile}
                    />
                </div>
            )}
        </>
    );
};