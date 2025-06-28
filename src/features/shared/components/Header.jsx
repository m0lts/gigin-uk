import { useNavigate, useLocation, Link } from 'react-router-dom';
import { VenueLogoLink, MusicianLogoLink, TextLogoLink } from '@features/shared/ui/logos/Logos';
import { GuitarsIcon, LogOutIcon, TelescopeIcon, UserIcon, VenueBuilderIcon } from '@features/shared/ui/extras/Icons';
import '@styles/shared/header.styles.css';
import { useAuth } from '@hooks/useAuth'
import { useState, useEffect } from 'react'
import { listenToUserConversations } from '@services/conversations';

export const Header = ({ setAuthModal, setAuthType, user }) => {
    
    const { logout } = useAuth();
    const navigate = useNavigate();
    const location = useLocation();
    const [accountMenu, setAccountMenu] = useState(false);
    const [feedbackForm, setFeedbackForm] = useState(false);
    const [feedback, setFeedback] = useState({
        scale: '',
        feedback: '',
        user: user?.uid,
    });
    const [feedbackLoading, setFeedbackLoading] = useState(false);
    const [newMessages, setNewMessages] = useState(false);

    useEffect(() => {
        if (!user) return;
        const unsubscribe = listenToUserConversations(user, (conversations) => {
          const hasUnread = conversations.some((conv) => {
            const lastViewed = conv.lastViewed?.[user.uid]?.seconds || 0;
            const lastMessage = conv.lastMessageTimestamp?.seconds || 0;
            const isNotSender = conv.lastMessageSenderId !== user.uid;
            const isDifferentPage = !location.pathname.includes(conv.id);
            return lastMessage > lastViewed && isNotSender && isDifferentPage;
          });
          setNewMessages(hasUnread);
        });
        return () => unsubscribe();
    }, [user]);

    const showAuthModal = (type) => {
        setAuthModal(true);
        setAuthType(type);
    }

    const handleLogout = async () => {
        try {
            await logout();
            navigate();
        } catch (err) {
            console.error(err);
        } finally {
            window.location.reload();
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
        padding: location.pathname.includes('dashboard') ? '0 1rem' : '0 5%',
      };

    const menuStyle = {
        right: location.pathname.includes('dashboard') ? '1rem' : '5%',
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
                            <Link className='link' to={'/create-profile'}>
                                    <button className='btn secondary'>
                                        <GuitarsIcon />
                                        Create a Musician Profile
                                    </button>
                            </Link>
                            {location.pathname !== '/find-a-gig' && (
                                <Link className='link' to={'/find-a-gig'}>
                                    <button className='btn secondary'>
                                        <TelescopeIcon />
                                        Find A Gig
                                    </button>
                                </Link>
                            )}
                            <Link className='link' to={'/venues'}>
                                    <button className='btn text'>
                                        I'm a Venue
                                    </button>
                            </Link>
                        </div>
                        <button className='btn icon' onClick={() => setAccountMenu(!accountMenu)}>
                            <UserIcon />
                        </button>
                    </div>
                    {accountMenu && (
                        <nav className='account-menu' style={menuStyle}>
                            <div className='item name-and-email no-margin'>
                                <h6>{user.name}</h6>
                                <p>{user.email}</p>
                            </div>
                            <div className='break' />
                            <h6 className='title'>musicians</h6>
                            <Link to={'/find-a-gig'} className='item link'>
                                Find a Gig
                                <TelescopeIcon />
                            </Link>
                            <Link to={'/create-profile'} className='item link'>
                                Create Musician Profile
                                <GuitarsIcon />
                            </Link>
                            <div className='break' />
                            <h6 className='title'>VEnues</h6>
                            <Link to={'/venues'} className='item link'>
                                I'm a Venue
                                <VenueBuilderIcon />
                            </Link>
                            <div className='break' />
                            <button className='btn logout no-margin' onClick={handleLogout}>
                                Log Out
                                <LogOutIcon />
                            </button>
                        </nav>
                    )}
                </>
            ) : (
                <>
                    { getLocation() }
                    <nav className='nav-list'>
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
