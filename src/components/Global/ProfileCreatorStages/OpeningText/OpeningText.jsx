import { useEffect } from 'react'
import { ProfileIcon } from '../../Icons/Icons'
import './opening-text.styles.css'

export const OpeningText = ({ setNextButtonAvailable }) => {
    
    useEffect(() => {
        setNextButtonAvailable(true);
    }, [])

    return (
        <div className='opening-text profile-creator-stage'>
            <ProfileIcon />
            <h1 className='title'>Welcome to your profile creator</h1>
            <p className='text'>Whether you are a musician, host or gig-goer (or all of these!) you create your profiles here. 
                <br />
                <br />
                Musicians and gig-goers can only create one profile per account, however hosts can create as many profiles as they like, each one representing a venue that will host gigs.
                <br />
                <br />
                Don't worry if you are a musician that also wants to be a gig-goer, a host that is also wants to be a musician or any mix you like. You can create a profile for each type of user you want to be.
                <br />
                <br />
                Just follow the steps to create your profile and observe your progress in the dynamic bar at the top of your page. You can save your selections and exit, but be aware that musicians and hosts will not be able to apply to, or build, gigs until they have created a profile.
            </p>
        </div>
    )
}