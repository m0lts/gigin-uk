import { useState, useEffect, useRef } from "react";
import mapboxgl from "mapbox-gl";
import useMapboxAccessToken from "../../../hooks/useAccessTokens";
import { LeftChevronIcon, NewTabIcon, RightChevronIcon } from "../../../components/ui/Extras/Icons";
import { faCircle } from "@fortawesome/free-solid-svg-icons"
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome"

export const MapView = ({ upcomingGigs }) => {

    const mapContainerRef = useRef(null);
    const mapboxToken = useMapboxAccessToken();
    const [mapInstance, setMapInstance] = useState(null); // State to hold the map instance
    const [markers, setMarkers] = useState({}); // State to hold marker elements
    const [clickedGigs, setClickedGigs] = useState([]); // State to hold clicked gigs
    const [currentGigIndex, setCurrentGigIndex] = useState(0); // State to track current clicked gig index

    useEffect(() => {
        if (mapboxToken && upcomingGigs && upcomingGigs.length > 0) {
            mapboxgl.accessToken = mapboxToken;

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
        }
    }, [mapboxToken, upcomingGigs]); // Dependency array includes mapboxToken and upcomingGigs

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
        markerElement.style.background = 'var(--off-white)';
        markerElement.style.border = '1px solid var(--light-medium-grey)';
        markerElement.style.boxShadow = '1px 5px 5px var(--light-medium-grey)';
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
        tooltip.style.color = 'black';
        tooltip.style.fontWeight = '600';
        tooltip.style.fontFamily = 'var(--h1-font)';
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
        markerElement.style.background = 'var(--dark-grey)';
        markerElement.querySelector('span').style.color = 'white';
    };

    // Function to handle marker mouse leave
    const handleMarkerMouseLeave = (markerElement) => {
        markerElement.style.background = 'var(--off-white)';
        markerElement.querySelector('span').style.color = 'black';
    };

    // Function to navigate to previous gig
    const navigateToPreviousGig = () => {
        if (currentGigIndex > 0) {
            setCurrentGigIndex(currentGigIndex - 1);
        }
    };

    // Function to navigate to next gig
    const navigateToNextGig = () => {
        if (currentGigIndex < clickedGigs.length - 1) {
            setCurrentGigIndex(currentGigIndex + 1);
        }
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

    const formatDate = (dateString) => {
        const date = new Date(dateString);
        const day = date.getDate();
        const weekday = date.toLocaleDateString('en-GB', { weekday: 'long' });
        const month = date.toLocaleDateString('en-GB', { month: 'long' });
        return `${weekday} ${day}${getOrdinalSuffix(day)} ${month}`;
    };

    const formatDuration = (duration) => {
        if (duration < 60) return `${duration}mins`;
        if (duration === 60) return `1 hour`;
        if (duration > 60 && duration < 120) return `1 hour ${duration - 60}mins`;
        if (duration === 120) return `2 hours`;
        if (duration > 120 && duration < 180) return `2 hour ${duration - 120}mins`;
        if (duration === 180) return `3 hours`;
        if (duration > 180 && duration < 240) return `3 hour ${duration - 180}mins`;
        if (duration === 240) return `4 hours`;
        if (duration > 240 && duration < 300) return `4 hour ${duration - 240}mins`;
        if (duration === 300) return `5 hours`;
    }
    
    const openMusicianGig = (gigId) => {
        const url = `/musician/${gigId}`;
        window.open(url, '_blank');
    };

    return (
        <div className="map-view">
            <div
                ref={mapContainerRef}
                className="map"
                style={{ width: "100%", height: "100%" }}
            />
            <div className="filter-box">
                <ul className="filter-list">
                    <li className="filter">
                        Date: 
                        <input type="date" name="date" id="date" />
                    </li>
                    <li className="filter">
                        Budget:
                        {/* Budget slider */}
                        <input type="range" name="budget" id="budget" />
                    </li>
                    <li className="filter">
                        Distance:
                        {/* Distance slider */}
                        <input type="range" name="distance" id="distance" />
                    </li>
                    <button className="btn secondary">
                        Apply Filters
                    </button>
                </ul>
            </div>
            {clickedGigs.length > 0 && (
                <div className="preview-box">
                    <div className="preview-gig">
                        <figure className="img-cont">
                            <img src={clickedGigs[currentGigIndex].venue.photo} alt={clickedGigs[currentGigIndex].venue.venueName} />
                        </figure>
                        <h2 className="title">{clickedGigs[currentGigIndex].venue.venueName}</h2>
                        <p className="date">{formatDate(clickedGigs[currentGigIndex].date)}</p>
                        <p className="address">{clickedGigs[currentGigIndex].venue.address}</p>
                        <div className="details">
                            <p className="start-time">{clickedGigs[currentGigIndex].startTime}</p>
                            <FontAwesomeIcon icon={faCircle} className="icon" />
                            <p className="duration">{formatDuration(clickedGigs[currentGigIndex].duration)}</p>
                            <FontAwesomeIcon icon={faCircle} className="icon" />
                            <p className="budget">{clickedGigs[currentGigIndex].budget}</p>
                        </div>
                        <div className="action-buttons">
                            <button className="btn primary">
                                Quick Apply
                            </button>
                            <button className="btn secondary" onClick={() => openMusicianGig(clickedGigs[currentGigIndex].gigId)}>
                                Open <NewTabIcon />
                            </button>
                        </div>
                    </div>
                    {clickedGigs.length > 1 && (
                        <div className="navigation-buttons">
                            <button className="btn text" onClick={navigateToPreviousGig} disabled={currentGigIndex === 0}>
                                <LeftChevronIcon />
                            </button>
                            <div className="navigation-dots">
                                {clickedGigs.map((gig, index) => (
                                    <FontAwesomeIcon
                                        key={index}
                                        icon={faCircle}
                                        className="icon"
                                        style={{ color: currentGigIndex === index ? 'var(--dark-grey)' : 'var(--light-grey)' }}
                                    />
                                ))}
                            </div>
                            <button className="btn text" onClick={navigateToNextGig} disabled={currentGigIndex === clickedGigs.length - 1}>
                                <RightChevronIcon />
                            </button>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};

