import { useEffect, useState, useRef } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { Header as MusicianHeader } from '@features/musician/components/Header';
import { Header as VenueHeader } from '@features/venue/components/Header';
import '@styles/host/venue-page.styles.css';
import { 
    BackgroundMusicIcon,
    ClubIcon,
    FacebookIcon,
    GuitarsIcon,
    HouseIconLight,
    InstagramIcon,
    InviteIcon,
    MicrophoneIcon,
    MicrophoneLinesIcon,
    PeopleGroupIcon,
    SpeakersIcon,
    TicketIcon,
    TwitterIcon,
    WeddingIcon } from '@features/shared/ui/extras/Icons';
import { LoadingThreeDots } from '@features/shared/ui/loading/Loading';
import Skeleton from 'react-loading-skeleton';
import 'react-loading-skeleton/dist/skeleton.css';
import { getVenueProfileById } from '@services/venues';
import { getCityFromAddress } from '@services/utils/misc';
import { getGigsByVenueId } from '../../../services/gigs';
import { useResizeEffect } from '@hooks/useResizeEffect';
import { useMapbox } from '@hooks/useMapbox';
import { formatDate } from '@services/utils/dates';
import 'mapbox-gl/dist/mapbox-gl.css';
import { openInNewTab } from '@services/utils/misc';
import { createVenueRequest, getMusicianProfileByMusicianId } from '../../../services/musicians';
import { toast } from 'sonner';
import { getOrCreateConversation } from '../../../services/conversations';
import { CashIcon, MicrophoneIconSolid, NewTabIcon, OptionsIcon, QuestionCircleIcon, RequestIcon, VerifiedIcon } from '../../shared/ui/extras/Icons';
import { VenueGigsList } from './VenueGigsList';
import { MapSection } from './MapSection';
import { ensureProtocol } from '../../../services/utils/misc';

export const VenuePage = ({ user, setAuthModal, setAuthType }) => {
    const { venueId } = useParams();
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const musicianId = searchParams.get('musicianId');
    const venueViewing = searchParams.get('venueViewing');
    const [venueData, setVenueData] = useState(null);
    const [venueGigs, setVenueGigs] = useState([]);
    const [loading, setLoading] = useState(true);
    const mapContainerRef = useRef(null);
    const [padding, setPadding] = useState('5%');
    const [fullscreenImage, setFullscreenImage] = useState(null);
    const [currentImageIndex, setCurrentImageIndex] = useState(0);
    const [width, setWidth] = useState('100%');
    const [showRequestModal, setShowRequestModal] = useState(false);
    const [requestMessage, setRequestMessage] = useState('');
    const [confirmedGigs, setConfirmedGigs] = useState([]);

    useResizeEffect((width) => {
        if (width > 1100) {
          setPadding('10%');
          setWidth('95%');
        } else {
          setPadding('2.5%');
          setWidth('95%');
        }
    });

    useEffect(() => {
        if (!venueId) return;
        const fetchVenueAndGigs = async () => {
            setLoading(true);
            try {
              const profile = await getVenueProfileById(venueId);
              setVenueData(profile);
        
              const gigs = await getGigsByVenueId(venueId);
              const now = new Date();
        
              const futureGigs = gigs
                .filter(gig => {
                  const startDateTime = gig.startDateTime?.toDate?.() ?? gig.startDateTime;
                  const openGigs = gig.status !== 'closed';
                  return (startDateTime > now) && openGigs;
                })
                .sort((a, b) => {
                  const aDate = a.startDateTime?.toDate?.() ?? a.startDateTime;
                  const bDate = b.startDateTime?.toDate?.() ?? b.startDateTime;
                  return aDate - bDate;
                });

                
                setVenueGigs(futureGigs);
                const filterConfirmedGigs = futureGigs
                .filter(gig => {
                    const confirmedApplicant = gig.applicants.some(g => g.status === 'confirmed');
                    return confirmedApplicant;
                })
              setConfirmedGigs(filterConfirmedGigs)
        
            } catch (error) {
              console.error('Error loading venue profile or gigs:', error);
            } finally {
              setLoading(false);
            }
          };
        fetchVenueAndGigs();
    }, [venueId]);


    useMapbox({
        containerRef: mapContainerRef,
        coordinates: venueData?.coordinates,
    });
    

    const closeFullscreen = () => {
        setFullscreenImage(null);
    };

    const showNextImage = (e) => {
        e.stopPropagation();
        setCurrentImageIndex((prevIndex) => (prevIndex + 1) % venueData.photos.length);
        setFullscreenImage(venueData.photos[(currentImageIndex + 1) % venueData.photos.length]);
    };

    const showPrevImage = (e) => {
        e.stopPropagation();
        setCurrentImageIndex((prevIndex) => (prevIndex - 1 + venueData.photos.length) % venueData.photos.length);
        setFullscreenImage(venueData.photos[(currentImageIndex - 1 + venueData.photos.length) % venueData.photos.length]);
    };

    const handleMusicianRequest = async () => {
        try {

          const profile = await getMusicianProfileByMusicianId(musicianId);
          if (!profile) throw new Error('Musician profile not found');
          await createVenueRequest({
            venueId: venueData.id,
            musicianId: profile.musicianId,
            musicianName: profile.name,
            musicianImage: profile.picture || '',
            musicianGenres: profile.genres || [],
            musicianType: profile.musicianType || null,
            musicianPlays: profile.musicType || null,
            message: requestMessage,
            createdAt: new Date(),
            viewed: false,
          });
          toast.success('Request sent to venue!');
          setRequestMessage('');
          setShowRequestModal(false);
        } catch (err) {
          console.error('Error sending request:', err);
          toast.error('Failed to send request. Please try again.');
        }
    };

    const copyToClipboard = (venueId) => {
        navigator.clipboard.writeText(`https://gigin.ltd/venues/${venueId}`).then(() => {
            toast.success('Link copied to clipboard');
        }).catch((err) => {
            toast.error('Failed to copy link. Please try again.')
            console.error('Failed to copy link: ', err);
        });
    };
    
    const openGoogleMaps = (address, coordinates) => {
        const baseUrl = 'https://www.google.com/maps/dir/?api=1';
        const queryParams = coordinates 
            ? `&destination=${coordinates[1]},${coordinates[0]}`
            : `&destination=${encodeURIComponent(address)}`;
        window.open(baseUrl + queryParams, '_blank');
    };

    return (
        <div className='venue-page'>
            {user?.venueProfiles?.length > 0 && (!user.musicianProfile) ? (
                <VenueHeader
                    user={user}
                    setAuthModal={setAuthModal}
                    setAuthType={setAuthType}
                    padding={padding}
                />
            ) : (
                <MusicianHeader
                    user={user}
                    setAuthModal={setAuthModal}
                    setAuthType={setAuthType}
                    padding={padding}
                />
            )}
            <section className='venue-page-body'>
                {loading ? (
                    <>
                        <div className='images'>
                            <Skeleton height={350} width='100%' />
                        </div>
                        <div className="body" style={{ marginTop: '1rem'}}>
                            <Skeleton height={200} width='100%' />
                        </div>
                    </>
                ) : (
                    <>
                        <div className='venue-page-hero'>
                        <img
  src={venueData?.photos[0]}
  alt={venueData?.name}
  className='background-image'
  style={{
    transform: `translateY(${venueData?.primaryImageOffsetY || 0}px)`,
    transition: 'transform 0.3s ease-out',
  }}
/>
                            <div className="primary-information">
                                {venueData?.verified && (
                                    <div className="verified-tag">
                                        <VerifiedIcon />
                                        <p>Verified Venue</p>
                                    </div>
                                )}
                                <h1 className="venue-name">
                                    {venueData?.name}
                                    <span className='orange-dot'>.</span>
                                </h1>
                                <h4 className="number-of-gigs">
                                    {venueData?.gigs?.length} Gigs Posted
                                </h4>
                                {(musicianId && !venueViewing) ? (
                                    <div className="action-buttons">
                                        <button className="btn quaternary" onClick={() => setShowRequestModal(true)}>
                                            Request a Gig
                                        </button>
                                        {/* <button className="btn quaternary">
                                            Message
                                        </button>
                                        <button className="btn icon white">
                                            <OptionsIcon />
                                        </button> */}
                                    </div>
                                ) : venueViewing && (
                                    <div className="action-buttons">
                                        <button className="btn quaternary" onClick={() => navigate(`/venues/add-venue`, {state: { venue: venueData }})}>
                                            Edit Profile
                                        </button>
                                        <button className="btn quaternary" onClick={() => copyToClipboard(venueData.venueId)}>
                                            Share
                                        </button>
                                    </div>
                                )}
                            </div>
                        </div>
                        <div className="venue-page-information" style={{ width: `${width}`, margin: '0 auto'}}>
                            <div className="venue-page-details">
                                <div className="section bio">
                                    <h3>Bio</h3>
                                    <p>{venueData?.description}</p>
                                </div>
                                <div className="section secondary-information">
                                    <div className="info-box location">
                                        <h3>Location</h3>
                                        <MapSection venueData={venueData} />
                                        <h5>{venueData?.address}</h5>
                                        <button className="btn tertiary" onClick={() => openGoogleMaps(venueData.address, venueData.coordinates)}>
                                            Get Directions <NewTabIcon />
                                        </button>
                                    </div>
                                    {venueData?.website && (
                                        <div className="info-box website">
                                            <h3>Website</h3>
                                            <a
                                                href={venueData.website.startsWith('http') ? venueData.website : `https://${venueData.website}`}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                            >
                                                <p>{venueData.website}</p>
                                            </a>
                                        </div>
                                    )}
                                    {(venueData?.socialMedia?.facebook !== '' || venueData?.socialMedia?.facebook !== '' || venueData?.socialMedia?.facebook !== '') && (
                                        <div className="info-box socials">
                                            <h3>Socials</h3>
                                            <div className="socials-buttons">
                                                {venueData?.socialMedia?.facebook && (
                                                    <a href={ensureProtocol(venueData.socialMedia.facebook)} target='_blank' rel='noreferrer'>
                                                        <FacebookIcon />
                                                    </a>
                                                )}
                                                {venueData?.socialMedia?.instagram && (
                                                    <a href={ensureProtocol(venueData.socialMedia.instagram)} target='_blank' rel='noreferrer'>
                                                        <InstagramIcon />
                                                    </a>
                                                )}
                                                {venueData?.socialMedia?.twitter && (
                                                    <a href={ensureProtocol(venueData.socialMedia.twitter)} target='_blank' rel='noreferrer'>
                                                        <TwitterIcon />
                                                    </a>
                                                )}
                                            </div>
                                        </div>
                                    )}

                                </div>
                                {venueData?.photos?.length > 1 && (
                                    <div className="section photos">
                                        <h3>Photos</h3>
                                        <div className="photos-collage">
                                        {venueData.photos.map((photo, index) => (
                                            <figure className="collage-item" key={photo}>
                                            <img
                                                src={photo}
                                                alt={venueData.name}
                                                loading="lazy"
                                                decoding="async"
                                            />
                                            </figure>
                                        ))}
                                        </div>
                                    </div>
                                )}
                            </div>
                            <div className="venue-page-gigs">
                                <VenueGigsList title={'Gig Vacancies'} gigs={venueGigs} isVenue={venueViewing} musicianId={musicianId} venueId={venueId} />
                                <VenueGigsList title={'Upcoming'} gigs={confirmedGigs} isVenue={venueViewing} musicianId={musicianId} venueId={venueId} />
                            </div>
                        </div>
                    </>
                )}
                {fullscreenImage && (
                    <div className='fullscreen-overlay' onClick={closeFullscreen}>
                        <span className='arrow left' onClick={showPrevImage}>&#8249;</span>
                        <img src={fullscreenImage} alt='Fullscreen' />
                        <span className='arrow right' onClick={showNextImage}>&#8250;</span>
                    </div>
                )}
            </section>
            {showRequestModal && (
                <div className="modal musician-request" onClick={() => setShowRequestModal(false)}>
                    <div className="modal-content" onClick={(e) => e.stopPropagation()}>
                        <button className='btn close tertiary' onClick={() => setShowRequestModal(false)}>
                            Close
                        </button>
                        <div className="modal-header">
                            <RequestIcon />
                            <h2>Request to perform at {venueData.name}</h2>
                            <p>Send a gig request to the venue. If they accept your request, they'll build a gig for you and you'll automatically be invited.</p>
                        </div>
                        <div className="modal-body">
                            <textarea
                                className="input"
                                rows={3}
                                placeholder="Write a message to the venue..."
                                value={requestMessage}
                                onChange={(e) => setRequestMessage(e.target.value)}
                            />
                            <div className="two-buttons">
                                <button className="btn tertiary" onClick={() => setShowRequestModal(false)}>
                                    Cancel
                                </button>
                                <button className="btn primary" onClick={handleMusicianRequest}>
                                    Request To Play Here
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};