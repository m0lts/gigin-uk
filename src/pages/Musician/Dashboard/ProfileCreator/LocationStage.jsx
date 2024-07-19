import { useState } from 'react';
import mapboxgl from 'mapbox-gl';


export const LocationStage = ({ data, onChange, mapboxToken }) => {

    const [inputValue, setInputValue] = useState(data.city || '');
    const [loading, setLoading] = useState(false);

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

    return (
        <div className="stage">
            <h2>Stage 3: Location</h2>
            <input
                type="text"
                value={inputValue}
                onChange={handleInputChange}
                placeholder="Enter your city"
            />
            {loading && <p>Loading...</p>}
            <select value={data.travelDistance || ''} onChange={handleSelectChange}>
                <option value="">Select travel distance</option>
                <option value="only in my city">Only in my city</option>
                <option value="5 miles">5 miles</option>
                <option value="10 miles">10 miles</option>
                <option value="20 miles">20 miles</option>
                <option value="50 miles">50 miles</option>
                <option value="nationwide">Nationwide</option>
            </select>
        </div>
    );
};