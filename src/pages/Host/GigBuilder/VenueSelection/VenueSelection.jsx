// Dependencies
    import { useState, useEffect } from "react"

// Icons and effects
    import { HostIcon, PubIcon, MusicVenueIcon, RestaurantIcon, ClubIcon, ApartmentIcon, VillageHallIcon, HouseOfWorshipIcon, SchoolIcon, PublicSpaceIcon, OtherIcon } from "/components/Icons/Icons"
    import { LoadingSkeletonText, LoadingSkeletonIcon } from "/components/Loading/LoadingEffects"

// Utils
    import { queryDatabase } from '/utils/queryDatabase'
    import { GetInfoFromLocalStorage } from '/utils/updateLocalStorage'

// Styles
    import './venue-selection.styles.css'


export const VenueSelection = ({ gigProfile, setGigProfile }) => {

    const userInfo = GetInfoFromLocalStorage();
    const userID = userInfo.userID;

    // Get user profiles from database
    const [loadingProfiles, setLoadingProfiles] = useState(false);
    const [hostProfiles, setHostProfiles] = useState([]);

    useEffect(() => {
        const getHostProfiles = async () => {
            setLoadingProfiles(true);
            const dataPayload = {
                userID
            };

            try {
                const response = await queryDatabase('/api/GigBuilder/GetHostProfiles.js', dataPayload); 
                const responseData = await response.json();
                if (response.ok) {
                    setHostProfiles(responseData.hostProfiles);
                    setLoadingProfiles(false);
                } else {
                    console.log('error');
                    setLoadingProfiles(false);
                }
            } catch (error) {
                console.error('Error:', error);
            }

        }

        getHostProfiles();
        
    }, [])

    // Handle profile click
    const handleProfileClick = (selectedProfile) => {
        if (gigProfile) {
            if (gigProfile.profileName === selectedProfile.profileName) {
                setGigProfile(undefined);
            } else {
                setGigProfile(selectedProfile);
            }
        } else {
            setGigProfile(selectedProfile);
        }
    }

    // Find correct icon for establishment type
    const findIcon = (type) => {
        if (type === 'Pub/Bar') {
            return <PubIcon />
        } else if (type === 'Music Venue') {
            return <MusicVenueIcon />
        } else if (type === 'Restaurant') {
            return <RestaurantIcon />
        } else if (type === 'Club') {
            return <ClubIcon />
        } else if (type === 'Apartment/Flat') {
            return <ApartmentIcon />
        } else if (type === 'House') {
            return <HostIcon />
        } else if (type === 'Village Hall') {
            return <VillageHallIcon />
        } else if (type === 'House of Worship') {
            return <HouseOfWorshipIcon />
        } else if (type === 'Place of Education') {
            return <SchoolIcon />
        } else if (type === 'Public Space') {
            return <PublicSpaceIcon />
        } else if (type === 'Other') {
            return <OtherIcon />
        }
    }

    return (
        <div className="venue-selection">
            {loadingProfiles ? (
                <div className="card">
                    <LoadingSkeletonIcon />
                    <LoadingSkeletonText
                        width={100}
                    />
                </div>
            ) : (
                hostProfiles.map((hostProfile, index) => (
                    <div 
                        className={`card ${gigProfile && gigProfile.profileName === hostProfile.profileName ? 'active' : ''}`}
                        onClick={() => handleProfileClick(hostProfile)}
                        key={index}
                    >
                        {findIcon(hostProfile.establishmentType)}
                        <h2 className="text">{hostProfile.profileName}</h2>
                    </div>
                ))
            )}
            
        </div>
    )
}