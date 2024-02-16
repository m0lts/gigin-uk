import GiginLogoIcon from '/assets/logos/gigin-logo.png'
import { Link } from 'react-router-dom'
import './gigin-logo.styles.css'

export const GiginLogo = () => {
    return (
        <Link to={'/'} className='logo'>
            <img src={GiginLogoIcon} alt='Gigin Logo' className='logo-img'/>
            <h1 className='logo-text'>Gigin</h1>
        </Link>
    )
}

export const GiginLogoNoText = () => {
    return (
        <Link to={'/'} className='logo'>
            <img src={GiginLogoIcon} alt='Gigin Logo' className='logo-img'/>
        </Link>
    )
}