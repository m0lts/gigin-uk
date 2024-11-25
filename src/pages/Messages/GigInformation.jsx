import { useEffect, useState, useRef } from "react"
import { getDoc, doc } from 'firebase/firestore';
import { firestore } from "../../firebase";
import mapboxgl from 'mapbox-gl';
import 'react-loading-skeleton/dist/skeleton.css';
import { LocationPinIcon, BackgroundMusicIcon, BeerIcon, MicrophoneIcon, ClubIcon, PeopleGroupIcon, InviteIcon, SpeakersIcon, GuitarsIcon, TicketIcon, HouseIcon, MicrophoneLinesIcon } from "../../components/ui/Extras/Icons";

export const GigInformation = ({ gigId, gigData, setGigData }) => {

    const [venueProfile, setVenueProfile] = useState();
    const mapContainerRef = useRef(null);

    useEffect(() => {
        const fetchGigInfo = async () => {
            try {
                const gigRef = doc(firestore, 'gigs', gigId);
                const gigSnapshot = await getDoc(gigRef);
                if (gigSnapshot.exists()) {
                    const gig = gigSnapshot.data();
                    setGigData(gig);

                    // Fetch venue profile data
                    const venueRef = doc(firestore, 'venueProfiles', gig.venueId);
                    const venueSnapshot = await getDoc(venueRef);
                    if (venueSnapshot.exists()) {
                        setVenueProfile(venueSnapshot.data());
                    } else {
                        console.error('No such venue!');
                    }
                } else {
                    console.error('No such gig!');
                }
            } catch (error) {
                console.error('Error fetching gig or venue data:', error);
            }
        }

        if (gigId) {
            fetchGigInfo();
        }
    }, [gigId])


    const getCityFromAddress = (address) => {
        const parts = address.split(',');
        return parts.length >= 3 ? parts[parts.length - 3].trim() : address;
    };

    const formatDate = (timestamp) => {
        const date = timestamp.toDate();
        const day = date.getDate();
        const weekday = date.toLocaleDateString('en-GB', { weekday: 'long' });
        const month = date.toLocaleDateString('en-GB', { month: 'long' });
        return `${weekday} ${day}${getOrdinalSuffix(day)} ${month}`;
    };

    const getOrdinalSuffix = (day) => {
        if (day > 3 && day < 21) return 'th';
        switch (day % 10) {
            case 1: return 'st';
            case 2: return 'nd';
            case 3: return 'rd';
            default: return 'th';
        }
    };

    const formatDurationSpan = (startTime, duration) => {
        const [startHours, startMinutes] = startTime.split(':').map(Number);
        const startDate = new Date();
        startDate.setHours(startHours, startMinutes, 0, 0);
    
        const endDate = new Date(startDate.getTime() + duration * 60000);
    
        const formatTime = (date) => {
            const hours = date.getHours().toString().padStart(2, '0');
            const minutes = date.getMinutes().toString().padStart(2, '0');
            return `${hours}:${minutes}`;
        };
    
        return `${formatTime(startDate)} - ${formatTime(endDate)}`;
    };

    const performerIcon = (input) => {
        if (input === 'Musician/Band') {
            return <MicrophoneIcon />
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
        if (input === "Background Music") {
            return <BackgroundMusicIcon />
        } else if (input === "Live Music") {
            return <GuitarsIcon />
        } else if (input === "Ticketed Gig") {
            return <TicketIcon />
        } else if (input === "House Party") {
            return <HouseIcon />
        } else if (input === "Wedding") {
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

    useEffect(() => {
        if (gigData && gigData.coordinates) {
            mapboxgl.accessToken = import.meta.env.VITE_MAPBOX_TOKEN;

            const map = new mapboxgl.Map({
                container: mapContainerRef.current,
                style: 'mapbox://styles/gigin/clp5jayun01l901pr6ivg5npf',
                center: [gigData.coordinates[0], gigData.coordinates[1]],
                zoom: 15
            });

            new mapboxgl.Marker()
                .setLngLat([gigData.coordinates[0], gigData.coordinates[1]])
                .addTo(map);

            return () => map.remove();
        }
    }, [gigData]);

    if (gigData) {

        return (
            <>
                <div className="venue">
                    <figure className="photo">
                        <img src={gigData.venue.photo} alt={`${gigData.venue.venueName} Photo`} />
                    </figure>
                    <h2>{gigData.venue.venueName}</h2>
                </div>
                <div className="date-and-time">
                    <h3>{formatDate(gigData.date)}</h3>
                    <h3>{formatDurationSpan(gigData.startTime, gigData.duration)}</h3>
                </div>
                <div className="location">
                    <h4>{gigData.venue.address}</h4>
                </div>
                <div className="budgets">
                    <div className="budget-container">
                        <h6>{gigData.agreedFee ? 'Gig Fee' : 'Venue Budget'}</h6>
                        <h2 style={{ textDecoration: gigData.negotiatedFee ? 'line-through' : 'none' }}>{gigData.agreedFee ? gigData.agreedFee : gigData.budget}</h2>                    </div>
                    {gigData.negotiatedFee && (
                        <div className="budget-container">
                            <h6>Negotiated Fee:</h6>
                            <h2>£{gigData.negotiatedFee}</h2>
                        </div>
                    )}
                </div>
                <div className="details">
                    <div className="details-list">
                        <div className="detail">
                            <h6>Performer</h6>
                            <div className="data">
                                {performerIcon(gigData.gigType)}
                                <p>{gigData.gigType}</p>
                            </div>
                        </div>
                        <div className="detail">
                            <h6>Audience</h6>
                            <div className="data">
                                {privacyIcon(gigData.privacy)}
                                <p>{gigData.privacy}</p>
                            </div>
                        </div>
                        <div className="detail">
                            <h6>Type</h6>
                            <div className="data">
                                {typeIcon(gigData.kind)}
                                <p>{gigData.kind}</p>
                            </div>
                        </div>
                        {gigData.genre.length > 0 ? (
                            <div className="detail">
                                <h6>Genres</h6>
                                <div className="data">
                                    <SpeakersIcon />
                                    <p>{formatGenres(gigData.genre)}</p>
                                </div>
                            </div>
                        ) : (
                            <div className="detail">
                                <h6>Genres</h6>
                                <div className="data">
                                    <SpeakersIcon />
                                    <p>No Preference</p>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
                <div className="map">
                    <div ref={mapContainerRef} className="map-container" style={{ height: '100%', width: '100%', borderRadius: '10px' }} />
                </div>
            </>
        )
    }

}