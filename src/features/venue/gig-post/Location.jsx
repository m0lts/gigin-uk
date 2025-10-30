import { useNavigate } from 'react-router-dom';
import { 
    VenueBuilderIcon,
    BeerIcon,
    ClubIcon,
    HouseIconLight,
    MicrophoneIcon,
    OtherIcon,
    PlaceOfWorshipIcon,
    RestaurantIcon,
    VillageHallIcon } from '@features/shared/ui/extras/Icons';
import { BeerIconSolid, ClubIconSolid, HouseIconSolid, MicrophoneIconSolid, PlaceOfWorshipIconSolid, RestaurantIconSolid, VillageHallIconSolid } from '../../shared/ui/extras/Icons';
import { useBreakpoint } from '../../../hooks/useBreakpoint';

export const GigLocation = ({ formData, handleInputChange, venueProfiles, setStage, error, setError, user }) => {

    const navigate = useNavigate();
    const { isSmUp } = useBreakpoint();

    const canCreateForVenue = (venue) => {
        const role = venue?.myMembership?.role || "member";
        const perms = venue?.myMembership?.permissions || {};
        return role === "owner" || perms["gigs.create"] === true;
    };

    const handleLocationSelect = (venue) => {
        handleInputChange({
            venueId: venue.venueId,
            venue: {
                venueName: venue.name,                
                address: venue.address,
                photo: venue.photos[0],
                userId: user.uid,
                type: venue.type,
            },
            coordinates: venue.coordinates,
        });
        setStage(prevStage => prevStage + 1);
    }

    const getIcon = (type, establishment, selected) => {
        if (type === 'Personal Space') {
            if (selected) {
                return <HouseIconSolid />
            } else {
                return <HouseIconLight />
            }
        } else if (type === 'Public Establishment') {
            if (establishment === 'Pub/Bar' && selected) {
                return <BeerIconSolid />
            } else if (establishment === 'Pub/Bar') {
                return <BeerIcon />
            } else if (establishment === 'Village Hall' && selected) {
                return <VillageHallIconSolid />
            } else if (establishment === 'Music Venue' && selected) {
                return <MicrophoneIconSolid />
            } else if (establishment === 'Restaurant' && selected) {
                return <RestaurantIconSolid />
            } else if (establishment === 'Place of Worship' && selected) {
                return <PlaceOfWorshipIconSolid />
            } else if (establishment === 'Club' && selected) {
                return <ClubIconSolid />
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
                <h1 className='title'>Which Venue is Hosting?</h1>
            </div>
            <div className='body location'>
                <div className='selections'>
                {venueProfiles.map((venue, index) => {
                    const selected = formData.venueId === venue.venueId;
                    const disabled = !canCreateForVenue(venue);

                    const onSelect = () => {
                    if (disabled) return; // no-op if user lacks permission
                    handleLocationSelect(venue);
                    };

                    return (
                    <div
                        key={index}
                        className={`card ${selected ? "selected" : ""} ${disabled ? "disabled" : ""}`}
                        onClick={onSelect}
                        aria-disabled={disabled}
                        title={disabled ? "You don’t have permission to post gigs for this venue." : ""}
                        role="button"
                        tabIndex={disabled ? -1 : 0}
                        onKeyDown={(e) => {
                        if (!disabled && (e.key === "Enter" || e.key === " ")) onSelect();
                        }}
                    >
                        {getIcon(venue.type, venue.establishment, selected)}
                        <h4 className='text'>{venue.name}</h4>
                        {disabled && (
                        <small className="card-note">You don’t have permission to post gigs for this venue.</small>
                        )}
                    </div>
                    );
                })}
                </div>
                {error && (
                    <div className="error-cont">
                        <p className="error-message">{error}</p>
                    </div>
                )}
                {isSmUp && (
                    <button className='btn secondary add-venue' onClick={() => navigate('/venues/add-venue')}>
                        Add Venue
                    </button>
                )}
            </div>
        </>
    );
}