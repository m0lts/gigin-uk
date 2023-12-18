import { useState, useEffect } from 'react'
import { BackAndNextFooterBar } from '../../../components/Global/FooterBars/FooterBars'
import { Header } from '../../../components/Global/header/Header'
import { OpeningText } from '../../../components/Global/ProfileCreatorStages/OpeningText/OpeningText'
import { UserTypeSelection } from '../../../components/Global/ProfileCreatorStages/UserType/UserType'
import { EstablishmentType } from '../../../components/Host/ProfileCreatorStages/EstablishmentType/EstablishmentType'
import { EstablishmentName } from '../../../components/Host/ProfileCreatorStages/EstablishmentName/EstablishmentName'
import { ImageInputs } from '../../../components/Global/ProfileCreatorStages/Images/ImageInputs'
import './profile-creator.styles.css'

export const ProfileCreator = () => {

    // Stage number processing
    const [stageNumber, setStageNumber] = useState(0);

    // Profile object states
    const [profileType, setProfileType] = useState();
    const [userProfile, setUserProfile] = useState({
        profileType: profileType,
    });
    const [profileImages, setProfileImages] = useState([]);
    // Host specific states
    const [establishmentType, setEstablishmentType] = useState();
    const [establishmentName, setEstablishmentName] = useState('');

    useEffect(() => {
        const updatedUserProfile = {
            profileType: profileType,
            ...(establishmentType && { establishmentType: establishmentType }), // Add establishmentType if it exists
            ...(establishmentName && { establishmentName: establishmentName }), // Add establishmentName if it exists
            ...(profileImages && { profileImages: profileImages }), // Add establishmentName if it exists
        };
        setUserProfile(updatedUserProfile);
    }, [profileType, establishmentType, establishmentName, profileImages])

    console.log(userProfile)

    return (
        <section className='profile-creator'>
            <Header 
                userProfile={userProfile}
                stageNumber={stageNumber}
            />
            {stageNumber === 0 ? (
                <OpeningText />
            ) : stageNumber === 1 ? (
                <UserTypeSelection 
                    profileType={profileType}
                    setProfileType={setProfileType}
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
            ) : stageNumber === 4 && (
                profileType === 'Musician' ? (
                    <h1>Musician</h1>
                ) : profileType === 'Host' ? (
                    <ImageInputs 
                        images={profileImages}
                        setImages={setProfileImages}
                    />
                ) : (
                    <h1>Gig-goer</h1>
                )
            )}
            <BackAndNextFooterBar 
                profileType={profileType}
                establishmentType={establishmentType}
                setStageNumber={setStageNumber}
                stageNumber={stageNumber}
            />
        </section>
    )
}