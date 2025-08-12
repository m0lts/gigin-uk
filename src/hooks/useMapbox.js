import { useEffect } from 'react';
import mapboxgl from 'mapbox-gl';

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
      new mapboxgl.Marker().setLngLat(coordinates).addTo(map);
    }

    return () => map.remove();
  }, [containerRef, coordinates, shouldInit, token, style, zoom, addMarker, reinitKey]);
};