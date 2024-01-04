import { useEffect, useState } from "react";
import { AmpIcon, CircleIcon, DrumIcon, ElectricGuitarIcon, GuitarIcon, HostIcon, KeyboardIcon, MicrophoneIcon, MicrophoneStandIcon, MixingDeckIcon, MusicVenueIcon, PianoIcon, PlugIcon, SoundSystemIcon } from "../../Icons/Icons";

export const HostProfilePreview = ({ userProfile, setSaveButtonAvailable }) => {

    const [images, setImages] = useState(userProfile.profileImages);
    const [venueName, setVenueName] = useState(userProfile.profileName);
    const [venueType, setVenueType] = useState(userProfile.establishmentType);
    const [inHouseEquipment, setInHouseEquipment] = useState(userProfile.inHouseEquipment);
    const [extraInfo, setExtraInfo] = useState(userProfile.hostExtraInfo);
    const [venueAddress, setVenueAddress] = useState(userProfile.hostAddress.address);


    // Find correct icon for equipment type
    const findIcon = (equipment) => {
        if (equipment === 'Piano') {
            return <PianoIcon />
        } else if (equipment === 'Sound System') {
            return <SoundSystemIcon />
        } else if (equipment === 'Microphone') {
            return <MicrophoneIcon />
        } else if (equipment === 'Amp') {
            return <AmpIcon />
        } else if (equipment === 'DJ Turntable') {
            return <MixingDeckIcon />
        } else if (equipment === 'XLR Cables') {
            return <PlugIcon />
        } else if (equipment === 'Jack Leads') {
            return <PlugIcon />
        } else if (equipment === 'Acoustic Guitar') {
            return <GuitarIcon />
        } else if (equipment === 'Electric Guitar') {
            return <ElectricGuitarIcon />
        } else if (equipment === 'Mic Stands') {
            return <MicrophoneStandIcon />
        } else if (equipment === 'Drum Kit') {
            return <DrumIcon />
        } else if (equipment === 'Electric Keyboard') {
            return <KeyboardIcon />
        } else if (equipment === 'Foldback Speakers') {
            return <MusicVenueIcon />
        }
    }

    useEffect(() => {
        setSaveButtonAvailable(true);
    }, [])


    return (
        <div className='profile-preview profile-creator-stage'>
            <h1 className='title'>Profile Preview</h1>
            <p className="text">This is a rough overview of how your profile will look to musicians.</p>
            <div className="host-preview">
                <div className="images">
                    <div className={`image1 ${images.length === 1 && 'full-width'}`}>
                        <img 
                            src={images[0]} 
                            alt="Image 1"
                        />
                    </div>
                    <div className={`other-images ${images.length === 2 && 'imgs-2'} ${images.length === 3 && 'imgs-3'}`}>
                        {images[1] && (
                            <img 
                                src={images[1]} 
                                alt="Image 2"
                            />
                        )}
                        {images[2] && (
                            <img 
                                src={images[2]} 
                                alt="Image 3"
                            />
                        )}
                        {images[3] && (
                            <img 
                                src={images[3]} 
                                alt="Image 4"
                                className={`${images.length === 4 && 'imgs-4'}`}
                            />
                        )}
                        {images[4] && (
                            <img 
                                src={images[4]} 
                                alt="Image 5"
                            />
                        )}
                    </div>
                </div>
                <div className="title-bar">
                    <h1 className="title">{venueName}</h1>
                    <h3 className="subtitle">{venueType}</h3>
                </div>
                <div className="other-information-section">
                    <div className="equipment-box">
                        <h3 className="subtitle">In House Equipment</h3>
                        {inHouseEquipment && (
                            <div className="equipment">
                                {inHouseEquipment.map((equipment, index) => (
                                    <p key={index}>{findIcon(equipment.equipment)} {equipment.equipment}</p>
                                ))}
                            </div>
                        )}
                    </div>
                    <div className="extra-info-box">
                        <h3 className="subtitle">Extra Information</h3>
                        {extraInfo ? (
                            <div className="info">
                                {extraInfo.parkingInfo.parkingAvailable === 'yes' && (
                                    <p className="parking">Parking Available{extraInfo.parkingInfo.parkingDetails && `: ${extraInfo.parkingInfo.parkingDetails}`}</p>
                                )}
                                {extraInfo.maxStageCapacity && (
                                    <p className="stage-capacity">Max Stage Capacity: {extraInfo.maxStageCapacity}</p>
                                )}
                                {extraInfo.maxVenueCapacity && (
                                    <p className="venue-capacity">Venue Capacity: {extraInfo.maxVenueCapacity}</p>
                                )}
                                {extraInfo.venueDescription && (
                                    <p className="venue-description">Venue description: {extraInfo.venueDescription}</p>
                                )}
                            </div>
                        ) : (
                            <p>N/A</p>
                        )}
                    </div>
                </div>
            </div>
        </div>
    )
}