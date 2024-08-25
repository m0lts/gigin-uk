import { Link } from "react-router-dom"
import '/styles/common/logos.styles.css'

export const TextLogo = () => {
    return (
        <h1 className="logo">gigin<span className="orange-txt">.</span></h1>
    )
}
export const TextLogoLink = () => {
    return (
        <h1 className="logo">
            <Link className="link" to={'/'}>
                gigin<span className="orange-txt">.</span>
            </Link>
        </h1>
    )
}
export const VenueLogoLink = () => {
    return (
        <h1 className="logo">
            <Link className="link" to={'/venues'}>
                gigin<span className="orange-txt">.</span>
                <span className="user-type">VENUES</span>
            </Link>
        </h1>
    )
}
export const MusicianLogoLink = () => {
    return (
        <h1 className="logo">
            <Link className="link" to={'/find-a-gig'}>
                gigin<span className="orange-txt">.</span>
                <span className="user-type">MUSICIANS</span>
            </Link>
        </h1>
    )
}
export const NoTextLogo = () => {
    return (
        <h1 className="logo">g<span className="orange-txt">.</span></h1>
    )
}
export const NoTextLogoLink = () => {
    return (
        <h1 className="logo">
            <Link className="link" to={'/'}>
                g<span className="orange-txt">.</span>
            </Link>
        </h1>
    )
}
export const WhiteBckgrdLogo = () => {
    return (
        <div className="bckgrd-white logo">
            <h1>
                <Link className="link" to={'/'}>
                    g<span className="orange-txt">.</span>
                </Link>
            </h1>
        </div>
    )
}