import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom"
import { Header as MusicianHeader } from "../../components/musician-components/Header"
import { Header as VenuesHeader } from "../../components/venue-components/Header"
import { Header as CommonHeader } from "../../components/common/Header";

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
        <div>
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
            <h1>This is the Venue info page</h1>
            <button onClick={checkUserAuth}>
                Let's get started
            </button>
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