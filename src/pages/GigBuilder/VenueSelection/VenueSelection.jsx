import { useState, useEffect } from "react"
import { HostIcon } from "/components/Icons/Icons"
import { queryDatabase } from '/utils/queryDatabase'
import { GetInfoFromLocalStorage } from '/utils/updateLocalStorage'
import { LoadingSkeletonText, LoadingSkeletonIcon } from "/components/Loading/LoadingEffects"
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
                        <HostIcon />
                        <h2 className="text">{hostProfile.profileName}</h2>
                    </div>
                ))
            )}
            
        </div>
    )
}