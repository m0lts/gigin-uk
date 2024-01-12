import { Link } from 'react-router-dom';
import './overlays.styles.css';

export const DefaultOverlay = ({ title, text, link, linkText }) => {
    return (
        <div className="overlay">
            <div className="overlay-content">
                <h2 className="title">{title}</h2>
                <p className="text">{text}</p>
                <Link to={link} className="btn link black-button">{linkText}</Link>
            </div>
        </div>
    )
}