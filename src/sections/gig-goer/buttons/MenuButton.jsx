import { useRef, useEffect } from "react"
import { MenuIcon } from "/components/Icons/Icons"
import { useAuth0 } from '@auth0/auth0-react'

export const MenuButton = ({ showMenu, setShowMenu }) => {

    const { user, isAuthenticated } = useAuth0();

    // Show menu when showMenu is truthy and vice versa.
    const handleShowMenu = () => {
        setShowMenu(!showMenu);
    }

    // Hide menu if user clicks anywhere on screen when menu is open
    const buttonRef = useRef(null);
    useEffect(() => {
        const handleClickOutside = (event) => {
            if (buttonRef.current && !buttonRef.current.contains(event.target)) {
                setShowMenu(false);
            }
        };
        document.addEventListener('click', handleClickOutside);
        return () => {
            document.removeEventListener('click', handleClickOutside);
        };
    }, [setShowMenu]);

    return (
        <button
            ref={buttonRef}
            className={`btn secondary-btn ${showMenu ? 'active shadow' : ''}`}
            onClick={handleShowMenu}
        >
            <span>
                {user && isAuthenticated ? (
                    user.given_name
                ) : (
                    'Menu'
                )}
            </span>
            <MenuIcon />
        </button>
    )
}
