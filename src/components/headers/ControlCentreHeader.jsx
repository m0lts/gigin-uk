// Dependencies
import { Link, useLocation } from "react-router-dom"

// Components
import { GiginLogoNoText } from "/components/logos/PrimaryLogo"
import { NotificationsIcon, UserIcon } from "/components/icons/Icons"

// Styles and extras
import './headers.styles.css'


export const ControlCentreHeader = () => {

    const location = useLocation();

    return (
        <header className="header control-centre">
            <div className="top">
                <div className="left">
                    <Link to={'/'} className="link">
                        <GiginLogoNoText />
                    </Link>
                    <span className="slash">|</span>
                    <h2 className="title">Control Centre</h2>
                </div>
                <div className="right">
                    <div className="buttons">
                        <button className="btn btn-text">Help</button>
                        <button className="btn btn-border">Feedback</button>
                    </div>
                    <div className="icons">
                        <button className="btn btn-icon"><NotificationsIcon /></button>
                        <button className="btn btn-icon"><UserIcon /></button>
                    </div>
                </div>
            </div>
            <div className="bottom">
                <nav className="navigation">
                    <div className={`nav-item ${location.pathname === '/control-centre' && 'active'}`}>
                        <Link to='/control-centre' className="link">
                            Overview
                        </Link>
                    </div>
                    <div className={`nav-item ${location.pathname === '/control-centre/gigs' && 'active'}`}>
                        <Link to='/control-centre/gigs' className="link">
                            Gigs
                        </Link>
                    </div>
                    <div className={`nav-item ${location.pathname === '/control-centre/venues' && 'active'}`}>
                        <Link to='/control-centre/venues' className="link">
                            Venues
                        </Link>
                    </div>
                </nav>
            </div>
        </header>
    )
}