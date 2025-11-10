import { useEffect, useState, useRef } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { Header as MusicianHeader } from '@features/musician/components/Header';
import { Header as VenueHeader } from '@features/venue/components/Header';
import '@styles/host/venue-page.styles.css';
import { 
    ClubIcon,
    FacebookIcon,
    GuitarsIcon,
    InstagramIcon,
    MicrophoneIcon,
    SpeakersIcon,
    TwitterIcon } from '@features/shared/ui/extras/Icons';
import Skeleton from 'react-loading-skeleton';
import 'react-loading-skeleton/dist/skeleton.css';
import { getVenueProfileById } from '@services/client-side/venues';
import { getGigsByVenueId } from '../../../services/client-side/gigs';
import { useMapbox } from '@hooks/useMapbox';
import 'mapbox-gl/dist/mapbox-gl.css';
import { createVenueRequest, getMusicianProfilesByIds } from '../../../services/client-side/musicians';
import { toast } from 'sonner';
import { AmpIcon, BassIcon, LinkIcon, MonitorIcon, NewTabIcon, PianoIcon, PlugIcon, RequestIcon, SpeakerIcon, VerifiedIcon } from '../../shared/ui/extras/Icons';
import { VenueGigsList } from './VenueGigsList';
import { MapSection } from './MapSection';
import { ensureProtocol } from '../../../services/utils/misc';
import Portal from '../../shared/components/Portal';
import { LoadingModal } from '../../shared/ui/loading/LoadingModal';
import { toJsDate } from '../../../services/utils/dates';
import { useBreakpoint } from '../../../hooks/useBreakpoint';

export const VenuePage = ({ user, setAuthModal, setAuthType }) => {
    const { venueId } = useParams();
    const { isMdUp, isSmUp } = useBreakpoint();
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const musicianId = searchParams.get('musicianId');
    const venueViewing = searchParams.get('venueViewing');
    const [venueData, setVenueData] = useState(null);
    const [venueGigs, setVenueGigs] = useState([]);
    const [loading, setLoading] = useState(true);
    const mapContainerRef = useRef(null);
    const [fullscreenImage, setFullscreenImage] = useState(null);
    const [currentImageIndex, setCurrentImageIndex] = useState(0);
    const [showRequestModal, setShowRequestModal] = useState(false);
    const [requestMessage, setRequestMessage] = useState('');
    const [confirmedGigs, setConfirmedGigs] = useState([]);
    const [expanded, setExpanded] = useState(false);
    const [loadingRequest, setLoadingRequest] = useState(false);
    const [musicianProfiles, setMusicianProfiles] = useState([]);
    const [selectedProfile, setSelectedProfile] = useState(null);

    useEffect(() => {
        if (!venueId) return;
        const fetchVenueAndGigs = async () => {
          setLoading(true);
          try {
            const profile = await getVenueProfileById(venueId);
            setVenueData(profile);
            const gigs = await getGigsByVenueId(venueId);
            const now = new Date();
            const normalized = gigs.map(g => {
              const dt = toJsDate(g.startDateTime);
              return {
                ...g,
                startDateTimeDate: dt,
                startDateTimeMs: dt ? dt.getTime() : Number.NaN,
              };
            });
            const futureGigs = normalized
              .filter(gig => gig.startDateTimeDate && gig.startDateTimeDate > now && gig.status !== 'closed')
              .sort((a, b) => a.startDateTimeMs - b.startDateTimeMs);
            setVenueGigs(futureGigs);
            const confirmed = futureGigs.filter(gig =>
              Array.isArray(gig.applicants) && gig.applicants.some(a => a.status === 'confirmed')
            );
            setConfirmedGigs(confirmed);
          } catch (error) {
            console.error('Error loading venue profile or gigs:', error);
          } finally {
            setLoading(false);
          }
        };
        fetchVenueAndGigs();
      }, [venueId]);

    useEffect(() => {
        if (!venueViewing) return;
        const isMusician = !!user?.musicianProfile?.id;
        const shouldHideVenueView = !user || isMusician;
        if (!shouldHideVenueView) return;
        const params = new URLSearchParams(searchParams);
        params.delete('venueViewing');
        if (isMusician) {
          params.set('musicianId', user.musicianProfile.id);
        } else {
          params.delete('musicianId');
        }
        navigate(
          {
            pathname: `/venues/${venueId}`,
            search: params.toString() ? `?${params.toString()}` : '',
          },
          { replace: true }
        );
      }, [venueViewing, user, searchParams, venueId, navigate]);


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
            setLoadingRequest(true);
          const profile = selectedProfile;
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
        } finally {
            setLoadingRequest(false);
        }
    };

    const copyToClipboard = (venueId) => {
        navigator.clipboard.writeText(`https://giginmusic.com/venues/${venueId}`).then(() => {
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

    const formatEquipmentIcon = (input) => {
        if (input === 'PA System' || input === 'Speakers') {
            return <SpeakersIcon />
        } else if (input === 'Stage Monitors') {
            return <SpeakerIcon />
        } else if (input === 'Guitar Amp' || input === 'Bass Amp') {
            return <AmpIcon />
        } else if (input === 'Mixing/Sound Desk') {
            return <ClubIcon />
        } else if (input === 'DI Boxes') {
            return <PlugIcon />
        } else if (input === 'Cables (XLRs, Jack Leads)') {
            return <LinkIcon />
        } else if (input === 'Guitar') {
            return <GuitarsIcon />
        } else if (input === 'Piano/Keyboard') {
            return <PianoIcon />
        } else if (input === 'Bass') {
            return <BassIcon />
        } else {
            return <MicrophoneIcon />
        }
    }

    const handleFetchMusicianProfiles = async () => {
        try {
            if (!user) return;
            if (user?.bands && user.bands.length > 0 && musicianId) {
                const allIds = [...user.bands, musicianId]
                const profiles = await getMusicianProfilesByIds(allIds);
                setMusicianProfiles(profiles);
                setLoadingRequest(false);
            } else {
                setSelectedProfile(user?.musicianProfile)
                setLoadingRequest(false);
            }
        } catch (error) {
            console.error(error);
            toast.error('Failed to request a gig.')
        }
    }

    const rawOff = venueData?.primaryImageOffsetY;
    let percentFromTop;
    if (rawOff == null) {
    percentFromTop = 50; // sensible default: center
    } else {
    const n = parseFloat(rawOff);
    if (Number.isFinite(n)) {
        // Legacy negative/[-50..0]: map to [0..50] via 50 + n
        percentFromTop = n <= 0 ? Math.max(0, Math.min(100, 50 + n))
                                : Math.max(0, Math.min(100, n));
    } else {
        percentFromTop = 50;
    }
    }

    function ImageCarousel({ photos = [], altBase = '' }) {
        const trackRef = useRef(null);
        const [index, setIndex] = useState(0);
        const total = photos.length || 1;
        
        useEffect(() => {
            const el = trackRef.current;
            if (!el) return;
          
            let to;
            const compute = () => {
              const i = Math.round(el.scrollLeft / el.clientWidth);
              setIndex(prev => (prev !== i ? i : prev));
            };
          
            const onScrollEnd = () => compute();
            const onScrollFallback = () => {
              clearTimeout(to);
              to = setTimeout(compute, 80); // debounce
            };
          
            if ('onscrollend' in window) {
              el.addEventListener('scrollend', onScrollEnd);
              return () => el.removeEventListener('scrollend', onScrollEnd);
            } else {
              el.addEventListener('scroll', onScrollFallback, { passive: true });
              return () => {
                clearTimeout(to);
                el.removeEventListener('scroll', onScrollFallback);
              };
            }
        }, []);

        useEffect(() => {
            const el = trackRef.current;
            if (!el || !('ResizeObserver' in window)) return;
            const ro = new ResizeObserver(() => {
                el.scrollTo({ left: el.clientWidth * index, behavior: 'auto' });
            });
            ro.observe(el);
            return () => ro.disconnect();
        }, [index]);
    
      
        if (!photos?.length) {
          return (
            <figure className="img single">
              <img src="/placeholder.jpg" alt={`${altBase} photo`} />
            </figure>
          );
        }
      
        return (
          <div className="img-carousel" aria-roledescription="carousel" aria-label="Venue photos">
            <div
              className="img-track"
              ref={trackRef}
              role="group"
              aria-live="polite"
            >
              {photos.map((src, i) => (
                <figure className="img slide" key={i}>
                  <img src={src} alt={`${altBase} photo ${i + 1} of ${total}`} />
                </figure>
              ))}
            </div>
      
              <div className="img-count">
                <span>{index + 1}/{total}</span>
              </div>
          </div>
        );
    }

    const checkRequestModal = () => {
        if (musicianId) {
            setLoadingRequest(true);
            setShowRequestModal(true);
            handleFetchMusicianProfiles();
        } else if (!musicianId && user) {
            const musicianProfile = user?.musicianProfile;
            const venueProfile = user?.venueProfiles?.[0];
            const isVenueOwner = venueId === venueProfile?.venueId;
            if (musicianProfile) {
                const isMusician = !!user?.musicianProfile?.id;
                const shouldHideVenueView = !user || isMusician;
                if (!shouldHideVenueView) return;
                const params = new URLSearchParams(searchParams);
                params.delete('venueViewing');
                if (isMusician) {
                  params.set('musicianId', user.musicianProfile.id);
                } else {
                  params.delete('musicianId');
                }
                navigate(
                    {
                      pathname: `/venues/${venueId}`,
                      search: params.toString() ? `?${params.toString()}` : '',
                    },
                    { replace: true }
                );
                setLoadingRequest(true);
                setShowRequestModal(true);
                handleFetchMusicianProfiles();
            } else if (venueProfile && isVenueOwner) {
                const params = new URLSearchParams(searchParams);
                params.set('venueViewing', true);
                navigate(
                    {
                      pathname: `/venues/${venueId}`,
                      search: params.toString() ? `?${params.toString()}` : '',
                    },
                    { replace: true }
                );
                return;
            } else {
                toast.info('You are signed in as a venue owner. Please sign in as a musician to request a gig.');
                return;
            }
        } else if (!user) {
            sessionStorage.setItem('redirect', `venues/${venueId}`);
            setAuthModal(true);
            setAuthType('login');
            return;
        } else {
            return;
        }
    }


    return (
        <div className='venue-page'>
            {user?.venueProfiles?.length > 0 && (!user.musicianProfile) ? (
                <VenueHeader
                    user={user}
                    setAuthModal={setAuthModal}
                    setAuthType={setAuthType}
                />
            ) : (
                <MusicianHeader
                    user={user}
                    setAuthModal={setAuthModal}
                    setAuthType={setAuthType}
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
                    isMdUp ? (
                        <>
                            <div className='venue-page-hero'>
                                <img
                                    src={venueData?.photos[0]}
                                    alt={venueData?.name}
                                    className='background-image'
                                    style={{
                                        // 0% = top, 50% = center, 100% = bottom
                                        objectPosition: `50% ${50 - percentFromTop}%`,
                                        transition: 'object-position 0.3s ease-out',
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
                                    {!venueViewing ? (
                                        <div className="action-buttons">
                                            <button className="btn quaternary" onClick={() => checkRequestModal()}>
                                                Request a Gig
                                            </button>
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
                            <div className="venue-page-information" style={{ width: `95%`, margin: '0 auto'}}>
                                <div className="venue-page-details">
                                    <div className="section bio">
                                        <h2>Bio</h2>
                                        <p>{venueData?.description}</p>
                                    </div>
                                    <div className="section secondary-information">
                                        <div className="info-box location">
                                            <h2>Location</h2>
                                            <MapSection venueData={venueData} />
                                            <h5>{venueData?.address}</h5>
                                            <button className="btn tertiary" onClick={() => openGoogleMaps(venueData.address, venueData.coordinates)}>
                                                Get Directions <NewTabIcon />
                                            </button>
                                        </div>
                                        <div className="info-box equipment">
                                            <div className="info-box-header" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between'}}>
                                                <h2>Equipment at {venueData.name}</h2>
                                                <button className="btn text" onClick={() => setExpanded(!expanded)}>
                                                    {expanded ? 'Hide' : 'Show'}
                                                </button>
                                            </div>
                                            {expanded && venueData.type === 'Public Establishment' && (
                                                venueData.equipment.map((e) => (
                                                    <span className="equipment-item" key={e}>
                                                        {formatEquipmentIcon(e)}
                                                        {e}
                                                    </span>
                                                ))
                                            )}
                                        </div>
                                        {venueData?.website && (
                                            <div className="info-box website">
                                                <h2>Website</h2>
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
                                                <h2>Socials</h2>
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
                                            <h2>Photos</h2>
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
                                    {/* <VenueGigsList title={'Upcoming'} gigs={confirmedGigs} isVenue={venueViewing} musicianId={musicianId} venueId={venueId} /> */}
                                </div>
                            </div>
                        </>
                    ) : (
                        <>
                            <div className='venue-page-hero'>
                                <ImageCarousel
                                    photos={venueData?.photos}
                                    altBase={venueData?.name}
                                />
                            </div>
                            <div className="venue-page-information">
                                <div className="section">
                                    <div className={`highlights ${!venueData?.verified && 'single'}`}>
                                        {venueData?.verified && (
                                            <div className="verified-tag">
                                                <VerifiedIcon />
                                                <h4>Verified Venue</h4>
                                            </div>
                                        )}
                                        <h4 className="number-of-gigs">
                                            {venueData?.gigs?.length} Gigs Posted
                                        </h4>
                                    </div>
                                    <h1 className="venue-name">
                                        {venueData?.name}
                                        <span className='orange-dot'>.</span>
                                    </h1>
                                    {(musicianId && !venueViewing) ? (
                                        <div className="action-buttons">
                                            <button className="btn secondary" onClick={() => {setLoadingRequest(true); setShowRequestModal(true); handleFetchMusicianProfiles()}}>
                                                Request a Gig
                                            </button>
                                        </div>
                                    ) : venueViewing && (
                                        <div className="action-buttons">
                                            <button className="btn secondary" onClick={() => navigate(`/venues/add-venue`, {state: { venue: venueData }})}>
                                                Edit Profile
                                            </button>
                                            <button className="btn secondary" onClick={() => copyToClipboard(venueData.venueId)}>
                                                Share
                                            </button>
                                        </div>
                                    )}
                                </div>
                                <div className="section venue-page-gigs">
                                    <VenueGigsList title={'Gig Vacancies'} gigs={venueGigs} isVenue={venueViewing} musicianId={musicianId} venueId={venueId} />
                                </div>
                                {venueData?.description && (
                                    <div className="section">
                                        <h4 className='subtitle'>Bio</h4>
                                        <p>{venueData?.description}</p>
                                    </div>
                                )}
                                <div className="section location">
                                    <h4 className='subtitle'>Location</h4>
                                    <MapSection venueData={venueData} />
                                    <h5>{venueData?.address}</h5>
                                    <button className="btn tertiary" onClick={() => openGoogleMaps(venueData.address, venueData.coordinates)}>
                                        Get Directions <NewTabIcon />
                                    </button>
                                </div>
                                {venueData.equipment.length > 0 && (
                                    <div className="section equipment">
                                        <h4>Equipment at {venueData.name}</h4>
                                        <div className="equipment-list">
                                            {venueData.type === 'Public Establishment' && (
                                                venueData.equipment.map((e) => (
                                                    <span className="equipment-item" key={e}>
                                                        {formatEquipmentIcon(e)}
                                                        {e}
                                                    </span>
                                                ))
                                            )}
                                        </div>
                                    </div>
                                )}
                                {venueData?.website && (
                                    <div className="section">
                                        <h4 className='subtitle'>Website</h4>
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
                                    <div className="section">
                                        <h4 className='subtitle'>Socials</h4>
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
                        </>
                    )
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
                loadingRequest ? (
                    <Portal>
                        <LoadingModal />
                    </Portal>
                ) : (
                    <Portal>
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
                                <div className="modal-body form">
                                    {musicianProfiles.length > 0 && (
                                        <div className="input-group">
                                            <select
                                            value={selectedProfile?.id || ""}
                                            onChange={(e) => {
                                                const profileId = e.target.value;
                                                const profile = musicianProfiles.find(p => p.id === profileId);
                                                setSelectedProfile(profile || null);
                                            }}
                                            className='select'
                                            >
                                            <option value="">-- Select a profile --</option>
                                            {musicianProfiles.map((profile) => (
                                                <option key={profile.id} value={profile.id}>
                                                {profile.name}
                                                </option>
                                            ))}
                                            </select>
                                        </div>
                                    )}
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
                                        <button className="btn primary" onClick={() => handleMusicianRequest(selectedProfile)}>
                                            Request To Play Here
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </Portal>
                )
            )}
        </div>
    );
};