import { useState, useEffect } from "react";
import { useNavigate, useLocation, Link } from "react-router-dom";
import { useAuth } from "../../hooks/useAuth";
import { TextLogoLink, VenueLogoLink } from "../ui/logos/Logos";
import { collection, addDoc, serverTimestamp, query, where, onSnapshot } from 'firebase/firestore';
import { firestore } from "../../firebase"
import { DotIcon, DashboardIcon, FaceFrownIcon, FaceHeartsIcon, FaceMehIcon, FaceSmileIcon, LogOutIcon, MapIcon, SettingsIcon, UserIcon, VenueBuilderIcon, MailboxEmptyIcon, MailboxFullIcon, GuitarsIcon, RightChevronIcon } from "../ui/Extras/Icons"

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

    const [newMessages, setNewMessages] = useState(false);

    useEffect(() => {
        if (!user) return;
    
        const checkForNewMessages = () => {
            const conversationsRef = collection(firestore, 'conversations');
            const queries = [];
    
            // Query by musicianProfile ID
            if (user.musicianProfile) {
                const musicianQuery = query(conversationsRef, where('participants', 'array-contains', user.musicianProfile.musicianId));
                queries.push(musicianQuery);
            }
    
            // Query by each venueProfile ID
            if (user.venueProfiles && user.venueProfiles.length > 0) {
                user.venueProfiles.forEach(venue => {
                    const venueQuery = query(conversationsRef, where('participants', 'array-contains', venue.venueId));
                    queries.push(venueQuery);
                });
            }
    
            // Set up listeners for each query
            const unsubscribeFunctions = queries.map(q => 
                onSnapshot(q, snapshot => {
                    if (!snapshot.empty) {
                        const newConversations = snapshot.docs.map(doc => ({
                            id: doc.id,
                            ...doc.data(),
                        }));
    
                        // Check for any conversations where the last message is unread
                        let hasUnreadMessages = false;
    
                        newConversations.forEach(conversation => {
                            const lastViewedTimestamp = conversation.lastViewed?.[user.uid]?.seconds || 0;
                            const lastMessageTimestamp = conversation.lastMessageTimestamp?.seconds || 0;
                            const lastMessageSenderId = conversation.lastMessageSenderId;
    
                            // If the last message is newer than the last viewed timestamp and the user is not the sender
                            if (lastMessageTimestamp > lastViewedTimestamp && lastMessageSenderId !== user.uid) {
                                hasUnreadMessages = true;
                            }
                        });
    
                        setNewMessages(hasUnreadMessages);  // Update the state based on unread messages
                    }
                })
            );
    
            // Clean up the listeners when the component unmounts
            return () => {
                unsubscribeFunctions.forEach(unsub => unsub());
            };
        };
    
        checkForNewMessages();
    }, [user]);

    const handleScaleSelection = (scale) => {
        setFeedback(prev => ({ ...prev, scale }));
    };

    const handleFeedbackSubmit = async () => {
        try {
            await addDoc(collection(firestore, 'feedback'), {
                ...feedback,
                timestamp: serverTimestamp()
            });
        
            setFeedback({ scale: '', feedback: '' });
            setFeedbackForm(false);
        } catch (error) {
            console.error('Error submitting feedback:', error);
        }
    };

    const showAuthModal = (type) => {
        setAuthModal(true);
        setAuthType(type);
    }

    const handleLogout = async () => {
        try {
            await logout();
            navigate('/venues');
        } catch (err) {
            console.error(err);
        } finally {
            window.location.reload();
        }
    }

    const headerStyle = {
        padding: location.pathname.includes('dashboard') ? '0 1rem' : '0 5%',
    };

    const menuStyle = {
        right: location.pathname.includes('dashboard') ? '1rem' : '5%',
    };

    
    return (
        <header className="header venue" style={headerStyle}>
            {user ? (
                <>
                    <div className="left">
                        <VenueLogoLink />
                        {location.pathname.includes('dashboard') && (
                            <div className="breadcrumbs">
                                <span className="item">Dashboard</span>
                                {location.pathname === ('/venues/dashboard') && (
                                    <>
                                        <RightChevronIcon />
                                        <span className="item active">Overview</span>
                                    </>
                                )}
                                {location.pathname.includes('gig') && (
                                    <>
                                        <RightChevronIcon />
                                        <span className="item active">Gigs</span>
                                        {location.pathname.includes('applications') && (
                                            <>
                                                <RightChevronIcon />
                                                <span className="item active">Gig Applications</span>
                                            </>
                                        )}
                                    </>
                                )}
                                {location.pathname === ('/venues/dashboard/venues') && (
                                    <>
                                        <RightChevronIcon />
                                        <span className="item active">Venues</span>
                                    </>
                                )}
                                {location.pathname.includes('musicians') && (
                                    <>
                                        <RightChevronIcon />
                                        <span className="item active">Musicians</span>
                                    </>
                                )}
                                {location.pathname.includes('finances') && (
                                    <>
                                        <RightChevronIcon />
                                        <span className="item active">Finances</span>
                                    </>
                                )}
                            </div>
                        )}
                    </div>
                    <div className="right">
                        <div className="buttons">
                            <button className="btn text" onClick={() => setFeedbackForm(!feedbackForm)}>
                                Feedback
                            </button>
                            {user.venueProfiles && user.venueProfiles.length > 0 && user.venueProfiles.some(profile => profile.completed) ? (
                                location.pathname === ('/venues/dashboard') ? (
                                    <Link className="link" to={'/venues/add-venue'}>
                                        <button className="btn secondary">
                                            <VenueBuilderIcon />
                                            Add Another Venue
                                        </button>
                                    </Link>
                                ) : (
                                    <Link className="link" to={'/venues/dashboard'}>
                                        <button className="btn secondary" onClick={() => console.log('clicked')}>
                                            <DashboardIcon />
                                            Dashboard
                                        </button>
                                    </Link>
                                )
                            ) : (
                                <Link className="link" to={'/venues/add-venue'}>
                                    <button className="btn primary">
                                        Add my Venue
                                    </button>
                                </Link>
                            )}
                            {user.venueProfiles && (
                                newMessages ? (
                                    <Link className="link" to={'/messages'}>
                                        <button className="btn secondary messages">
                                            <span className="notification-dot"><DotIcon /></span>
                                            <MailboxFullIcon />
                                            Messages
                                        </button>
                                    </Link>
                                ) : (
                                    <Link className="link" to={'/messages'}>
                                        <button className="btn secondary">
                                            <MailboxEmptyIcon />
                                            Messages
                                        </button>
                                    </Link>
                                )
                            )}
                        </div>
                        <button className="btn icon" onClick={() => setAccountMenu(!accountMenu)}>
                            <UserIcon />
                        </button>
                    </div>
                    {accountMenu && (
                        <nav className="account-menu" style={menuStyle}>
                            <div className="item name-and-email no-margin">
                                <h6>{user.name}</h6>
                                <p>{user.email}</p>
                            </div>
                            {user.venueProfiles && (
                                newMessages ? (
                                    <Link className="link item message" to={'/messages'}>
                                            Messages
                                            <MailboxFullIcon />
                                    </Link>
                                ) : (
                                    <Link className="link item" to={'/messages'}>
                                            Messages
                                            <MailboxEmptyIcon />
                                    </Link>
                                )
                            )}
                            <div className="break" />
                            <h6 className="title">venues</h6>
                            {user.venueProfiles && user.venueProfiles.length > 0 ? (
                                <>
                                    <Link className="link" to={'/venues/dashboard'}>
                                        <div className="item no-margin">
                                            Dashboard
                                            <DashboardIcon />
                                        </div>
                                    </Link>
                                    <Link to={'/venues/add-venue'} className="item link">
                                        Add another venue
                                        <VenueBuilderIcon />
                                    </Link>
                                </>
                            ) : (
                                <Link to={'/venues/add-venue'} className="item link">
                                    Add my Venue
                                    <VenueBuilderIcon />
                                </Link>
                            )}
                            <div className="break" />
                            <Link to={'/create-musician-profile'} className="item no-margin link">
                                Create a Musician Profile
                                <GuitarsIcon />
                            </Link>
                            {/* <div className="item no-margin">
                                Find Gigs
                                <MapIcon />
                            </div> */}
                            {/* <div className="item no-margin">
                                Settings
                                <SettingsIcon />
                            </div> */}
                            <button className="btn danger no-margin" onClick={handleLogout}>
                                Log Out
                                <LogOutIcon />
                            </button>
                        </nav>
                    )}
                    {feedbackForm && (
                        <div className="feedback">
                            <div className="body">
                                <textarea
                                    name="feedbackBox"
                                    id="feedbackBox"
                                    onChange={(e) => setFeedback(prev => ({ ...prev, feedback: e.target.value }))}
                                    value={feedback.feedback}
                                    placeholder="Your feedback..."
                                    
                                ></textarea>
                            </div>
                            <div className="foot">
                                <div className="faces">
                                    <button className={`btn icon ${feedback.scale === 'hearts' ? 'active' : ''}`} onClick={() => handleScaleSelection('hearts')}>
                                        <FaceHeartsIcon />
                                    </button>
                                    <button className={`btn icon ${feedback.scale === 'smiles' ? 'active' : ''}`} onClick={() => handleScaleSelection('smiles')}>
                                        <FaceSmileIcon />
                                    </button>
                                    <button className={`btn icon ${feedback.scale === 'meh' ? 'active' : ''}`} onClick={() => handleScaleSelection('meh')}>
                                        <FaceMehIcon />
                                    </button>
                                    <button className={`btn icon ${feedback.scale === 'frown' ? 'active' : ''}`} onClick={() => handleScaleSelection('frown')}>
                                        <FaceFrownIcon />
                                    </button>
                                </div>
                                <button className="btn primary-alt" onClick={handleFeedbackSubmit}>
                                    Send
                                </button>
                            </div>
                        </div>
                    )}
                </>
            ) : (
                <>
                    <TextLogoLink />
                    <nav className="nav-list">
                        <button className="item btn secondary" onClick={() => {showAuthModal(true); setAuthType('login')}}>
                            Log In
                        </button>
                        <button className="item btn primary-alt" onClick={() => {showAuthModal(true); setAuthType('signup')}}>
                            Sign Up
                        </button>
                    </nav>
                </>
            )}
        </header>
    )
}