import { useState } from "react";
import { StarIcon } from "../../../../components/ui/Extras/Icons"
import { ProfileCreator } from "../ProfileCreator/ProfileCreator"
import '/styles/musician/musician-profile.styles.css'
import { Overview } from "./Overview";

export const Profile = ({ musicianProfile }) => {
    const [activeTab, setActiveTab] = useState('overview'); // State to track the active tab

    const renderActiveTabContent = () => {
        switch (activeTab) {
            case 'overview':
                return <Overview musicianData={musicianProfile} />; 
            case 'music':
                return <div className="music">Music Content</div>;
            case 'reviews':
                return <div className="reviews">Reviews Content</div>;
            default:
                return null;
        }
    };

    console.log(musicianProfile)

    return (
        <div className="profile">
            {musicianProfile && musicianProfile.completed ? (
                <div className="profile-view">
                    <div className="profile-banner">
                        <figure className="profile-picture">
                            <img src={musicianProfile.picture} alt={`${musicianProfile.name}'s Profile Picture`} />
                        </figure>
                        <div className="profile-details">
                            <h1>{musicianProfile.name}</h1>
                            <div className="data">
                                <p>50 gigs played</p>
                                <p>300 followers</p>
                                <p>4.5<StarIcon /> avg. rating</p>
                            </div>
                        </div>
                    </div>
                    <nav className="profile-tabs">
                        <p onClick={() => setActiveTab('overview')} className={`profile-tab ${activeTab === 'overview' ? 'active' : ''}`}>
                            Overview
                        </p>
                        <p onClick={() => setActiveTab('music')} className={`profile-tab ${activeTab === 'music' ? 'active' : ''}`}>
                            Music
                        </p>
                        <p onClick={() => setActiveTab('reviews')} className={`profile-tab ${activeTab === 'reviews' ? 'active' : ''}`}>
                            Reviews
                        </p>
                    </nav>
                    <div className="profile-sections">
                        {renderActiveTabContent()}
                    </div>
                </div>
            ) : (
                <ProfileCreator musicianProfile={musicianProfile} />
            )}
        </div>
    );
};