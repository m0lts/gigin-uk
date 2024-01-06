import { useEffect, useState } from 'react';

export const ParkingInput = ({ hostExtraInfo, setParkingInfo }) => {

    const [selectedOption, setSelectedOption] = useState(hostExtraInfo && hostExtraInfo.parkingInfo.parkingAvailable ? hostExtraInfo.parkingInfo.parkingAvailable : '');
    const [parkingDetails, setParkingDetails] = useState(hostExtraInfo && hostExtraInfo.parkingInfo.parkingDetails ? hostExtraInfo.parkingInfo.parkingDetails : '');

    useEffect(() => {
        if (selectedOption === 'no' || selectedOption === '') {
            setParkingDetails('');
        }
        setParkingInfo({
            parkingAvailable: selectedOption,
            parkingDetails: parkingDetails,
        })
    }, [selectedOption, parkingDetails])


    const handleOptionChange = (e) => {
        setSelectedOption(e.target.value);
    };

    const handleDetailsChange = (e) => {
        setParkingDetails(e.target.value);
    }

    return (
        <div className='parking-inputs'>
            <h3 className='subtitle'>Is there parking available?</h3>
            <div className='form'>
                <div className="radio-options">
                    <label htmlFor="yes" className={`labels ${selectedOption === 'yes' ? 'clicked' : ''}`}>
                        <input 
                            type="radio"
                            id='yes'
                            value="yes"
                            checked={selectedOption === 'yes'}
                            onChange={handleOptionChange}
                        />
                        Yes
                    </label>
                    <label htmlFor="no" className={`labels ${selectedOption === 'no' ? 'clicked' : ''}`}>
                        <input 
                            type="radio"
                            id='no'
                            value="no"
                            checked={selectedOption === 'no'}
                            onChange={handleOptionChange}
                        />
                        No
                    </label>
                </div>
                <div className="details" style={{ display: selectedOption === 'no' || !selectedOption ? 'none' : 'block' }}>
                    <textarea 
                        name="parking-details" 
                        id="parking-details" 
                        cols="50" 
                        rows="5"
                        placeholder='Provide any extra details if required.'
                        onChange={handleDetailsChange}
                        value={parkingDetails}
                    ></textarea>
                </div>
            </div>
        </div>
    );
};


export const MaxStageCapacity = ({ setMaxStageCapacity, hostExtraInfo }) => {
    
    const [capacity, setCapacity] = useState(hostExtraInfo && hostExtraInfo.maxStageCapacity ? hostExtraInfo.maxStageCapacity : '');

    useEffect(() => {
        setMaxStageCapacity(capacity);
    }, [capacity])

    const handleOptionChange = (e) => {
        setCapacity(e.target.value);
    };

    return (
        <div className='parking-inputs'>
            <h3 className='subtitle'>Maximum stage capacity:</h3>
            <div className='form'>
                <div className="radio-options">
                    <label htmlFor="1" className={`labels ${capacity === '1' ? 'clicked' : ''}`}>
                        <input 
                            type="radio"
                            id='1'
                            value="1"
                            checked={capacity === '1'}
                            onChange={handleOptionChange}
                        />
                        1
                    </label>
                    <label htmlFor="1-5" className={`labels ${capacity === '1-5' ? 'clicked' : ''}`}>
                        <input 
                            type="radio"
                            id='1-5'
                            value="1-5"
                            checked={capacity === '1-5'}
                            onChange={handleOptionChange}
                        />
                        1-5
                    </label>
                    <label htmlFor="5-10" className={`labels ${capacity === '5-10' ? 'clicked' : ''}`}>
                        <input 
                            type="radio"
                            id='5-10'
                            value="5-10"
                            checked={capacity === '5-10'}
                            onChange={handleOptionChange}
                        />
                        5-10
                    </label>
                    <label htmlFor="10+" className={`labels ${capacity === '10+' ? 'clicked' : ''}`}>
                        <input 
                            type="radio"
                            id='10+'
                            value="10+"
                            checked={capacity === '10+'}
                            onChange={handleOptionChange}
                        />
                        10+
                    </label>
                </div>
            </div>
        </div>
    );
};

export const MaxVenueCapacity = ({ setMaxVenueCapacity, hostExtraInfo }) => {

    const [capacity, setCapacity] = useState(hostExtraInfo && hostExtraInfo.maxVenueCapacity ? hostExtraInfo.maxVenueCapacity : '');

    useEffect(() => {
        setMaxVenueCapacity(capacity);
    }, [capacity])

    const handleOptionChange = (e) => {
        setCapacity(e.target.value);
    };

    return (
        <div className='parking-inputs'>
            <h3 className='subtitle'>Venue capacity:</h3>
            <div className='form'>
                <div className="radio-options">
                    <label htmlFor="Less than 25" className={`labels ${capacity === 'Less than 25' ? 'clicked' : ''}`}>
                        <input 
                            type="radio"
                            id='Less than 25'
                            value="Less than 25"
                            checked={capacity === 'Less than 25'}
                            onChange={handleOptionChange}
                        />
                        Less than 25
                    </label>
                    <label htmlFor="25+" className={`labels ${capacity === '25+' ? 'clicked' : ''}`}>
                        <input 
                            type="radio"
                            id='25+'
                            value="25+"
                            checked={capacity === '25+'}
                            onChange={handleOptionChange}
                        />
                        25+
                    </label>
                    <label htmlFor="50+" className={`labels ${capacity === '50+' ? 'clicked' : ''}`}>
                        <input 
                            type="radio"
                            id='50+'
                            value="50+"
                            checked={capacity === '50+'}
                            onChange={handleOptionChange}
                        />
                        50+
                    </label>
                    <label htmlFor="100+" className={`labels ${capacity === '100+' ? 'clicked' : ''}`}>
                        <input 
                            type="radio"
                            id='100+'
                            value="100+"
                            checked={capacity === '100+'}
                            onChange={handleOptionChange}
                        />
                        100+
                    </label>
                </div>
            </div>
        </div>
    );
};

export const VenueDescription = ({ setVenueDescription, hostExtraInfo }) => {

    const [description, setDescription] = useState(hostExtraInfo && hostExtraInfo.venueDescription ? hostExtraInfo.venueDescription : '');

    useEffect(() => {
        setVenueDescription(description);
    }, [description])

    const handleDescriptionChange = (e) => {
        setDescription(e.target.value);
    }

    return (
        <div className='venue-description'>
            <h3 className='subtitle'>Let the musicians know what vibe to expect:</h3>
            <div className="details">
                <textarea 
                    name="parking-details" 
                    id="parking-details" 
                    cols="50" 
                    rows="5"
                    placeholder='E.g. What sort of music the crowd would like to hear, the character of the venue, the energy of the place etc.'
                    value={description}
                    onChange={handleDescriptionChange}
                >
                </textarea>
            </div>
        </div>
    );
};