import { useState, useEffect } from 'react'
import { BackAndNextFooterBar } from '../../../components/Global/FooterBars/FooterBars'
import { Header } from '../../../components/Global/header/Header'
import { OpeningText } from '../../../components/Global/ProfileCreatorStages/OpeningText/OpeningText'
import { UserTypeSelection } from '../../../components/Global/ProfileCreatorStages/StageOne/UserType'
import './profile-creator.styles.css'
import { EstablishmentType } from '../../../components/Host/ProfileCreatorStages/StageTwo/EstablishmentType'

export const ProfileCreator = () => {

    // Stage number processing
    const [stageNumber, setStageNumber] = useState(0);

    // Profile object states
    const [profileType, setProfileType] = useState();
    const [userProfile, setUserProfile] = useState({
        profileType: profileType,
    });
    // Host specific states
    const [establishmentType, setEstablishmentType] = useState();

    useEffect(() => {
        const updatedUserProfile = {
            profileType: profileType,
            ...(establishmentType && { establishmentType: establishmentType }), // Add establishmentType if it exists
        };
        setUserProfile(updatedUserProfile);
    }, [profileType, establishmentType])

    return (
        <section className='profile-creator'>
            <Header 
                userProfile={userProfile}
            />
            {stageNumber === 0 ? (
                <OpeningText />
            ) : stageNumber === 1 ? (
                <UserTypeSelection 
                    profileType={profileType}
                    setProfileType={setProfileType}
                />
            ) : stageNumber === 2 && (
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