import { useEffect } from "react";
import { useNavigate } from "react-router-dom"
import { Header } from "../../components/venue-components/Header";

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
            <Header
                user={user}
                setAuthModal={setAuthModal}
                setAuthType={setAuthType}
            />
            <h1>This is the Venue info page</h1>
            <button onClick={checkUserAuth}>
                Let's get started
            </button>
        </div>
    )
}