import { useState, useEffect, useRef } from 'react';
import mapboxgl from 'mapbox-gl';
import { ErrorIcon } from '@features/shared/ui/extras/Icons';
import 'react-datepicker/dist/react-datepicker.css';
import { formatDate, toJsDate } from '@services/utils/dates';
import { LoadingSpinner, LoadingThreeDots } from '../shared/ui/loading/Loading';
import { openInNewTab } from '../../services/utils/misc';
import { CloseIcon, FilterIconEmpty, MapIcon, TelescopeIcon } from '../shared/ui/extras/Icons';
import { useBreakpoint } from '../../hooks/useBreakpoint';
import { useNavigate } from 'react-router-dom';

const labelFor = (g) =>
((g.budget === '£' || g.budget === 'No Fee') && (g.kind === 'Ticketed Gig' || g.kind === 'Open Mic'))
  ? g.kind
  : (g.budget !== 'No Fee' ? g.budget : 'No Fee');

const toFeatureCollection = (list) => {
  const features = (list || [])
    .map((gig) => {
      const coordinates = gig.coordinates;
      if (!coordinates || !Array.isArray(coordinates) || coordinates.length !== 2) {
        return null;
      }
      return {
        type: 'Feature',
        properties: {
          gigId: gig.gigId,
          budget: gig.budget,
          kind: gig.kind,
          label: labelFor(gig),
        },
        geometry: { type: 'Point', coordinates },
      };
    })
    .filter(Boolean);
  return {
    type: 'FeatureCollection',
    features,
  };
};

export const MapOutput = ({ upcomingGigs, loading, clickedGigs, setClickedGigs, gigMarkerDisplay, userLocation, onSearchArea, showFilters, toggleFilters, groupedGigs = [] }) => {

  const navigate = useNavigate();
  const mapContainerRef = useRef(null);
  const mapRef = useRef(null);
  const { isMdUp } = useBreakpoint();
  const sourceId = 'gigs';
  const latestGigsRef = useRef(upcomingGigs);
  latestGigsRef.current = upcomingGigs; 

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
        zoom: 12,
      });
  
      map.on('load', () => {
  
        map.addSource(sourceId, {
          type: 'geojson',
          data: toFeatureCollection(latestGigsRef.current),
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
  
          const ids = new Set(features.map(f => f.properties?.gigId).filter(Boolean));
          const gigsToAdd = (latestGigsRef.current || []).filter(g => ids.has(g.gigId));

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
          const features = map.queryRenderedFeatures(e.point, { layers: ['clusters'] });
          if (!features.length) return;
  
          const clusterId = features[0].properties.cluster_id;
          const source = map.getSource(sourceId);
  
          source.getClusterLeaves(clusterId, Infinity, 0, (err, leaves) => {
            if (err) return console.error(err);
  
            const newGigs = leaves
              .map(f => {
                const gigId = f.properties.gigId;
                return (latestGigsRef.current || []).find(g => g.gigId === gigId);
              })
              .filter(Boolean)
              .sort((a, b) => {
                const dateA = toJsDate(a.startDateTime);
                const dateB = toJsDate(b.startDateTime);
                if (!dateA || !dateB) return 0;
                return dateA.getTime() - dateB.getTime();
              });
  
            setClickedGigs(prev => {
              const merged = [...prev, ...newGigs];
              const uniq = {};
              merged.forEach(g => { uniq[g.gigId] = g; });
              return Object.values(uniq);
            });
          });
        });
  
        // cursors...
        ['unclustered-point', 'unclustered-hit'].forEach(l => {
          map.on('mouseenter', l, () => (map.getCanvas().style.cursor = 'pointer'));
          map.on('mouseleave', l, () => (map.getCanvas().style.cursor = ''));
        });
        
      });
  
      mapRef.current = map;
      return () => { map.remove(); mapRef.current = null; };
  }, []);

  useEffect(() => {
    if (!mapRef.current || !userLocation) return;
    mapRef.current.easeTo({ center: centerLngLat, duration: 500 });
  }, [userLocation]);
  
  useEffect(() => {
    if (!mapRef.current) return;
    const src = mapRef.current.getSource(sourceId);
    if (src) {
      const featureCollection = toFeatureCollection(upcomingGigs);
      src.setData(featureCollection);
    } else {
      console.warn('Map source not found:', sourceId);
    }
  }, [upcomingGigs]);
  

  function formatGigRange(gigStartTime, duration) {
    const [startHour, startMinute] = gigStartTime.split(':').map(Number);
    const startDate = new Date();
    startDate.setHours(startHour, startMinute, 0, 0);
    const endDate = new Date(startDate.getTime() + duration * 60000);
    const formatTime = (date) => date.toTimeString().slice(0, 5);
    return `${formatTime(startDate)}-${formatTime(endDate)}`;
  }

  function formatGigRangeForGroup(gig) {
    // Find the group this gig belongs to
    const group = groupedGigs.find(g => g.gigIds.includes(gig.gigId));
    
    if (group && group.isGroup && group.allGigs.length > 1) {
      // For grouped gigs, find the earliest start and latest end
      const allSlots = group.allGigs.filter(g => g.startTime && g.duration);
      if (allSlots.length > 0) {
        // Sort by startTime to get first and last
        const sortedSlots = [...allSlots].sort((a, b) => {
          const [aH, aM] = a.startTime.split(':').map(Number);
          const [bH, bM] = b.startTime.split(':').map(Number);
          return (aH * 60 + aM) - (bH * 60 + bM);
        });
        
        const firstSlot = sortedSlots[0];
        const lastSlot = sortedSlots[sortedSlots.length - 1];
        const firstStartTime = firstSlot.startTime;
        
        // Calculate end time of last slot
        const [lastHour, lastMinute] = lastSlot.startTime.split(':').map(Number);
        const lastStartDate = new Date();
        lastStartDate.setHours(lastHour, lastMinute, 0, 0);
        const lastEndDate = new Date(lastStartDate.getTime() + lastSlot.duration * 60000);
        const formatTime = (date) => date.toTimeString().slice(0, 5);
        
        return `${firstStartTime}-${formatTime(lastEndDate)}`;
      }
    }
    
    // For single gigs, use the regular format
    return formatGigRange(gig.startTime, gig.duration);
  }

  return (
    <div className="output-container">
      <div
        ref={mapContainerRef}
        className="map"
        style={{ width: '100%', height: clickedGigs.length > 0 ? '70%' : '100%', borderRadius: (!isMdUp && clickedGigs.length > 0) ? '0 0 0.5rem 0.5rem' : '0 0 1rem1rem' }}
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
            <button
              className="btn danger clear-all"
              onClick={() => setClickedGigs([])}
            >
              {isMdUp && (
                <ErrorIcon />
              )}
              Clear All
            </button>
            {clickedGigs.map((gig, i) => (
              <li key={i} className="preview-gig-item" onClick={(e) => openInNewTab(`/gig/${gig.gigId}`, e)}>
                <button className="btn danger" onClick={(e) => {
                  e.stopPropagation();
                  setClickedGigs(prev => prev.filter(g => g.gigId !== gig.gigId));
                }}>
                  <ErrorIcon />
                </button>
                {isMdUp ? (
                  <div className="preview-gig-item-venue">
                    <figure className="preview-gig-img">
                      <img src={gig.venue.photo} alt={gig.venue.venueName} />
                    </figure>
                    <div className="preview-gig-info">
                      <h3>{gig.venue.venueName?.trim()}</h3>
                      <p>{formatDate(gig.date)}</p>
                      <p>{formatGigRangeForGroup(gig)}</p>
                    </div>
                  </div>
                ) : (
                  <div className="preview-gig-item-venue">
                    <div className="preview-gig-info">
                      <h3>{gig.venue.venueName?.trim()}</h3>
                      <p>{formatDate(gig.date)}, {formatGigRangeForGroup(gig)}</p>
                    </div>
                  </div>
                )}
                <div className="preview-gig-budget">
                {((gig.budget === '£' || gig.budget === 'No Fee' || gig.budget === '£0') && (gig.kind === 'Ticketed Gig' || gig.kind === 'Open Mic')) ? (
                  <h3 className='budget text'>{gig.kind}</h3>
                ) : (
                  <h3 className='budget'>{(gig.budget !== '£' && gig.budget !== '£0') ? gig.budget : 'No Fee'}</h3>
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
