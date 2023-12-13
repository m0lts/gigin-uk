import { NavLink, useNavigate } from 'react-router-dom'
import './menus.styles.css'
import { RemoveInfoFromSessionStorage } from '../../../../utils/updateSessionStorage'

export const DefaultMenu = ({ buttonStatus }) => {
    if (buttonStatus) {
        return (
            <nav className='header-menu'>
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
                </ul>
            </nav>
        )
    } else {
        return null
    }
}

export const LoggedInMenu = ({ buttonStatus }) => {

    const navigate = useNavigate();

    const handleLogOut = () => {
        RemoveInfoFromSessionStorage();
        navigate('/');
    }

    if (buttonStatus) {
        return (
            <nav className='header-menu'>
                <ul className='menu-list'>
                    <li className='menu-item'>
                        <NavLink 
                            to={'/'} 
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

export const DefaultMenuMobile = ({ buttonStatus }) => {
    if (buttonStatus) {
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
                </ul>
            </nav>
        )
    } else {
        return (
            <nav className="header-menu-mobile-hide"></nav>
        )
    }
}

export const LoggedInMenuMobile = ({ buttonStatus }) => {

    const handleLogOut = () => {
        RemoveInfoFromSessionStorage();
        navigate('/');
    }

    if (buttonStatus) {
        return (
            <nav className='header-menu-mobile'>
                <ul className='menu-list'>
                    <li className='menu-item'>
                        <NavLink 
                            to={'/'} 
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