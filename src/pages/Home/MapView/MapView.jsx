import { useState, useEffect, useRef } from "react"
import { useNavigate } from "react-router-dom"
import { FilterBar } from '/pages/Home/FilterBar/FilterBar.jsx'
import { formatSelectedDate } from '/utils/dateFormatting'
import mapboxgl from "mapbox-gl"
import 'mapbox-gl/dist/mapbox-gl.css'
import './map-view.styles.css'


mapboxgl.accessToken = "pk.eyJ1IjoiZ2lnaW4iLCJhIjoiY2xwNDQ2ajFwMWRuNzJxczZqNHlvbHg3ZCJ9.nR_HaL-dWRkUhOgBnmbyjg";

export const MapView = ({ gigs }) => {

    const navigate = useNavigate();

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
        }
        // Add markers for each gig
        gigs.forEach((gig) => {
            const coordinates = gig.gigInformation.gigProfile.hostAddress.coordinates;
            const latCoordinates = gig.gigInformation.gigProfile.hostAddress.coordinates[1];

            const profileName = gig.gigInformation.gigProfile.profileName;

            // Create a marker
            const customMarker = document.createElement('div');
            customMarker.className = 'marker';
            customMarker.innerHTML = `<p>£${gig.gigInformation.gigDetails.gigFee}</p>`;

            // Add the custom marker to the map
            const marker = new mapboxgl.Marker({ element: customMarker })
                .setLngLat(coordinates)
                .addTo(map.current);

            marker.getElement().addEventListener('mouseover', () => {

                // Create a preview marker
                const fullMarker = document.createElement('div');
                fullMarker.className = 'preview-marker';
                fullMarker.innerHTML = `
                    <div class="profile-picture">
                        <img class="img" src="${gig.gigInformation.gigProfile.profileImages[0]}" alt="Profile picture" />
                    </div>
                    <div class="gig-information">
                        <h1 class="title">${gig.gigInformation.gigProfile.profileName}</h1>
                        <div class="other">
                            <p class="date">
                                ${formatSelectedDate(gig.gigInformation.gigDate)}
                            </p>
                            <p class="fee">
                                £${gig.gigInformation.gigDetails.gigFee}
                            </p>
                        </div>
                    </div>
                `;
                const previewMarker = new mapboxgl.Marker({ element: fullMarker })
                .setLngLat(coordinates)
                .addTo(map.current);

                fullMarker.addEventListener('click', () => {
                    // Navigate to the target page using React Router
                    navigate(`/${gig._id}`, { state: gig });
                });

                previewMarker.getElement().addEventListener('mouseout', () => {
                    previewMarker.remove();
                });

            });          
            
        });
        
    }, [gigs, lng, lat, zoom]);

    return (
        <div ref={mapContainer} className='map'>
            <FilterBar />
        </div>
    )
}