import { MenuIcon, NotificationsIcon, UserIcon } from "../../../components/Icons/Icons"
import { GiginLogoNoText } from "../../../components/logos/GiginLogo"

export const HostControlCentre = () => {
    return (
        <section className="control-centre">
            <header className="header">
                <div className="top">
                    <div className="left">
                        <GiginLogoNoText />
                        <span className="slash">/</span>
                        <h2 className="title">Host</h2>
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
                        <div className="nav-item">
                            <a className="link" href="#">Overview</a>
                        </div>
                        <div className="nav-item">
                            <a className="link" href="#">Venues</a>
                        </div>
                        <div className="nav-item">
                            <a className="link" href="#">Gigs</a>
                        </div>
                        <div className="nav-item">
                            <a className="link" href="#">Settings</a>
                        </div>
                    </nav>
                </div>
            </header>

            <main className="main">
                <div className="venues-tab tab">
                    <div className="tab-banner">
                        <h3 className="title">Venues</h3>
                        <button className="btn btn-black">Add Venue</button>
                    </div>
                    <div className="tab-content">
                        <div className="card">
                            <div className="left">
                                <h4 className="title">The Old Blue Last</h4>
                                <p className="address">38 Great Eastern St, Hackney, London EC2A 3ES</p>
                                <p className="description">The Old Blue Last is a pub and live music venue in Shoreditch, East London. It is the first pub on the left as you come out of Old Street Station.</p>
                            </div>
                            <div className="right">
                                <button className="btn btn-icon"><MenuIcon /></button>
                            </div>
                        </div>
                        <div className="card">
                            <div className="left">
                                <h4 className="title">The Old Blue Last</h4>
                                <p className="address">38 Great Eastern St, Hackney, London EC2A 3ES</p>
                                <p className="description">The Old Blue Last is a pub and live music venue in Shoreditch, East London. It is the first pub on the left as you come out of Old Street Station.</p>
                            </div>
                            <div className="right">
                                <button className="btn btn-icon"><MenuIcon /></button>
                            </div>
                        </div>
                        <div className="card">
                            <div className="left">
                                <h4 className="title">The Old Blue Last</h4>
                                <p className="address">38 Great Eastern St, Hackney, London EC2A 3ES</p>
                                <p className="description">The Old Blue Last is a pub and live music venue in Shoreditch, East London. It is the first pub on the left as you come out of Old Street Station.</p>
                            </div>
                            <div className="right">
                                <button className="btn btn-icon"><MenuIcon /></button>
                            </div>
                        </div>
                        <div className="card">
                            <div className="left">
                                <h4 className="title">The Old Blue Last</h4>
                                <p className="address">38 Great Eastern St, Hackney, London EC2A 3ES</p>
                                <p className="description">The Old Blue Last is a pub and live music venue in Shoreditch, East London. It is the first pub on the left as you come out of Old Street Station.</p>
                            </div>
                            <div className="right">
                                <button className="btn btn-icon"><MenuIcon /></button>
                            </div>
                        </div>
                    </div>
                </div>
            </main>
        </section>
    )
}