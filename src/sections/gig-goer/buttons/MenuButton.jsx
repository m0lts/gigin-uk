import { useRef, useEffect } from "react"
import { MenuIcon } from "/components/Icons/Icons"

export const MenuButton = ({ showMenu, setShowMenu }) => {

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
            <span>Menu</span>
            <MenuIcon />
        </button>
    )
}
