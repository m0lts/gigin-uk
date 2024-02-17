import { useState, useCallback } from "react";
import { AddressAutofill } from "@mapbox/search-js-react";

export const AddVenueModal = ({ addVenueModal, setAddVenueModal }) => {

    // Modal functions
    const closeModal = () => {
        setAddVenueModal(false);
    };
    const handleContentClick = (event) => {
        event.stopPropagation();
    };

    // Form related states
    const [venueData, setVenueData] = useState({
        name: '',
        address: '',
        coordinates: [],
        description: ''
    });
    const [manualAddressEntry, setManualAddressEntry] = useState({
        address1: '',
        city: '',
        country: '',
        postcode: '',
    });
    const [expandForm, setExpandForm] = useState(false);
    const [allowManualEntry, setAllowManualEntry] = useState(true);
    const [error, setError] = useState('');


    // Form submission
    const handleVenueSubmission = async (e) => {

        e.preventDefault();
        setError('');

        if (expandForm) {
            const address1 = manualAddressEntry.address1;
            const city = manualAddressEntry.city;
            const country = manualAddressEntry.country;
            const postcode = manualAddressEntry.postcode;

            if (address1 === '' || city === '' || country === '' || postcode === '') {
                setError('Please fill in all fields marked with an asterisk (*)');
                return;
            }

            const enteredAddress = `${address1}, ${city}, ${postcode}, ${country}`;

            try {
                const response = await fetch(
                  `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(enteredAddress)}.json?access_token=pk.eyJ1IjoiZ2lnaW4iLCJhIjoiY2xwNDQ2ajFwMWRuNzJxczZqNHlvbHg3ZCJ9.nR_HaL-dWRkUhOgBnmbyjg`
                );
          
                if (response.ok) {
                  const data = await response.json();
                  if (data.features && data.features.length > 0) {
                    const coordinates = data.features[0].geometry.coordinates;

                    const dataPayload = {
                        ...venueData,
                        address: enteredAddress,
                        coordinates: coordinates,
                    };

                    console.log(dataPayload)
                  } else {
                    setError('Please fill in all fields marked with an asterisk (*)');
                    return;
                  }
                } else {
                    setError('Please fill in all fields marked with an asterisk (*)');
                    return;
                }
            } catch (error) {
                console.error('Error fetching coordinates:', error);
            }

        } else {

            if (venueData.address === '' || venueData.coordinates.length === 0) {
                setError('Please fill in all fields marked with an asterisk (*)');
                return;
            }
            console.log(venueData);
            
        }
    };

    // Handle autofill address retrieval
    const handleRetrieve = useCallback(
        (res) => {
            const feature = res.features[0];
            const address = feature.properties.place_name;
            const coordinates = feature.geometry.coordinates;

            setVenueData(prevState => ({ ...prevState, address: address, coordinates: coordinates }));
            setAllowManualEntry(false);
        },
        [setVenueData]
    );

    // Sort manually entered address
    const sortAddress = (address) => {
        const addressArray = address.split(',');
        const address1 = addressArray[0];
        const city = addressArray[1];
        const postcode = addressArray[2];
        const country = addressArray[3];
        return (
            <>
                <p>{address1}</p>
                <p>{city}</p>
                <p>{postcode}</p>
                <p>{country}</p>
            </>
        );
    }


    return (
        <div className={`modal add-venue-modal ${addVenueModal ? 'show' : ''}`} onClick={closeModal}>
            <div className="modal-content" onClick={handleContentClick}>
                <div className="modal-head">
                    <h3 className="title">Add Venue</h3>
                </div>
                <div className="modal-body">
                    <div className="input-group">
                        <label htmlFor="venueName">Venue Name:</label>
                        <input type="text" id="venueName" value={venueData.name} onChange={(e) => { setVenueData({...venueData, name: e.target.value}) }} />
                    </div>
                    {!expandForm && (
                        <>
                        <AddressAutofill accessToken="pk.eyJ1IjoiZ2lnaW4iLCJhIjoiY2xwNDQ2ajFwMWRuNzJxczZqNHlvbHg3ZCJ9.nR_HaL-dWRkUhOgBnmbyjg" onRetrieve={handleRetrieve}>
                            <div className="input-group">
                                <label htmlFor="autofill" className="label">Venue Address:</label>
                                <input 
                                    type="text"
                                    name="autofill"
                                    id="autofill"
                                    required={!expandForm}
                                    placeholder="Start typing your address, e.g. 72 High Street..."
                                    onChange={() => setError('')}
                                />
                            </div>
                        </AddressAutofill>
                        {!allowManualEntry && (<div className="entered-address">
                            {sortAddress(venueData.address)}
                        </div>)}
                        </>
                    )}
                    {allowManualEntry && (<div className="manual-entry-option" onClick={() => setExpandForm(!expandForm)}>
                        {!expandForm && <p>Enter Address Manually</p>}
                    </div>)}
                    <div className="manual-entry-form" style={{ display: expandForm ? 'block' : 'none' }}>
                        <div className="input-group">
                            <label htmlFor="address1" className="label">Address Line 1:</label>
                            <input 
                                className="input"
                                type="text"
                                name="address1"
                                autoComplete="address-line1"
                                required={expandForm}
                                onChange={(e) => { setManualAddressEntry({ ...manualAddressEntry, address1: e.target.value }); setError('') }} 
                            />
                        </div>
                        <div className="input-group">
                            <label htmlFor="city" className="label">City:</label>
                            <input 
                                className="input"
                                type="text"
                                name="city"
                                autoComplete="address-level2"
                                required={expandForm}
                                onChange={(e) => { setManualAddressEntry({ ...manualAddressEntry, city: e.target.value }); setError('') }} 
                            />
                        </div>
                        <div className="input-group">
                            <label htmlFor="country" className="label">Country:</label>
                            <input 
                                className="input"
                                type="text"
                                name="country"
                                autoComplete="country"
                                required={expandForm}
                                onChange={(e) => { setManualAddressEntry({ ...manualAddressEntry, country: e.target.value }); setError('') }} 
                            />
                        </div>
                        <div className="input-group">
                            <label htmlFor="postcode" className="label">Postcode:</label>
                            <input 
                                className="input"
                                type="text"
                                name="postcode"
                                autoComplete="postal-code"
                                required={expandForm}
                                onChange={(e) => { setManualAddressEntry({ ...manualAddressEntry, postcode: e.target.value }); setError('') }} 
                            />
                        </div>
                        <div className="manual-entry-option" onClick={() => setExpandForm(!expandForm)}>
                            {expandForm && <p>Hide Manual Entry</p>}
                        </div>
                    </div>
                    <div className="input-group">
                        <label htmlFor="description">Description:</label>
                        <textarea id="description"  value={venueData.description} onChange={(e) => { setVenueData({...venueData, description: e.target.value}) }}></textarea>
                    </div>
                </div>
                <div className="modal-footer">
                    <button className="btn btn-border" onClick={closeModal}>Cancel</button>
                    <button className="btn btn-black" onClick={handleVenueSubmission}>Submit</button>
                </div>
            </div>
        </div>
    )
}