import { Link } from "react-router-dom";

export const LandingPage = () => {
    return (
        <div>
            <div className="options" style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
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
        </div>
    )
}