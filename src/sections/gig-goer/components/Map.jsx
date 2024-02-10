// Dependencies
import { useState, useEffect, useRef } from "react"
import mapboxgl from "mapbox-gl"
import 'mapbox-gl/dist/mapbox-gl.css'

// Components
import { AddEventModal } from "../add-event-modal/AddEventModal";
import { Header } from "../header/Header";
import GiginIcon from "/assets/logos/gigin-logo.png"

// Utils
import { queryDatabase } from "/utils/queryDatabase"
import { LocationIcon } from "../../../components/Icons/Icons";
import { LoadingDots } from "../../../components/Loading/LoadingEffects";

// Mapbox access token
mapboxgl.accessToken = "pk.eyJ1IjoiZ2lnaW4iLCJhIjoiY2xwNDQ5bjE1MDg2dDJrcW5yOHV1Z2t6bSJ9.Sk502nZET2-W6vLvCDwSEg";


export const Map = () => {

    const [showModal, setShowModal] = useState(false);
    const [gigs, setGigs] = useState([]);
    const [loading, setLoading] = useState(false);

    const mapContainer = useRef(null);
    const map = useRef(null);
    const [lng, setLng] = useState(0.1);
    const [lat, setLat] = useState(52.2);
    const [zoom, setZoom] = useState(8);

    useEffect(() => {
        if (!map.current) {
            map.current = new mapboxgl.Map({
                container: mapContainer.current,
                style: 'mapbox://styles/mapbox/streets-v12',
                center: [lng, lat],
                zoom: zoom
            });
        }
        // Add markers for each gig
        gigs.forEach((gig) => {
            const coordinates = gig.gigInformation.gigCoordinates;

            // Create a marker
            const customMarker = document.createElement('img');
            customMarker.className = 'marker';
            customMarker.src = `${GiginIcon}`;

            // Add the custom marker to the map
            new mapboxgl.Marker({ element: customMarker })
                .setLngLat(coordinates)
                .addTo(map.current);

        });     
    }, [lng, lat, zoom, gigs]);

    useEffect(() => {
        setLoading(true);
        const fetchGigData = async () => {

            const dataPayload = {
                userLocation: 'Cambridge'
            }
            try {
                const response = await queryDatabase('/api/Gigs/GetGigsFromDatabase.js', dataPayload);
                const responseData = await response.json();
                if (response.ok) {
                    setGigs(responseData.gigs);
                    setLoading(false);
                } else {
                    console.log('error');
                }
            } catch (error) {
                console.error('Error:', error);
            }
        }
        fetchGigData();
    }, [])

    const handleGetUserLocation = () => {
        setLoading(true);
        navigator.geolocation.getCurrentPosition((position) => {
            const newLng = position.coords.longitude;
            const newLat = position.coords.latitude;
            const newZoom = 12;

            setLng(newLng);
            setLat(newLat);
            setZoom(newZoom);

            // Update map's center and zoom
            if (map.current) {
                map.current.setCenter([newLng, newLat]);
                map.current.setZoom(newZoom);
                setLoading(false);
            }
        });
    }

    return (
        <div ref={mapContainer} className='map'>
            <Header
                showModal={showModal}
                setShowModal={setShowModal}
            />
            <AddEventModal 
                showModal={showModal}
                setShowModal={setShowModal}
            />
            <button onClick={handleGetUserLocation} className='btn get-location-btn shadow'>
                <LocationIcon />
            </button>
            {loading && (
                <div className="loading-overlay shadow">
                    <LoadingDots />
                </div>
            )}
            {showModal && (
                <div className="map-overlay" onClick={() => setShowModal(false)}></div>
            )}
        </div>
    );
}