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

export const VenueDetails = ({ formData, handleInputChange }) => {

    const navigate = useNavigate();

    const [expandForm, setExpandForm] = useState(false);
    const [feature, setFeature] = useState(null);
    const [locationCoordinates, setLocationCoordinates] = useState(formData.coordinates || null);
    const [locationAddress, setLocationAddress] = useState(formData.address || '');
    const [coordinatesError, setCoordinatesError] = useState(false);

    const mapboxToken = import.meta.env.DEV ? 
    'pk.eyJ1IjoiZ2lnaW4iLCJhIjoiY2xwNDQ2ajFwMWRuNzJxczZqNHlvbHg3ZCJ9.nR_HaL-dWRkUhOgBnmbyjg'
    : import.meta.env.VITE_MAPBOX_TOKEN;

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
                console.error('Failed to fetch coordinates.');
            }
        } catch (error) {
            console.error('Error fetching coordinates:', error);
        }
    };

    const handleNext = () => {
        if (formData.name === '') return;
        if (formData.address === '') return;
        if (formData.coordinates === null) {
            setCoordinatesError(true);
        }
        if (formData.type === 'Public Establishment') {
            if (formData.establishment === '') return;
            navigate('/venues/add-venue/equipment');
        } else {
            navigate('/venues/add-venue/photos');
        }
    };

    return (
        <div className='stage details'>
            <h3>Tell us about the venue.</h3>
            <div className='form'>
                <div className='input-group'>
                    <label htmlFor='name' className='input-label'>Venue Name</label>
                    <input
                        type='text'
                        className='input-box'
                        placeholder='e.g. The Plough'
                        value={formData.name}
                        id='name'
                        autoComplete='off'
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
                    handleInputChange={handleInputChange}
                    coordinatesError={coordinatesError}
                    setCoordinatesError={setCoordinatesError}
                />
            </div>
            {!expandForm && (
                <>
                    {(feature && locationCoordinates) && (
                        <div className='map'>
                            <Map
                                initialViewState={{
                                    longitude: locationCoordinates[0],
                                    latitude: locationCoordinates[1],
                                    zoom: 14
                                }}
                                mapStyle='mapbox://styles/mapbox/streets-v11'
                                mapboxAccessToken={mapboxToken}
                            >
                                <Marker longitude={locationCoordinates[0]} latitude={locationCoordinates[1]} />
                            </Map>
                        </div>
                    )}

                    {formData.type === 'Public Establishment' && (
                        <div className='establishment-type'>
                            <h6 className='input-label'>Type of establishment</h6>
                            <div className='selections'>
                                <button className={`card small ${formData.establishment === 'Pub/Bar' && 'selected'}`} onClick={() => handleInputChange('establishment', 'Pub/Bar')}>
                                    <div className='status-dot'>
                                        {formData.establishment === 'Pub/Bar' && (
                                            <div className='inner'></div>
                                        )}
                                    </div>
                                    <BeerIcon />
                                    <span className='title'>Pub/Bar</span>
                                </button>
                                <button className={`card small ${formData.establishment === 'Music Venue' && 'selected'}`} onClick={() => handleInputChange('establishment', 'Music Venue')}>
                                    <div className='status-dot'>
                                        {formData.establishment === 'Music Venue' && (
                                            <div className='inner'></div>
                                        )}
                                    </div>
                                    <MicrophoneIcon />
                                    <span className='title'>Music Venue</span>
                                </button>
                                <button className={`card small ${formData.establishment === 'Restaurant' && 'selected'}`} onClick={() => handleInputChange('establishment', 'Restaurant')}>
                                    <div className='status-dot'>
                                        {formData.establishment === 'Restaurant' && (
                                            <div className='inner'></div>
                                        )}
                                    </div>
                                    <RestaurantIcon />
                                    <span className='title'>Restaurant</span>
                                </button>
                                <button className={`card small ${formData.establishment === 'Place of Worship' && 'selected'}`} onClick={() => handleInputChange('establishment', 'Place of Worship')}>
                                    <div className='status-dot'>
                                        {formData.establishment === 'Place of Worship' && (
                                            <div className='inner'></div>
                                        )}
                                    </div>
                                    <PlaceOfWorshipIcon />
                                    <span className='title'>Place of Worship</span>
                                </button>
                                <button className={`card small ${formData.establishment === 'Village Hall' && 'selected'}`} onClick={() => handleInputChange('establishment', 'Village Hall')}>
                                    <div className='status-dot'>
                                        {formData.establishment === 'Village Hall' && (
                                            <div className='inner'></div>
                                        )}
                                    </div>
                                    <VillageHallIcon />
                                    <span className='title'>Village Hall</span>
                                </button>
                                <button className={`card small ${formData.establishment === 'Club' && 'selected'}`} onClick={() => handleInputChange('establishment', 'Club')}>
                                    <div className='status-dot'>
                                        {formData.establishment === 'Club' && (
                                            <div className='inner'></div>
                                        )}
                                    </div>
                                    <ClubIcon />
                                    <span className='title'>Club</span>
                                </button>
                                <button className={`card small ${formData.establishment === 'Other' && 'selected'}`} onClick={() => handleInputChange('establishment', 'Other')}>
                                    <div className='status-dot'>
                                        {formData.establishment === 'Other' && (
                                            <div className='inner'></div>
                                        )}
                                    </div>
                                    <OtherIcon />
                                    <span className='title'>Other</span>
                                </button>
                            </div>
                        </div>
                    )}
                </>
            )}
            <div className='controls'>
                <button className='btn secondary' onClick={() => navigate(-1)}>
                    <LeftChevronIcon />
                </button>
                <button className='btn primary' onClick={handleNext}>Continue</button>
            </div>
        </div>
    );
};





