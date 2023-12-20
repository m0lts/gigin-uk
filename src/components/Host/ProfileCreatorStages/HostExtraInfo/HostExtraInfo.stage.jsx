import { useState, useEffect } from "react"
import { MaxStageCapacity, MaxVenueCapacity, ParkingInput, VenueDescription } from "./HostExtraInfo.inputs"

export const HostExtraInfoStage = ({ hostExtraInfo, setHostExtraInfo}) => {

    const [parkingInfo, setParkingInfo] = useState('');
    const [maxStageCapacity, setMaxStageCapacity] = useState('');
    const [maxVenueCapacity, setMaxVenueCapacity] = useState('');
    const [venueDescription, setVenueDescription] = useState('');

    useEffect(() => {
        setHostExtraInfo((prevHostExtraInfo) => ({
            ...prevHostExtraInfo,
            parkingInfo: parkingInfo,
            maxStageCapacity: maxStageCapacity,
            maxVenueCapacity: maxVenueCapacity,
            venueDescription: venueDescription,
        }));
      }, [parkingInfo, maxStageCapacity, maxVenueCapacity, venueDescription])

    return (
        <div className='extra-information profile-creator-stage'>
            <h1 className='title'>Extra information</h1>
            <p className="text">Please provide any extra information below. The more concise you are, the better your chances of finding a musician.</p>
            <div className="options">
                <ParkingInput 
                    hostExtraInfo={hostExtraInfo}
                    setParkingInfo={setParkingInfo}
                />
                <MaxStageCapacity 
                    hostExtraInfo={hostExtraInfo}
                    setMaxStageCapacity={setMaxStageCapacity}
                />
                <MaxVenueCapacity 
                    hostExtraInfo={hostExtraInfo}
                    setMaxVenueCapacity={setMaxVenueCapacity}
                />
                <VenueDescription 
                    hostExtraInfo={hostExtraInfo}
                    setVenueDescription={setVenueDescription}
                />
            </div>
        </div>
    )
}