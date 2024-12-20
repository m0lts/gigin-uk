import { useEffect, useState } from "react";
import { DeleteIcon, EditIcon, ShareIcon, StarIcon } from "../../../../components/ui/Extras/Icons"
import { ProfileCreator } from "../ProfileCreator/ProfileCreator"
import '/styles/musician/musician-profile.styles.css'
import { OverviewTab } from "./OverviewTab";
import { MusicTab } from "./MusicTab";
import { ReviewsTab } from "./ReviewsTab";
import { useLocation, useNavigate } from "react-router-dom";
import { collection, deleteDoc, doc, getDocs, query, updateDoc, where, arrayRemove } from "firebase/firestore";
import { ref, listAll, deleteObject } from "firebase/storage";
import { firestore, storage } from '../../../../firebase';

export const ProfileTab = ({ musicianProfile }) => {
    const [activeTab, setActiveTab] = useState('overview');
    const [editingMedia, setEditingMedia] = useState(false);
    const [localVideos, setLocalVideos] = useState(musicianProfile.videos || []);
    const [localTracks, setLocalTracks] = useState(musicianProfile.tracks || []);

    const navigate = useNavigate();
    const location = useLocation();

    const renderActiveTabContent = () => {
        switch (activeTab) {
            case 'overview':
                return <OverviewTab musicianData={musicianProfile} />; 
            case 'music':
                return <MusicTab 
                videos={localVideos}
                tracks={localTracks}
                setVideos={setLocalVideos}
                setTracks={setLocalTracks}
                musicianId={musicianProfile.musicianId} 
                editingMedia={editingMedia} 
                setEditingMedia={setEditingMedia}
                
                />;
            case 'reviews':
                return <ReviewsTab profile={musicianProfile} />;
            default:
                return null;
        }        
    };    

    const editMusicianProfileRedirect = () => {
        navigate('/create-musician-profile', { state: { musicianProfile } });
    }    


    const saveChanges = async () => {
        try {
            const musicianRef = doc(firestore, 'musicianProfiles', musicianProfile.musicianId);
            await updateDoc(musicianRef, {
                videos: localVideos,
                tracks: localTracks,
            });
            setEditingMedia(false);
        } catch (error) {
            console.error('Error saving changes:', error);
            alert('Failed to save changes. Please try again. If the issue persists, contact support.');
        }
    };


    return (
        <div className="profile">
            <div className="profile-view">
                <div className="profile-banner" style={{
                        padding: location.pathname.includes('dashboard') ? '2rem 5%' : '2rem 0',
                    }}>
                    <div className="profile-information">
                        <figure className="profile-picture">
                            <img src={musicianProfile.picture} alt={`${musicianProfile.name}'s Profile Picture`} />
                        </figure>
                        <div className="profile-details">
                            <div className="name">
                                <h1>{musicianProfile.name}</h1>
                                <button className="btn icon" onClick={editMusicianProfileRedirect}>
                                    <EditIcon />
                                </button>
                            </div>
                            <div className="data">
                                {musicianProfile.avgReviews && (
                                    <h6><StarIcon /> {musicianProfile.avgReviews.avgRating} ({musicianProfile.avgReviews.totalReviews})</h6>
                                )}
                                <h6>{musicianProfile.clearedFees && musicianProfile.clearedFees.length || '0'} gigs played</h6>
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
                    {editingMedia && (
                        <button className="btn primary" onClick={saveChanges}>
                            Save Changes
                        </button>
                    )}
                </div>
                <nav className="profile-tabs" style={{
                        margin: location.pathname.includes('dashboard') ? '0 5%' : undefined,
                    }}>
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
                <div className="profile-sections" style={{
                        margin: location.pathname.includes('dashboard') ? '0 5%' : undefined,
                    }}>
                    {renderActiveTabContent()}
                </div>
            </div>
        </div>
    );
};