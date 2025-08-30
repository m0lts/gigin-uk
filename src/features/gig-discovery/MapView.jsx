import { useState, useEffect, useRef } from 'react';
import mapboxgl from 'mapbox-gl';
import { ErrorIcon } from '@features/shared/ui/extras/Icons';
import 'react-datepicker/dist/react-datepicker.css';
import { formatDate } from '@services/utils/dates';
import { LoadingSpinner, LoadingThreeDots } from '../shared/ui/loading/Loading';
import { openInNewTab } from '../../services/utils/misc';
import { MapIcon } from '../shared/ui/extras/Icons';

export const MapOutput = ({ upcomingGigs, loading, clickedGigs, setClickedGigs, gigMarkerDisplay, userLocation, onSearchArea }) => {

    const mapContainerRef = useRef(null);
    const mapRef = useRef(null)
    const sourceId = 'gigs';

    const centerLngLat = userLocation
    ? [userLocation.longitude, userLocation.latitude]
    : [0.1218, 52.2053];

    useEffect(() => {

      if (!mapContainerRef.current || mapRef.current) return;
        mapboxgl.accessToken = import.meta.env.VITE_MAPBOX_TOKEN;
        const map = new mapboxgl.Map({
          container: mapContainerRef.current,
          style: 'mapbox://styles/gigin/clp5jayun01l901pr6ivg5npf',
          center: centerLngLat,
          zoom: 10,
        });
    
        map.on('load', () => {

          const labelFor = (g) =>
            ((g.budget === '£' || g.budget === 'No Fee') &&
            (g.kind === 'Ticketed Gig' || g.kind === 'Open Mic'))
              ? g.kind
              : (g.budget !== 'No Fee' ? g.budget : 'No Fee');

          const geojson = {
            type: 'FeatureCollection',
            features: upcomingGigs.map(gig => ({
              type: 'Feature',
              properties: {
                gigId: gig.gigId,
                budget: gig.budget,
                kind: gig.kind,
                label: labelFor(gig),
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
              'circle-color': 'rgba(0, 0, 0, 0.07)',
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
              'text-field': ['concat', ['get', 'point_count_abbreviated'], ' Gigs'],
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
              'text-field': ['get', 'label'],
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
    
        mapRef.current = map;
        return () => { map.remove(); mapRef.current = null; };
      }, []);

      // 2) Recenter when userLocation becomes available
  useEffect(() => {
    if (!mapRef.current) return;
    if (!userLocation) return;
    mapRef.current.easeTo({ center: centerLngLat, duration: 500 });
  }, [userLocation]); // recenter only

  // 3) Update source data whenever results change (even 0)
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    const labelFor = (g) =>
      ((g.budget === '£' || g.budget === 'No Fee') && (g.kind === 'Ticketed Gig' || g.kind === 'Open Mic'))
        ? g.kind
        : (g.budget !== 'No Fee' ? g.budget : 'No Fee');

    const data = {
      type: 'FeatureCollection',
      features: (upcomingGigs || []).map(gig => ({
        type: 'Feature',
        properties: {
          gigId: gig.gigId,
          budget: gig.budget,
          kind: gig.kind,
          label: labelFor(gig),
        },
        geometry: { type: 'Point', coordinates: gig.coordinates },
      })),
    };

    const src = map.getSource(sourceId);
    if (src) src.setData(data);
  }, [upcomingGigs]);

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
        <div
          ref={mapContainerRef}
          className="map"
          style={{ width: '100%', height: clickedGigs.length > 0 ? '70%' : '100%' }}
        >
          {!loading && (
            <button
              className="btn primary"
              onClick={() => {
                if (!mapRef.current) return;
                const center = mapRef.current.getCenter();
                onSearchArea?.({ latitude: center.lat, longitude: center.lng });
              }}
            >
              <MapIcon />
              Search Here
            </button>
          )}
          {loading && (
            <div className="map-loading">
              <LoadingSpinner width={20} height={20} />
              <span style={{ marginRight: 2 }}>Finding Gigs...</span>
            </div>
          )}
        </div>
  
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
                  {((gig.budget === '£' || gig.budget === 'No Fee') && (gig.kind === 'Ticketed Gig' || gig.kind === 'Open Mic')) ? (
                    <h3 className='budget text'>{gig.kind}</h3>
                  ) : (
                    <h3 className='budget'>{gig.budget !== '£' ? gig.budget : 'No Fee'}</h3>
                  )}
                  </div>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    );
};
