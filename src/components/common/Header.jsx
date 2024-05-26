import { NoTextLogo, NoTextLogoLink, TextLogo, TextLogoLink } from "../ui/logos/Logos"
import '/styles/common/header.styles.css'

export const Header = ({ setAuthModal }) => {

    const showAuthModal = () => {
        setAuthModal(true)
    }

    return (
        <header className="header default">
            <TextLogo />
            <nav className="nav-list">
                <button className="item btn primary" onClick={showAuthModal}>
                    Sign Up
                </button>
            </nav>
        </header>
    )
}

export const HostHeader = () => {
    return (
        <header className="header host">
            <h1>HOST HEADER</h1>
        </header>
    )
}

export const MusicianHeader = () => {
    return (
        <header className="header musician">
            <h1>MUSICIAN HEADER</h1>
        </header>
    )
}

export const GigGoerHeader = () => {
    return (
        <header className="header gig-goer">
            <h1>GIGGOER HEADER</h1>
        </header>
    )
}