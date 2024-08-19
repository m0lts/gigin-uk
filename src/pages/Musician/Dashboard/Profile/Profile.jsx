import { useEffect, useState } from "react";
import { DeleteIcon, EditIcon, ShareIcon, StarIcon } from "../../../../components/ui/Extras/Icons"
import { ProfileCreator } from "../ProfileCreator/ProfileCreator"
import '/styles/musician/musician-profile.styles.css'
import { OverviewTab } from "./OverviewTab";
import { MusicTab } from "./MusicTab";
import { ReviewsTab } from "./ReviewsTab";

export const Profile = ({ musicianProfile }) => {
    const [activeTab, setActiveTab] = useState('overview'); // State to track the active tab

    const renderActiveTabContent = () => {
        switch (activeTab) {
            case 'overview':
                return <OverviewTab musicianData={musicianProfile} />; 
            case 'music':
                return <MusicTab videos={musicianProfile.videos} tracks={musicianProfile.tracks}/>;
            case 'reviews':
                return <ReviewsTab reviews={musicianProfile.reviews} />;
            default:
                return null;
        }
    };


    return (
        <div className="profile">
            {musicianProfile && musicianProfile.completed ? (
                <div className="profile-view">
                    <div className="profile-banner">
                        <div className="profile-information">
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
                                <div className="genre-tags">
                                    {musicianProfile.genres && musicianProfile.genres.map((genre, index) => (
                                        <div className="genre-tag" key={index}>
                                            {genre}
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                        <div className="profile-actions">
                            <button className="btn secondary">
                                <ShareIcon />
                            </button>
                            <button className="btn secondary">
                                <EditIcon />
                            </button>
                            <button className="btn danger">
                                <DeleteIcon />
                            </button>
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