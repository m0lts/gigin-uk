import { GiginLogo } from '../Logo/GiginLogo'
import { DynamicTextBox } from './DynamicTextBox/DynamicTextBox'
import { MyGiginButton } from '../Buttons/Buttons'
import './header.styles.css'
import { useState } from 'react'
import { DefaultMenu } from './Menus/Menus'

export const Header = () => {

    // MyGiginButton Clicked - Toggle show DefaultMenu
    const [myGiginButtonClicked, setMyGiginButtonClicked] = useState(false);

    return (
        <header className='header'>
            <GiginLogo />
            <DynamicTextBox />
            <MyGiginButton
                setButtonClicked={setMyGiginButtonClicked}
                buttonStatus={myGiginButtonClicked}
            />
            <DefaultMenu 
                buttonStatus={myGiginButtonClicked}
            />
        </header>
    )
}