import { ApartmentIcon, ClubIcon, HouseIcon, HouseOfWorshipIcon, MusicVenueIcon, OtherIcon, PubIcon, PublicSpaceIcon, RestaurantIcon, SchoolIcon, VillageHallIcon } from "../../../Global/Icons/Icons";

export const EstablishmentType = ({ establishmentType, setEstablishmentType }) => {

    const handleEstablishmentTypeClick = (place) => {
        if (establishmentType === place) {
            setEstablishmentType(undefined);
        } else {
            setEstablishmentType(place);
        }
    }

    return (
        <div className='establishment-type profile-creator-stage'>
            <h1 className='title'>Type of Establishment</h1>
            <div className="options">
                <div 
                    className={`card ${establishmentType === 'Pub/Bar' && 'active'}`}
                    onClick={() => handleEstablishmentTypeClick('Pub/Bar')}
                >
                    <PubIcon />
                    <h2 className="text">Pub/Bar</h2>
                </div>
                <div 
                    className={`card ${establishmentType === 'Music Venue' && 'active'}`}
                    onClick={() => handleEstablishmentTypeClick('Music Venue')}
                >
                    <MusicVenueIcon />
                    <h2 className="text">Music Venue</h2>
                </div>
                <div 
                    className={`card ${establishmentType === 'Restaurant' && 'active'}`}
                    onClick={() => handleEstablishmentTypeClick('Restaurant')}
                >
                    <RestaurantIcon />
                    <h2 className="text">Restaurant</h2>
                </div>
                <div 
                    className={`card ${establishmentType === 'Club' && 'active'}`}
                    onClick={() => handleEstablishmentTypeClick('Club')}
                >
                    <ClubIcon />
                    <h2 className="text">Club</h2>
                </div>
                <div 
                    className={`card ${establishmentType === 'Apartment/Flat' && 'active'}`}
                    onClick={() => handleEstablishmentTypeClick('Apartment/Flat')}
                >
                    <ApartmentIcon />
                    <h2 className="text">Apartment/Flat</h2>
                </div>
                <div 
                    className={`card ${establishmentType === 'House' && 'active'}`}
                    onClick={() => handleEstablishmentTypeClick('House')}
                >
                    <HouseIcon />
                    <h2 className="text">House</h2>
                </div>
                <div 
                    className={`card ${establishmentType === 'Village Hall' && 'active'}`}
                    onClick={() => handleEstablishmentTypeClick('Village Hall')}
                >
                    <VillageHallIcon />
                    <h2 className="text">Village Hall</h2>
                </div>
                <div 
                    className={`card ${establishmentType === 'House of Worship' && 'active'}`}
                    onClick={() => handleEstablishmentTypeClick('House of Worship')}
                >
                    <HouseOfWorshipIcon />
                    <h2 className="text">House of Worship</h2>
                </div>
                <div 
                    className={`card ${establishmentType === 'Place of Education' && 'active'}`}
                    onClick={() => handleEstablishmentTypeClick('Place of Education')}
                >
                    <SchoolIcon />
                    <h2 className="text">Place of Education</h2>
                </div>
                <div 
                    className={`card ${establishmentType === 'Public Space' && 'active'}`}
                    onClick={() => handleEstablishmentTypeClick('Public Space')}
                >
                    <PublicSpaceIcon />
                    <h2 className="text">Public Space</h2>
                </div>
                <div 
                    className={`card ${establishmentType === 'Other' && 'active'}`}
                    onClick={() => handleEstablishmentTypeClick('Other')}
                >
                    <OtherIcon />
                    <h2 className="text">Other</h2>
                </div>
            </div>
        </div>
    )
}