import { useState, useEffect } from 'react'
import { useParams } from 'react-router-dom'
import { GiginLogo } from '../Logo/GiginLogo'
import { DynamicTextBox } from './DynamicTextBox/DynamicTextBox'
import { MobileHeaderMyGiginButton, MobileHeaderSavedButton, MyGiginButton, SaveAndExitButton } from '../Buttons/Buttons'
import { DefaultMenu, LoggedInMenu, DefaultMenuMobile, LoggedInMenuMobile } from './Menus/Menus'
import { GetInfoFromLocalStorage } from '../../../utils/updateLocalStorage'
import './header.styles.css'

export const Header = ({ userProfile, stageNumber }) => {

    // MyGiginButton Clicked - Toggle show DefaultMenu
    const [myGiginButtonClicked, setMyGiginButtonClicked] = useState(false);
    // User at profile creator page
    const [profileCreatorPage, setProfileCreatorPage] = useState(false);
    const { page } = useParams();

    useEffect(() => {
        // Get the current URL path
        const currentPath = window.location.pathname;

        // Check if the user is at /profile-creator
        if (currentPath === '/profile-creator') {
            setProfileCreatorPage(true);
        } else {
            setProfileCreatorPage(false);
        }
    }, []);

    // User logged in - fill with local storage when possible
    const localStorageInfo = GetInfoFromLocalStorage();

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
                            profileCreated={localStorageInfo.profileCreated}
                        />
                    ) : (
                        <DefaultMenuMobile 
                            buttonStatus={myGiginButtonClicked}
                        />
                    )}
                </header>
            ) : (
                <header className='header'>
                    <GiginLogo />
                    <DynamicTextBox />
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
                                    profileCreated={localStorageInfo.profileCreated}
                                />
                            ) : (
                                <DefaultMenu 
                                    buttonStatus={myGiginButtonClicked}
                                />
                            )}
                        </>
                    )}
                </header>
            )}
        </>
    )
}