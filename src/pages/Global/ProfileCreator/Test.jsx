import { Outlet } from "react-router-dom"
import { Header } from "../../../components/Global/header/Header"
import { BackAndNextFooterBar } from "../../../components/Global/FooterBars/FooterBars"
import './profile-creator.styles.css'
import { useState, useEffect } from "react"


export const ProfileCreatorTest = () => {

    // Stage number processing
    const [stageNumber, setStageNumber] = useState(0);
    // Profile object states
    const [profileType, setProfileType] = useState();
    const [userProfile, setUserProfile] = useState({
        profileType: profileType,
    });
    const [profileImages, setProfileImages] = useState();
    // Host specific states
    const [establishmentType, setEstablishmentType] = useState();
    const [establishmentName, setEstablishmentName] = useState('');
    const [inHouseEquipment, setInHouseEquipment] = useState();
    const [hostAddress, setHostAddress] = useState();
    const [hostExtraInfo, setHostExtraInfo] = useState();

    useEffect(() => {
        const updatedUserProfile = {
            profileType: profileType,
            ...(establishmentType && { establishmentType: establishmentType }), // Add establishmentType if it exists
            ...(establishmentName && { establishmentName: establishmentName }), // Add establishmentName if it exists
            ...(profileImages && { profileImages: profileImages }), // Add establishmentName if it exists
            ...(inHouseEquipment && { inHouseEquipment: inHouseEquipment }), // Add inHouseEquipment if it exists
            ...(hostAddress && { hostAddress: hostAddress }), // Add hostAddress if it exists
            ...(hostExtraInfo && { hostExtraInfo: hostExtraInfo }), // Add hostExtraInfo if it exists
        };
        setUserProfile(updatedUserProfile);
    }, [profileType, establishmentType, establishmentName, profileImages, inHouseEquipment, hostAddress, hostExtraInfo])
    

    return (
        <section className='profile-creator'>
            <Header 
                // userProfile={userProfile}
                // stageNumber={stageNumber}
            />
            <Outlet />
            <BackAndNextFooterBar 
                setStageNumber={setStageNumber}
                stageNumber={stageNumber}
            />
        </section>
    )
}