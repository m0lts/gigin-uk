import { NavLink } from 'react-router-dom'
import './menus.styles.css'

export const DefaultMenu = ({ buttonStatus }) => {
    if (buttonStatus) {
        return (
            <nav className='default-menu'>
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