// Dependencies
    import { useState, useEffect } from 'react'
    import { useLocation } from 'react-router-dom'

// Components
    import { Header } from '/components/Header/Header'
    import { DynamicBox } from '/components/Header/DynamicBox/DynamicBox'
    import { SaveFooterButton, NextFooterButton, BackFooterButton } from '/pages/Musician/ProfileCreator/Buttons/ProfileCreator.buttons.jsx'
    import { OpeningText } from '/pages/Musician/ProfileCreator/Stages/OpeningText/OpeningText'
    import { ProfileName } from '/pages/Musician/ProfileCreator/Stages/ProfileName/ProfileName'
    import { MusicianType } from '/pages/Musician/ProfileCreator/Stages/Type/Type'
    import { MusicianInstruments } from '/pages/Musician/ProfileCreator/Stages/Instruments/Instruments'
    import { MusicianInformation } from '/pages/Musician/ProfileCreator/Stages/Information/Information'
    import { MusicianPreview } from '/pages/Musician/ProfileCreator/Stages/Preview/Preview'
    
// Utils
    import { GetProfileDataFromLocalStorage } from '/utils/updateLocalStorage'


// Styles
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
    const [userProfile, setUserProfile] = useState(location.state || {});
    const [profileID, setProfileID] = useState(location.state ? location.state.profileID : generateRandomId(25))
    const [profileType, setProfileType] = useState(location.state ? location.state.profileType : undefined);
    const [profileImages, setProfileImages] = useState(location.state ? location.state.profileImages : []);
    const [profileName, setProfileName] = useState(location.state ? location.state.profileName : '');
    // Musician specific states
    const [musicianType, setMusicianType] = useState(location.state ? location.state.musicianType : null);
    const [musicianInstruments, setMusicianInstruments] = useState(location.state ? location.state.musicianInstruments : null);
    const [musicianExtraInfo, setMusicianExtraInfo] = useState(location.state ? location.state.musicianExtraInfo : null);

    useEffect(() => {
        const updatedUserProfile = {
            ...userProfile,
            profileID: profileID,
            profileType: profileType,
            profileName: profileName,
            profileImages: profileImages,
            
            // Only add value below if they exist or don't equal null
            ...(musicianType && { musicianType: musicianType }),
            ...(musicianInstruments && { musicianInstruments: musicianInstruments }),
            ...(musicianExtraInfo && { musicianExtraInfo: musicianExtraInfo }),
        };
        setUserProfile(updatedUserProfile);
    }, [profileID, profileType, profileName, profileImages, musicianType, musicianInstruments, musicianExtraInfo])

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
                <ProfileName 
                    establishmentType={establishmentType}
                    profileName={profileName}
                    setProfileName={setProfileName}
                    setNextButtonAvailable={setNextButtonAvailable}
                />
            ) : stageNumber === 2 ? (
                <MusicianType 
                    musicianType={musicianType}
                    setMusicianType={setMusicianType}
                    setMusicianInstruments={setMusicianInstruments}
                    setNextButtonAvailable={setNextButtonAvailable}
                />
            ) : stageNumber === 3 ? (
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
            ) : stageNumber === 4 ? (
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
            ) : stageNumber === 5 && (
                musicianType.includes('Instrumentalist / Vocalist') || musicianType.includes('Singer / Songwriter') && (
                    <MusicianPreview 
                        userProfile={userProfile}
                        profileImages={profileImages}
                        setProfileImages={setProfileImages}
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