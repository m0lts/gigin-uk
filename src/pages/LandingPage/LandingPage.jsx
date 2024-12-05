import { Link, useNavigate } from "react-router-dom";
import MusicianImg from "../../assets/images/venues-landing-page2.jpg"
import VenuesImg from "../../assets/images/venues-landing-page.jpg"
import GigGoersImg from "../../assets/images/gig-goers-landing-page.jpg"

import '/styles/common/landing-page.styles.css'

export const LandingPage = () => {

    const navigate = useNavigate();

    return (
        <div className="landing-page">
            <div className="element">
                <div className="title-and-text">
                    <h1>Musicians</h1>
                    <h3>Find your next gig and grow your following with gigin. We ensure that you get fair payment on time and in full.</h3>
                </div>
                <figure className="img-cont">
                    <img src={MusicianImg} alt="Musicians landing page img" />
                </figure>
                <button className="btn primary" onClick={() => navigate('/find-a-gig')}>
                    Find Your Next Gig
                </button>
            </div>
            <div className="element">
                <div className="title-and-text">
                    <h1>Venues</h1>
                    <h3>A complete system where you can post and manage your gigs. Less legwork for you - just build a venue, post a gig and watch the applications flow in.</h3>
                </div>
                <figure className="img-cont">
                    <img src={VenuesImg} alt="Venues landing page img" />
                </figure>
                <button className="btn primary" onClick={() => navigate('/venues')}>
                    Add Your Venue
                </button>
            </div>
            <div className="element">
                <div className="title-and-text">
                    <h1>Gig-goers</h1>
                    <h3>Want to watch more live music? See upcoming gigs on the map and follow your favourite local musicians!</h3>
                </div>
                <figure className="img-cont">
                    <img src={GigGoersImg} alt="Gig-goers landing page img" />
                </figure>
                <button className="btn primary">
                    Coming Soon...
                </button>
            </div>
        </div>
    )
}