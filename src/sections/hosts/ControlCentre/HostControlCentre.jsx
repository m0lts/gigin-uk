import { Link, Outlet, useLocation } from "react-router-dom"
import { MenuIcon, NotificationsIcon, UserIcon } from "../../../components/Icons/Icons"
import { GiginLogoNoText } from "../../../components/logos/GiginLogo"

export const HostControlCentre = () => {

    const location = useLocation();

    return (
        <section className="control-centre">
            <header className="header">
                <div className="top">
                    <div className="left">
                        <GiginLogoNoText />
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
                    <nav className="nav">
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
            <main className="main">
                <Outlet />
            </main>
        </section>
    )
}