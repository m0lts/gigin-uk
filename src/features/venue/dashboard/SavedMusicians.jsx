import { useEffect, useState } from 'react'
import { collection, getDocs, query, where, documentId } from 'firebase/firestore';
import { firestore } from '@lib/firebase';
import { useLocation, useNavigate } from 'react-router-dom';
import { getMusicianProfilesByIds } from '@services/musicians';
import { openInNewTab } from '@services/utils/misc';

export const SavedMusicians = ({ user }) => {
    const navigate = useNavigate();
    
    const [savedMusicians, setSavedMusicians] = useState([]);

    useEffect(() => {
        const fetchSavedMusicians = async () => {
          if (!user?.savedMusicians || user.savedMusicians.length === 0) return;
          try {
            const musiciansData = await getMusicianProfilesByIds(user.savedMusicians);
            setSavedMusicians(musiciansData);
          } catch (error) {
            console.error('Error fetching saved musicians:', error);
          }
        };
        fetchSavedMusicians();
      }, [user]);

    return (
        <>
        <div className='head'>
            <h1 className='title'>Saved Musicians</h1>
            <button 
                className='btn primary' 
                onClick={() => navigate('/venues/dashboard/musicians/find')}
            >
                Find Musicians
            </button>
        </div>
        <div className='body musicians'>
            {savedMusicians.length > 0 ? (
                <div className='saved-musicians'>
                    {savedMusicians.map((musician) => (
                        <div className='musician-card' key={musician.id} onClick={() => openInNewTab(`/${musician.id}/null`)}>
                            <figure className='photo'>
                                <img src={musician.picture} alt={musician.name} />
                            </figure>
                            <h3>{musician.name}</h3>
                            <h4>{musician.musicianType}</h4>
                        </div>
                    ))}
                </div>
            ) : (
                <h4>You have no saved musicians.</h4>
            )}
        </div>
    </>

    )
}