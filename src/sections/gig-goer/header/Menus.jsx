import { NavLink } from 'react-router-dom'
import { useAuth0 } from '@auth0/auth0-react'
import './menus.styles.css'

export const DefaultMenu = ({ showMenu }) => {

    const { loginWithRedirect } = useAuth0();

    if (showMenu) {
        return (
            <nav className='header-menu'>
                <ul className='menu-list'>
                    <li className='menu-item'>
                        <p 
                            onClick={() => loginWithRedirect()}
                            className='link menu-link'
                        >
                            Log in or Sign up
                        </p>
                    </li>
                    <hr />
                    <li className='menu-item'>
                        <NavLink 
                            to={'/host/control-centre'} 
                            className='link menu-link'
                        >
                            Hosts
                        </NavLink>
                    </li>
                    <li className='menu-item'>
                        <NavLink 
                            to={'/gig-goers'} 
                            className='link menu-link'
                        >
                            Gig-goers
                        </NavLink>
                    </li>
                    <hr />
                    <li className='menu-item'>
                        <NavLink 
                            to={'/help'} 
                            className='link menu-link'
                        >
                            Help
                        </NavLink>
                    </li>
                    <li className='menu-item'>
                        <NavLink 
                            to={'/contact-us'} 
                            className='link menu-link'
                        >
                            Contact us
                        </NavLink>
                    </li>
                </ul>
            </nav>
        )
    } else {
        return null
    }
}

export const LoggedInMenu = ({ showMenu }) => {

    const { logout } = useAuth0();

    if (showMenu) {
        return (
            <nav className='header-menu'>
                <ul className='menu-list'>
                    {/* <li className='menu-item'>
                        <NavLink 
                            to={`${profileInfo ? '/control-centre' : 'profile-creator'}`} 
                            className='link menu-link'
                        >
                            {profileInfo ? 'Control Centre' : 'Create your profile'}
                        </NavLink>
                    </li> */}
                    <li className='menu-item'>
                        <NavLink 
                            to={'/control-centre'} 
                            className='link menu-link'
                        >
                            Control Centre
                        </NavLink>
                    </li>
                    <li className='menu-item'>
                        <NavLink 
                            to={'/'} 
                            className='link menu-link'
                        >
                            Account
                        </NavLink>
                    </li>
                    <hr />
                    <li className='menu-item'>
                        <NavLink 
                            to={'/help'} 
                            className='link menu-link'
                        >
                            Help
                        </NavLink>
                    </li>
                    <li className='menu-item'>
                        <NavLink 
                            to={'/contact-us'} 
                            className='link menu-link'
                        >
                            Contact us
                        </NavLink>
                    </li>
                    <hr />
                    <li className='menu-item'>
                        <p 
                            className='link menu-link'
                            onClick={() => logout({ logoutParams: { returnTo: window.location.origin } })}
                        >
                            Log out
                        </p>
                    </li>
                </ul>
            </nav>
        )
    } else {
        return null
    }
}

export const DefaultMenuMobile = ({ showMenu }) => {
    if (showMenu) {
        return (
            <nav className='header-menu-mobile'>
                <ul className='menu-list'>
                    <li className='menu-item'>
                        <NavLink 
                            to={'/login'} 
                            className='link menu-link'
                        >
                            Log in
                        </NavLink>
                    </li>
                    <li className='menu-item'>
                        <NavLink 
                            to={'/signup'} 
                            className='link menu-link'
                        >
                            Sign up
                        </NavLink>
                    </li>
                    <hr />
                    <li className='menu-item'>
                        <NavLink 
                            to={'/host-with-gigin'} 
                            className='link menu-link'
                        >
                            Hosts
                        </NavLink>
                    </li>
                    <li className='menu-item'>
                        <NavLink 
                            to={'/gig-goers'} 
                            className='link menu-link'
                        >
                            Gig-goers
                        </NavLink>
                    </li>
                    <hr />
                    <li className='menu-item'>
                        <NavLink 
                            to={'/help'} 
                            className='link menu-link'
                        >
                            Help
                        </NavLink>
                    </li>
                    <li className='menu-item'>
                        <NavLink 
                            to={'/contact-us'} 
                            className='link menu-link'
                        >
                            Contact us
                        </NavLink>
                    </li>
                    <hr />
                    <li className='menu-item'>
                        <NavLink 
                            to={'/'} 
                            className='link menu-link'
                        >
                            Home
                        </NavLink>
                    </li>
                </ul>
            </nav>
        )
    } else {
        return (
            <nav className="header-menu-mobile-hide"></nav>
        )
    }
}

export const LoggedInMenuMobile = ({ showMenu }) => {

    if (showMenu) {
        return (
            <nav className='header-menu-mobile logged-in'>
                <ul className='menu-list'>
                    <li className='menu-item'>
                        <NavLink 
                            to={'/'} 
                            className='link menu-link'
                        >
                            Home
                        </NavLink>
                    </li>
                    <hr />
                    <li className='menu-item'>
                        <NavLink 
                            to={'/'} 
                            className='link menu-link'
                        >
                            Account
                        </NavLink>
                    </li>
                    <hr />
                    <li className='menu-item'>
                        <NavLink 
                            to={'/help'} 
                            className='link menu-link'
                        >
                            Help
                        </NavLink>
                    </li>
                    <li className='menu-item'>
                        <NavLink 
                            to={'/contact-us'} 
                            className='link menu-link'
                        >
                            Contact us
                        </NavLink>
                    </li>
                    <hr />
                    <li className='menu-item'>
                        <NavLink 
                            to={'/'} 
                            className='link menu-link'
                            onClick={handleLogOut}
                        >
                            Log out
                        </NavLink>
                    </li>
                </ul>
            </nav>
        )
    } else {
        return null
    }
}