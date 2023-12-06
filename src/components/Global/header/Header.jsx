import { useState } from 'react'
import { GiginLogo } from '../Logo/GiginLogo'
import { DynamicTextBox } from './DynamicTextBox/DynamicTextBox'
import { MyGiginButton } from '../Buttons/Buttons'
import { DefaultMenu, LoggedInMenu } from './Menus/Menus'
import './header.styles.css'

export const Header = () => {

    // MyGiginButton Clicked - Toggle show DefaultMenu
    const [myGiginButtonClicked, setMyGiginButtonClicked] = useState(false);

    // User logged in - fill with session storage when possible
    const userName = '';

    return (
        <header className='header'>
            <GiginLogo />
            <DynamicTextBox />
            <MyGiginButton
                setButtonClicked={setMyGiginButtonClicked}
                buttonStatus={myGiginButtonClicked}
                userName={userName}
            />
            {userName ? (
                <LoggedInMenu 
                    buttonStatus={myGiginButtonClicked}
                />
            ) : (
                <DefaultMenu 
                    buttonStatus={myGiginButtonClicked}
                />
            )}
        </header>
    )
}