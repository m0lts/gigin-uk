import { Link } from 'react-router-dom'
import { Notifications } from '../../../../components/Global/ControlCentre/Notifications/Notifications'
import { ProfileIcon } from '../../../../components/Global/Icons/Icons'
import '../control-centre.styles.css'

export const ControlCentre = () => {
    return (
        <>
            <Notifications />
            <div className='selections'>
                <Link to={'/profile-creator'} className='link selections-card'>
                    <ProfileIcon />
                    <h5 className='title'>Profile Creator</h5>
                    <p className='info'>Whether you're a musician, host or gig-goer, you can create your profile here.</p>
                </Link>
            </div>
        </>
    )
}