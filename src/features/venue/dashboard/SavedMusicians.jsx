import { useEffect, useState } from 'react'
import { collection, getDocs, query, where, documentId } from 'firebase/firestore';
import { firestore } from '@lib/firebase';
import { useLocation, useNavigate } from 'react-router-dom';
import { getMusicianProfilesByIds } from '@services/musicians';
import { openInNewTab } from '@services/utils/misc';
import { toast } from 'sonner';
import { ErrorIcon, NewTabIcon, PlayIcon, SaveIcon, SavedIcon, StarIcon } from '../../shared/ui/extras/Icons';
import Skeleton from 'react-loading-skeleton';
import { removeMusicianFromUser } from '../../../services/venues';

const VideoModal = ({ video, onClose }) => {
    return (
        <div className='modal'>
            <div className='modal-content transparent'>
                <span className='close' onClick={onClose}>&times;</span>
                <video controls autoPlay style={{ width: '100%' }}>
                    <source src={video.file} type='video/mp4' />
                    Your browser does not support the video tag.
                </video>
            </div>
        </div>
    );
};

export const SavedMusicians = ({ user }) => {
    const navigate = useNavigate();
    const [showModal, setShowModal] = useState(false);
    const [video, setVideo] = useState(null);
    const [savedMusicians, setSavedMusicians] = useState([]);
    const [noSavedMusicians, setNoSavedMusicians] = useState(false);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        const fetchSavedMusicians = async () => {
            setLoading(true);
            if (!user?.savedMusicians || user.savedMusicians.length === 0) {
                setNoSavedMusicians(true);
            };
            try {
                const musiciansData = await getMusicianProfilesByIds(user.savedMusicians);
                setSavedMusicians(musiciansData);
                setLoading(false);
            } catch (error) {
                console.error('Error fetching saved musicians:', error);
                toast.error('Error loading saved musicians. Please try again.')
            }
        };
        fetchSavedMusicians();
      }, [user]);

    if (noSavedMusicians) {
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
            <div className='body musicians no-saved'>
                <h2>You have no saved musicians.</h2>
                <br />
                <h4>When you save a musician, their profile will appear here.</h4>
            </div>
        </>
        )
    }

    const handleMusicianUnsave = async (musician) => {
        if (!user?.uid || !musician?.id) return;
        try {
          await removeMusicianFromUser(user.uid, musician.id);
          toast.success(`Removed ${musician.name} from your saved musicians`);
        } catch (error) {
          console.error('Error unsaving musician:', error);
          toast.error('Failed to unsave musician. Please try again.');
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
            <h1 className='title'>Saved Musicians</h1>
            <button 
                className='btn primary' 
                onClick={() => navigate('/venues/dashboard/musicians/find')}
            >
                Find Musicians
            </button>
        </div>
        <div className='body musicians'>
            {!loading ? (
                <div className='saved-musicians'>
                    {savedMusicians.map((musician) => {
                        if (!musician) return null;

                        const {
                            id,
                            name = 'Unnamed',
                            picture,
                            genres = [],
                            musicianType = '',
                            videos = [],
                            avgReviews,
                            totalEarnings,
                            followers,
                        } = musician;

                        const firstVideo = videos[0];
                        const videoSrc =
                        typeof firstVideo === 'string'
                            ? firstVideo
                            : firstVideo?.file || firstVideo?.url || null;
                        const videoThumb =
                        typeof firstVideo === 'object' ? firstVideo?.thumbnail : undefined;

                        const completedMusician =
                        !!videoSrc && genres.length > 0 && !!musicianType;

                        return (
                        <div className='musician-card' key={id}>
                            <div className={`media-container empty`}>
                                <figure className="profile-picture-only">
                                    <img src={picture} alt={name} />
                                </figure>
                            </div>

                            <div className="musician-card-flex">
                                <div className="musician-name-type">
                                    <h2>{name}</h2>
                                    <p>{musicianType}</p>
                                </div>
                                <button className="btn icon" onClick={() => handleMusicianUnsave(musician)}>
                                    <SavedIcon />
                                </button>
                            </div>

                            {genres.length > 0 && (
                                <div className="genre-tags">
                                    {genres.map((g) => (
                                    <span className="genre-tag" key={g}>{g}</span>
                                    ))}
                                </div>
                            )}

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
                                onClick={(e) => openInNewTab(`/${encodeURIComponent(id)}/null`, e)}
                                disabled={!id}
                            >
                                <span>Open Profile</span>
                                <NewTabIcon />
                            </button>
                        </div>
                        );
                    })}
                </div>
            ) : (
                <div className='saved-musicians'>
                {Array.from({ length: user?.savedMusicians?.length || 0 }).map((_, index) => (
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