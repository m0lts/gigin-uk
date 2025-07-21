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
import { getVenueProfileById } from '@services/venues';
import { useMapbox } from '@hooks/useMapbox';
import { formatDate } from '@services/utils/dates';
import { formatDurationSpan } from '@services/utils/misc';
import { toast } from 'sonner';

export const GigInformation = ({ gigId, gigData, setGigData, venueGigs = [] }) => {

    const [venueProfile, setVenueProfile] = useState();
    const mapContainerRef = useRef(null);

    useMapbox({
        containerRef: mapContainerRef,
        coordinates: gigData?.coordinates,
        zoom: 15,
        markers: gigData ? [gigData] : [],
      });

      useEffect(() => {
        if (!gigId) return;
        const found = venueGigs.find(g => g.id === gigId);
        if (found) {
          setGigData(found);
          setVenueProfile(found.venue);
          return;
        } else {
            toast.error('Error loading gig information.')
        }
      }, [gigId, venueGigs, setGigData]);

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
                    <figure className='photo'>
                        <img src={gigData.venue.photo} alt={`${gigData.venue.venueName} Photo`} />
                    </figure>
                    <h2>{gigData.venue.venueName}</h2>
                </div>
                <div className='date-and-time'>
                    <h3>{formatDate(gigData.date)}</h3>
                    <h3>{formatDurationSpan(gigData.startTime, gigData.duration)}</h3>
                </div>
                <div className='location'>
                    <h4>{gigData.venue.address}</h4>
                </div>
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
                <div className='details'>
                    <div className='details-list'>
                        <div className='detail'>
                            <h6>Performer</h6>
                            <div className='data'>
                                {performerIcon(gigData.gigType)}
                                <p>{gigData.gigType}</p>
                            </div>
                        </div>
                        <div className='detail'>
                            <h6>Audience</h6>
                            <div className='data'>
                                {privacyIcon(gigData.privacy)}
                                <p>{gigData.privacy}</p>
                            </div>
                        </div>
                        <div className='detail'>
                            <h6>Type</h6>
                            <div className='data'>
                                {typeIcon(gigData.kind)}
                                <p>{gigData.kind}</p>
                            </div>
                        </div>
                        {gigData.genre.length > 0 ? (
                            <div className='detail'>
                                <h6>Genres</h6>
                                <div className='data'>
                                    <SpeakersIcon />
                                    <p>{formatGenres(gigData.genre)}</p>
                                </div>
                            </div>
                        ) : (
                            <div className='detail'>
                                <h6>Genres</h6>
                                <div className='data'>
                                    <SpeakersIcon />
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