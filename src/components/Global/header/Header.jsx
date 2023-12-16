import { useState, useEffect } from 'react'
import { GiginLogo } from '../Logo/GiginLogo'
import { DynamicTextBox } from './DynamicTextBox/DynamicTextBox'
import { MobileHeaderMyGiginButton, MobileHeaderSavedButton, MyGiginButton } from '../Buttons/Buttons'
import { DefaultMenu, LoggedInMenu, DefaultMenuMobile, LoggedInMenuMobile } from './Menus/Menus'
import { GetInfoFromLocalStorage } from '../../../utils/updateLocalStorage'
import './header.styles.css'

export const Header = () => {

    // MyGiginButton Clicked - Toggle show DefaultMenu
    const [myGiginButtonClicked, setMyGiginButtonClicked] = useState(false);

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
                    <MyGiginButton
                        setButtonClicked={setMyGiginButtonClicked}
                        buttonStatus={myGiginButtonClicked}
                        userName={localStorageInfo.userFirstName}
                    />
                    {localStorageInfo.userFirstName ? (
                        <LoggedInMenu 
                            buttonStatus={myGiginButtonClicked}
                        />
                    ) : (
                        <DefaultMenu 
                            buttonStatus={myGiginButtonClicked}
                        />
                    )}
                </header>
            )}
        </>
    )
}