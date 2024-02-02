// Dependencies
    import { useState, useEffect, useRef } from 'react'
    import { Link, useNavigate } from 'react-router-dom'

// Utils
    import { queryDatabase } from '/utils/queryDatabase'
    import { GetInfoFromLocalStorage, AddProfileCreatedToLocalStorage, AddProfileDataToLocalStorage } from '/utils/updateLocalStorage'

// Icons and effects
    import { LoadingDots } from '/components/Loading/LoadingEffects'
    import { MenuIcon, BookmarkIcon, ExitIcon, HostIcon } from '/components/Icons/Icons'

// Styles
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
export const MobileHeaderSaveAndExitButton = ({ userProfile }) => {

    const [isLoading, setIsLoading] = useState(false);
    const userInfo = GetInfoFromLocalStorage();
    const userID = userInfo.userID;

    const navigate = useNavigate();

    const handleSaveAndExit = async (event) => {
        event.preventDefault();
        setIsLoading(true);


        if (userProfile.profileImages) {
            if (Array.isArray(userProfile.profileImages)) {
                // If profileImages is an array, process each image
                const userImages = userProfile.profileImages;
                const updatedProfileImages = [];
    
                await Promise.all(userImages.map(async (image) => {
                    if (typeof image === 'string') {
                        // If the item is already a URL, no need to reprocess
                        updatedProfileImages.push(image);
                    } else {
                        // Convert raw image to S3 URL
                        const s3Url = await handleMediaUpload(image);
                        updatedProfileImages.push(s3Url);
                    }
                }));
                userProfile.profileImages = updatedProfileImages;
            } else if (typeof userProfile.profileImages === 'object') {
                // If profileImages is an object, process profileImage and coverImage
                const userProfileImage = userProfile.profileImages.profileImage;
                const userCoverImage = userProfile.profileImages.coverImage;
    
                if (userProfileImage && typeof userProfileImage === 'string') {
                    // If profileImage is already a URL, no need to reprocess
                    userProfile.profileImages.profileImage = userProfileImage;
                } else if (userProfileImage) {
                    // Convert raw profileImage to S3 URL
                    const updatedProfileImage = await handleMediaUpload(userProfileImage);
                    userProfile.profileImages.profileImage = updatedProfileImage;
                }
    
                if (userCoverImage && typeof userCoverImage === 'string') {
                    // If coverImage is already a URL, no need to reprocess
                    userProfile.profileImages.coverImage = userCoverImage;
                } else if (userCoverImage) {
                    // Convert raw coverImage to S3 URL
                    const updatedCoverImage = await handleMediaUpload(userCoverImage);
                    userProfile.profileImages.coverImage = updatedCoverImage;
                }
            }
        }

        const dataPayload = {
            userID,
            userProfile,
        }
        if (userProfile.profileType) {
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
        } else {
            setIsLoading(false);
            navigate('/control-centre');
        }
    }

    return (
        <button 
            className={`btn header-save-and-exit-button-mobile ${isLoading && 'loading'}`} 
            onClick={handleSaveAndExit}
        >
            {isLoading ? (
                <LoadingDots />
            ) : (
                <>
                    <ExitIcon />
                    <span>Save and Exit</span>
                </>
            )}
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
        if (userProfile.profileType) {
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
        } else {
            setIsLoading(false);
            navigate('/control-centre');
        }
    }

    return (
        <button 
            className={`btn white-button ${isLoading && 'loading'}`} 
            onClick={handleSaveAndExit}
        >
            {isLoading ? (
                <LoadingDots />
            ) : (
                <>Save and Exit</>
            )}
        </button>
    )
}

// Host live music button
export const HostLiveMusicButton = () => {
    return (
        <button className='btn text-only-button'>
            <Link to={'/host'} className='link'>
                Host live music with Gigin
            </Link>
        </button>
    )
}

// Host create account button
export const HostCreateAccountButton = () => {

    const handleSaveUrl = () => {
        localStorage.setItem('redirectUrl', '/host');
    }

    // User logged in - fill with local storage when possible
    const localStorageInfo = GetInfoFromLocalStorage();

    return (
        <button className='btn host-with-gigin-button background-gradient'>
            <Link to={`${localStorageInfo.userFirstName ? ('/host/venue-creator') : ('/login')}`} className='link' onClick={handleSaveUrl}>
                <HostIcon />
                Start Hosting
            </Link>
        </button>
    )
}

// Host login button
export const HostLoginButton = () => {
    return (
        <button className='btn text-only-button'>
            <Link to={'/login'} className='link'>
                Log In
            </Link>
        </button>
    )
}
