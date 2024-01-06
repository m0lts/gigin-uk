import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { queryDatabase } from '/utils/queryDatabase'
import { GetInfoFromLocalStorage } from '/utils/updateLocalStorage'
import { LoadingDots } from '/components/Loading/LoadingEffects'
import { MenuIcon, BookmarkIcon } from '/components/Icons/Icons'
import './header.buttons.styles.css'

// Desktop header My Gigin button
export const MyGiginButton = ({ setButtonClicked, buttonStatus, userName }) => {

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
            {userName ? (
                <span className='text'>{userName}</span>
            ) : (
                <span className='text'>My Gigin</span>
            )}
            <MenuIcon />
        </button>
    )
}

// Mobile header buttons
export const MobileHeaderSavedButton = () => {
    return (
        <button className='btn header-saved-button-mobile'>
            <BookmarkIcon />
            <span>Saved</span>
        </button>
    )
}
export const MobileHeaderMyGiginButton = ({ setButtonClicked, buttonStatus, userName }) => {
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
            className={`btn my-gigin-button-mobile ${buttonStatus ? 'active' : ''}`}
            onClick={handleShowMenu}
        >
            <MenuIcon />
            {userName ? (
                <span className='text'>{userName}</span>
            ) : (
                <span className='text'>My Gigin</span>
            )}
        </button>
    )
}

// Profile creator save and exit button
export const SaveAndExitButton = ({ userProfile }) => {
    
    const [isLoading, setIsLoading] = useState(false);
    const userInfo = GetInfoFromLocalStorage();
    const userID = userInfo.userID;

    const navigate = useNavigate();

    const handleSaveAndExit = async (event) => {
        event.preventDefault();
        setIsLoading(true);
        const dataPayload = {
            userID,
            userProfile,
        }
        try {
            const response = await queryDatabase('/api/Profile/SaveProfileEntry.js', dataPayload); 
            const responseData = await response.json();
            if (response.ok) {
                setIsLoading(false);
                AddProfileCreatedToLocalStorage(true);
                AddProfileDataToLocalStorage(responseData.updatedProfileDocument.profiles)
                navigate('/control-centre');
            } else {
                setIsLoading(false);
                console.log('error');
            }
        } catch (error) {
            console.error('Error:', error);
        }
    }

    return (
        <button 
            className={`btn save-and-exit-button ${isLoading && 'loading'}`} 
            onClick={handleSaveAndExit}
        >
            {isLoading ? (
                <LoadingDots />
            ) : (
                <p>Save and Exit</p>
            )}
        </button>
    )
}
