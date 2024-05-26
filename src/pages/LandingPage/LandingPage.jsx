import { Link } from "react-router-dom";
import '/styles/common/landing-page.styles.css'

export const LandingPage = () => {
    return (
        <div className="landing-page">
            <Link to={'/musician'} className="link">
                Musicians
            </Link>
            <Link to={'/host'} className="link">
                Hosts
            </Link>
            <Link to={'/giggoer'} className="link">
                Gig-goers
            </Link>
        </div>
    )
}