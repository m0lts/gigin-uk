import { useEffect, useState } from "react"
import { collection, getDocs, query, where, documentId } from "firebase/firestore";
import { firestore } from '../../../firebase';
import { useLocation, useNavigate } from "react-router-dom";

export const SavedMusicians = ({ user }) => {
    const navigate = useNavigate();
    
    const [savedMusicians, setSavedMusicians] = useState([]);

    useEffect(() => {
        const fetchSavedMusicians = async () => {
            if (!user?.savedMusicians || user.savedMusicians.length === 0) {
                return;
            }

            try {
                // Reference to the musicians collection
                const musiciansRef = collection(firestore, 'musicianProfiles');

                // Firestore query to get the saved musicians by their IDs
                const musiciansQuery = query(
                    musiciansRef,
                    where(documentId(), 'in', user.savedMusicians)
                );

                // Fetch the musicians documents
                const snapshot = await getDocs(musiciansQuery);

                // Map the fetched documents into an array of musician data
                const musiciansData = snapshot.docs.map(doc => ({
                    id: doc.id,
                    ...doc.data(),
                }));

                setSavedMusicians(musiciansData);
            } catch (error) {
                console.error('Error fetching saved musicians:', error);
            }
        };

        if (user && user.savedMusicians) {
            fetchSavedMusicians();
        }
    }, [user]);

    const openMusicianProfile = (musicianId) => {
        const url = `/${musicianId}/null`;
        window.open(url, '_blank');
    };

    return (
        <>
        <div className="head">
            <h1 className="title">Saved Musicians</h1>
            <button 
                className="btn secondary" 
                onClick={() => navigate('/venues/dashboard/musicians/find')}
            >
                Find Musicians
            </button>
        </div>
        <div className="body musicians">
            {savedMusicians.length > 0 && (
                <div className="saved-musicians">
                    {savedMusicians.map((musician) => (
                        <div className="musician-card" key={musician.id} onClick={() => openMusicianProfile(musician.id)}>
                            <figure className="photo">
                                <img src={musician.picture} alt={musician.name} />
                            </figure>
                            <h3>{musician.name}</h3>
                            <h4>{musician.musicianType}</h4>
                        </div>
                    ))}
                </div>
            )}
        </div>
    </>

    )
}