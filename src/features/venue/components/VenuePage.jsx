import { useEffect, useState, useRef } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { Header as MusicianHeader } from '@features/musician/components/Header';
import { Header as VenueHeader } from '@features/venue/components/Header';
import '@styles/musician/gig-page.styles.css';
import { 
    BackgroundMusicIcon,
    ClubIcon,
    FacebookIcon,
    GuitarsIcon,
    HouseIcon,
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

export const VenuePage = ({ user, setAuthModal, setAuthType }) => {
    const { venueId } = useParams(); // Get venueId from URL
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const [venueData, setVenueData] = useState(null);
    const [venueGigs, setVenueGigs] = useState([]);
    const [loading, setLoading] = useState(true);
  
    const mapContainerRef = useRef(null);
    const [padding, setPadding] = useState('5%');
    const [fullscreenImage, setFullscreenImage] = useState(null);
    const [width, setWidth] = useState('100%');
  
    useEffect(() => {
      if (!venueId) return;
      const fetchVenueAndGigs = async () => {
        try {
          const profile = await getVenueProfileById(venueId);  
          setVenueData(profile);
          const gigs = await getGigsByVenueId(venueId);
          setVenueGigs(gigs);
        } catch (error) {
          console.error('Error loading venue profile or gigs:', error);
        } finally {
          setLoading(false);
        }
      };
      fetchVenueAndGigs();
    }, [venueId]);

    
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
            <section className='venue-page-body' style={{ width: `${width}`}}>
                {loading ? (
                    <>
                        <div className='head'>
                            <div className='title'>
                                <Skeleton height={40} width={400} />
                            </div>
                        </div>
                        <div className='images'>
                            <Skeleton height={350} width='100%' />
                        </div>
                    </>
                ) : (
                    <>
                        <div className='head'>
                            <div className='title'>
                                <h1>{venueData.venueName}</h1>
                                <p>{getCityFromAddress(venueData.address)}</p>
                            </div>
                            {/* <div className='options'>
                                <button className='btn icon'>
                                    <ShareIcon />
                                </button>
                                <button className='btn icon'>
                                    <SaveIcon />
                                </button>
                            </div> */}
                        </div>
                        <div className='images-and-location'>
                            <div className='main-image'>
                                <figure className='img' onClick={() => handleImageClick(0)}>
                                    <img src={venueData.photos[0]} alt={`${venueData.name} photo`} />
                                    <div className='more-overlay'>
                                        <h2>+{venueData.photos.length - 1}</h2>
                                    </div>
                                </figure>
                            </div>
                            <div className='location'>
                                <div ref={mapContainerRef} className='map-container' style={{ height: '100%', width: '100%' }} />
                            </div>
                        </div>
                        <div className='main'>
                            <div className='venue-info'>
                                <div className='important-info'>
                                    <div className='date-and-time'>
                                        <h2>{venueData.name}</h2>
                                    </div>
                                    <div className='address'>
                                        <h4>{venueData.address}</h4>
                                    </div>
                                </div>
                                <div className='description'>
                                    <h4>Description</h4>
                                    <p>{venueData.description}</p>
                                </div>
                                <div className='extra-info'>
                                    <div className='info'>
                                        <h6>Venue Information</h6>
                                        <div className='text'>
                                            <p>{venueData.extraInformation}</p>
                                        </div>
                                    </div>
                                </div>
                                {venueData.socialMedia && (
                                    <div className='socials'>
                                        <h4 className='subtitle'>Socials</h4>
                                        <div className='links'>
                                            {venueData.socialMedia.facebook && (
                                                <a href={venueData.socialMedia.facebook} target='_blank' rel='noreferrer'>
                                                    <FacebookIcon />
                                                </a>
                                            )}
                                            {venueData.socialMedia.instagram && (
                                                <a href={venueData.socialMedia.instagram} target='_blank' rel='noreferrer'>
                                                    <InstagramIcon />
                                                </a>
                                            )}
                                            {venueData.socialMedia.twitter && (
                                                <a href={venueData.socialMedia.twitter} target='_blank' rel='noreferrer'>
                                                    <TwitterIcon />
                                                </a>
                                            )}
                                        </div>
                                    </div>
                                )}

                            </div>
                            <div className='action-box'>
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

        </div>
    );
};