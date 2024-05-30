import { useNavigate } from 'react-router-dom';
import { LeftChevronIcon } from '/components/ui/Icons/Icons';
import { useEffect, useState, useRef, useCallback } from 'react';
import { AddressMinimap } from '@mapbox/search-js-react';
import { AddressInputAutofill } from './AddressInputAutofill';
import { BeerIcon, MapIcon } from '../../../components/ui/Icons/Icons';
import 'mapbox-gl/dist/mapbox-gl.css';

export const VenueDetails = ({ formData, handleInputChange }) => {

    const navigate = useNavigate();

    const [expandForm, setExpandForm] = useState(false);
    const [feature, setFeature] = useState(null);
    const [locationCoordinates, setLocationCoordinates] = useState(formData.coordinates || null);
    const [locationAddress, setLocationAddress] = useState(formData.address || '');

    useEffect(() => {
        console.log('location address', locationAddress)
        if (locationAddress || locationCoordinates) {
            handleInputChange('address', locationAddress);
            handleInputChange('coordinates', locationCoordinates);
        }
    }, [locationAddress, locationCoordinates]);

    useEffect(() => {
        if (formData.type === '') {
            navigate('/host/venue-builder');
        }
    }, [formData]);

    // useEffect(() => {
    //     if (formData.coordinates) {
    //         const featureDetails = {
    //             type: 'Feature',
    //             geometry: {
    //                 type: 'Point',
    //                 coordinates: formData.coordinates,
    //             },
    //         };
    //         setFeature(featureDetails);
    //     }
    // }, [formData.coordinates]);

    // const handleSaveMarkerLocation = useCallback((coordinate) => {
    //     setLocationCoordinates(coordinate);
    //     handleGeocodeCoordinates(coordinate);
    // }, []);

    // const handleGeocodeCoordinates = async (coordinates) => {
    //     try {
    //         const response = await fetch(
    //             `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(coordinates)}.json?access_token=pk.eyJ1IjoiZ2lnaW4iLCJhIjoiY2xwNDQ5bjE1MDg2dDJrcW5yOHV1Z2t6bSJ9.Sk502nZET2-W6vLvCDwSEg`
    //         );

    //         if (response.ok) {
    //             const data = await response.json();
    //             if (data.features && data.features.length > 0) {
    //                 const address = data.features[0].place_name;
    //                 setLocationAddress(address);
    //             } else {
    //                 console.error('No coordinates found for the provided address.');
    //             }
    //         } else {
    //             console.error('Failed to fetch coordinates.');
    //         }
    //     } catch (error) {
    //         console.error('Error fetching coordinates:', error);
    //     }
    // };

    const handleNext = () => {
        if (formData.name === '') return;
        if (formData.address === '') return;
        if (formData.type === 'Public Establishment') {
            if (formData.establishment === '') return;
            navigate('/host/venue-builder/equipment');
        } else {
            navigate('/host/venue-builder/photos');
        }
    };

    return (
        <div className='stage'>
            <h2 className='orange-title'>Venue Details</h2>
            <h3 className='subtitle'>Tell us about the venue.</h3>
            <div className="form">
                <div className="input-group">
                    <label htmlFor="name">Venue Name</label>
                    <input
                        type="text"
                        placeholder="Name of the venue"
                        value={formData.name}
                        id='name'
                        onChange={(e) => handleInputChange('name', e.target.value)}
                    />
                </div>
                <AddressInputAutofill
                    expandForm={expandForm}
                    setExpandForm={setExpandForm}
                    setFeature={setFeature}
                    setLocationAddress={setLocationAddress}
                    setLocationCoordinates={setLocationCoordinates}
                    locationAddress={locationAddress}
                />
            </div>
            {/* <div className="map">
                {feature ? (
                    <AddressMinimap
                        canAdjustMarker={true}
                        satelliteToggle={true}
                        show={true}
                        feature={feature}
                        accessToken="pk.eyJ1IjoiZ2lnaW4iLCJhIjoiY2xwNDQ5bjE1MDg2dDJrcW5yOHV1Z2t6bSJ9.Sk502nZET2-W6vLvCDwSEg"
                        onSaveMarkerLocation={handleSaveMarkerLocation}
                        style={{ width: '100%', height: '300px' }}
                    />
                ) : (
                    <MapIcon />
                )}
            </div> */}
            {formData.type === 'Public Establishment' && (
                <div className="selections">
                    <button className={`card small ${formData.establishment === 'Pub/Bar' && 'selected'}`} onClick={() => handleInputChange('establishment', 'Pub/Bar')}>
                        <div className="status-dot">
                            {formData.establishment === 'Pub/Bar' && (
                                <div className="inner"></div>
                            )}
                        </div>
                        <BeerIcon />
                        <span className="title">Pub/Bar</span>
                    </button>
                </div>
            )}
            <div className="controls">
                <button className='btn secondary' onClick={() => navigate(-1)}>
                    <LeftChevronIcon />
                </button>
                <button className='btn primary' onClick={handleNext}>Continue</button>
            </div>
        </div>
    );
};