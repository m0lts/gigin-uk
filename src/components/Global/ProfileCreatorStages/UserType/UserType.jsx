import { useEffect } from "react"
import { GigGoerIcon, HostIcon, MusicianIcon } from "../../Icons/Icons"
import './user-type.styles.css'

export const UserTypeSelection = ({ profileType, setProfileType }) => {

    const handleProfileTypeClick = (selectedProfile) => {
        if (profileType === selectedProfile) {
            setProfileType(undefined);
        } else {
            setProfileType(selectedProfile);
        }
    }

    return (
        <div className='user-type profile-creator-stage'>
            <h1 className='title'>What type of profile do you want to create?</h1>
            <div className="options">
                <div 
                    className={`card ${profileType === 'Musician' && 'active'}`}
                    onClick={() => handleProfileTypeClick('Musician')}
                >
                    <MusicianIcon />
                    <h2 className="text">Musician</h2>
                </div>
                <div 
                    className={`card ${profileType === 'Host' && 'active'}`}
                    onClick={() => handleProfileTypeClick('Host')}
                >
                    <HostIcon />
                    <h2 className="text">Host</h2>
                </div>
                <div 
                    className={`card ${profileType === 'Gig-Goer' && 'active'}`}
                    onClick={() => handleProfileTypeClick('Gig-Goer')}
                >
                    <GigGoerIcon />
                    <h2 className="text">Gig-Goer</h2>
                </div>
            </div>
        </div>
    )
}