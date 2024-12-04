import { Link } from "react-router-dom";
import '/styles/common/landing-page.styles.css'

export const LandingPage = () => {
    return (
        <div className="landing-page">
            <Link to={'/find-a-gig'} className="link">
                Musicians
            </Link>
            <Link to={'/venues'} className="link">
                Venues
            </Link>
            <Link to={'/giggoer'} className="link">
                Gig-goers
            </Link>
        </div>
    )
}