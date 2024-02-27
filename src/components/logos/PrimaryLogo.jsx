// Styles and extras
import GiginLogo from '/assets/logos/gigin-logo.png'
import './logos.styles.css'

export const PrimaryLogo = () => {
    return (
        <div className="logo">
            <img src={GiginLogo} alt="Gigin Logo" />
            <h1>GIGIN</h1>
        </div>
    )
}

export const GiginLogoNoText = () => {
    return (
        <div className="logo">
            <img src={GiginLogo} alt="Gigin Logo" />
        </div>
    )
}