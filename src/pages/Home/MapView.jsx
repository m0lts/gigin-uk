import { useState, useEffect, useRef } from "react";
import mapboxgl from "mapbox-gl";
import { CloseIcon, ErrorIcon, LeftChevronIcon, NewTabIcon, RightChevronIcon } from "../../components/ui/Extras/Icons";
import { faCircle } from "@fortawesome/free-solid-svg-icons"
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome"
import ReactDatePicker from "react-datepicker";
import 'react-datepicker/dist/react-datepicker.css';

export const MapView = ({ upcomingGigs }) => {

    const mapContainerRef = useRef(null);
    const [mapInstance, setMapInstance] = useState(null); // State to hold the map instance
    const [markers, setMarkers] = useState({}); // State to hold marker elements
    const [clickedGigs, setClickedGigs] = useState([]); // State to hold clicked gigs
    const [currentGigIndex, setCurrentGigIndex] = useState(0); // State to track current clicked gig index
    const [selectedDates, setSelectedDates] = useState([]);
    const [showDatePicker, setShowDatePicker] = useState(false);

    useEffect(() => {
        mapboxgl.accessToken = import.meta.env.VITE_MAPBOX_TOKEN;
        const map = new mapboxgl.Map({
            container: mapContainerRef.current,
            style: 'mapbox://styles/gigin/clp5jayun01l901pr6ivg5npf',
            center: [0.1278, 52.2053],
            zoom: 10,
        });
        setMapInstance(map);
        return () => {
            if (map) {
                map.remove();
            }
        };
    }, []);

    useEffect(() => {
        const handleClickOutside = (event) => {
            if (!event.target.closest('.filter-bar') && !event.target.closest('.react-datepicker')) {
                setShowDatePicker(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, []);

    useEffect(() => {
        if (mapInstance && upcomingGigs && upcomingGigs.length > 0) {
            clearMarkers();
            const filteredGigs = selectedDates.length > 0
                ? upcomingGigs.filter(gig => {
                    const gigDate = gig.date.toDate();
                    return selectedDates.some(
                        selectedDate => gigDate.toDateString() === selectedDate.toDateString()
                    );
                })
                : upcomingGigs;
            const newMarkers = {};
            filteredGigs.forEach(gig => {
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
            setMarkers(newMarkers);
        }
    }, [mapInstance, upcomingGigs, clickedGigs, selectedDates]);

    const createCustomMarker = (gig) => {
        const markerElement = document.createElement('div');
        markerElement.className = 'custom-marker';
        markerElement.style.background = 'var(--gn-white)';
        markerElement.style.boxShadow = '0px 0px 10px var(--gn-shadow)';
        markerElement.style.width = '50px';
        markerElement.style.height = '30px';
        markerElement.style.borderRadius = '25px';
        markerElement.style.display = 'flex';
        markerElement.style.justifyContent = 'center';
        markerElement.style.alignItems = 'center';
        markerElement.style.position = 'relative';
        markerElement.style.padding = '15px 35px';
        markerElement.style.cursor = 'pointer';
        markerElement.style.transition = 'background-color 200ms linear';
        const tooltip = document.createElement('span');
        tooltip.textContent = `${gig.budget}`;
        tooltip.style.color = 'var(--gn-off-black)';
        tooltip.style.fontWeight = '700';
        tooltip.style.fontSize = '1.1rem';
        markerElement.appendChild(tooltip);
        return markerElement;
    };

    const handleMarkerClick = (gig) => {
        const alreadyClicked = clickedGigs.find(clickedGig => clickedGig.gigId === gig.gigId);
        if (!alreadyClicked) {
            setClickedGigs(prevClickedGigs => [...prevClickedGigs, gig]);
            setCurrentGigIndex(clickedGigs.length);
        }
    };

    const handleMarkerMouseEnter = (markerElement) => {
        markerElement.style.background = 'var(--gn-off-black)';
        markerElement.querySelector('span').style.color = 'white';
    };

    const handleMarkerMouseLeave = (markerElement) => {
        markerElement.style.background = 'var(--gn-white)';
        markerElement.querySelector('span').style.color = 'black';
    };

    
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

    function formatGigRange(gigStartTime, duration) {
        const [startHour, startMinute] = gigStartTime.split(':').map(Number);
        const startDate = new Date();
        startDate.setHours(startHour, startMinute, 0, 0);
        const endDate = new Date(startDate.getTime() + duration * 60000);
        const formatTime = (date) => date.toTimeString().slice(0, 5);
        return `${formatTime(startDate)}-${formatTime(endDate)}`;
    }

    return (
        <div className="map-view">
            <div className="filter-bar">
                {showDatePicker ? (
                    <ReactDatePicker
                        selected={null} // Ensure no single date is pre-selected
                        onChange={(date) => {
                            setSelectedDates((prevDates) => 
                                prevDates.some(d => d.toDateString() === date.toDateString())
                                    ? prevDates.filter(d => d.toDateString() !== date.toDateString())
                                    : [...prevDates, date]
                            );
                            setShowDatePicker(false);
                        }}
                        dateFormat="dd-MM-yyyy"
                        placeholderText="Select Dates"
                        inline
                    />
                ) : (
                    selectedDates.length > 0 ? (
                        <ul className="selected-dates"  onClick={() => setShowDatePicker(prevState => !prevState)}>
                            {selectedDates.map((date, index) => (
                                <li key={index}>
                                    {date.toLocaleDateString('en-GB')}
                                    {index < selectedDates.length - 1 && ','}
                                </li>
                            ))}
                        </ul>
                    ) : (
                        <h4 className="filter-button" onClick={() => setShowDatePicker(prevState => !prevState)}>
                            Filter by Date
                        </h4>
                    )
                )}
                {selectedDates.length > 0 && (
                    <button className="btn primary round" onClick={() => setSelectedDates([])}>Clear Filters</button>
                )}
            </div>
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
                                <ErrorIcon />
                            </button>
                            <div className="preview-gig-item-venue">
                                <figure className="preview-gig-img">
                                    <img src={gig.venue.photo} alt={gig.venue.venueName} />
                                </figure>
                                <div className="preview-gig-info">
                                    <h3>{gig.venue.venueName}</h3>
                                    <p>{formatDate(gig.date)}</p>
                                    <p>{formatGigRange(gig.startTime, gig.duration)}</p>
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
