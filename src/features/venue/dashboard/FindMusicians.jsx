import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom';
import { getAllMusicianProfiles } from '@services/musicians';
import { openInNewTab } from '@services/utils/misc';

export const FindMusicians = ({ user }) => {

    const [musicians, setMusicians] = useState([]);
    const [searchQuery, setSearchQuery] = useState('');
    const navigate = useNavigate();

    useEffect(() => {
        const fetchMusicians = async () => {
            try {
                const musiciansData = await getAllMusicianProfiles();
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

    return (
        <>
        <div className='head'>
            <h1 className='title'>Find Musicians</h1>
            <button 
                className='btn primary' 
                onClick={() => navigate('/venues/dashboard/musicians')}
            >
                Saved Musicians
            </button>
        </div>
        <div className='body musicians'>
            <div className='filters'>
                <input 
                    type='text' 
                    placeholder='Search...' 
                    value={searchQuery} 
                    onChange={handleSearchChange} 
                    className='search-bar'
                />
            </div>
            {filteredMusicians.length > 0 ? (
                <div className='saved-musicians'>
                    {filteredMusicians.map((musician) => (
                        <div className='musician-card' key={musician.id} onClick={(e) => openInNewTab(`/${musician.id}/null`, e)}>
                            <figure className='photo'>
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