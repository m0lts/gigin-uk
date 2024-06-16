import { useNavigate, useLocation, Link } from "react-router-dom"
import { HostLogoLink, MusicianLogoLink, TextLogo } from "../ui/logos/Logos"
import '/styles/common/header.styles.css'
import { useAuth } from "../../hooks/useAuth"
import { DashboardIcon, DownChevronIcon, MailboxEmptyIcon, RightChevronIcon } from "/components/ui/Extras/Icons"
import { useState } from "react"

export const Header = ({ setAuthModal, setAuthType }) => {
    
    const { user, logout } = useAuth();
    const navigate = useNavigate();
    const location = useLocation();
    const [accountMenu, setAccountMenu] = useState(false);

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
            return <HostLogoLink />;
        } else if (location.pathname.includes('musician')) {
            return <MusicianLogoLink />;
        } else {
            return <TextLogo />;
        }
    }

    return (
        <header className="header default">
            {user ? (
                <>
                    <div className="left">
                        { getLocation() }
                        {location.pathname.includes('dashboard') && (
                            <div className="breadcrumbs">
                                <span className="item">Dashboard</span>
                                {location.pathname === ('/host/dashboard') && (
                                    <>
                                        <RightChevronIcon />
                                        <span className="item active">Overview</span>
                                    </>
                                )}
                                {location.pathname === ('/host/dashboard/gigs') && (
                                    <>
                                        <RightChevronIcon />
                                        <span className="item active">Gigs</span>
                                    </>
                                )}
                                {location.pathname === ('/host/dashboard/venues') && (
                                    <>
                                        <RightChevronIcon />
                                        <span className="item active">Venues</span>
                                    </>
                                )}
                                {location.pathname === ('/host/dashboard/musicians') && (
                                    <>
                                        <RightChevronIcon />
                                        <span className="item active">Musicians</span>
                                    </>
                                )}
                            </div>
                        )}
                    </div>
                    <div className="right">
                        <div className="buttons">
                            <Link className="link" to={'/host/dashboard'}>
                                <button className="btn secondary">
                                    <DashboardIcon />
                                    Dashboard
                                </button>
                            </Link>
                            <button className="btn secondary">
                                <MailboxEmptyIcon />
                                Messages
                            </button>
                        </div>
                        <button className="btn secondary" onClick={() => setAccountMenu(!accountMenu)}>
                            {user.name}
                            <DownChevronIcon />
                        </button>
                    </div>
                    {accountMenu && (
                        <nav className="account-menu">
                            <div className="item">
                                Option 1
                            </div>
                            <div className="item">
                                Option 2
                            </div>
                            <hr className="break" />
                            <div className="item">
                                Option 3
                            </div>
                            <div className="item">
                                Option 4
                            </div>
                            <hr className="break" />
                            <button className="item btn text" onClick={handleLogout}>
                                Log Out
                            </button>
                        </nav>
                    )}
                </>
            ) : (
                <>
                    { getLocation() }
                    <nav className="nav-list">
                        <button className="item btn tertiary" onClick={() => {showAuthModal(true); setAuthType('login')}}>
                            Log In
                        </button>
                        <button className="item btn primary" onClick={() => {showAuthModal(true); setAuthType('signup')}}>
                            Sign Up
                        </button>
                    </nav>
                </>
            )}
        </header>
    )
}
