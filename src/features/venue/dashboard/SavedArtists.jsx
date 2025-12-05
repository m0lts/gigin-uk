import { useEffect, useState } from 'react'
import { collection, getDocs, query, where, documentId } from 'firebase/firestore';
import { firestore } from '@lib/firebase';
import { useLocation, useNavigate } from 'react-router-dom';
import { getArtistProfileById } from '@services/client-side/artists';
import { openInNewTab } from '@services/utils/misc';
import { toast } from 'sonner';
import { ErrorIcon, NewTabIcon, NoImageIcon, PlayIcon, SaveIcon, SavedIcon, StarIcon } from '../../shared/ui/extras/Icons';
import Skeleton from 'react-loading-skeleton';
import { updateUserArrayField } from '@services/api/users';
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

export const SavedArtists = ({ user }) => {
    const navigate = useNavigate();
    const [showModal, setShowModal] = useState(false);
    const [video, setVideo] = useState(null);
    const [savedArtists, setSavedArtists] = useState([]);
    const [noSavedArtists, setNoSavedArtists] = useState(false);
    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(null);

    useEffect(() => {
        const fetchSavedArtists = async () => {
            setLoading(true);
            const savedIds = user?.savedArtists || [];
            if (!Array.isArray(savedIds) || savedIds.length === 0) {
                setNoSavedArtists(true);
                setLoading(false);
                return;
            };
            try {
                const artistsData = await Promise.all(
                  savedIds.map((id) => getArtistProfileById(id))
                );
                setSavedArtists(artistsData.filter(Boolean));
                setLoading(false);
            } catch (error) {
                console.error('Error fetching saved artists:', error);
                toast.error('Error loading saved artists. Please try again.')
            }
        };
        fetchSavedArtists();
      }, [user]);

    if (noSavedArtists) {
        return (
            <>
            <div className='head'>
                <h1 className='title'>Saved Artists</h1>
                <button 
                    className='btn primary' 
                    onClick={() => navigate('/venues/dashboard/artists/find')}
                >
                    Find Artists
                </button>
            </div>
            <div className='body musicians no-saved'>
                <h2>You have no saved artists.</h2>
                <br />
                <h4>When you save an artist, their profile will appear here.</h4>
            </div>
        </>
        )
    }

    const handleArtistUnsave = async (artist) => {
        if (!user?.uid || !artist?.id) return;
        setSaving(artist.id);
        try {
          await updateUserArrayField({ field: 'savedArtists', op: 'remove', value: artist.id });
          toast.success(`Removed ${artist.name} from your saved artists`);
        } catch (error) {
          console.error('Error unsaving artist:', error);
          toast.error('Failed to unsave artist. Please try again.');
        } finally {
            setTimeout(() => {
                setSaving(null);
            }, 1500);
        }
      };

    const formatEarnings = (e) => {
        if (e < 100) return '<£100';
        if (e < 500) return '£100+';
        if (e < 1000) return '£500+';
        if (e < 2500) return '£1k+';
        if (e < 5000) return '£2.5k+';
        return '£5k+';
    };

    const openVideoModal = (video) => {
        setVideo(video);
        setShowModal(true);
    }

    const closeVideoModal = () => {
        setShowModal(false);
        setVideo(null);
    }

    return (
        <>
        <div className='head'>
            <h1 className='title'>Saved Artists</h1>
            <button 
                className='btn primary' 
                onClick={() => navigate('/venues/dashboard/artists/find')}
            >
                Find Artists
            </button>
        </div>
        <div className='body musicians'>
            {!loading ? (
                <div className='saved-musicians'>
                    {savedArtists
                      .filter((artist, index, arr) =>
                        artist?.id ? arr.findIndex((a) => a?.id === artist.id) === index : false
                      )
                      .map((artist) => {
                        if (!artist) return null;

                        const {
                            id,
                            name = 'Unnamed',
                            genres = [],
                            videos = [],
                            totalEarnings,
                            followers,
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
                                        <NoImageIcon />
                                        <h4>No Artist Image</h4>
                                    </div>
                                )}
                            </div>

                            <div className="musician-card-flex">
                                <div className="musician-name-type">
                                    <h2>{name}</h2>
                                    {/* <p>{musicianType}</p> */}
                                </div>
                                <button className="btn icon" onClick={() => handleArtistUnsave(artist)}>
                                    {saving === artist?.id ? <LoadingSpinner marginBottom={0} width={15} height={15} /> : <SavedIcon />}
                                </button>
                            </div>

                            {/* {genres.length > 0 && (
                                <div className="genre-tags">
                                    {genres.map((g) => (
                                    <span className="genre-tag" key={g}>{g}</span>
                                    ))}
                                </div>
                            )} */}

                            {/* <div className="stats-container">
                                {avgReviews?.avgRating ? (
                                    <div className="stats-box avg-rating">
                                    <span className="large-item"><StarIcon />{avgReviews.avgRating}</span>
                                    <span className='text'>avg rating</span>
                                    </div>
                                ) : (
                                    <div className="stats-box avg-rating">
                                    <span className="large-item"><StarIcon />-</span>
                                    <span className='text'>no ratings</span>
                                    </div>
                                )}

                                <span className="spacer"></span>

                                <div className="stats-box earnings">
                                    <span className="large-item">{totalEarnings ? formatEarnings(totalEarnings) : '£0'}</span>
                                    <span className='text'>earned</span>
                                </div>

                                <span className="spacer"></span>

                                <div className="stats-box followers">
                                    <span className="large-item">{followers ?? 0}</span>
                                    <span className="text">followers</span>
                                </div>
                            </div>
                            */}
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
                {Array.from({ length: user?.savedArtists?.length || 0 }).map((_, index) => (
                    <div className="musician-card-loading" key={index}>
                        <Skeleton width={'100%'} height={300} />
                    </div>
                ))}
                </div>
            )}
            {showModal && <VideoModal video={video} onClose={closeVideoModal} />}
        </div>
    </>

    )
}