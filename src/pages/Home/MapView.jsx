import { useState, useEffect, useRef } from "react";
import mapboxgl from "mapbox-gl";
import { CloseIcon, LeftChevronIcon, NewTabIcon, RightChevronIcon } from "../../components/ui/Extras/Icons";
import { faCircle } from "@fortawesome/free-solid-svg-icons"
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome"

export const MapView = ({ upcomingGigs }) => {

    const mapContainerRef = useRef(null);
    const [mapInstance, setMapInstance] = useState(null); // State to hold the map instance
    const [markers, setMarkers] = useState({}); // State to hold marker elements
    const [clickedGigs, setClickedGigs] = useState([]); // State to hold clicked gigs
    const [currentGigIndex, setCurrentGigIndex] = useState(0); // State to track current clicked gig index

    useEffect(() => {
        mapboxgl.accessToken = import.meta.env.VITE_MAPBOX_TOKEN;

        // Initialize map instance
        const map = new mapboxgl.Map({
            container: mapContainerRef.current,
            style: 'mapbox://styles/gigin/clp5jayun01l901pr6ivg5npf',
            center: [0.1278, 52.2053],
            zoom: 10,
        });

        // Store map instance in state
        setMapInstance(map);

        // Clean up map instance on component unmount
        return () => {
            if (map) {
                map.remove();
            }
        };
    }, []); // Dependency array includes mapboxToken and upcomingGigs

    useEffect(() => {
        if (mapInstance && upcomingGigs && upcomingGigs.length > 0) {
            // Clear existing markers
            clearMarkers();

            // Create markers for each unique location
            const newMarkers = {};
            upcomingGigs.forEach(gig => {
                const key = gig.coordinates.toString();
                if (!newMarkers[key]) {
                    const markerElement = createCustomMarker(gig);
                    newMarkers[key] = markerElement;
                    markerElement.addEventListener('click', () => handleMarkerClick(gig));
                    markerElement.addEventListener('mouseenter', () => handleMarkerMouseEnter(markerElement));
                    markerElement.addEventListener('mouseleave', () => handleMarkerMouseLeave(markerElement));
                    new mapboxgl.Marker(markerElement)
                        .setLngLat(gig.coordinates)
                        .addTo(mapInstance);
                }
            });

            // Update markers state
            setMarkers(newMarkers);
        }
    }, [mapInstance, upcomingGigs, clickedGigs]); // Dependency array includes mapInstance and upcomingGigs

    // Function to create custom marker element
    const createCustomMarker = (gig) => {
        const markerElement = document.createElement('div');
        markerElement.className = 'custom-marker';
        markerElement.style.background = 'var(--gn-grey-100)';
        markerElement.style.boxShadow = '0px 0px 10px var(--gn-shadow)';
        markerElement.style.width = '50px';
        markerElement.style.height = '30px';
        markerElement.style.borderRadius = '25px';
        markerElement.style.display = 'flex';
        markerElement.style.justifyContent = 'center';
        markerElement.style.alignItems = 'center';
        markerElement.style.position = 'relative';
        markerElement.style.padding = '10px 30px';
        markerElement.style.cursor = 'pointer';
        markerElement.style.transition = 'background-color 0.1s linear';

        const tooltip = document.createElement('span');
        tooltip.textContent = `${gig.budget}`;
        tooltip.style.color = 'var(--gn-black)';
        tooltip.style.fontWeight = '600';
        tooltip.style.fontSize = '1rem';
        markerElement.appendChild(tooltip);

        return markerElement;
    };

    // Function to handle marker click
    const handleMarkerClick = (gig) => {
        // Check if the clicked gig is already in clickedGigs
        const alreadyClicked = clickedGigs.find(clickedGig => clickedGig.gigId === gig.gigId);

        if (!alreadyClicked) {
            setClickedGigs(prevClickedGigs => [...prevClickedGigs, gig]);
            setCurrentGigIndex(clickedGigs.length);
        }
    };

    const handleMarkerMouseEnter = (markerElement) => {
        markerElement.style.background = 'var(--gn-grey-600)';
        markerElement.querySelector('span').style.color = 'white';
    };

    // Function to handle marker mouse leave
    const handleMarkerMouseLeave = (markerElement) => {
        markerElement.style.background = 'var(--gn-grey-100)';
        markerElement.querySelector('span').style.color = 'black';
    };

    
    // Function to clear existing markers
    const clearMarkers = () => {
        Object.values(markers).forEach(markerElement => {
            markerElement.removeEventListener('click', () => handleMarkerClick);
            markerElement.remove();
        });
        setMarkers({});
    };
    
    const getOrdinalSuffix = (day) => {
        if (day > 3 && day < 21) return 'th';
        switch (day % 10) {
            case 1: return 'st';
            case 2: return 'nd';
            case 3: return 'rd';
            default: return 'th';
        }
    };
    
    const formatDate = (timestamp) => {
        const date = timestamp.toDate();
        const day = date.getDate();
        const weekday = date.toLocaleDateString('en-GB', { weekday: 'long' });
        const month = date.toLocaleDateString('en-GB', { month: 'long' });
        return `${weekday} ${day}${getOrdinalSuffix(day)} ${month}`;
    };
    
    const openMusicianGig = (gigId) => {
        const url = `/gig/${gigId}`;
        window.open(url, '_blank');
    };
        
    const handleCloseGig = (gig, e) => {
        e.stopPropagation();
        setClickedGigs(prevGigs => prevGigs.filter(g => g.gigId !== gig.gigId));
    };

    return (
        <div className="map-view">
            <div
                ref={mapContainerRef}
                className="map"
                style={{ width: "100%", height: "100%" }}
            />
            <>
            {clickedGigs.length > 0 && (
                <ul className="preview-gig-list">
                    {clickedGigs.map((gig, index) => (
                        <li className="preview-gig-item" key={index} onClick={() => openMusicianGig(gig.gigId)}>
                            <button className="btn danger" onClick={(e) => handleCloseGig(gig, e)}>
                                <CloseIcon />
                            </button>
                            <div className="preview-gig-item-venue">
                                <figure className="preview-gig-img">
                                    <img src={gig.venue.photo} alt={gig.venue.venueName} />
                                </figure>
                                <div className="preview-gig-info">
                                    <h4>{gig.venue.venueName}</h4>
                                    <p>{formatDate(gig.date)}</p>
                                </div>
                            </div>
                            <div className="preview-gig-budget">
                                <h3>{gig.budget}</h3>
                            </div>
                        </li>
                    ))}
                </ul>
            )}
            </>
        </div>
    );
};
