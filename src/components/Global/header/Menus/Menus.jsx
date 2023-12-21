import { NavLink, useNavigate } from 'react-router-dom'
import './menus.styles.css'
import { GetInfoFromLocalStorage, RemoveInfoFromLocalStorage } from '../../../../utils/updateLocalStorage'
import { useEffect, useState } from 'react'

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

export const LoggedInMenu = ({ buttonStatus, profileCreated }) => {

    const navigate = useNavigate();

    const handleLogOut = () => {
        RemoveInfoFromLocalStorage();
        navigate('/');
        window.location.reload();
    }

    if (buttonStatus) {
        return (
            <nav className='header-menu'>
                <ul className='menu-list'>
                    <li className='menu-item'>
                        <NavLink 
                            to={`${profileCreated ? '/control-centre' : 'profile-creator'}`} 
                            className='link menu-link'
                        >
                            {profileCreated ? 'Control Centre' : 'Create your profile'}
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

export const LoggedInMenuMobile = ({ buttonStatus, profileCreated }) => {

    const navigate = useNavigate();

    const handleLogOut = () => {
        RemoveInfoFromLocalStorage();
        navigate('/');
        window.location.reload();
    }

    if (buttonStatus) {
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
                            to={`${profileCreated ? '/control-centre' : 'profile-creator'}`} 
                            className='link menu-link'
                        >
                            {profileCreated ? 'Control Centre' : 'Create your profile'}
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