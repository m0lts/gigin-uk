import { Link } from "react-router-dom"
import { Notifications } from "../../../components/Global/ControlCentre/Notifications/Notifications"
import { ProfileCreator } from "../../../components/Global/ControlCentre/Selections/ProfileCreator.jsx/ProfileCreator"
import './control-centre.styles.css'
// import { ProfileIcon } from "../../../components/Global/Icons/Icons"

export const ControlCentre = () => {
    return (
        <section className='control-centre'>
            <div className='header'>
                <h1>Control Centre</h1>
            </div>
            <div className='body'>
                <Notifications />
                <div className='selections'>
                    <Link to={''} className='link selections-card'>
                        {/* <ProfileIcon /> */}
                        <h5 className='title'>Profile Creator</h5>
                        <p className='info'>Whether you're a musician, host or gig-goer, you can create your profile here.</p>
                    </Link>
                </div>
            </div>
        </section>
    )
}