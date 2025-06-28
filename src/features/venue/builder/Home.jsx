import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom'
import { Header as VenuesHeader } from '@features/venue/components/Header'
import { Header as CommonHeader } from '@features/shared/components/Header';
import VenueImg from '@assets/images/venue-welcome.png';
import '@styles/host/info.styles.css'

export const VenueHome = ({ user, setAuthModal, setAuthType }) => {

    const navigate = useNavigate();
    const [showErrorModal, setShowErrorModal] = useState(false);

    const checkUserAuth = () => {
        if (!user) {
            setAuthModal(true);
            setAuthType('signup');
            sessionStorage.setItem('redirect', '/venues/add-venue');
        } else {
            if (user.musicianProfile) {
                setShowErrorModal(true);
            } else {
                navigate('/venues/add-venue');
            }
        }
    }

    return (
        <div className='venue-welcome-page'>
            {user && !user.musicianProfile && !user.venueProfiles ? (
                <CommonHeader
                    setAuthModal={setAuthModal}
                    setAuthType={setAuthType}
                    user={user}
                />
            ) : (
                <VenuesHeader
                    setAuthModal={setAuthModal}
                    setAuthType={setAuthType}
                    user={user}
                />
            )}
            <div className='body'>
                <div className='grid-cont'>
                    <div className='title-and-text'>
                        <h1 style={{ fontSize: '3rem' }}>Welcome, Venues.</h1>
                        <h4 style={{ fontSize: '1.25rem' }}>Gigin makes gig-booking simpler. We reduce the legwork, so you can focus on creating unforgettable experiences for your guests.</h4>
                        <h4 style={{ fontSize: '1.25rem' }}>Simply create a venue profile, post a gig, and either let musicians apply or go and find who you are looking for on our comprehensive musician profiles. Partnered with Stripe®️, save a bank card and pay securely in one click. Simple!</h4>
                    </div>
                    <div className='img-and-button'>
                        <figure className='img-cont'>
                            <img src={VenueImg} alt='Venue Welcome Page Image' />
                        </figure>
                        <button onClick={checkUserAuth} className='btn primary'>
                            Let's get started
                        </button>
                    </div>
                </div>
            </div>
            {showErrorModal && (
                <div className='modal'>
                    <div className='modal-content'>
                        <h3>Oops!</h3>
                        <p>You are already signed up as a musician. We don't allow two profiles for the time being, check back soon!</p>
                        <button className='btn primary' onClick={() => {setShowErrorModal(false)}}>Got it!</button>
                        <button className='btn close tertiary' onClick={() => setShowErrorModal(false)}>Close</button>
                    </div>
                </div>
            )}
        </div>
    )
}