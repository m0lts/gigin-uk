import { Link } from 'react-router-dom';
import { 
    VenueBuilderIcon,
    BeerIcon,
    ClubIcon,
    HouseIcon,
    MicrophoneIcon,
    OtherIcon,
    PlaceOfWorshipIcon,
    RestaurantIcon,
    VillageHallIcon } from '@features/shared/ui/extras/Icons';

export const GigLocation = ({ formData, handleInputChange, venueProfiles, setStage }) => {

    const handleLocationSelect = (venue) => {
        handleInputChange({
            venueId: venue.venueId,
            venue: {
                venueName: venue.name,                
                address: venue.address,
                photo: venue.photos[0],
            },
            coordinates: venue.coordinates,
        });
        setStage(prevStage => prevStage + 1);
    }

    const getIcon = (type, establishment) => {
        if (type === 'Personal Space') {
            return <HouseIcon />
        } else if (type === 'Public Establishment') {
            if (establishment === 'Pub/Bar') {
                return <BeerIcon />
            } else if (establishment === 'Village Hall') {
                return <VillageHallIcon />
            } else if (establishment === 'Music Venue') {
                return <MicrophoneIcon />
            } else if (establishment === 'Restaurant') {
                return <RestaurantIcon />
            } else if (establishment === 'Place of Worship') {
                return <PlaceOfWorshipIcon />
            } else if (establishment === 'Club') {
                return <ClubIcon />
            } else {
                return <OtherIcon />
            }
        }
    }

    return (
        <>
            <div className='head'>
                <h1 className='title'>Where is the Gig?</h1>
                
            </div>
            <div className='body location'>
                <div className='selections'>
                    {venueProfiles.map((venue, index) => (
                        <div className={`card ${formData.venue.venueName === venue.name && 'selected'}`} key={index} onClick={() => handleLocationSelect(venue)}>
                            { getIcon(venue.type, venue.establishment) }
                            <h4 className='text'>{venue.name}</h4>
                        </div>
                    ))}
                </div>
                <Link className='link' to={'/venues/add-venue'}>
                    <button className='btn secondary'>
                        <VenueBuilderIcon />
                        <span style={{ marginLeft: '5px' }}>Add another venue</span>
                    </button>
                </Link>
            </div>
        </>
    );
}