import { GiginLogo } from '/components/logos/GiginLogo'
import { MenuButton } from '../buttons/MenuButton'
import { AddEventButton } from '../buttons/AddEventButton'
import { useState } from 'react'
import { DefaultMenu, LoggedInMenu } from './Menus'
import { useAuth0 } from '@auth0/auth0-react'

export const Header = ({ showModal, setShowModal }) => {

    const { isAuthenticated, user } = useAuth0();

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
            {isAuthenticated && user ? (
                <LoggedInMenu 
                    showMenu={showMenu}
                    user={user}
                />
            ) : (
                <DefaultMenu 
                    showMenu={showMenu}
                />
            )}
        </div>
    )
}