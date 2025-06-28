import React, { useCallback } from 'react';
import { AddressAutofill } from '@mapbox/search-js-react';

export const AddressInputAutofill = ({ expandForm, setExpandForm, setFeature, setLocationAddress, setLocationCoordinates, locationAddress, handleInputChange, coordinatesError, setCoordinatesError }) => {

    const handleRetrieve = useCallback(
        (res) => {
            const feature = res.features[0];
            setFeature(feature);

            const address = feature.properties.full_address;
            const coordinates = feature.geometry.coordinates;

            if (coordinates) {
                setLocationCoordinates(coordinates);
            } else {
                setCoordinatesError(true)
            }

            setLocationAddress(address);
        },
        [setFeature, setLocationAddress, setLocationCoordinates]
    );

    const handleGeocodeAddress = async (address) => {
        setLocationAddress(address);
        try {
            const response = await fetch(
                `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(address)}.json?access_token=${import.meta.env.VITE_MAPBOX_TOKEN}`
            );

            if (response.ok) {
                const data = await response.json();
                if (data.features && data.features.length > 0) {
                    const coordinates = data.features[0].geometry.coordinates;
                    if (coordinates) {
                        setLocationCoordinates(coordinates);
                    } else {
                        setCoordinatesError(true);
                    }
                    const addressDetails = {
                        type: 'Feature',
                        geometry: {
                            type: 'Point',
                            coordinates: coordinates,
                        },
                        properties: {
                            address: address,
                        },
                    };
                    setFeature(addressDetails);
                }
            } else {
                console.error('Failed to fetch coordinates.');
            }
        } catch (error) {
            console.error('Error fetching coordinates:', error);
        }
    };

    const handleAddressSubmission = (e) => {
        e.preventDefault();
        const formData = new FormData(e.target);

        const address1 = formData.get('address1');
        const address2 = formData.get('address2');
        const city = formData.get('city');
        const country = formData.get('country');
        const postcode = formData.get('postcode');

        const enteredAddress = `${address1}${address2 ? `, ${address2}` : ''}, ${city}, ${postcode}, ${country}`;

        handleGeocodeAddress(enteredAddress);
        handleInputChange('address', enteredAddress);
        setExpandForm(false);
    };

    return (
        <>
            {!expandForm ? ( 
                <>
                {locationAddress ? (
                    <div className='input-group'>
                        <label htmlFor='autofill' className='input-label'>Venue Address</label>
                        <input
                            className={`input-box ${coordinatesError ? 'error': ''}`}
                            type='text'
                            value={locationAddress}
                            disabled
                        />
                        {coordinatesError && (
                            <p className='error-message'>Sorry, we couldn't find any coordinates for that address. Please try again.</p>
                        )}
                        <button className='btn secondary' style={{ width: 'fit-content' }} onClick={() => {setLocationAddress(''); setLocationCoordinates(null)}}>
                            Change Address
                        </button>
                    </div>
                
                ) : (

                    <AddressAutofill accessToken={import.meta.env.VITE_MAPBOX_TOKEN} onRetrieve={handleRetrieve}>
                        <div className='input-group'>
                            <label htmlFor='autofill' className='input-label'>Venue Address</label>
                            <input
                                className={`input-box ${coordinatesError ? 'error': ''}`}
                                type='text'
                                name='autofill'
                                id='autofill'
                                placeholder='Start typing your address, e.g. 72 High Street...'
                                autoComplete='off'
                            />
                        </div>
                    </AddressAutofill>
                )}
                    <button className='btn text manual-address' onClick={() => {setExpandForm(true); setLocationAddress(''); setLocationCoordinates(null)}} style={{ textAlign: 'left', fontSize: '0.75rem' }}>
                        Or enter your address manually
                    </button>
                </>
            ) : (
                <>
                <form onSubmit={handleAddressSubmission} className='form' style={{ width: '100%', marginTop: 0 }}>
                    <div className='input-group'>
                        <label htmlFor='address1' className='input-label'>Address Line 1</label>
                        <input
                            className='input-box'
                            type='text'
                            name='address1'
                            placeholder='Address Line 1'
                            autoComplete='address-line1'
                            id='address1'
                        />
                    </div>
                    <div className='input-group'>
                        <label htmlFor='address2' className='input-label'>Address Line 2</label>
                        <input
                            className='input-box'
                            type='text'
                            name='address2'
                            placeholder='Address Line 2'
                            autoComplete='address-line2'
                            id='address2'
                        />    
                    </div>
                    <div className='input-group'>
                        <label htmlFor='city' className='input-label'>City</label>
                        <input
                            className='input-box'
                            type='text'
                            name='city'
                            placeholder='City'
                            autoComplete='address-level2'
                            id='city'
                        />
                    </div>
                    <div className='input-group'>
                        <label htmlFor='country' className='input-label'>Country</label>
                        <input
                            className='input-box'
                            type='text'
                            name='country'
                            placeholder='Country'
                            autoComplete='country'
                            id='country'
                        />
                    </div>
                    <div className='input-group'>
                        <label htmlFor='postcode' className='input-label'>Postcode</label>
                        <input
                            className='input-box'
                            type='text'
                            name='postcode'
                            placeholder='Postcode'
                            autoComplete='postal-code'
                            id='postcode'
                        />
                    </div>
                    <button className='btn secondary' type='submit' style={{ width: 'fit-content' }}>
                        Save
                    </button>
                </form>
                <button className='btn text manual-address' onClick={() => {setExpandForm(false); setLocationAddress(''); setLocationCoordinates(null)}} style={{ textAlign: 'left', fontSize: '0.75rem' }}>
                    Use automatic address entry
                </button>
                </>
            )}
        </>
    );
};
