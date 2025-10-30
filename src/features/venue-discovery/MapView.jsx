import { useState, useEffect, useRef } from 'react';
import mapboxgl from 'mapbox-gl';
import { ErrorIcon } from '@features/shared/ui/extras/Icons';
import 'react-datepicker/dist/react-datepicker.css';
import { formatDate } from '@services/utils/dates';
import { LoadingSpinner, LoadingThreeDots } from '../shared/ui/loading/Loading';
import { getCityFromAddress, openInNewTab } from '../../services/utils/misc';
import { MapIcon, TelescopeIcon } from '../shared/ui/extras/Icons';
import { useBreakpoint } from '../../hooks/useBreakpoint';
import { useNavigate } from 'react-router-dom';

const toLngLat = (venue) => {
  if (venue?.geopoint?.longitude != null && venue?.geopoint?.latitude != null) {
    return [venue.geopoint.longitude, venue.geopoint.latitude]; // [lng, lat]
  }
  if (Array.isArray(venue?.coordinates) && venue.coordinates.length === 2) {
    return venue.coordinates; // [lng, lat]
  }
  return null;
};

const toFeatureCollection = (list) => ({
  type: 'FeatureCollection',
  features: (list || [])
    .map((v) => {
      const coords = toLngLat(v);
      if (!coords) return null;
      return {
        type: 'Feature',
        properties: { id: v.id, name: v.name },
        geometry: { type: 'Point', coordinates: coords },
      };
    })
    .filter(Boolean),
});

export const MapOutput = ({ venues, loading, userLocation, onSearchArea, user, clickedVenues, setClickedVenues }) => {
  const navigate = useNavigate();
  const mapContainerRef = useRef(null);
  const mapRef = useRef(null);
  const latestVenuesRef = useRef(venues);
  latestVenuesRef.current = venues;
  const { isMdUp } = useBreakpoint();
  const sourceId = 'venues';
  const centerLngLat = userLocation
    ? [userLocation.longitude, userLocation.latitude]
    : [0.1218, 52.2053]; // Cambridge [lng, lat]

  // Init map once
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
      map.addSource(sourceId, {
        type: 'geojson',
        data: toFeatureCollection(latestVenuesRef.current),
        cluster: true,
        clusterMaxZoom: 14,
        clusterRadius: 50,
      });

      map.addLayer({
        id: 'clusters-shadow',
        type: 'circle',
        source: sourceId,
        filter: ['has', 'point_count'],
        paint: {
          'circle-color': 'rgba(0, 0, 0, 0.07)',
          'circle-radius': ['step', ['get', 'point_count'], 16, 5, 20, 10, 24, 25, 28],
          'circle-blur': 1.2,
        },
      });

      map.addLayer({
        id: 'clusters',
        type: 'circle',
        source: sourceId,
        filter: ['has', 'point_count'],
        paint: {
          'circle-color': '#1A1A1A',
          'circle-radius': ['step', ['get', 'point_count'], 12, 5, 16, 10, 20, 25, 24],
          'circle-stroke-width': 0,
        },
      });

      map.addLayer({
        id: 'cluster-count',
        type: 'symbol',
        source: sourceId,
        filter: ['has', 'point_count'],
        layout: {
          'text-field': ['concat', ['get', 'point_count_abbreviated'], ' Venues'],
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
        source: sourceId,
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
        source: sourceId,
        filter: ['!', ['has', 'point_count']],
        layout: {
          'text-field': ['get', 'name'],
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
        source: sourceId,
        filter: ['!', ['has', 'point_count']],
        paint: {
          'circle-radius': ['interpolate', ['linear'], ['zoom'], 5, 18, 10, 22, 14, 26],
          'circle-color': '#fff',
          'circle-opacity': 0,
        },
      });

      const handleUnclusteredClick = (e) => {
        const padding = 10;
        const p1 = new mapboxgl.Point(e.point.x - padding, e.point.y - padding);
        const p2 = new mapboxgl.Point(e.point.x + padding, e.point.y + padding);
        const features = map.queryRenderedFeatures([p1, p2], {
          layers: ['unclustered-point', 'unclustered-hit', 'unclustered-point-label'],
        });
        if (!features.length) return;
        const ids = new Set(features.map((f) => f.properties?.id).filter(Boolean));
        const match = (latestVenuesRef.current || []).find((v) => ids.has(v.id));
        if (match) {
          if (user?.musicianProfile) {
            window.open(`/venues/${match.id}?musicianId=${user.musicianProfile.id}`, '_blank', 'noopener,noreferrer')
          } else {
            window.open(`/venues/${match.id}`, '_blank', 'noopener,noreferrer')
          }
        };
      };

      map.on('click', 'unclustered-hit', handleUnclusteredClick);
      ['unclustered-point', 'unclustered-hit'].forEach((l) => {
          map.on('mouseenter', l, () => (map.getCanvas().style.cursor = 'pointer'));
          map.on('mouseleave', l, () => (map.getCanvas().style.cursor = ''));
        });
      });

      map.on('mouseenter', 'clusters', () => (map.getCanvas().style.cursor = 'pointer'));
      map.on('mouseleave', 'clusters', () => (map.getCanvas().style.cursor = ''));

      map.on('click', 'clusters', (e) => {
        const features = map.queryRenderedFeatures(e.point, { layers: ['clusters'] });
        if (!features.length) return;
      
        const clusterId = features[0].properties.cluster_id;
        const source = map.getSource(sourceId);
      
        source.getClusterLeaves(clusterId, Infinity, 0, (err, leaves) => {
          if (err) return console.error(err);
      
          const newVenues = leaves
            .map(f => {
              const id = f.properties?.id;
              return (latestVenuesRef.current || []).find(v => v.id === id);
            })
            .filter(Boolean)
            .sort((a, b) => (a?.name || '').localeCompare(b?.name || ''));
      
          setClickedVenues(prev => {
            const byId = Object.fromEntries((prev || []).map(v => [v.id, v]));
            newVenues.forEach(v => { byId[v.id] = v; });
            return Object.values(byId);
          });
        });
      });

    mapRef.current = map;
    return () => { map.remove(); mapRef.current = null; };

  }, []);

  // Recenter when userLocation changes
  useEffect(() => {
    if (!mapRef.current || !userLocation) return;
    mapRef.current.easeTo({ center: centerLngLat, duration: 500 });
  }, [userLocation]);

  // Update data when venues change
  useEffect(() => {
    if (!mapRef.current) return;
    const src = mapRef.current.getSource(sourceId);
    if (src) src.setData(toFeatureCollection(venues));
  }, [venues]);

  return (
    <div className="output-container">
      <div ref={mapContainerRef} className="map" style={{ width: '100%', height: clickedVenues.length > 0 ? '70%' : '100%' }}>
        {!loading && (
          <button
            className="btn primary"
            onClick={() => {
              if (!mapRef.current) return;
              const center = mapRef.current.getCenter();
              onSearchArea?.({ latitude: center.lat, longitude: center.lng });
            }}
          >
            <TelescopeIcon />
            Search Here
          </button>
        )}
        {loading && (
          <div className="map-loading">
            <LoadingSpinner width={20} height={20} />
            <span style={{ marginRight: 2 }}>Finding Venues...</span>
          </div>
        )}
        {(!isMdUp && !loading) && (
          <button className="btn secondary venue-button" onClick={() => navigate('/find-a-gig')}>
            <MapIcon />
            Find a Gig
          </button>
        )}
      </div>

      {(clickedVenues?.length ?? 0) > 0 && (
        <div className="preview-gig-container">
          <ul className="preview-gig-list">
            <button
              className="btn danger clear-all"
              onClick={() => setClickedVenues([])}
            >
              <ErrorIcon />
              Clear All
            </button>
            {clickedVenues.map((venue, i) => (
              <li key={i} className="preview-gig-item" onClick={(e) => openInNewTab(`/venues/${venue.venueId}`, e)}>
                <button className="btn danger" onClick={(e) => {
                  e.stopPropagation();
                  setClickedVenues(prev => prev.filter(g => g.venueId !== venue.venueId));
                }}>
                  <ErrorIcon />
                </button>
                <div className="preview-gig-item-venue">
                  <figure className="preview-gig-img">
                    <img src={venue.photos[0]} alt={venue.name} />
                  </figure>
                  <div className="preview-gig-info">
                    <h3>{venue.name?.trim()}</h3>
                    <p>{getCityFromAddress(venue.address)}</p>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}

    </div>
  );
};