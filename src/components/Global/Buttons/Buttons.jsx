import { MenuIcon } from "../Icons/Icons"
import { useRef, useEffect } from "react"
import './buttons.styles.css'

export const MyGiginButton = ({ setButtonClicked, buttonStatus}) => {

    // Show menu when buttonStatus is truthy and vice versa.
    const handleShowMenu = () => {
        setButtonClicked(!buttonStatus);
    }
    // Hide menu if user clicks anywhere on screen when menu is open
    const buttonRef = useRef(null);
    useEffect(() => {
        const handleClickOutside = (event) => {
            if (buttonRef.current && !buttonRef.current.contains(event.target)) {
                setButtonClicked(false);
            }
        };
        document.addEventListener('click', handleClickOutside);
        return () => {
            document.removeEventListener('click', handleClickOutside);
        };
    }, [setButtonClicked]);

    return (
        <button 
            ref={buttonRef}
            className={`btn my-gigin-button ${buttonStatus ? 'active' : ''}`}
            onClick={handleShowMenu}
        >
            <span className='text'>My Gigin</span>
            <MenuIcon />
        </button>
    )
}