import { MapIcon, MenuIcon, ListIcon, BookmarkIcon, SearchIcon, XIcon } from "../Icons/Icons"
import { useRef, useEffect, useState } from "react"
import { queryDatabase } from "../../../utils/queryDatabase"
import './buttons.styles.css'

// *************************** //
// UNIVERSAL BUTTONS //
export const SearchButtonSmall = () => {
    return (
        <button className='btn search-button-small'>
            <SearchIcon />
        </button>
    )
}
export const SearchButtonBig = () => {
    return (
        <button className='btn search-button-big'>
            <span>Search</span>
            <SearchIcon />
        </button>
    )
}





// *************************** //
// HEADER BUTTONS //

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


// *************************** //
// HOMEPAGE BUTTONS //

// Map and list view type toggle
export const ChangeViewTypeButton = ({ showMap, setShowMap }) => {

    const handleViewChange = () => {
        if (showMap) {
            setShowMap(false);
        } else {
            setShowMap(true);
        }
    }

    return (
        <button 
            className='btn change-view-btn'
            onClick={handleViewChange}
        >
            {showMap ? (
                <>
                    <ListIcon />
                    <span>List View</span>
                </>
            ) : (
                <>
                    <MapIcon />
                    <span>Map View</span>
                </>
            )}
        </button>
    )
}


// *************************** //
// FILTER BUTTONS //

// Universal filter button
export const FilterButton = ({ filterName, showFilter, setShowFilter, filterFilled, setFilterFilled }) => {

    const handleShowFilter = () => {
        if (showFilter) {
            setShowFilter(false);
        } else {
            setShowFilter(true);
        }
    }

    return (
        <button 
            className={`btn filter-button ${showFilter && 'active'}`}
            onClick={handleShowFilter}
        >   
            {filterFilled ? (
                <span 
                    className='filter-button-with-cross'
                >
                        {filterName} 
                        <XIcon 
                            clearItem={setFilterFilled}
                        />
                </span>
            ) : (
                <>{filterName}</>
            )}
        </button>
    )
}

// *************************** //
// SAVE BUTTON //
export const SaveButton = ({ saveItem }) => {

    // See FilterBar save button for reference
    const handleSave = () => {
        saveItem(false);
    }

    return (
        <button 
            className='btn save-button'
            onClick={handleSave}
        >
            Save
        </button>
    )
}


// *************************** //
// FORM BUTTONS //

// Next button login
export const NextButtonLogin = ({ emailData, setEmailError, setShowPasswordSection }) => {

    const handleNext = (event) => {
        event.preventDefault();
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(emailData)) {
            setEmailError('* Please enter a valid email address. Example: johndoe@gmail.com');
        } else {
            setShowPasswordSection(true);
        }
    }

    return (
        <button 
            className='btn next-button'
            onClick={handleNext}
        >
            Next
        </button>
    )
}

// Next button forgot password
export const NextButtonForgotPassword = ({ emailData, setEmailError, setShowPasswordSection, dataPayload, apiRoute }) => {

    const handleNext = async (event) => {
        event.preventDefault();
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(emailData)) {
            setEmailError('* Please enter a valid email address. Example: johndoe@gmail.com');
        } else {
            try {
                const response = await queryDatabase(apiRoute, dataPayload);
                if (response.ok) {
                    setShowPasswordSection(true);
                }
            } catch (error) {
                console.error('Error:', error);
            }
        }
    }

    return (
        <button 
            className='btn next-button'
            onClick={handleNext}
        >
            Next
        </button>
    )
}

// Submit button
export const SubmitFormButton = ({ passwordError, verifyPasswordStatus, dataPayload, apiRoute, setResponse }) => {

    const handleSubmit = async (event) => {
        event.preventDefault();
        if (!passwordError || !verifyPasswordStatus) {
            try {
                const response = await queryDatabase(apiRoute, dataPayload);
                const responseData = await response.json();
                if (response.ok) {
                    setResponse({
                        data: responseData,
                        status: response.status
                    })
                } else {
                    setResponse({
                        status: response.status,
                        message: responseData.error
                    })
                }
            } catch (error) {
                console.error('Error:', error);
            }
        };
    }

    return (
        <button 
            className='btn submit-button'
            onClick={handleSubmit}
        >
            Submit
        </button>
    )
}
