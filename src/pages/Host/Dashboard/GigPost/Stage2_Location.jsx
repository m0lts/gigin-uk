import { Link } from "react-router-dom";
import { BeerIcon, ClubIcon, HouseIcon, MicrophoneIcon, OtherIcon, PlaceOfWorshipIcon, RestaurantIcon, VillageHallIcon } from "../../../../components/ui/icons/Icons";

export const GigLocation = ({ formData, handleInputChange, venueProfiles }) => {


    const handleLocationSelect = (venue) => {
        handleInputChange({
            venueId: venue.venueId,
            coordinates: venue.coordinates,
            address: venue.address,
            venueName: venue.name,
        });
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
            <h1 className="title">Where is the Gig?</h1>
            <div className="body location">
                <div className="selections">
                    {venueProfiles.map((venue, index) => (
                        <div className={`card ${formData.venueName === venue.name && 'selected'}`} key={index} onClick={() => handleLocationSelect(venue)}>
                            { getIcon(venue.type, venue.establishment) }
                            <p className="text">{venue.name}</p>
                        </div>
                    ))}
                </div>
                <Link className="link" to={'/host/venue-builder'}>
                    Add another venue
                </Link>
            </div>
        </>
    );
}