import { useCallback, useEffect, useRef, useState, useMemo } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom';
import { openInNewTab } from '@services/utils/misc';
import { NewTabIcon, ImageIcon, PlayIcon, SaveIcon, SavedIcon, SearchIcon, StarIcon } from '../../shared/ui/extras/Icons';
import Skeleton from 'react-loading-skeleton';
import { fetchArtistsPaginated } from '../../../services/client-side/artists';
import { toast } from 'sonner';
import { updateUserArrayField } from '@services/api/users';
import { createArtistCRMEntry, isArtistSavedInCRM, removeArtistFromCRMByArtistId } from '@services/client-side/artistCRM';
import { LoadingSpinner } from '../../shared/ui/loading/Loading';

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

export const FindArtists = ({ user }) => {
    const navigate = useNavigate();
    const [showModal, setShowModal] = useState(false);
    const [video, setVideo] = useState(null);
    const [artists, setArtists] = useState([]);
    const [loading, setLoading] = useState(false);
    const [searchParams, setSearchParams] = useSearchParams();
    const searchQuery = searchParams.get('search') || '';
    const selectedType = searchParams.get('type') || '';
    const rawGenres = searchParams.get('genres') || '';
    const selectedGenres = useMemo(() => rawGenres.split(',').filter(Boolean), [rawGenres]);
    const [lastDocId, setLastDocId] = useState(null);
    const [hasMore, setHasMore] = useState(true);
    const [saving, setSaving] = useState(null);
    const [savedArtistIds, setSavedArtistIds] = useState(new Set());
    
    const normalizedType = useMemo(() => {
      if (selectedType === 'DJ') return 'DJ';
      if (selectedType === 'Musician/Band') return 'Musician/Band';
      return '';
    }, [selectedType]);

    const fetchArtists = useCallback(async (reset = false) => {
        if ((loading && !reset) || (!hasMore && !reset)) return;
        setLoading(true);
        try {
            const { artists: newArtists, lastDocId: newLastId } =
            await fetchArtistsPaginated({
              lastDocId: reset ? null : lastDocId,
              limitCount: 50,
              genres: selectedGenres,      // array ([]) when none
              search: searchQuery.trim(),  // trim for safety
              type: normalizedType,
            });
          setArtists(prev => reset ? newArtists : [...prev, ...newArtists]);
          setLastDocId(newLastId);
          if (newArtists.length < 50) setHasMore(false);
        } catch (err) {
          console.error('Error fetching artists:', err);
        } finally {
          setLoading(false);
        }
      }, [loading, hasMore, lastDocId, selectedGenres, searchQuery, normalizedType]);

      useEffect(() => {
        const el = document.querySelector('.saved-musicians');
        if (!el) return;
        const handleScroll = () => {
          const nearBottom = el.scrollHeight - el.scrollTop <= el.clientHeight + 100;
          if (nearBottom) {
            fetchArtists();
          }
        };
        el.addEventListener('scroll', handleScroll);
        return () => el.removeEventListener('scroll', handleScroll);
      }, [fetchArtists]);

      useEffect(() => {
        setLastDocId(null);
        setHasMore(true);
        setArtists([]);
        fetchArtists(true);
      // We intentionally omit fetchArtists from deps to avoid loops; it already
      // captures selectedGenres/searchQuery via its own dependencies.
      // eslint-disable-next-line react-hooks/exhaustive-deps
      }, [selectedType, selectedGenres, searchQuery]);

      // Load saved artist IDs from CRM
      useEffect(() => {
        const loadSavedArtists = async () => {
          if (!user?.uid) return;
          try {
            const { getArtistCRMEntries } = await import('@services/client-side/artistCRM');
            const entries = await getArtistCRMEntries(user.uid);
            const savedIds = new Set(entries.filter(e => e.artistId).map(e => e.artistId));
            setSavedArtistIds(savedIds);
          } catch (error) {
            console.error('Error loading saved artists:', error);
          }
        };
        loadSavedArtists();
      }, [user?.uid]);

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

    const handleArtistSave = async (artist) => {
        if (!user?.uid || !artist?.id) return;
        setSaving(artist?.id);
        try {
            // Check if already saved
            const alreadySaved = await isArtistSavedInCRM(user.uid, artist.id);
            if (alreadySaved) {
              toast.info(`${artist.name} is already saved.`);
              setSaving(null);
              return;
            }
            
            // Create CRM entry
            await createArtistCRMEntry(user.uid, {
              artistId: artist.id,
              name: artist.name || 'Unknown Artist',
              notes: '',
            });
            
            // Update local state
            setSavedArtistIds(prev => new Set([...prev, artist.id]));
            
            toast.success(`Saved ${artist.name} to your list`);
        } catch (error) {
          console.error('Error saving artist:', error);
          toast.error('Something went wrong. Please try again.');
        } finally {
          setSaving(null);
        }
      };

    const handleArtistUnsave = async (artist) => {
        if (!user?.uid || !artist?.id) return;
        setSaving(artist?.id);
        try {
          const removed = await removeArtistFromCRMByArtistId(user.uid, artist.id);
          if (removed) {
            // Update local state
            setSavedArtistIds(prev => {
              const newSet = new Set(prev);
              newSet.delete(artist.id);
              return newSet;
            });
            toast.success(`Removed ${artist.name} from your saved artists`);
          } else {
            toast.error('Artist not found in your saved list.');
          }
        } catch (error) {
          console.error('Error unsaving artist:', error);
          toast.error('Failed to unsave artist. Please try again.');
        } finally {
          setSaving(null);
        }
    };

    return (
        <>
        <div className='head'>
            <h1 className='title'>Find Artists</h1>
            <button 
                className='btn primary' 
                onClick={() => navigate('/venues/dashboard/artists')}
            >
                My Artists
            </button>
        </div>
        <div className='body musicians'>
            <div className='filters'>
                <div className="status-buttons">
                    <button
                      className={`btn ${selectedType === '' ? 'active' : ''}`}
                      onClick={() => updateParam('type', '')}
                    >
                      All
                    </button>
                    <button
                      className={`btn ${selectedType === 'Musician/Band' ? 'active' : ''}`}
                      onClick={() => updateParam('type', 'Musician/Band')}
                    >
                      Musician/Band
                    </button>
                    <button
                      className={`btn ${selectedType === 'DJ' ? 'active' : ''}`}
                      onClick={() => updateParam('type', 'DJ')}
                    >
                      DJ
                    </button>
                </div>

                    <select
                        value={rawGenres}
                        onChange={(e) => {
                            const v = e.target.value;
                            updateParam('genres', v === 'Genre' ? '' : v);
                        }}
                    >
                    <option value="">Genre</option>
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
                        placeholder='Search Artists By Name...'
                        value={searchQuery}
                        onChange={(e) => updateParam('search', e.target.value)} 
                        className='search-bar'
                        aria-label='Search artists'
                    />
                </div>
            </div>
            {!loading ? (
                <div className='saved-musicians'>
                    {artists
                      .filter((artist, index, arr) =>
                        artist?.id ? arr.findIndex((a) => a?.id === artist.id) === index : false
                      )
                      .map((artist) => {
                        if (!artist) return null;
                        const isComplete = artist?.isComplete;
                        if (!isComplete) return null;

                        const {
                            id,
                            name = 'Unnamed',
                            genres = [],
                            videos = [],
                        } = artist;

                        const heroUrl = artist?.heroMedia?.url || null;
                        const heroPositionY = typeof artist?.heroPositionY === 'number' ? artist.heroPositionY : 50;
                        const imageSrc = heroUrl;

                        return (
                        <div className='musician-card' key={id}>
                            <div className={`media-container empty`}>
                                {imageSrc ? (
                                    <figure className="profile-picture-only">
                                        <img
                                          src={imageSrc}
                                          alt={name}
                                          style={{ objectPosition: `50% ${heroPositionY}%` }}
                                        />
                                    </figure>
                                ) : (
                                    <div className="profile-picture-only empty">
                                        <ImageIcon />
                                        <h4>No Artist Image</h4>
                                    </div>
                                )}
                            </div>

                            <div className="musician-card-flex">
                                <div className="musician-name-type">
                                    <h2>{name}</h2>
                                </div>
                                <button className="btn icon" onClick={() => savedArtistIds.has(id) ? handleArtistUnsave(artist) : handleArtistSave(artist)}>
                                    {saving === id ? (
                                        <LoadingSpinner marginBottom={0} width={15} height={15} />
                                    ) : (
                                        savedArtistIds.has(id) ? <SavedIcon /> : <SaveIcon />
                                    )}
                                </button>
                            </div>

                            <button
                                className="btn tertiary"
                                onClick={(e) => openInNewTab(`/artist/${encodeURIComponent(id)}`, e)}
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