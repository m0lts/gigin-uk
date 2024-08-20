import { useEffect, useState } from "react";
import { DeleteIcon, EditIcon, ShareIcon, StarIcon } from "../../../../components/ui/Extras/Icons"
import { ProfileCreator } from "../ProfileCreator/ProfileCreator"
import '/styles/musician/musician-profile.styles.css'
import { OverviewTab } from "./OverviewTab";
import { MusicTab } from "./MusicTab";
import { ReviewsTab } from "./ReviewsTab";
import { useNavigate } from "react-router-dom";
import { collection, deleteDoc, doc, getDocs, query, updateDoc, where, arrayRemove } from "firebase/firestore";
import { ref, listAll, deleteObject } from "firebase/storage";
import { firestore, storage } from '../../../../firebase';

export const ProfileTab = ({ musicianProfile }) => {
    const [activeTab, setActiveTab] = useState('overview');
    const [showDeleteModal, setShowDeleteModal] = useState(false);
    const [profileToDelete, setProfileToDelete] = useState(null);

    const navigate = useNavigate()

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

    const editMusicianProfileRedirect = () => {
        navigate('/musician/create-musician-profile', { state: { musicianProfile } });
    }    

    const handleDeleteProfile = (profile) => {
        setProfileToDelete(profile);
        setShowDeleteModal(true);
    };

    const confirmDeleteProfile = async () => {
        if (!profileToDelete) return;
      
        try {
          const musicianRef = doc(firestore, 'musicianProfiles', profileToDelete.musicianId);
          await deleteDoc(musicianRef);
      
          // Remove the venue ID from the user's venueProfiles array
          const userRef = doc(firestore, 'users', profileToDelete.userId);
          await updateDoc(userRef, {
            musicianProfile: arrayRemove(profileToDelete.musicianId)
          });
      
          // Delete all gigs associated with the musician
        //   const gigsQuery = query(collection(firestore, 'gigs'), where('venueId', '==', venueId));
        //   const gigsSnapshot = await getDocs(gigsQuery);
        //   const gigDeletionPromises = gigsSnapshot.docs.map(doc => deleteDoc(doc.ref));
        //   await Promise.all(gigDeletionPromises);

          // Delete all files in Google Cloud Storage associated with the venue
          const storageRef = ref(storage, `musicians/${profileToDelete.musicianId}`);
          const listResults = await listAll(storageRef);
          const deletePromises = listResults.items.map(itemRef => deleteObject(itemRef));
          await Promise.all(deletePromises);
      
          navigate('/musician');
        } catch (error) {
          console.error('An error occurred while deleting the venue:', error);
        } finally {
          setShowDeleteModal(false);
          setProfileToDelete(null);
        }
      };



    return (
        <div className="profile">
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
                        <button className="btn secondary" onClick={editMusicianProfileRedirect}>
                            <EditIcon />
                        </button>
                        <button className="btn danger" onClick={() => handleDeleteProfile(musicianProfile)}>
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

            {showDeleteModal && (
                <div className="modal">
                    <div className="modal-content">
                        <h2>Confirm Profile Deletion</h2>
                        <p style={{ textAlign: 'center' }}>Are you sure you want to delete your musician profile? <br /> This will delete all information associated with this musician profile and cannot be undone.</p>
                        <div className="two-buttons">
                            <button className="btn secondary" onClick={() => setShowDeleteModal(false)}>Cancel</button>
                            <button className="btn danger" onClick={confirmDeleteProfile}>Delete</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};