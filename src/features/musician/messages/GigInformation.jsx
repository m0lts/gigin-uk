import { useEffect, useState, useRef } from 'react'
import mapboxgl from 'mapbox-gl';
import 'react-loading-skeleton/dist/skeleton.css';
import { 
    BackgroundMusicIcon,
    MicrophoneIcon,
    ClubIcon,
    PeopleGroupIcon,
    InviteIcon,
    SpeakersIcon,
    GuitarsIcon,
    TicketIcon,
    HouseIconLight,
    MicrophoneLinesIcon } from '@features/shared/ui/extras/Icons';
import { getGigById } from '@services/gigs';
import { getVenueProfileById } from '@services/client-side/venues';
import { useMapbox } from '@hooks/useMapbox';
import { formatDate } from '@services/utils/dates';
import { formatDurationSpan } from '@services/utils/misc';
import { WeddingIcon } from '@features/shared/ui/extras/Icons';

export const GigInformation = ({ gigId, gigData, setGigData }) => {

    const [venueProfile, setVenueProfile] = useState();
    const mapContainerRef = useRef(null);

    useMapbox({
        containerRef: mapContainerRef,
        coordinates: gigData?.coordinates,
        zoom: 15,
        markers: gigData ? [gigData] : [],
      });

    useEffect(() => {
        const fetchGigInfo = async () => {
            try {
                const gig = await getGigById(gigId);
                if (gig) {
                    setGigData(gig);
                    const venue = await getVenueProfileById(gig.venueId);
                    if (venue) {
                        setVenueProfile(venue);
                    } else {
                        console.error('No such venue!');
                    }
                } else {
                    console.error('No such gig!');
                }
            } catch (error) {
                console.error('Error fetching gig or venue data:', error);
            }
        };
        if (gigId) {
            fetchGigInfo();
        }
    }, [gigId]);

    const performerIcon = (input) => {
        if (input === 'Musician') {
            return <MicrophoneIcon />
        } else if (input === 'Band') {
            return <PeopleGroupIcon />
        } else {
            return <ClubIcon />
        }
    }

    const privacyIcon = (input) => {
        if (input === 'Public') {
            return <PeopleGroupIcon />
        } else {
            return <InviteIcon />
        }
    }

    const typeIcon = (input) => {
        if (input === 'Background Music') {
            return <BackgroundMusicIcon />
        } else if (input === 'Live Music') {
            return <GuitarsIcon />
        } else if (input === 'Ticketed Gig') {
            return <TicketIcon />
        } else if (input === 'House Party') {
            return <HouseIconLight />
        } else if (input === 'Wedding') {
            return <WeddingIcon />
        } else {
            <MicrophoneLinesIcon />
        }
    }

    const formatGenres = (genres) => {
        if (genres.length === 0) return '';
        if (genres.length === 1) return genres[0];
        const copiedGenres = [...genres];
        const lastGenre = copiedGenres.pop();
        return `${copiedGenres.join(', ')} or ${lastGenre}`;
    };

    if (gigData) {
        return (
            <>
                <div className='venue'>
                    <h2>{gigData.gigName}</h2>
                    <figure className='photo'>
                        <img src={gigData.venue.photo} alt={`${gigData.venue.venueName} Photo`} />
                    </figure>
                </div>
                <div className='primary-info'>
                    <h3>{gigData.venue.venueName}</h3>
                    <div className="date-and-time">
                        <h4>{formatDurationSpan(gigData.startTime, gigData.duration)}, {formatDate(gigData.date)}</h4>
                    </div>
                </div>
                <div className='location'>
                    <h5>{gigData.venue.address}</h5>
                </div>
                {(gigData.kind !== 'Ticketed Gig' && gigData.kind !== 'Open Mic') && (
                    <div className='budgets'>
                        <div className='budget-container'>
                            <h6>{gigData.agreedFee ? 'Gig Fee' : 'Venue Budget'}</h6>
                            <h2 style={{ textDecoration: gigData.negotiatedFee ? 'line-through' : 'none' }}>{gigData.agreedFee ? gigData.agreedFee : gigData.budget}</h2>                    </div>
                        {gigData.negotiatedFee && (
                            <div className='budget-container'>
                                <h6>Negotiated Fee:</h6>
                                <h2>£{gigData.negotiatedFee}</h2>
                            </div>
                        )}
                    </div>
                )}
                <div className='details'>
                    <div className='details-list'>
                        <div className='detail'>
                            <h6>Type</h6>
                            <div className='data'>
                                <p>{gigData.kind}</p>
                            </div>
                        </div>
                        {gigData.genre.length > 0 ? (
                            <div className='detail'>
                                <h6>Genres</h6>
                                <div className='data'>
                                    <p>{formatGenres(gigData.genre)}</p>
                                </div>
                            </div>
                        ) : (
                            <div className='detail'>
                                <h6>Genres</h6>
                                <div className='data'>
                                    <p>No Preference</p>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
                <div className='map'>
                    <div ref={mapContainerRef} className='map-container' style={{ height: '100%', width: '100%', borderRadius: '10px' }} />
                </div>
            </>
        )
    }

}