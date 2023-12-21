import { useState, useEffect } from 'react'
import { BackAndNextFooterBar } from '../../../components/Global/FooterBars/FooterBars'
import { Header } from '../../../components/Global/header/Header'
import { OpeningText } from '../../../components/Global/ProfileCreatorStages/OpeningText/OpeningText'
import { UserTypeSelection } from '../../../components/Global/ProfileCreatorStages/UserType/UserType'
import { EstablishmentType } from '../../../components/Host/ProfileCreatorStages/EstablishmentType/EstablishmentType'
import { EstablishmentName } from '../../../components/Host/ProfileCreatorStages/EstablishmentName/EstablishmentName'
import { MultipleImagesInput } from '../../../components/Global/Images/ImageInputs'
import './profile-creator.styles.css'
import { InHouseEquipment } from '../../../components/Host/ProfileCreatorStages/InHouseEquipment/InHouseEquipment'
import { InHouseEquipmentImages } from '../../../components/Host/ProfileCreatorStages/InHouseEquipment/InHouseEquipmentImages'
import { ImagesOfVenue } from '../../../components/Host/ProfileCreatorStages/VenueImages/ImagesOfVenue'
import { HostAddressStage } from '../../../components/Host/ProfileCreatorStages/HostAddress/HostAddress.stage'
import { HostExtraInfoStage } from '../../../components/Host/ProfileCreatorStages/HostExtraInfo/HostExtraInfo.stage'
import { HostProfilePreview } from '../../../components/Global/ProfileCreatorStages/ProfilePreview/HostProfilePreview.stages'
import { GetProfileDataFromLocalStorage } from '../../../utils/updateLocalStorage'
import { useLocation } from 'react-router-dom'

export const ProfileCreator = () => {

    const location = useLocation();

    // Get existing userProfile data from localStorage
    const existingUserProfiles = GetProfileDataFromLocalStorage();

    // Stage number processing
    const [stageNumber, setStageNumber] = useState(0);
    // Next button availability
    const [nextButtonAvailable, setNextButtonAvailable] = useState(true);

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
    const [profileType, setProfileType] = useState(location.state ? location.state.profileType : null);
    const [userProfile, setUserProfile] = useState(location.state || {});
    const [profileImages, setProfileImages] = useState(location.state ? location.state.profileImages : []);
    // Host specific states
    const [establishmentType, setEstablishmentType] = useState(location.state ? location.state.establishmentType : null);
    const [establishmentName, setEstablishmentName] = useState(location.state ? location.state.establishmentName : '');
    const [inHouseEquipment, setInHouseEquipment] = useState(location.state ? location.state.inHouseEquipment : null);
    const [hostAddress, setHostAddress] = useState(location.state ? location.state.hostAddress : null);
    const [hostExtraInfo, setHostExtraInfo] = useState(location.state ? location.state.hostExtraInfo : null);

    useEffect(() => {
        if (profileType) {
            setNextButtonAvailable(true);
        }
        const updatedUserProfile = {
            ...userProfile,
            ...(profileID && { profileID: profileID }), // Add profileID
            ...(profileType && { profileType: profileType }), // Add profileType if it exists
            ...(establishmentType && { establishmentType: establishmentType }), // Add establishmentType if it exists
            ...(establishmentName && { establishmentName: establishmentName }), // Add establishmentName if it exists
            ...(profileImages && { profileImages: profileImages }), // Add establishmentName if it exists
            ...(inHouseEquipment && { inHouseEquipment: inHouseEquipment }), // Add inHouseEquipment if it exists
            ...(hostAddress && { hostAddress: hostAddress }), // Add hostAddress if it exists
            ...(hostExtraInfo && { hostExtraInfo: hostExtraInfo }), // Add hostExtraInfo if it exists
        };
        setUserProfile(updatedUserProfile);
    }, [profileID, profileType, establishmentType, establishmentName, profileImages, inHouseEquipment, hostAddress, hostExtraInfo])


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
                />
            ) : stageNumber === 2 ? (
                profileType === 'Musician' ? (
                    <h1>Musician</h1>
                ) : profileType === 'Host' ? (
                    <EstablishmentType 
                        establishmentType={establishmentType}
                        setEstablishmentType={setEstablishmentType}
                    />
                ) : (
                    <h1>Gig-goer</h1>
                )
            ) : stageNumber === 3 ? (
                profileType === 'Musician' ? (
                    <h1>Musician</h1>
                ) : profileType === 'Host' ? (
                    <EstablishmentName 
                        establishmentType={establishmentType}
                        establishmentName={establishmentName}
                        setEstablishmentName={setEstablishmentName}
                    />
                ) : (
                    <h1>Gig-goer</h1>
                )
            ) : stageNumber === 4 ? (
                profileType === 'Musician' ? (
                    <h1>Musician</h1>
                ) : profileType === 'Host' ? (
                    <ImagesOfVenue 
                        images={profileImages}
                        setImages={setProfileImages}
                        numberOfImages={5}
                    />
                ) : (
                    <h1>Gig-goer</h1>
                )
            ) : stageNumber === 5 ? (
                profileType === 'Musician' ? (
                    <h1>Musician</h1>
                ) : profileType === 'Host' ? (
                    <InHouseEquipment
                        inHouseEquipment={inHouseEquipment}
                        setInHouseEquipment={setInHouseEquipment}
                    />
                ) : (
                    <h1>Gig-goer</h1>
                )
            ) : stageNumber === 6 ? (
                profileType === 'Musician' ? (
                    <h1>Musician</h1>
                ) : profileType === 'Host' ? (
                    inHouseEquipment.length > 0 ? (
                        <InHouseEquipmentImages 
                            inHouseEquipment={inHouseEquipment}
                            setInHouseEquipment={setInHouseEquipment}
                        />
                    ) : (
                        <HostAddressStage 
                            hostAddress={hostAddress}
                            setHostAddress={setHostAddress}
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
                        />
                    ) : (
                        <HostExtraInfoStage 
                            hostExtraInfo={hostExtraInfo}
                            setHostExtraInfo={setHostExtraInfo}
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
                        />
                    ) : (
                        <HostProfilePreview 
                            userProfile={userProfile}
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
                        />
                    )
                ) : (
                    <h1>Gig-goer</h1>
                )
            )}
            <BackAndNextFooterBar 
                setStageNumber={setStageNumber}
                stageNumber={stageNumber}
                setNextButtonAvailable={setNextButtonAvailable}
                nextButtonAvailable={nextButtonAvailable}
            />
        </section>
    )
}