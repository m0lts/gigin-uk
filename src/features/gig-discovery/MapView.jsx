import { useState, useEffect, useRef } from 'react';
import mapboxgl from 'mapbox-gl';
import { ErrorIcon } from '@features/shared/ui/extras/Icons';
import ReactDatePicker from 'react-datepicker';
import 'react-datepicker/dist/react-datepicker.css';
import { useFilterGigsByDate } from '@hooks/useFilterGigsByDate';
import { formatDate } from '@services/utils/dates';
import { openInNewTab } from '@services/utils/misc';


export const MapView = ({ upcomingGigs }) => {

    const mapContainerRef = useRef(null);
    const [mapInstance, setMapInstance] = useState(null); // State to hold the map instance
    const [clickedGigs, setClickedGigs] = useState([]); // State to hold clicked gigs
    const [selectedDates, setSelectedDates] = useState([]);
    const [showDatePicker, setShowDatePicker] = useState(false);

    const filteredGigs = useFilterGigsByDate(upcomingGigs, selectedDates);

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
        mapboxgl.accessToken = import.meta.env.DEV
          ? 'pk.eyJ1IjoiZ2lnaW4iLCJhIjoiY2xwNDQ2ajFwMWRuNzJxczZqNHlvbHg3ZCJ9.nR_HaL-dWRkUhOgBnmbyjg'
          : import.meta.env.VITE_MAPBOX_TOKEN;
    
        const map = new mapboxgl.Map({
          container: mapContainerRef.current,
          style: 'mapbox://styles/gigin/clp5jayun01l901pr6ivg5npf',
          center: [0.1278, 52.2053],
          zoom: 10,
        });
    
        map.on('load', () => {
          const geojson = {
            type: 'FeatureCollection',
            features: filteredGigs.map(gig => ({
              type: 'Feature',
              properties: {
                gigId: gig.gigId,
                budget: gig.budget,
              },
              geometry: {
                type: 'Point',
                coordinates: gig.coordinates,
              },
            })),
          };
    
          map.addSource('gigs', {
            type: 'geojson',
            data: geojson,
            cluster: true,
            clusterMaxZoom: 14,
            clusterRadius: 50,
          });
    
          map.addLayer({
            id: 'clusters',
            type: 'circle',
            source: 'gigs',
            filter: ['has', 'point_count'],
            paint: {
              'circle-color': 'white',
              'circle-radius': [
                'step',
                ['get', 'point_count'],
                15, 5,
                20, 10,
                40,
              ],
              'circle-stroke-color': 'rgba(0,0,0,0.15)',
              'circle-stroke-width': 2,
            },
          });
    
          map.addLayer({
            id: 'cluster-count',
            type: 'symbol',
            source: 'gigs',
            filter: ['has', 'point_count'],
            layout: {
              'text-field': 'x{point_count_abbreviated}',
              'text-font': ['DM Sans Bold'],
              'text-size': 14,
            },
            paint: {
              'text-color': '#333',
            },
          });
    
          map.addLayer({
            id: 'unclustered-point',
            type: 'circle',
            source: 'gigs',
            filter: ['!', ['has', 'point_count']],
            paint: {
              'circle-color': 'white',
              'circle-radius': 25,
              'circle-stroke-color': 'rgba(255, 108, 75, 0.5)',
              'circle-stroke-width': 2,
            },
          });
    
          map.addLayer({
            id: 'unclustered-point-label',
            type: 'symbol',
            source: 'gigs',
            filter: ['!', ['has', 'point_count']],
            layout: {
              'text-field': ['get', 'budget'],
              'text-font': ['DM Sans Bold'],
              'text-size': 14,
              'text-offset': [0, -0.5],
              'text-anchor': 'top',
            },
            paint: {
              'text-color': '#111',
            },
          });
    
          map.on('click', 'unclustered-point', (e) => {
            const features = map.queryRenderedFeatures(e.point, {
              layers: ['unclustered-point'],
            });
          
            const gigId = features[0]?.properties?.gigId;
            const gig = filteredGigs.find(g => g.gigId === gigId);
          
            if (gig) {
              setClickedGigs(prev => {
                const exists = prev.some(g => g.gigId === gig.gigId);
                if (exists) return prev;
                return [...prev, gig];
              });
            }
          });

          map.on('click', 'clusters', (e) => {
            const features = map.queryRenderedFeatures(e.point, {
              layers: ['clusters'],
            });
          
            if (!features.length) return;
          
            const clusterId = features[0].properties.cluster_id;
            const source = map.getSource('gigs');
          
            source.getClusterLeaves(clusterId, Infinity, 0, (err, leafFeatures) => {
              if (err) {
                console.error('Error fetching cluster leaves:', err);
                return;
              }
          
              const newGigs = leafFeatures
                .map(f => {
                  const gigId = f.properties.gigId;
                  return filteredGigs.find(g => g.gigId === gigId);
                })
                .filter(g => !!g); // just in case any are undefined
          
              setClickedGigs(prev => {
                const merged = [...prev, ...newGigs];
                const uniqueById = {};
                merged.forEach(gig => {
                  uniqueById[gig.gigId] = gig;
                });
                return Object.values(uniqueById);
              });
            });
          });
        });
    
        setMapInstance(map);
        return () => map.remove();
      }, [filteredGigs]);
        
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
        <div className='map-view'>
            <div className='filter-bar'>
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
                        dateFormat='dd-MM-yyyy'
                        placeholderText='Select Dates'
                        inline
                    />
                ) : (
                    selectedDates.length > 0 ? (
                        <ul className='selected-dates'  onClick={() => setShowDatePicker(prevState => !prevState)}>
                            {selectedDates.map((date, index) => (
                                <li key={index}>
                                    {date.toLocaleDateString('en-GB')}
                                    {index < selectedDates.length - 1 && ','}
                                </li>
                            ))}
                        </ul>
                    ) : (
                        <h4 className='filter-button' onClick={() => setShowDatePicker(prevState => !prevState)}>
                            Filter by Date
                        </h4>
                    )
                )}
                {selectedDates.length > 0 && (
                    <button className='btn primary round' onClick={() => setSelectedDates([])}>Clear Filters</button>
                )}
            </div>
            <div
                ref={mapContainerRef}
                className='map'
                style={{ width: '100%', height: '100%' }}
            />
            <>
            {clickedGigs.length > 0 && (
                <ul className='preview-gig-list'>
                    {clickedGigs.map((gig, index) => (
                        <li className='preview-gig-item' key={index} onClick={(e) => openInNewTab(`/gig/${gig.gigId}`, e)}>
                            <button className='btn danger' onClick={(e) => handleCloseGig(gig, e)}>
                                <ErrorIcon />
                            </button>
                            <div className='preview-gig-item-venue'>
                                <figure className='preview-gig-img'>
                                    <img src={gig.venue.photo} alt={gig.venue.venueName} />
                                </figure>
                                <div className='preview-gig-info'>
                                    <h3>{gig.venue.venueName}</h3>
                                    <p>{formatDate(gig.date)}</p>
                                    <p>{formatGigRange(gig.startTime, gig.duration)}</p>
                                </div>
                            </div>
                            <div className='preview-gig-budget'>
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
