import { useState, useEffect, useRef } from 'react';
import mapboxgl from 'mapbox-gl';
import { ErrorIcon } from '@features/shared/ui/extras/Icons';
import 'react-datepicker/dist/react-datepicker.css';
import { formatDate } from '@services/utils/dates';
import { LoadingThreeDots } from '../shared/ui/loading/Loading';
import { openInNewTab } from '../../services/utils/misc';

export const MapOutput = ({ upcomingGigs, loading, clickedGigs, setClickedGigs, gigMarkerDisplay }) => {

    const mapContainerRef = useRef(null);
    const [mapInstance, setMapInstance] = useState(null);

    useEffect(() => {
      if (!mapContainerRef.current || !upcomingGigs.length) return;

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
            features: upcomingGigs.map(gig => ({
              type: 'Feature',
              properties: {
                gigId: gig.gigId,
                budget: gig.budget,
                kind: gig.kind,
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
              'text-field': ['get', gigMarkerDisplay],
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
            const gig = upcomingGigs.find(g => g.gigId === gigId);
          
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
                  return upcomingGigs.find(g => g.gigId === gigId);
                })
                .filter(g => !!g);
          
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
      }, [upcomingGigs, loading, gigMarkerDisplay]);
        
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
      <div className="output-container">
        {!loading ? (
          upcomingGigs.length > 0 ? (
            <div ref={mapContainerRef} className="map" style={{ width: '100%', height: clickedGigs.length > 0 ? '70%' : '100%' }} />
          ) : (
            <div className="map-loading"><h3>No Results</h3></div>
          )
        ) : (
          <div className="map-loading"><h3>Loading Gigs</h3> <LoadingThreeDots /></div>
        )}
  
        {clickedGigs.length > 0 && (
          <div className="preview-gig-container">
            <ul className="preview-gig-list">
              {clickedGigs.map((gig, i) => (
                <li key={i} className="preview-gig-item" onClick={(e) => openInNewTab(`/gig/${gig.gigId}`, e)}>
                  <button className="btn danger" onClick={(e) => {
                    e.stopPropagation();
                    setClickedGigs(prev => prev.filter(g => g.gigId !== gig.gigId));
                  }}>
                    <ErrorIcon />
                  </button>
                  <div className="preview-gig-item-venue">
                    <figure className="preview-gig-img">
                      <img src={gig.venue.photo} alt={gig.venue.venueName} />
                    </figure>
                    <div className="preview-gig-info">
                      <h3>{gig.venue.venueName?.trim()}</h3>
                      <p>{formatDate(gig.date)}</p>
                      <p>{formatGigRange(gig.startTime, gig.duration)}</p>
                    </div>
                  </div>
                  <div className="preview-gig-budget">
                    <h3>{gig.budget !== '£' ? gig.budget : 'No Fee'}</h3>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    );
};
