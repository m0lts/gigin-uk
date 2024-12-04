import { useState, useEffect, useRef } from 'react';
import mapboxgl from 'mapbox-gl';
import { LoadingThreeDots } from '../../../../components/ui/loading/Loading';
import 'react-loading-skeleton/dist/skeleton.css';
import Skeleton from 'react-loading-skeleton';
import { MapIcon } from '../../../../components/ui/Extras/Icons';



export const LocationStage = ({ data, onChange, mapboxToken, error, setError }) => {

    const [inputValue, setInputValue] = useState(data.city || '');
    const [loading, setLoading] = useState(false);

    const locationInputRef = useRef(null);
    const mapContainerRef = useRef(null)

    useEffect(() => {
        if (locationInputRef.current) {
            locationInputRef.current.focus();
        }
    }, []);

    const handleInputChange = async (e) => {
        const value = e.target.value;
        setInputValue(value);

        if (value.length > 2) {
            setLoading(true);
            try {
                const response = await fetch(
                    `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(value)}.json?access_token=${mapboxToken}&types=place&limit=1`
                );
                const data = await response.json();
                const match = data.features.find(feature => feature.place_type.includes('place'));

                if (match) {
                    const city = match.text;
                    const coordinates = match.center;
                    onChange('location', { city, coordinates });
                } else {
                    onChange('location', { city: '', coordinates: [] });
                }
            } catch (error) {
                console.error('Error fetching location:', error);
                onChange('location', { city: '', coordinates: [] });
            } finally {
                setLoading(false);
            }
        } else {
            onChange('location', { city: '', coordinates: [] });
        }
    };

    const handleSelectChange = (e) => {
        onChange('location', { ...data, travelDistance: e.target.value });
    };

    useEffect(() => {
        if (data.coordinates.length > 0 && mapboxToken) {
            mapboxgl.accessToken = mapboxToken;

            const map = new mapboxgl.Map({
                container: mapContainerRef.current,
                style: 'mapbox://styles/gigin/clp5jayun01l901pr6ivg5npf',
                center: [data.coordinates[0], data.coordinates[1]],
                zoom: 8
            });

            new mapboxgl.Marker()
                .setLngLat([data.coordinates[0], data.coordinates[1]])
                .addTo(map);

            return () => map.remove();
        }
    }, [data.coordinates, mapboxToken]);

    return (
        <div className="stage location">
            <h3 className='section-title'>Details</h3>
            <div className="body">
                <h1>Where you are based?</h1>
                <input
                    type="text"
                    className='input'
                    value={inputValue}
                    onChange={handleInputChange}
                    placeholder="Enter your city..."
                    ref={locationInputRef}
                />
                {data.coordinates.length > 0 ? (
                    <div ref={mapContainerRef} className="map-container" style={{ height: '200px', width: '200px', borderRadius: '5px' }} />
                ) : (
                    <div className="map-placeholder">
                        <MapIcon />
                    </div>
                )}
                {loading && <LoadingThreeDots />}
                <select value={data.travelDistance || ''} onChange={handleSelectChange} className={`select ${error === 'travelDistance' ? 'error' : ''}`}>
                    <option value="">How far are you typically willing to travel?</option>
                    <option value="only in my city">Only in my city</option>
                    <option value="5 miles">5 miles</option>
                    <option value="10 miles">10 miles</option>
                    <option value="20 miles">20 miles</option>
                    <option value="50 miles">50 miles</option>
                    <option value="nationwide">Nationwide</option>
                </select>
            </div>
        </div>
    );
};