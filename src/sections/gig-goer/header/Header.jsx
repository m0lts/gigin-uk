import { GiginLogo } from '/components/logos/GiginLogo'
import { MenuButton } from '../buttons/MenuButton'
import { AddEventButton } from '../buttons/AddEventButton'
import { useState } from 'react'
import { DefaultMenu } from './Menus'

export const Header = ({ showModal, setShowModal }) => {

    // Menu button clicked - toggle show menu
    const [showMenu, setShowMenu] = useState(false);

    return (
        <div className="header shadow">
            <GiginLogo />
            <div className="buttons">
                <AddEventButton
                    showModal={showModal}
                    setShowModal={setShowModal}
                />
                <MenuButton
                    showMenu={showMenu}
                    setShowMenu={setShowMenu}
                />
            </div>
            <DefaultMenu 
                showMenu={showMenu}
            />
        </div>
    )
}