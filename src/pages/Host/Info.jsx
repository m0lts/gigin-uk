import { useState } from "react";
import { Link, useNavigate } from "react-router-dom"

export const HostInfo = ({ user, setAuthModal }) => {

    const [isUserLoggedIn, setIsUserLoggedIn] = useState();
    const navigate = useNavigate();

    const checkUserAuth = () => {
        if (!user) {
            setAuthModal(true);
        }
    }

    return (
        <div>
            <h1>This is the Host info page</h1>
            <button onClick={checkUserAuth}>
                Let's get started
            </button>
        </div>
    )
}