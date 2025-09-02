import '@styles/shared/footer.styles.css'
import { TextLogoLink } from '@features/shared/ui/logos/Logos';

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
                    <li style={{ margin: '0 15px' }}>
                        <a href='/#' style={{ textDecoration: 'none', color: '#333' }}>Privacy</a>
                    </li>
                    <li style={{ margin: '0 15px' }}>
                        <a href='/#' style={{ textDecoration: 'none', color: '#333' }}>Terms</a>
                    </li>
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