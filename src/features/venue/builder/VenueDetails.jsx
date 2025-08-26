import { useNavigate } from 'react-router-dom';
import { 
    LeftChevronIcon,
    MicrophoneIcon,
    OtherIcon,
    PlaceOfWorshipIcon,
    RestaurantIcon,
    VillageHallIcon,
    BeerIcon,
    ClubIcon } from '@features/shared/ui/extras/Icons';
import { useEffect, useState, useRef, useCallback } from 'react';
import Map, { Marker } from 'react-map-gl';
import { AddressInputAutofill } from './AddressInputAutofill';
import 'mapbox-gl/dist/mapbox-gl.css';
import { toast } from 'sonner';

export const VenueDetails = ({ formData, handleInputChange, setStepError, stepError }) => {

    const navigate = useNavigate();

    const [expandForm, setExpandForm] = useState(false);
    const [feature, setFeature] = useState(null);
    const [locationCoordinates, setLocationCoordinates] = useState(formData.coordinates || null);
    const [locationAddress, setLocationAddress] = useState(formData.address || '');
    const [coordinatesError, setCoordinatesError] = useState(false);
    const [errorField, setErrorField] = useState(null);

    const mapboxToken = import.meta.env.VITE_MAPBOX_TOKEN;

    useEffect(() => {
        if (locationAddress !== formData.address) {
            handleInputChange('address', locationAddress);
        }
        if (locationCoordinates !== formData.coordinates) {
            handleInputChange('coordinates', locationCoordinates);
            setCoordinatesError(false);
        }
    }, [locationAddress, locationCoordinates, formData, handleInputChange]);

    useEffect(() => {
        if (formData.type === '') {
            navigate('/venues/add-venue');
        }
    }, [formData]);

    useEffect(() => {
        if (formData.coordinates) {
            const featureDetails = {
                type: 'Feature',
                geometry: {
                    type: 'Point',
                    coordinates: formData.coordinates,
                },
            };
            setFeature(featureDetails);
        }
    }, [formData.coordinates]);

    const handleSaveMarkerLocation = useCallback((coordinate) => {
        setLocationCoordinates(coordinate);
        handleGeocodeCoordinates(coordinate);
    }, []);

    const handleGeocodeCoordinates = async (coordinates) => {
        try {
            const response = await fetch(
                `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(coordinates)}.json?access_token=${mapboxToken}`
            );

            if (response.ok) {
                const data = await response.json();
                if (data.features && data.features.length > 0) {
                    const address = data.features[0].place_name;
                    setLocationAddress(address);
                }
            } else {
                toast.error("We couldn't find coordinates for that address. Please try again.")
                console.error('Failed to fetch coordinates.');
            }
        } catch (error) {
            toast.error("We couldn't find coordinates for that address. Please try again.")
            console.error('Error fetching coordinates:', error);
        }
    };

    const handleNext = () => {
        if (formData.name === '') {
            setErrorField('name');
            setStepError('Please enter your venue name before continuing.');
            return;
        }
    
        if (formData.address === '') {
            setErrorField('address');
            setStepError('Please enter the address of your venue.');
            return;
        }
    
        if (formData.coordinates === null) {
            setCoordinatesError(true);
            setStepError('Please drop a pin on the map or select an address.');
            return;
        }
    
        if (formData.type === 'Public Establishment' && formData.establishment === '') {
            setStepError('Please select a type of establishment.');
            return;
        }
    
        // All good
        setStepError(null);
    
        if (formData.type === 'Public Establishment') {
            navigate('/venues/add-venue/equipment');
        } else {
            navigate('/venues/add-venue/photos');
        }
    };

    return (
        <div className='stage details'>
            <div className="stage-content">
                <div className="stage-definition">
                    <h1>Let’s Get You on the Map</h1>
                </div>
                    <div className='form'>
                        <div className='input-group'>
                            <label htmlFor='name' className='input-label'>Venue Name</label>
                            <input
                                type='text'
                                className={`input-box ${stepError && errorField === 'name' ? 'error' : ''}`}
                                placeholder='e.g. The Plough'
                                value={formData.name}
                                id='name'
                                autoComplete='off'
                                onChange={(e) => handleInputChange('name', e.target.value)}
                                onClick={() => setStepError(null)}
                                />
                        </div>
                        {!(feature && locationCoordinates) && (
                            <AddressInputAutofill
                                expandForm={expandForm}
                                setExpandForm={setExpandForm}
                                setFeature={setFeature}
                                setLocationAddress={setLocationAddress}
                                setLocationCoordinates={setLocationCoordinates}
                                locationAddress={locationAddress}
                                handleInputChange={handleInputChange}
                                coordinatesError={coordinatesError}
                                setCoordinatesError={setCoordinatesError}
                                stepError={stepError}
                                setStepError={setStepError}
                                errorField={errorField}
                                setErrorField={setErrorField}
                            />
                        )}
                    </div>
                {!expandForm && (
                    <>
                        {(feature && locationCoordinates) && (
                            <div className="map-container">
                                <div className="address">
                                    <h4>{formData.address}</h4>
                                    <button className="btn text" onClick={() => {
                                    setLocationAddress('');
                                    setLocationCoordinates(null);
                                    setExpandForm(false);
                                  }}>Change</button>
                                </div>
                                <div className='map'>
                                    <Map
                                        initialViewState={{
                                            longitude: locationCoordinates[0],
                                            latitude: locationCoordinates[1],
                                            zoom: 12
                                        }}
                                        mapStyle='mapbox://styles/mapbox/streets-v11'
                                        mapboxAccessToken={mapboxToken}
                                    >
                                        <Marker longitude={locationCoordinates[0]} latitude={locationCoordinates[1]} >
                                            <svg
                                                xmlns="http://www.w3.org/2000/svg"
                                                viewBox="0 0 24 24"
                                                fill="#FF6C4B"
                                                width="30px"
                                                height="30px"
                                            >
                                                <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5S10.62 6.5 12 6.5s2.5 1.12 2.5 2.5S13.38 11.5 12 11.5z" />
                                            </svg>
                                        </Marker>
                                    </Map>
                                </div>
                            </div>
                        )}

                        {formData.type === 'Public Establishment' && (
                            <div className='establishment-type'>
                                <h6 className='input-label'>Type of establishment</h6>
                                <div className='selections'>
                                    {[
                                        'Pub/Bar',
                                        'Music Venue',
                                        'Restaurant',
                                        'Place of Worship',
                                        'Village Hall',
                                        'Club',
                                        'Other',
                                    ].map((type) => (
                                        <button
                                            key={type}
                                            className={`card small ${formData.establishment === type ? 'selected' : ''} ${
                                                stepError?.includes('establishment') && formData.establishment === '' ? 'error' : ''
                                            }`}
                                            onClick={() => handleInputChange('establishment', type)}
                                        >
                                            {type}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        )}
                    </>
                )}
            </div>
            <div className='stage-controls'>
                <button className='btn secondary' onClick={() => navigate(-1)}>
                    Back
                </button>
                <button className='btn primary' onClick={handleNext}>Continue</button>
            </div>
        </div>
    );
};





