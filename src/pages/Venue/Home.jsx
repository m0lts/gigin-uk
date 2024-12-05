import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom"
import { Header as MusicianHeader } from "../../components/musician-components/Header"
import { Header as VenuesHeader } from "../../components/venue-components/Header"
import { Header as CommonHeader } from "../../components/common/Header";
import VenueImg from "../../assets/images/venue-welcome.jpg";
import '/styles/host/info.styles.css'

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
        <div className="venue-welcome-page">
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
            <div className="body">
                <div className="grid-cont">
                    <div className="title-and-text">
                        <h1>Welcome, Venues.</h1>
                        <h4>Are you a venue owner or manager? Create a profile to start booking musicians for your events!</h4>
                        <p>We want to make booking gigs simpler for you, reducing the legwork and effort required to find the perfect live musician. All you have to do is build a venue, post a gig and musicians will apply, just leaving you with accepting who you like the look of.</p>
                    </div>
                    <div className="img-and-button">
                        <figure className="img-cont">
                            <img src={VenueImg} alt="Venue Welcome Page Image" />
                        </figure>
                        <button onClick={checkUserAuth} className="btn primary">
                            Let's get started
                        </button>
                    </div>
                </div>
            </div>
            {showErrorModal && (
                <div className="modal">
                    <div className="modal-content">
                        <h3>Oops!</h3>
                        <p>You are already signed up as a musician. We don't allow two profiles for the time being, check back soon!</p>
                        <button className="btn primary" onClick={() => {setShowErrorModal(false)}}>Got it!</button>
                        <button className='btn close tertiary' onClick={() => setShowErrorModal(false)}>Close</button>
                    </div>
                </div>
            )}
        </div>
    )
}