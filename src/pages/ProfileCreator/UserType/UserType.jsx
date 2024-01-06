import { useEffect, useState } from "react"
import { GigGoerIcon, HostIcon, MusicianIcon } from "/components/Icons/Icons"

export const UserTypeSelection = ({ profileType, setProfileType, existingUserProfiles, setNextButtonAvailable }) => {

    const [isMusicianInactive, setIsMusicianInactive] = useState(false);
    const [isGigGoerInactive, setIsGigGoerInactive] = useState(false);

    const handleProfileTypeClick = (selectedProfile) => {
        if (profileType === selectedProfile) {
            setProfileType(undefined);
        } else {
            setProfileType(selectedProfile);
        }
    }


    useEffect(() => {
        if (existingUserProfiles) {
            const musicianInactive = existingUserProfiles.some(
                (profile) => profile.profileType === 'Musician'
            )
            const gigGoerInactive = existingUserProfiles.some(
            (profile) => profile.profileType === 'Gig-goer'
            );
            if (musicianInactive) {
                setIsMusicianInactive(true);
            }
            if (gigGoerInactive) {
                setIsGigGoerInactive(true);
            }
        }
    }, [existingUserProfiles])

    useEffect(() => {
        if (profileType) {
            setNextButtonAvailable(true);
        } else {
            setNextButtonAvailable(false);
        }
    }, [profileType]);


    return (
        <div className='user-type profile-creator-stage'>
            <h1 className='title'>What type of profile do you want to create?</h1>
            <div className="options">
                <div 
                    className={`card ${profileType === 'Musician' ? 'active' : ''} ${isMusicianInactive ? 'inactive' : ''}`}
                    onClick={isMusicianInactive ? null : () => handleProfileTypeClick('Musician')}
                >
                    <MusicianIcon />
                    <h2 className="text">Musician</h2>
                </div>
                <div 
                    className={`card ${profileType === 'Host' ? 'active' : ''}`}
                    onClick={() => handleProfileTypeClick('Host')}
                >
                    <HostIcon />
                    <h2 className="text">Host</h2>
                </div>
                <div 
                    className={`card ${profileType === 'Gig-Goer' ? 'active' : ''} ${isGigGoerInactive ? 'inactive' : ''}`}
                    onClick={isGigGoerInactive ? null : () => handleProfileTypeClick('Gig-Goer')}
                >
                    <GigGoerIcon />
                    <h2 className="text">Gig-Goer</h2>
                </div>
            </div>
        </div>
    )
}