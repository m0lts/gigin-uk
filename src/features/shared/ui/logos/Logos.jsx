import { Link } from 'react-router-dom'
import '@styles/shared/logos.styles.css'
import '@assets/fonts/fonts.css'

export const TextLogo = () => {
    return (
        <h1 className='logo' style={{ fontFamily: 'Visby CF, sans-serif', fontWeight: 900 }}>gigin<span className='orange-txt'>.</span></h1>
    )
}
export const TextLogoXL = () => {
    return (
        <h1 className='logo' style={{ fontFamily: 'Visby CF, sans-serif', fontWeight: 900, fontSize: '5rem' }}>gigin<span className='orange-txt' style={{ fontSize: '3rem' }}>.<span style={{ color: 'var(--gn-grey-600)', textTransform: 'uppercase', marginLeft: 5 }}>(beta)</span></span></h1>
    )
}
export const TextLogoLink = () => {
    return (
        <h1 className='logo'>
            <Link className='link' to={'/'} style={{ fontFamily: 'Visby CF, sans-serif', fontWeight: 900 }}>
                gigin<span className='orange-txt'>.</span>
            </Link>
        </h1>
    )
}
export const VenueLogoLink = () => {
    return (
        <h1 className='logo'>
            <Link className='link' to={'/venues'} style={{ fontFamily: 'Visby CF, sans-serif', fontWeight: 900 }}>
                gigin<span className='orange-txt'>.</span>
                <span className='user-type' style={{ fontWeight: 600 }}>VENUES</span>
            </Link>
        </h1>
    )
}
export const MusicianLogoLink = () => {
    return (
        <h1 className='logo'>
            <Link className='link' to={'/find-a-gig'} style={{ fontFamily: 'Visby CF, sans-serif', fontWeight: 900 }}>
                gigin<span className='orange-txt'>.</span>
                <span className='user-type' style={{ fontWeight: 600 }}>MUSICIANS</span>
            </Link>
        </h1>
    )
}
export const NoTextLogo = () => {
    return (
        <h1 className='logo' style={{ fontFamily: 'Visby CF, sans-serif', fontWeight: 900 }}>g<span className='orange-txt'>.</span></h1>
    )
}
export const NoTextLogoLink = () => {
    return (
        <h1 className='logo'>
            <Link className='link' to={'/'} style={{ fontFamily: 'Visby CF, sans-serif', fontWeight: 900 }}>
                g<span className='orange-txt'>.</span>
            </Link>
        </h1>
    )
}
export const WhiteBckgrdLogo = () => {
    return (
        <div className='bckgrd-white logo'>
            <h1>
                <Link className='link' to={'/venues'} style={{ fontFamily: 'Visby CF, sans-serif', fontWeight: 900 }}>
                    g<span className='orange-txt'>.</span>
                </Link>
            </h1>
        </div>
    )
}