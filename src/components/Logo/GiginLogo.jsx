import GiginLogoSVG from '/assets/logos/gigin_logo.svg'
import { Link } from 'react-router-dom'
import './gigin-logo.styles.css'

export const GiginLogo = () => {
    return (
        <Link to={'/'} className='logo'>
            <img src={GiginLogoSVG} alt='Gigin Logo' className='logo-img'/>
            <h1 className='logo-text'>Gigin</h1>
        </Link>
    )
}