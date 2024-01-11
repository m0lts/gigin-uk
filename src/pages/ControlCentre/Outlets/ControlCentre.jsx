import { Link } from 'react-router-dom'
import { GigGoerIcon, HostIcon, MusicianIcon, ProfileIcon } from '/components/Icons/Icons'
import { GetProfileDataFromLocalStorage } from '/utils/updateLocalStorage'
import '../control-centre.styles.css'
import { CeilingLightIcon } from '../../../components/Icons/Icons'

export const ControlCentre = () => {

    const existingUserProfiles = GetProfileDataFromLocalStorage();

    return (
        <>
            <div className='selections'>
                <Link to={'/gig-builder'} className='link selections-card'>
                    <CeilingLightIcon />
                    <h5 className='title'>Gig Builder</h5>
                    <p className='info'>Let's get you on the map! Build a gig here.</p>
                </Link>
                <Link to={'/profile-creator'} className='link selections-card'>
                    <ProfileIcon />
                    <h5 className='title'>Profile Creator</h5>
                    <p className='info'>Whether you're a musician, host or gig-goer, you can create your profile here.</p>
                </Link>
                {existingUserProfiles && (
                    existingUserProfiles.map((profile, index) => (
                        <Link to={'/profile-creator'} state={profile} key={index} className='link selections-card'>
                            {profile.profileType === 'Host' ? (
                                <>
                                    <HostIcon />
                                    <h5 className='title'>{profile.establishmentName} Profile</h5>
                                    <p className='info'>Edit your profile here.</p>
                                </>
                            ) : profile.profileType === 'Musician' ? (
                                <>
                                    <MusicianIcon />
                                    <h5 className='title'>Musician Profile</h5>
                                    <p className='info'>Edit your profile here.</p>
                                </>
                            ) : profile.profileType === 'Gig-goer' && (
                                <>
                                    <GigGoerIcon />
                                    <h5 className='title'>Gig-goer Profile</h5>
                                    <p className='info'>Edit your profile here.</p>
                                </>
                            )}
                        </Link>
                    ))
                )}
            </div>
        </>
    )
}