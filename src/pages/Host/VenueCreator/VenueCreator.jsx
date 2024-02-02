// Dependencies
    import { useState, useEffect } from 'react'
    import { useLocation } from 'react-router-dom'

// Components
    import { Header } from '/components/Header/Header'
    import { DynamicBox } from '/components/Header/DynamicBox/DynamicBox'
    import { SaveFooterButton, NextFooterButton, BackFooterButton } from '/pages/Host/VenueCreator/Buttons/VenueCreator.buttons.jsx'
    import { OpeningText } from '/pages/Host/VenueCreator/Stages/OpeningText/OpeningText'
    import { ProfileName } from '/pages/Host/VenueCreator/Stages/ProfileName/ProfileName'
    import { HostType } from '/pages/Host/VenueCreator/Stages/Type/Type'
    import { HostEquipment } from '/pages/Host/VenueCreator/Stages/Equipment/Equipment'
    import { HostEquipmentImages } from '/pages/Host/VenueCreator/Stages/Equipment/EquipmentImages'
    import { HostImages } from '/pages/Host/VenueCreator/Stages/Images/Images'
    import { HostAddress } from '/pages/Host/VenueCreator/Stages/Address/Address'
    import { HostInformation } from '/pages/Host/VenueCreator/Stages/Information/Information'
    import { HostPreview } from '/pages/Host/VenueCreator/Stages/Preview/Preview'

// Utils
    import { GetProfileDataFromLocalStorage } from '/utils/updateLocalStorage'

// Styles
    import './venue-creator.styles.css'


export const VenueCreator = () => {

const location = useLocation();

// Get existing userProfile data from localStorage
const existingUserProfiles = GetProfileDataFromLocalStorage();

// Stage number processing
const [stageNumber, setStageNumber] = useState(0);
// Next button availability
const [nextButtonAvailable, setNextButtonAvailable] = useState(true);
// Save button availability
const [saveButtonAvailable, setSaveButtonAvailable] = useState(false);
// Back button availability
const [backButtonAvailable, setBackButtonAvailable] = useState(true);

// Generate profile ID
const generateRandomId = (length) => {
    const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    const charactersLength = characters.length;
    let randomId = '';
  
    for (let i = 0; i < length; i++) {
      randomId += characters.charAt(Math.floor(Math.random() * charactersLength));
    }
  
    return randomId;
}

// Profile object states, if location.state is true (user is editing profile), set userProfile and all states to that. Otherwise set to null.
const [userProfile, setUserProfile] = useState(location.state || {});
const [profileID, setProfileID] = useState(location.state ? location.state.profileID : generateRandomId(25))
const [profileType, setProfileType] = useState(location.state ? location.state.profileType : undefined);
const [profileImages, setProfileImages] = useState(location.state ? location.state.profileImages : []);
const [profileName, setProfileName] = useState(location.state ? location.state.profileName : '');

// Host specific states
const [establishmentType, setEstablishmentType] = useState(location.state ? location.state.establishmentType : null);
const [inHouseEquipment, setInHouseEquipment] = useState(location.state ? location.state.inHouseEquipment : null);
const [hostAddress, setHostAddress] = useState(location.state ? location.state.hostAddress : null);
const [hostExtraInfo, setHostExtraInfo] = useState(location.state ? location.state.hostExtraInfo : null);

useEffect(() => {
    const updatedUserProfile = {
        ...userProfile,
        profileID: profileID,
        profileType: profileType,
        profileName: profileName,
        profileImages: profileImages,
        
        // Only add value below if they exist or don't equal null
        ...(establishmentType && { establishmentType: establishmentType }),
        ...(inHouseEquipment && { inHouseEquipment: inHouseEquipment }),
        ...(hostAddress && { hostAddress: hostAddress }),
        ...(hostExtraInfo && { hostExtraInfo: hostExtraInfo }),
    };
    setUserProfile(updatedUserProfile);
}, [profileID, profileType, establishmentType, profileName, profileImages, inHouseEquipment, hostAddress, hostExtraInfo])

// Take user to stage 2 if they are editing profile
useEffect(() => {
    if (location.state) {
        setStageNumber(2);
    }
}, [location.state])

// Mobile screen 
const [isMobile, setIsMobile] = useState(window.innerWidth < 768)
useEffect(() => {
    const handleResize = () => {
        setIsMobile(window.innerWidth < 768);
    };
    window.addEventListener('resize', handleResize);
    return () => {
        window.removeEventListener('resize', handleResize);
    };
}, []);


return (
    <section className={`profile-creator ${isMobile && 'mobile'}`}>
        {isMobile && (
            <DynamicBox
                userProfile={userProfile}
                stageNumber={stageNumber}
            />
        )}
        <Header 
            userProfile={userProfile}
            stageNumber={stageNumber}
        />
        {stageNumber === 0 ? (
            <OpeningText 
                setNextButtonAvailable={setNextButtonAvailable}
            />
        ) : stageNumber === 1 ? (
            <HostType 
                establishmentType={establishmentType}
                setEstablishmentType={setEstablishmentType}
                setNextButtonAvailable={setNextButtonAvailable}
            />
        ) : stageNumber === 2 ? (
            <ProfileName 
                establishmentType={establishmentType}
                profileName={profileName}
                setProfileName={setProfileName}
                setNextButtonAvailable={setNextButtonAvailable}
            />
        ) : stageNumber === 3 ? (
            <HostImages 
                images={profileImages}
                setImages={setProfileImages}
                numberOfImages={5}
                setNextButtonAvailable={setNextButtonAvailable}
            />
        ) : stageNumber === 4 ? (
            <HostEquipment
                inHouseEquipment={inHouseEquipment}
                setInHouseEquipment={setInHouseEquipment}
                setNextButtonAvailable={setNextButtonAvailable}
            />
        ) : stageNumber === 5 ? (
            inHouseEquipment.length > 0 ? (
                <HostEquipmentImages 
                    inHouseEquipment={inHouseEquipment}
                    setInHouseEquipment={setInHouseEquipment}
                    setNextButtonAvailable={setNextButtonAvailable}
                />
            ) : (
                <HostAddress 
                    hostAddress={hostAddress}
                    setHostAddress={setHostAddress}
                    setNextButtonAvailable={setNextButtonAvailable}
                />
            )
        ) : stageNumber === 6 ? (
            inHouseEquipment.length > 0 ? (
                <HostAddress
                    hostAddress={hostAddress}
                    setHostAddress={setHostAddress}
                    setNextButtonAvailable={setNextButtonAvailable}
                />
            ) : (
                <HostInformation 
                    hostExtraInfo={hostExtraInfo}
                    setHostExtraInfo={setHostExtraInfo}
                    setNextButtonAvailable={setNextButtonAvailable}
                />
            )
        ) : stageNumber === 7 ? (
            inHouseEquipment.length > 0 ? (
                <HostInformation 
                    hostExtraInfo={hostExtraInfo}
                    setHostExtraInfo={setHostExtraInfo}
                    setNextButtonAvailable={setNextButtonAvailable}
                />
            ) : (
                <HostPreview
                    userProfile={userProfile}
                    saveButtonAvailable={saveButtonAvailable}
                    setSaveButtonAvailable={setSaveButtonAvailable}
                />
            )
            
        ) : stageNumber === 8 && (
            inHouseEquipment.length > 0 && (
                <HostPreview
                    userProfile={userProfile}
                    saveButtonAvailable={saveButtonAvailable}
                    setSaveButtonAvailable={setSaveButtonAvailable}
                />
            )
        )}
        <footer className={`footer-bar ${stageNumber < 1 ? 'right-flex' : ''}`}>
        {stageNumber > 0 && (
            <BackFooterButton 
                stageNumber={stageNumber}
                setStageNumber={setStageNumber}
                setSaveButtonAvailable={setSaveButtonAvailable}
                setNextButtonAvailable={setNextButtonAvailable}
                setBackButtonAvailable={setBackButtonAvailable}
                backButtonAvailable={backButtonAvailable}
                editingProfile={location.state}
            />
        )}
        <NextFooterButton 
            stageNumber={stageNumber}
            setStageNumber={setStageNumber}
            setNextButtonAvailable={setNextButtonAvailable}
            nextButtonAvailable={nextButtonAvailable}
            saveButtonAvailable={saveButtonAvailable}
            userProfile={userProfile}
        />
        <SaveFooterButton
            setSaveButtonAvailable={setSaveButtonAvailable}
            saveButtonAvailable={saveButtonAvailable}
            userProfile={userProfile}
        />
    </footer>
    </section>
)
}