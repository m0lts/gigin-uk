// Dependencies
    import { useState, useEffect } from "react"

// Components
    import { HostStageCapacityInput, HostVenueCapacityInput, HostParkingInput, HostDescriptionInput } from "/pages/Host/VenueCreator/Stages/Information/Inputs/Information.inputs"

// Styles
    import './information.styles.css'


export const HostInformation = ({ hostExtraInfo, setHostExtraInfo, setNextButtonAvailable }) => {

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

    useEffect(() => {
        setNextButtonAvailable(true);
    }, []);

    return (
        <div className='extra-information profile-creator-stage'>
            <h1 className='title'>Extra information</h1>
            <p className="text">Please provide any extra information below. The more concise you are, the better your chances of finding a musician.</p>
            <div className="options">
                <HostParkingInput 
                    hostExtraInfo={hostExtraInfo}
                    setParkingInfo={setParkingInfo}
                />
                <HostStageCapacityInput 
                    hostExtraInfo={hostExtraInfo}
                    setMaxStageCapacity={setMaxStageCapacity}
                />
                <HostVenueCapacityInput
                    hostExtraInfo={hostExtraInfo}
                    setMaxVenueCapacity={setMaxVenueCapacity}
                />
                <HostDescriptionInput 
                    hostExtraInfo={hostExtraInfo}
                    setVenueDescription={setVenueDescription}
                />
            </div>
        </div>
    )
}