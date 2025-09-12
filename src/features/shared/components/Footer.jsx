import '@styles/shared/footer.styles.css'
import { TextLogoLink } from '@features/shared/ui/logos/Logos';
import { Link } from 'react-router-dom';

export const Footer = () => {
    return (
        <footer style={{ 
            display: 'flex', 
            justifyContent: 'space-between', 
            alignItems: 'center', 
            padding: '20px 2rem', 
            backgroundColor: '#f5f5f5', 
            borderTop: '1px solid #ddd'
        }}>
            {/* Left Side: Logo */}
            <div style={{ textAlign: 'center' }}>
                <TextLogoLink />
                <p style={{ marginTop: '10px', fontSize: '14px', color: '#666' }}>
                    © {new Date().getFullYear()} Gigin Ltd. All rights reserved.
                </p>
            </div>

            {/* Right Side: Footer Links */}
            <nav>
                <ul style={{ 
                    display: 'flex', 
                    listStyle: 'none', 
                    padding: 0, 
                    margin: 0 
                }}>
                    <li style={{ margin: '0 15px' }}>
                        <a href='/' style={{ textDecoration: 'none', color: '#333' }}>About</a>
                    </li>
                    <Link style={{ margin: '0 15px', textDecoration: 'none' }} to={'/privacy-policy'}>
                        <span style={{ textDecoration: 'none', color: '#333' }}>Privacy Policy</span>
                    </Link>
                    <Link style={{ margin: '0 15px', textDecoration: 'none' }} to={'/terms-and-conditions'}>
                        <span style={{ textDecoration: 'none', color: '#333' }}>Terms & Conditions</span>
                    </Link>
                    <li style={{ margin: '0 15px' }}>
                        <a 
                            href='mailto:hq.gigin@gmail.com' 
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