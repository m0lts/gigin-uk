// Dependencies
import { useState, useEffect, useRef } from "react"
import mapboxgl from "mapbox-gl"
import 'mapbox-gl/dist/mapbox-gl.css'

// Components
import { GiginLogo } from '/components/logos/GiginLogo'
import { Header } from "/sections/gig-goer/components/header/Header";
import { SideBar } from "../side-bar/SideBar";

// Mapbox access token
mapboxgl.accessToken = "pk.eyJ1IjoiZ2lnaW4iLCJhIjoiY2xwNDQ2ajFwMWRuNzJxczZqNHlvbHg3ZCJ9.nR_HaL-dWRkUhOgBnmbyjg";


export const Map = () => {

    const mapContainer = useRef(null);
    const map = useRef(null);
    const [lng, setLng] = useState(0.1);
    const [lat, setLat] = useState(52.2);
    const [zoom, setZoom] = useState(10);

    useEffect(() => {
        if (!map.current) {
            map.current = new mapboxgl.Map({
                container: mapContainer.current,
                style: 'mapbox://styles/mapbox/streets-v12',
                center: [lng, lat],
                zoom: zoom
            });
        } else {
            map.current.setCenter([lng, lat]);
            map.current.setZoom(zoom);
        }
    }, [lng, lat, zoom]);

    return (
        <div ref={mapContainer} className='map'>
            <Header />
            <SideBar />
        </div>
    );
}