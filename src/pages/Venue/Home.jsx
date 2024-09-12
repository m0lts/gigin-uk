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
            sessionStorage.setItem('redirect', '/venues/add-venue');
        } else {
            navigate('/venues/add-venue');
        }
    }

    useEffect(() => {
        const redirect = sessionStorage.getItem('redirect');
        if (redirect) {
            navigate(redirect);
            sessionStorage.removeItem('redirect');
        }
    }, [user])

    return (
        <div>
            <VenuesHeader
                setAuthModal={setAuthModal}
                setAuthType={setAuthType}
                user={user}
            />
            <h1>This is the Venue info page</h1>
            <button onClick={checkUserAuth}>
                Let's get started
            </button>
        </div>
    )
}