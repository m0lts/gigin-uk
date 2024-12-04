import { useEffect, useState } from "react"
import { collection, getDocs } from "firebase/firestore";
import { firestore } from '../../../firebase';
import { useLocation, useNavigate } from "react-router-dom";
import { LoadingThreeDots } from "../../../components/ui/loading/Loading";

export const FindMusicians = ({ user }) => {

    const [musicians, setMusicians] = useState([]);
    const [searchQuery, setSearchQuery] = useState('');
    const navigate = useNavigate();

    useEffect(() => {
        const fetchMusicians = async () => {
            try {
                const musiciansRef = collection(firestore, 'musicianProfiles');
                const snapshot = await getDocs(musiciansRef);
                const musiciansData = snapshot.docs.map(doc => ({
                    id: doc.id,
                    ...doc.data(),
                }));
                setMusicians(musiciansData);
            } catch (error) {
                console.error('Error fetching musicians:', error);
            }
        };

        fetchMusicians();
    }, [user]);

    const handleSearchChange = (event) => {
        setSearchQuery(event.target.value);
    };

    const filteredMusicians = musicians.filter(musician =>
        musician.name.toLowerCase().includes(searchQuery.toLowerCase())
    );

    const openMusicianProfile = (musicianId) => {
        const url = `/${musicianId}/null`;
        window.open(url, '_blank');
    };

    return (
        <>
        <div className="head">
            <h1 className="title">Find Musicians</h1>
            <button 
                className="btn primary" 
                onClick={() => navigate('/venues/dashboard/musicians')}
            >
                Saved Musicians
            </button>
        </div>
        <div className="body musicians">
            <div className="filters">
                <input 
                    type="text" 
                    placeholder="Search..." 
                    value={searchQuery} 
                    onChange={handleSearchChange} 
                    className="search-bar"
                />
            </div>
            {filteredMusicians.length > 0 ? (
                <div className="saved-musicians">
                    {filteredMusicians.map((musician) => (
                        <div className="musician-card" key={musician.id} onClick={() => openMusicianProfile(musician.id)}>
                            <figure className="photo">
                                <img src={musician.picture} alt={musician.name} />
                            </figure>
                            <h3>{musician.name}</h3>
                            <h4>{musician.musicianType}</h4>
                        </div>
                    ))}
                </div>
            ) : (
                <p>No musicians found.</p>
            )}
        </div>
    </>

    )
}