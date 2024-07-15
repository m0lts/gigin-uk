import { useNavigate, useLocation, Link } from "react-router-dom"
import { HostLogoLink, MusicianLogoLink, TextLogo } from "../ui/logos/Logos"
import '/styles/common/header.styles.css'
import { useAuth } from "../../hooks/useAuth"
import { DashboardIcon, DownChevronIcon, MailboxEmptyIcon, RightChevronIcon } from "/components/ui/Extras/Icons"
import { useState } from "react"
import { ExitIcon, HouseIcon, LogOutIcon, MapIcon, NewTabIcon, SettingsIcon, UserIcon, VenueBuilderIcon, VillageHallIcon } from "../ui/Extras/Icons"

export const Header = ({ setAuthModal, setAuthType, user }) => {
    
    const { logout } = useAuth();
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

    const headerStyle = {
        padding: location.pathname.includes('dashboard') ? '0 1rem' : '0 5%',
      };

    const menuStyle = {
        right: location.pathname.includes('dashboard') ? '1rem' : '5%',
      };


    if (location.pathname === '/') {
        return (
            user ? (
                <header className="header default" style={headerStyle}>
                    <TextLogo />
                    <div className="left">

                    </div>
                    <div className="right">
                        <div className="buttons">
                            <Link className="link" to={'/musician'}>
                                <button className="btn primary-alt">
                                    Musicians
                                    <NewTabIcon />
                                </button>
                            </Link>
                            <Link className="link" to={'/host/dashboard'}>
                                <button className="btn primary-alt">
                                    Hosts
                                    <NewTabIcon />
                                </button>
                            </Link>
                            <Link className="link" to={'/host/dashboard'}>
                                <button className="btn primary-alt">
                                    Gig-Goers
                                    <NewTabIcon />
                                </button>
                            </Link>
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
                            <div className="item">
                                Messages
                                <MailboxEmptyIcon />
                            </div>
                            <div className="break" />
                            <h6 className="title">musicians</h6>
                            <div className="item no-margin">
                                Dashboard
                                <DashboardIcon />
                            </div>
                            <div className="item">
                                Map
                                <MapIcon />
                            </div>
                            <div className="break" />
                            <h6 className="title">hosts</h6>
                            <div className="item no-margin">
                                Dashboard
                                <DashboardIcon />
                            </div>
                            <div className="item">
                                Venue Builder
                                <VenueBuilderIcon />
                            </div>
                            <div className="break" />
                            <h6 className="title">gig-goers</h6>
                            <div className="item no-margin">
                                Map
                                <MapIcon />
                            </div>
                            <div className="break" />
                            <div className="item no-margin">
                                Settings
                                <SettingsIcon />
                            </div>
                            <button className="btn danger no-margin" onClick={handleLogout}>
                                Log Out
                                <LogOutIcon />
                            </button>
                        </nav>
                    )}
                </header>
            ) : (
                <header className="header default" style={headerStyle}>
                    <TextLogo />
                    <nav className="nav-list">
                        <button className="item btn secondary" onClick={() => {showAuthModal(true); setAuthType('login')}}>
                            Log In
                        </button>
                        <button className="item btn primary-alt" onClick={() => {showAuthModal(true); setAuthType('signup')}}>
                            Sign Up
                        </button>
                    </nav>
                </header>
            )
        )
    }

    return (
        <header className="header default" style={headerStyle}>
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
                        <nav className="account-menu" style={menuStyle}>
                            <div className="item name-and-email no-margin">
                                <h6>{user.name}</h6>
                                <p>{user.email}</p>
                            </div>
                            <div className="item">
                                Messages
                                <MailboxEmptyIcon />
                            </div>
                            <div className="break" />
                            <h6 className="title">musicians</h6>
                            <div className="item no-margin">
                                Dashboard
                                <DashboardIcon />
                            </div>
                            <div className="item">
                                Map
                                <MapIcon />
                            </div>
                            <div className="break" />
                            <h6 className="title">hosts</h6>
                            <div className="item no-margin">
                                Dashboard
                                <DashboardIcon />
                            </div>
                            <div className="item">
                                Venue Builder
                                <VenueBuilderIcon />
                            </div>
                            <div className="break" />
                            <h6 className="title">gig-goers</h6>
                            <div className="item no-margin">
                                Map
                                <MapIcon />
                            </div>
                            <div className="break" />
                            <div className="item no-margin">
                                Settings
                                <SettingsIcon />
                            </div>
                            <button className="btn danger no-margin" onClick={handleLogout}>
                                Log Out
                                <LogOutIcon />
                            </button>
                        </nav>
                    )}
                </>
            ) : (
                <>
                    { getLocation() }
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
