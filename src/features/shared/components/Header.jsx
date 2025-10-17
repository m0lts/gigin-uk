import { useNavigate, useLocation, Link } from 'react-router-dom';
import { VenueLogoLink, MusicianLogoLink, TextLogoLink } from '@features/shared/ui/logos/Logos';
import { GuitarsIcon, LogOutIcon, TelescopeIcon, UserIcon, VenueBuilderIcon } from '@features/shared/ui/extras/Icons';
import '@styles/shared/header.styles.css';
import { useAuth } from '@hooks/useAuth'
import { useState, useEffect } from 'react'
import { listenToUserConversations } from '@services/client-side/conversations';
import { ProfileCreator } from '../../musician/profile-creator/ProfileCreator';
import { ExitIcon, MapIcon } from '../ui/extras/Icons';
import { NoProfileModal } from '../../musician/components/NoProfileModal';

export const Header = ({ setAuthModal, setAuthType, user, noProfileModal, setNoProfileModal, noProfileModalClosable = false, setNoProfileModalClosable }) => {
    
    const { logout } = useAuth();
    const navigate = useNavigate();
    const location = useLocation();

    const showAuthModal = (type) => {
        setAuthModal(true);
        setAuthType(type);
    }

    const handleLogout = async () => {
        try {
            await logout();
        } catch (err) {
            console.error(err);
        }
    }

    const getLocation = () => {
        if (location.pathname.includes('host')) {
            return <VenueLogoLink />;
        } else if (location.pathname.includes('musician')) {
            return <MusicianLogoLink />;
        } else {
            return <TextLogoLink />;
        }
    }

    const headerStyle = {
        padding: location.pathname.includes('dashboard') ? '0 1rem' : '0 2.5%',
    };
    return (
        <header className='header default' style={headerStyle}>
            {user ? (
                <>
                    <div className='left'>
                        { getLocation() }
                    </div>
                    <div className='right'>
                        <div className='buttons'>
                            <Link className='link' to={'/find-a-gig'}>
                                <button className={`btn secondary ${location.pathname === '/find-a-gig' ? 'disabled' : ''}`}>
                                    <MapIcon />
                                    Find a Gig
                                </button>
                            </Link>
                            <button className={`btn secondary ${noProfileModal ? 'disabled' : ''}`}  onClick={() => {setNoProfileModal(true); setNoProfileModalClosable(!noProfileModalClosable)}}>
                                <GuitarsIcon />
                                Create a Musician Profile
                            </button>
                            <Link className='link' to={'/venues/add-venue'}>
                                <button className='btn text'>
                                    I'm a Venue
                                </button>
                            </Link>
                        </div>
                        <button className='btn logout' onClick={() => handleLogout()}>
                            <LogOutIcon />
                        </button>
                    </div>
                </>
            ) : (
                <>
                    { getLocation() }
                    <nav className='nav-list right'>
                        <Link className='link' to={'/venues/add-venue'}>
                                <button className='btn text'>
                                    I'm a Venue
                                </button>
                        </Link>
                        <Link className='link' to={'/find-a-gig'}>
                            <button className={`btn secondary ${location.pathname === '/find-a-gig' ? 'disabled' : ''}`}>
                                <MapIcon />
                                Find a Gig
                            </button>
                        </Link>
                        <Link className='link' to={'/find-venues'}>
                            <button className={`btn secondary ${location.pathname === '/find-venues' ? 'disabled' : ''}`}>
                                <TelescopeIcon />
                                Find a Venue
                            </button>
                        </Link>
                        <button className='item btn secondary' onClick={() => {showAuthModal(true); setAuthType('login')}}>
                            Log In
                        </button>
                        <button className='item btn primary' onClick={() => {showAuthModal(true); setAuthType('signup')}}>
                            Sign Up
                        </button>
                    </nav>
                </>
            )}
        </header>
    )
}
