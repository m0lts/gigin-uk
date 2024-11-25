import { useEffect } from "react";
import { useNavigate } from "react-router-dom"
import { Header as MusicianHeader } from "../../components/musician-components/Header"
import { Header as VenuesHeader } from "../../components/venue-components/Header"
import { Header as CommonHeader } from "../../components/common/Header";

export const VenueHome = ({ user, setAuthModal, setAuthType }) => {

    const navigate = useNavigate();

    const checkUserAuth = () => {
        if (!user) {
            setAuthModal(true);
            setAuthType('signup');
            sessionStorage.setItem('redirect', '/venues/add-venue');
        } else {
            navigate('/venues/add-venue');
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
        </div>
    )
}