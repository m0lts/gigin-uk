import { useEffect } from 'react';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';

/**
 * Initializes a Mapbox map and optionally adds a marker.
 * 
 * @param {Object} params
 * @param {React.RefObject} params.containerRef - Ref to map container div.
 * @param {number[]} params.coordinates - [lng, lat]
 * @param {boolean} [params.addMarker=true] - Whether to add a marker at the center.
 * @param {string} [params.style] - Mapbox style URL.
 * @param {number} [params.zoom] - Initial zoom level.
 * @param {boolean} [params.shouldInit=true] - Whether to initialize map.
 * @param {string} [params.token] - Optional token override.
 */
export const useMapbox = ({
  containerRef,
  coordinates,
  addMarker = true,
  style = 'mapbox://styles/gigin/clp5jayun01l901pr6ivg5npf',
  zoom = 15,
  shouldInit = true,
  token = import.meta.env.VITE_MAPBOX_TOKEN,
  reinitKey
}) => {
  useEffect(() => {
    if (!shouldInit || !coordinates || !containerRef.current) return;

    mapboxgl.accessToken = token;

    const map = new mapboxgl.Map({
      container: containerRef.current,
      style,
      center: coordinates,
      zoom,
    });

    if (addMarker) {
      const el = document.createElement('div');
      el.innerHTML = `
        <svg xmlns="http://www.w3.org/2000/svg" fill="#FF6C4B" viewBox="0 0 24 24" width="30" height="30">
          <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5
                   c-1.38 0-2.5-1.12-2.5-2.5S10.62 6.5 12 6.5s2.5 1.12 2.5 2.5S13.38 11.5 12 11.5z"/>
        </svg>
      `;
      el.style.cursor = 'pointer';
    
      new mapboxgl.Marker({ element: el }).setLngLat(coordinates).addTo(map);
    }

    return () => map.remove();
  }, [containerRef, coordinates, shouldInit, token, style, zoom, addMarker, reinitKey]);
};