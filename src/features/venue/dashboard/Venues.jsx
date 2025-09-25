import { useNavigate } from 'react-router-dom';
import { VenueIconSolid } from '@icons';
import { getCityFromAddress } from '@services/utils/misc';

export const Venues = ({ venues}) => {
    const navigate = useNavigate();
    const handleOpenVenuePage = (venueProfile) => {
        navigate(`/venues/dashboard/my-venues/${venueProfile.venueId}`);
    }

    return (
        <>
            <div className='head'>
                <h1 className='title'>My Venues</h1>
                <button className='btn primary' onClick={() => navigate('/venues/add-venue')}>
                    Add Another Venue
                </button>
            </div>

            <div className='body venues'>
                {venues.map((venue, index) => (
                    <div className='venue-card' key={index} onClick={() => handleOpenVenuePage(venue)}>
                        <div>
                            <div className='venue-image'>
                                <img src={venue.photos[0]} alt={venue.name} />
                            </div>
                            <div className="venue-flex">
                                <div className="venue-name">
                                    <h3 className='venue-name'>{venue.name}</h3>
                                    <p className='venue-address'>{getCityFromAddress(venue.address)}</p>
                                </div>
                            </div>
                            <div className="venue-gigs">
                                <span className="gigs">{(venue?.gigs ?? []).length}</span>
                                <span className='text'>gigs posted.</span>
                            </div>
                        </div>
                    </div>
                ))}
                {!venues.length && (
                    <div className="no-venues" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', width: '100%', minHeight: '500px', gap:'0.5rem'}}>
                        <VenueIconSolid />
                        <h4>No venue profiles.</h4>
                    </div>
                )}
            </div>
        </>
    )
}