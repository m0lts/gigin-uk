// Dependencies
import { Link } from 'react-router-dom'

// Components
import { PrimaryLogo } from '/components/logos/PrimaryLogo'

// Styles and extras
import './headers.styles.css'
import { MenuIcon, UserIcon } from '../icons/Icons'
import { useState } from 'react'

export const PrimaryHeader = () => {

    const [showMenu, setShowMenu] = useState(false);

    const userLoggedIn = sessionStorage.getItem('user');
    const user = userLoggedIn ? JSON.parse(userLoggedIn) : null;

    return (
        <header className="header primary">
            <PrimaryLogo />
            <nav className="navigation">
                <ul className="nav-list">
                    <li className={`nav-item user ${showMenu && 'active'}`} onClick={() => setShowMenu(!showMenu)}>
                        <UserIcon />
                        <span>|</span>
                        Menu
                    </li>
                </ul>
            </nav>
            <nav className="menu" style={{ display: showMenu ? 'block' : 'none', top: showMenu ? '100%' : '0%'}}>
                <ul className="menu-list">
                    {userLoggedIn ? (
                        <>
                            <li className="menu-item">
                                {user.email}
                            </li>
                            {(user.email === 'moltontom6@gmail.com' || user.email === 'osearle@icloud.com' || user.email === 'gardner.t.b@gmail.com') && (
                                <li className="menu-item">
                                    <Link to={'/control-centre'} className='link'>
                                        Control centre
                                    </Link>
                                </li>
                            )}
                        </>
                    ) : (
                        <li className="menu-item">
                            <Link to={'/accounts'} className='link'>
                                Login or Signup
                            </Link>
                        </li>
                    )}
                    <hr />
                    <li className="menu-item">
                        <Link to={'/'} className='link'>
                            Home
                        </Link>
                    </li>
                    <li className="menu-item">
                        <Link to={'/'} className='link'>
                            About
                        </Link>
                    </li>
                    <li className="menu-item">
                        <Link to={'/'} className='link'>
                            Contact
                        </Link>
                    </li>
                    <li className="menu-item">
                        <Link to={'/'} className='link'>
                            Leave Feedback
                        </Link>
                    </li>
                    {userLoggedIn && (
                        <>
                            <hr />
                            <li className="menu-item link" style={{ color: 'red' }} onClick={() => {sessionStorage.clear(); window.location.reload()}}>
                                Logout
                            </li>
                        </>
                    )}
                </ul>
            </nav>
        </header>
    )
}