import { useEffect } from "react";
import { Link, useNavigate } from "react-router-dom"

export const HostInfo = ({ user, setAuthModal }) => {

    const navigate = useNavigate();

    const checkUserAuth = () => {
        if (!user) {
            setAuthModal(true);
            sessionStorage.setItem('redirect', '/host/venue-builder');
        } else {
            navigate('/host/venue-builder');
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
            <h1>This is the Host info page</h1>
            <button onClick={checkUserAuth}>
                Let's get started
            </button>
        </div>
    )
}