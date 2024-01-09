import { useState, useEffect } from 'react'
import { useLocation } from 'react-router-dom'
import { GiginLogo } from '/components/Logo/GiginLogo'
import { DynamicBox } from '/components/Header/DynamicBox/DynamicBox.jsx'
import { MobileHeaderMyGiginButton, MobileHeaderSavedButton, MyGiginButton, SaveAndExitButton } from '/components/Header/Buttons/Header.buttons.jsx'
import { DefaultMenu, LoggedInMenu, DefaultMenuMobile, LoggedInMenuMobile } from '/components/Header/Menus/Menus.jsx'
import { GetInfoFromLocalStorage, GetProfileDataFromLocalStorage } from '/utils/updateLocalStorage'
import './header.styles.css'

export const Header = ({ userProfile, stageNumber }) => {

    // MyGiginButton Clicked - Toggle show DefaultMenu
    const [myGiginButtonClicked, setMyGiginButtonClicked] = useState(false);
    // User at profile creator page
    const [profileCreatorPage, setProfileCreatorPage] = useState(false);
    const location = useLocation();

    useEffect(() => {
        // Get the current URL path
        const currentPath = location.pathname;

        // Check if the user is at /profile-creator
        if (currentPath === '/profile-creator') {
            setProfileCreatorPage(true);
        } else {
            setProfileCreatorPage(false);
        }
    }, []);

    // User logged in - fill with local storage when possible
    const localStorageInfo = GetInfoFromLocalStorage();
    const profileInfo = GetProfileDataFromLocalStorage();

    // Mobile screen 
    const [isMobile, setIsMobile] = useState(window.innerWidth < 768)
    useEffect(() => {
        const handleResize = () => {
            setIsMobile(window.innerWidth < 768);
        };
        window.addEventListener('resize', handleResize);
        return () => {
            window.removeEventListener('resize', handleResize);
        };
    }, []);

    return (
        <>
            {isMobile ? (
                <header className='header-mobile'>
                    <MobileHeaderSavedButton />
                    <MobileHeaderMyGiginButton 
                        setButtonClicked={setMyGiginButtonClicked}
                        buttonStatus={myGiginButtonClicked}
                        userName={localStorageInfo.userFirstName}
                    />
                    {localStorageInfo.userFirstName ? (
                        <LoggedInMenuMobile 
                            buttonStatus={myGiginButtonClicked}
                            profileInfo={profileInfo}
                        />
                    ) : (
                        <DefaultMenuMobile 
                            buttonStatus={myGiginButtonClicked}
                        />
                    )}
                </header>
            ) : (
                <header className={`header ${profileCreatorPage && 'no-border'}`}>
                    <GiginLogo />
                    <DynamicBox
                        userProfile={userProfile}
                        stageNumber={stageNumber}
                    />
                    <div className='right'>
                    {!profileCreatorPage && <p>Host with Gigin</p>}
                    {profileCreatorPage && stageNumber > 1 ? (
                        <>
                            <SaveAndExitButton 
                                userProfile={userProfile}
                            />
                        </>
                    ) : (
                        <>
                            <MyGiginButton
                                setButtonClicked={setMyGiginButtonClicked}
                                buttonStatus={myGiginButtonClicked}
                                userName={localStorageInfo.userFirstName}
                            />
                            {localStorageInfo.userFirstName ? (
                                <LoggedInMenu 
                                    buttonStatus={myGiginButtonClicked}
                                    profileInfo={profileInfo}
                                />
                            ) : (
                                <DefaultMenu 
                                    buttonStatus={myGiginButtonClicked}
                                />
                            )}
                        </>
                    )}
                    </div>
                </header>
            )}
        </>
    )
}