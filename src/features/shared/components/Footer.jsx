import '@styles/shared/footer.styles.css'
import { TextLogoLink } from '@features/shared/ui/logos/Logos';
import { Link } from 'react-router-dom';
import { useBreakpoint } from '../../../hooks/useBreakpoint';

export const Footer = () => {

    const { isMdUp } = useBreakpoint();

    return (
        <footer style={{ 
            display: 'flex', 
            justifyContent: 'space-between', 
            alignItems: 'center', 
            padding: isMdUp ? '20px 2rem' : '30px 2rem', 
            backgroundColor: '#f5f5f5', 
            borderTop: '1px solid #ddd'
        }}>
            {/* Left Side: Logo */}
            <div style={{ textAlign: isMdUp ? 'center' : 'left', display: 'flex', flexDirection: 'column', alignItems: 'flex-start' }}>
                <TextLogoLink />
                <p style={{ marginTop: '10px', fontSize: isMdUp ? '14px' : '10px', textAlign: isMdUp ? 'center' : 'left', color: '#666' }}>
                    © {new Date().getFullYear()} Gigin Ltd. {!isMdUp && <br />} All rights reserved.
                </p>
            </div>

            {/* Right Side: Footer Links */}
            <nav>
                <ul style={{ 
                    display: 'flex',
                    flexDirection: isMdUp ? 'row' : 'column',
                    alignItems: isMdUp ? 'center' : 'flex-end',
                    listStyle: 'none', 
                    padding: 0, 
                    margin: 0 
                }}>
                    {/* <li style={{ margin: isMdUp ? '0 15px' : '5px 0' }}>
                        <a href='/' style={{ textDecoration: 'none', color: '#333' }}>About</a>
                    </li> */}
                    <Link style={{ margin: isMdUp ? '0 15px' : '5px 0', textDecoration: 'none' }} to={'/privacy-policy'}>
                        <span style={{ textDecoration: 'none', color: '#333' }}>Privacy Policy</span>
                    </Link>
                    <Link style={{ margin: isMdUp ? '0 15px' : '5px 0', textDecoration: 'none' }} to={'/terms-and-conditions'}>
                        <span style={{ textDecoration: 'none', color: '#333' }}>Terms & Conditions</span>
                    </Link>
                    <li style={{ margin: isMdUp ? '0 15px' : '5px 0' }}>
                        <a 
                            href='mailto:toby@giginmusic.com' 
                            style={{ textDecoration: 'none', color: '#333' }}
                        >
                            Contact Us
                        </a>
                    </li>
                </ul>
            </nav>
        </footer>
    );
};