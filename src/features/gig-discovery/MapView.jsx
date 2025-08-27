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

        mapboxgl.accessToken = import.meta.env.VITE_MAPBOX_TOKEN;
    
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
            id: 'clusters-shadow',
            type: 'circle',
            source: 'gigs',
            filter: ['has', 'point_count'],
            paint: {
              'circle-color': 'rgba(0, 0, 0, 0.07)', // soft grey shadow
              'circle-radius': [
                'step',
                ['get', 'point_count'],
                16, 5,
                20, 10,
                24, 25,
                28
              ],
              'circle-blur': 1.2,
            },
          });
    
          map.addLayer({
            id: 'clusters',
            type: 'circle',
            source: 'gigs',
            filter: ['has', 'point_count'],
            paint: {
              'circle-color': '#1A1A1A',
              'circle-radius': [
                'step',
                ['get', 'point_count'],
                12, 5,
                16, 10,
                20, 25,
                24
              ],
              'circle-stroke-width': 0,
            },
          });
    
          map.addLayer({
            id: 'cluster-count',
            type: 'symbol',
            source: 'gigs',
            filter: ['has', 'point_count'],
            layout: {
              'text-field': ['concat', ['get', 'point_count_abbreviated'], ' gigs'],
              'text-font': ['DM Sans Bold'],
              'text-size': 13,
              'text-anchor': 'center',
            },
            paint: {
              'text-color': '#FFFFFF',
              'text-halo-color': '#1A1A1A',
              'text-halo-width': 1.5,
            },
          });
    
          map.addLayer({
            id: 'unclustered-point',
            type: 'circle',
            source: 'gigs',
            filter: ['!', ['has', 'point_count']],
            paint: {
              'circle-color': '#FF6C4B',
              'circle-radius': 8,
              'circle-blur': 0.3,
              'circle-opacity': 1,
              'circle-stroke-width': 0,
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
              'text-anchor': 'top',
              'text-offset': [0, 0.5],
            },
            paint: {
              'text-color': '#111111',
              'text-halo-color': '#FFFFFF',
              'text-halo-width': 1,
              'text-halo-blur': 0.5,
            },
          });

          map.addLayer({
            id: 'unclustered-hit',
            type: 'circle',
            source: 'gigs',
            filter: ['!', ['has', 'point_count']],
            paint: {
              'circle-radius': [
                'interpolate', ['linear'], ['zoom'],
                5, 18,
                10, 22,
                14, 26
              ],
              'circle-color': '#fff',
              'circle-opacity': 0
            }
          });
    
          const handleUnclusteredClick = (e) => {
            const padding = 10;
            const p1 = new mapboxgl.Point(e.point.x - padding, e.point.y - padding);
            const p2 = new mapboxgl.Point(e.point.x + padding, e.point.y + padding);
          
            const features = map.queryRenderedFeatures([p1, p2], {
              layers: ['unclustered-point', 'unclustered-hit', 'unclustered-point-label'],
            });
            if (!features.length) return;
          
            const ids = new Set(
              features.map(f => f.properties?.gigId).filter(Boolean)
            );
          
            const gigsToAdd = upcomingGigs.filter(g => ids.has(g.gigId));
          
            setClickedGigs(prev => {
              const byId = Object.fromEntries(prev.map(g => [g.gigId, g]));
              gigsToAdd.forEach(g => { byId[g.gigId] = g; });
              return Object.values(byId);
            });
          };

          map.on('click', 'unclustered-hit', handleUnclusteredClick);
          map.on('click', 'unclustered-point', handleUnclusteredClick);
          map.on('click', 'unclustered-point-label', handleUnclusteredClick);

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

          map.on('mouseenter', 'unclustered-point', () => {
            map.getCanvas().style.cursor = 'pointer';
          });
          map.on('mouseleave', 'unclustered-point', () => {
            map.getCanvas().style.cursor = '';
          });
          map.on('mouseenter', 'unclustered-hit', () => {
            map.getCanvas().style.cursor = 'pointer';
          });
          map.on('mouseleave', 'unclustered-hit', () => {
            map.getCanvas().style.cursor = '';
          });
          
        });
    
        setMapInstance(map);
        return () => map.remove();
      }, [upcomingGigs, loading, gigMarkerDisplay]);

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
