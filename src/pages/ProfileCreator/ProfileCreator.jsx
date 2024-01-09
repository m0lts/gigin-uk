import { useState, useEffect } from 'react'
import { useLocation } from 'react-router-dom'
import { Header } from '/components/Header/Header'
import { DynamicBox } from '/components/Header/DynamicBox/DynamicBox'
import { GetProfileDataFromLocalStorage } from '/utils/updateLocalStorage'
import { SaveFooterButton, NextFooterButton, BackFooterButton } from '/pages/ProfileCreator/Buttons/ProfileCreator.buttons.jsx'
// Shared components
import { OpeningText } from '/pages/ProfileCreator/Shared/OpeningText/OpeningText'
import { ProfileType } from '/pages/ProfileCreator/Shared/ProfileType/ProfileType'
import { ProfileName } from '/pages/ProfileCreator/Shared/ProfileName/ProfileName'
// Host specific components
import { HostType } from '/pages/ProfileCreator/Host/Type/Type'
import { HostEquipment } from '/pages/ProfileCreator/Host/Equipment/Equipment'
import { HostEquipmentImages } from '/pages/ProfileCreator/Host/Equipment/EquipmentImages'
import { HostImages } from '/pages/ProfileCreator/Host/Images/Images'
import { HostAddress } from '/pages/ProfileCreator/Host/Address/Address'
import { HostInformation } from '/pages/ProfileCreator/Host/Information/Information'
import { HostPreview } from '/pages/ProfileCreator/Host/Preview/Preview'
// Musician specific components
import { MusicianType } from '/pages/ProfileCreator/Musician/Type/Type'
import { MusicianInstruments } from '/pages/ProfileCreator/Musician/Instruments/Instruments'
import { MusicianInformation } from '/pages/ProfileCreator/Musician/Information/Information'
import { MusicianPreview } from '/pages/ProfileCreator/Musician/Preview/Preview'
import './profile-creator.styles.css'

export const ProfileCreator = () => {

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
    const [profileID, setProfileID] = useState(location.state ? location.state.profileID : generateRandomId(25))
    const [profileType, setProfileType] = useState(location.state ? location.state.profileType : undefined);
    const [userProfile, setUserProfile] = useState(location.state || {});
    const [profileImages, setProfileImages] = useState(location.state ? location.state.profileImages : []);
    const [profileName, setProfileName] = useState(location.state ? location.state.profileName : '');
    // Musician specific states
    const [musicianType, setMusicianType] = useState(location.state ? location.state.musicianType : null);
    const [musicianInstruments, setMusicianInstruments] = useState(location.state ? location.state.musicianInstruments : null);
    const [musicianExtraInfo, setMusicianExtraInfo] = useState(location.state ? location.state.musicianExtraInfo : null);
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
            // Musician specific values
            ...(musicianType && { musicianType: musicianType }),
            ...(musicianInstruments && { musicianInstruments: musicianInstruments }),
            ...(musicianExtraInfo && { musicianExtraInfo: musicianExtraInfo }),
            // Host specific values
            ...(establishmentType && { establishmentType: establishmentType }),
            ...(inHouseEquipment && { inHouseEquipment: inHouseEquipment }),
            ...(hostAddress && { hostAddress: hostAddress }),
            ...(hostExtraInfo && { hostExtraInfo: hostExtraInfo }),
        };
        setUserProfile(updatedUserProfile);
    }, [profileID, profileType, establishmentType, profileName, profileImages, inHouseEquipment, hostAddress, hostExtraInfo, musicianType, musicianInstruments, musicianExtraInfo])

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
                <ProfileType 
                    profileType={profileType}
                    setProfileType={setProfileType}
                    existingUserProfiles={existingUserProfiles}
                    setNextButtonAvailable={setNextButtonAvailable}
                />
            ) : stageNumber === 2 ? (
                profileType === 'Musician' ? (
                    <ProfileName 
                        establishmentType={establishmentType}
                        profileName={profileName}
                        setProfileName={setProfileName}
                        setNextButtonAvailable={setNextButtonAvailable}
                    />
                ) : profileType === 'Host' ? (
                    <HostType 
                        establishmentType={establishmentType}
                        setEstablishmentType={setEstablishmentType}
                        setNextButtonAvailable={setNextButtonAvailable}
                    />
                ) : (
                    <h1>Gig-goer</h1>
                )
            ) : stageNumber === 3 ? (
                profileType === 'Musician' ? (
                    <MusicianType 
                        musicianType={musicianType}
                        setMusicianType={setMusicianType}
                        setMusicianInstruments={setMusicianInstruments}
                        setNextButtonAvailable={setNextButtonAvailable}
                    />
                ) : profileType === 'Host' ? (
                    <ProfileName 
                        establishmentType={establishmentType}
                        profileName={profileName}
                        setProfileName={setProfileName}
                        setNextButtonAvailable={setNextButtonAvailable}
                    />
                ) : (
                    <h1>Gig-goer</h1>
                )
            ) : stageNumber === 4 ? (
                profileType === 'Musician' ? (
                    musicianType.includes('Instrumentalist / Vocalist') || musicianType.includes('Singer / Songwriter') ? (
                        <MusicianInstruments 
                            musicianInstruments={musicianInstruments}
                            setMusicianInstruments={setMusicianInstruments}
                            setNextButtonAvailable={setNextButtonAvailable}
                        />
                    ) : (
                        <MusicianInformation 
                            musicianExtraInfo={musicianExtraInfo}
                            setMusicianExtraInfo={setMusicianExtraInfo}
                            setNextButtonAvailable={setNextButtonAvailable}
                        />
                    )
                ) : profileType === 'Host' ? (
                    <HostImages 
                        images={profileImages}
                        setImages={setProfileImages}
                        numberOfImages={5}
                        setNextButtonAvailable={setNextButtonAvailable}
                    />
                ) : (
                    <h1>Gig-goer</h1>
                )
            ) : stageNumber === 5 ? (
                profileType === 'Musician' ? (
                    musicianType.includes('Instrumentalist / Vocalist') || musicianType.includes('Singer / Songwriter') ? (
                        <MusicianInformation 
                            musicianExtraInfo={musicianExtraInfo}
                            setMusicianExtraInfo={setMusicianExtraInfo}
                            setNextButtonAvailable={setNextButtonAvailable}
                        />
                    ) : (
                        <MusicianPreview
                            userProfile={userProfile}
                            profileImages={profileImages}
                            setProfileImages={setProfileImages}
                            saveButtonAvailable={saveButtonAvailable}
                            setSaveButtonAvailable={setSaveButtonAvailable}
                        />
                    )
                ) : profileType === 'Host' ? (
                    <HostEquipment
                        inHouseEquipment={inHouseEquipment}
                        setInHouseEquipment={setInHouseEquipment}
                        setNextButtonAvailable={setNextButtonAvailable}
                    />
                ) : (
                    <h1>Gig-goer</h1>
                )
            ) : stageNumber === 6 ? (
                profileType === 'Musician' ? (
                    musicianType.includes('Instrumentalist / Vocalist') || musicianType.includes('Singer / Songwriter') ? (
                        <MusicianPreview 
                            userProfile={userProfile}
                            profileImages={profileImages}
                            setProfileImages={setProfileImages}
                            saveButtonAvailable={saveButtonAvailable}
                            setSaveButtonAvailable={setSaveButtonAvailable}
                        />
                    ) : (
                        <h1>wrong page</h1>
                    )
                ) : profileType === 'Host' ? (
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
                ) : (
                    <h1>Gig-goer</h1>
                )
            ) : stageNumber === 7 ? (
                profileType === 'Musician' ? (
                    <h1>Musician</h1>
                ) : profileType === 'Host' ? (
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
                ) : (
                    <h1>Gig-goer</h1>
                )
            ) : stageNumber === 8 ? (
                profileType === 'Musician' ? (
                    <h1>Musician</h1>
                ) : profileType === 'Host' ? (
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
                ) : (
                    <h1>Gig-goer</h1>
                )
            ) : stageNumber === 9 && (
                profileType === 'Musician' ? (
                    <h1>Musician</h1>
                ) : profileType === 'Host' ? (
                    inHouseEquipment.length > 0 && (
                        <HostPreview
                            userProfile={userProfile}
                            saveButtonAvailable={saveButtonAvailable}
                            setSaveButtonAvailable={setSaveButtonAvailable}
                        />
                    )
                ) : (
                    <h1>Gig-goer</h1>
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