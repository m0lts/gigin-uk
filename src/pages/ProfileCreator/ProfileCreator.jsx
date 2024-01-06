import { useState, useEffect } from 'react'
import { useLocation } from 'react-router-dom'
import { Header } from '/components/Header/Header'
import { GetProfileDataFromLocalStorage } from '/utils/updateLocalStorage'
import { SaveFooterButton, NextFooterButton, BackFooterButton } from '/components/Buttons/Buttons'
// Shared components
import { OpeningText } from '/pages/ProfileCreator/OpeningText/OpeningText'
import { UserTypeSelection } from '/pages/ProfileCreator/UserType/UserType'
import { ProfileName } from '/pages/ProfileCreator/ProfileName/ProfileName'
import { HostProfilePreview } from '/pages/ProfileCreator/ProfilePreview/HostProfilePreview.stages'
import { MusicianProfilePreview } from '/pages/ProfileCreator/ProfilePreview/MusicianProfilePreview.stage'
// Host specific components
import { EstablishmentType } from '/pages/ProfileCreator/Host/EstablishmentType/EstablishmentType'
import { InHouseEquipment } from '/pages/ProfileCreator/Host/InHouseEquipment/InHouseEquipment'
import { InHouseEquipmentImages } from '/pages/ProfileCreator/Host/InHouseEquipment/InHouseEquipmentImages'
import { ImagesOfVenue } from '/pages/ProfileCreator/Host/VenueImages/ImagesOfVenue'
import { HostAddressStage } from '/pages/ProfileCreator/Host/HostAddress/HostAddress.stage'
import { HostExtraInfoStage } from '/pages/ProfileCreator/Host/HostExtraInfo/HostExtraInfo.stage'
// Musician specific components
import { MusicianType } from '/pages/ProfileCreator/Musician/MusicianType/MusicianType'
import { MusicianInstruments } from '/pages/ProfileCreator/Musician/MusicianInstruments/MusicianInstruments'
import { MusicianExtraInfo } from '/pages/ProfileCreator/Musician/MusicianExtraInfo/MusicianExtraInfo.stage'
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

    return (
        <section className='profile-creator'>
            <Header 
                userProfile={userProfile}
                stageNumber={stageNumber}
            />
            {stageNumber === 0 ? (
                <OpeningText 
                    setNextButtonAvailable={setNextButtonAvailable}
                />
            ) : stageNumber === 1 ? (
                <UserTypeSelection 
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
                    <EstablishmentType 
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
                        <MusicianExtraInfo 
                            musicianExtraInfo={musicianExtraInfo}
                            setMusicianExtraInfo={setMusicianExtraInfo}
                            setNextButtonAvailable={setNextButtonAvailable}
                        />
                    )
                ) : profileType === 'Host' ? (
                    <ImagesOfVenue 
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
                        <MusicianExtraInfo 
                            musicianExtraInfo={musicianExtraInfo}
                            setMusicianExtraInfo={setMusicianExtraInfo}
                            setNextButtonAvailable={setNextButtonAvailable}
                        />
                    ) : (
                        <MusicianProfilePreview
                            userProfile={userProfile}
                            profileImages={profileImages}
                            setProfileImages={setProfileImages}
                            saveButtonAvailable={saveButtonAvailable}
                            setSaveButtonAvailable={setSaveButtonAvailable}
                        />
                    )
                ) : profileType === 'Host' ? (
                    <InHouseEquipment
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
                        <MusicianProfilePreview 
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
                        <InHouseEquipmentImages 
                            inHouseEquipment={inHouseEquipment}
                            setInHouseEquipment={setInHouseEquipment}
                            setNextButtonAvailable={setNextButtonAvailable}
                        />
                    ) : (
                        <HostAddressStage 
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
                        <HostAddressStage
                            hostAddress={hostAddress}
                            setHostAddress={setHostAddress}
                            setNextButtonAvailable={setNextButtonAvailable}
                        />
                    ) : (
                        <HostExtraInfoStage 
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
                        <HostExtraInfoStage 
                            hostExtraInfo={hostExtraInfo}
                            setHostExtraInfo={setHostExtraInfo}
                            setNextButtonAvailable={setNextButtonAvailable}
                        />
                    ) : (
                        <HostProfilePreview 
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
                        <HostProfilePreview
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