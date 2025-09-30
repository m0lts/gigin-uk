import { useCallback, useEffect, useRef, useState, useMemo } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom';
import { openInNewTab } from '@services/utils/misc';
import { NewTabIcon, NoImageIcon, PlayIcon, SaveIcon, SavedIcon, SearchIcon, StarIcon } from '../../shared/ui/extras/Icons';
import Skeleton from 'react-loading-skeleton';
import { fetchMusiciansPaginated } from '../../../services/client-side/musicians';
import { toast } from 'sonner';


const VideoModal = ({ video, onClose }) => {
    return (
        <div className='modal' onClick={onClose}>
            <div className='modal-content transparent' onClick={(e) => e.stopPropagation()}>
                <span className='close' onClick={onClose}>&times;</span>
                <video controls autoPlay style={{ width: '100%' }}>
                    <source src={video.file} type='video/mp4' />
                    Your browser does not support the video tag.
                </video>
            </div>
        </div>
    );
};

export const FindMusicians = ({ user }) => {
    const navigate = useNavigate();
    const [showModal, setShowModal] = useState(false);
    const [video, setVideo] = useState(null);
    const [musicians, setMusicians] = useState([]);
    const [loading, setLoading] = useState(false);
    const [searchParams, setSearchParams] = useSearchParams();
    const searchQuery = searchParams.get('search') || '';
    const selectedType = searchParams.get('type') || '';
    const rawGenres = searchParams.get('genres') || '';
    const selectedGenres = useMemo(() => rawGenres.split(',').filter(Boolean), [rawGenres]);
    const [lastDocId, setLastDocId] = useState(null);
    const [hasMore, setHasMore] = useState(true);
    
    const fetchMusicians = useCallback(async (reset = false) => {
        if ((loading && !reset) || (!hasMore && !reset)) return;
        setLoading(true);
        try {
            const { musicians: newMusicians, lastDocId: newLastId } =
            await fetchMusiciansPaginated({
              lastDocId: reset ? null : lastDocId,
              limitCount: 50,
              type: selectedType,
              genres: selectedGenres,      // array ([]) when none
              search: searchQuery.trim(),  // trim for safety
            });
          setMusicians(prev => reset ? newMusicians : [...prev, ...newMusicians]);
          setLastDocId(newLastId);
          if (newMusicians.length < 50) setHasMore(false);
        } catch (err) {
          console.error('Error fetching musicians:', err);
        } finally {
          setLoading(false);
        }
      }, [loading, hasMore, lastDocId, selectedType, selectedGenres, searchQuery]);
    
      useEffect(() => {
        fetchMusicians();
      }, [fetchMusicians]);

      useEffect(() => {
        const el = document.querySelector('.saved-musicians');
        if (!el) return;
        const handleScroll = () => {
          const nearBottom = el.scrollHeight - el.scrollTop <= el.clientHeight + 100;
          if (nearBottom) {
            fetchMusicians();
          }
        };
        el.addEventListener('scroll', handleScroll);
        return () => el.removeEventListener('scroll', handleScroll);
      }, [fetchMusicians]);

      useEffect(() => {
        setLastDocId(null);
        setHasMore(true);
        setMusicians([]);
        const timeout = setTimeout(() => {
            fetchMusicians(true);
        }, 0);
    
        return () => clearTimeout(timeout);
    }, [selectedType, selectedGenres, searchQuery]);

    const updateParam = (key, value) => {
        const newParams = new URLSearchParams(searchParams);
        if (value && value.length !== 0) {
            newParams.set(key, Array.isArray(value) ? value.join(',') : value);
        } else {
            newParams.delete(key);
        }
        setSearchParams(newParams);
    };

    const closeVideoModal = () => {
        setShowModal(false);
        setVideo(null);
    }

    const handleMusicianSave = async (musician) => {
        if (!user?.uid || !musician?.id) return;
        try {
            await updateUserArrayField('savedMusicians', 'add', musician.id);
          toast.success(`Saved ${musician.name} to your list`);
        } catch (error) {
          console.error('Error toggling saved musician:', error);
          toast.error('Something went wrong. Please try again.');
        }
      };

    const handleMusicianUnsave = async (musician) => {
        if (!user?.uid || !musician?.id) return;
        try {
          await updateUserArrayField('savedMusicians', 'remove', musician.id);
          toast.success(`Removed ${musician.name} from your saved musicians`);
        } catch (error) {
          console.error('Error unsaving musician:', error);
          toast.error('Failed to unsave musician. Please try again.');
        }
    };

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
                <div className="status-buttons">
                    <button className={`btn ${selectedType === '' ? 'active' : ''}`} onClick={() => updateParam('type', '')}>All</button>
                    <button className={`btn ${selectedType === 'Musician' ? 'active' : ''}`} onClick={() => updateParam('type', 'Musician')}>Musician</button>
                    <button className={`btn ${selectedType === 'Band' ? 'active' : ''}`} onClick={() => updateParam('type', 'Band')}>Band</button>
                    <button className={`btn ${selectedType === 'DJ' ? 'active' : ''}`} onClick={() => updateParam('type', 'DJ')}>DJ</button>
                </div>

                    <select
                        value={rawGenres}
                        onChange={(e) => {
                            const v = e.target.value;
                            updateParam('genres', v === 'Any' ? '' : v);
                        }}
                    >
                    <option value="">Any</option>
                    <option value="Rock">Rock</option>
                    <option value="Jazz">Jazz</option>
                    <option value="Pop">Pop</option>
                    <option value="Hip-Hop">Hip-Hop</option>
                    <option value="Classical">Classical</option>
                </select>

                <div className="search-bar-container">
                    <SearchIcon />
                    <input
                        type='text'
                        placeholder='Search By Name...'
                        value={searchQuery}
                        onChange={(e) => updateParam('search', e.target.value)} 
                        className='search-bar'
                        aria-label='Search musicians'
                    />
                </div>
            </div>
            {!loading ? (
                <div className='saved-musicians'>
                    {musicians.map((musician) => {
                        if (!musician) return null;

                        const {
                            id,
                            name = 'Unnamed',
                            picture,
                            genres = [],
                            musicianType = '',
                            videos = [],
                        } = musician;

                        const firstVideo = videos[0];
                        const videoSrc =
                        typeof firstVideo === 'string'
                            ? firstVideo
                            : firstVideo?.file || firstVideo?.url || null;

                        return (
                        <div className='musician-card' key={id}>
                            <div className={`media-container empty`}>
                                {picture ? (
                                    <figure className="profile-picture-only">
                                        <img src={picture} alt={name} />
                                    </figure>
                                ) : (
                                    <div className="profile-picture-only empty">
                                        <NoImageIcon />
                                        <h4>No Artist Image</h4>
                                    </div>
                                )}
                            </div>

                            <div className="musician-card-flex">
                                <div className="musician-name-type">
                                    <h2>{name}</h2>
                                </div>
                                <button className="btn icon" onClick={() => user?.savedMusicians?.includes(id) ? handleMusicianUnsave(musician) : handleMusicianSave(musician)}>
                                    {user?.savedMusicians?.includes(id) ? <SavedIcon /> : <SaveIcon />}
                                </button>
                            </div>

                            <button
                                className="btn tertiary"
                                onClick={(e) => openInNewTab(`/${encodeURIComponent(id)}/null`, e)}
                                disabled={!id}
                            >
                                <span>Open Profile</span>
                            </button>
                        </div>
                        );
                    })}
                </div>
            ) : (
                <div className='saved-musicians'>
                {Array.from({ length: 3 }).map((_, index) => (
                    <div className="musician-card-loading" key={index}>
                        <Skeleton width={'100%'} height={400} />
                    </div>
                ))}
                </div>
            )}
            {showModal && <VideoModal video={video} onClose={closeVideoModal} />}
        </div>
    </>
    )
}