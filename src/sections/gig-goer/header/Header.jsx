import { GiginLogo } from '/components/logos/GiginLogo'
import { MenuButton } from '../buttons/MenuButton'
import { AddEventButton } from '../buttons/AddEventButton'
import { useState } from 'react'
import { DefaultMenu, LoggedInMenu } from './Menus'
import { useAuth0 } from '@auth0/auth0-react'
import { UserIcon } from '../../../components/Icons/Icons'
import { Link } from 'react-router-dom'

export const Header = ({ showModal, setShowModal }) => {

    const { isAuthenticated, user } = useAuth0();

    // Menu button clicked - toggle show menu
    const [showMenu, setShowMenu] = useState(false);

    return (
        <div className="header shadow">
            <GiginLogo />
            <div className="buttons">
                <Link to='/control-centre' className='btn btn-text link'>
                    Control Centre
                </Link>
                {/* <MenuButton
                    showMenu={showMenu}
                    setShowMenu={setShowMenu}
                /> */}
                <button className={`btn btn-icon ${showMenu && 'active'}`} onClick={() => setShowMenu(!showMenu)}>
                    <UserIcon />
                </button>
            </div>
            <DefaultMenu 
                showMenu={showMenu}
                setShowMenu={setShowMenu}
            />
            {/* {isAuthenticated && user ? (
                <LoggedInMenu 
                    showMenu={showMenu}
                    user={user}
                />
            ) : (
                <DefaultMenu 
                    showMenu={showMenu}
                />
            )} */}
        </div>
    )
}