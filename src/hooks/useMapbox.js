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
function pinElement(color, active) {
  const el = document.createElement('button');
  el.type = 'button';
  el.style.cssText = `width:${active ? 22 : 16}px;height:${active ? 22 : 16}px;border-radius:999px;border:2px solid #fff;background:${color};box-shadow:0 2px 6px rgba(15,17,21,.35);padding:0;cursor:pointer;`;
  return el;
}

export const useMapbox = ({
  containerRef,
  coordinates,
  addMarker = true,
  style = 'mapbox://styles/gigin/clp5jayun01l901pr6ivg5npf',
  zoom = 15,
  shouldInit = true,
  token = import.meta.env.VITE_MAPBOX_TOKEN,
  reinitKey,
  markers,
  activeMarkerId,
  onMarkerClick,
}) => {
  useEffect(() => {
    if (!shouldInit || !containerRef.current) return undefined;
    const list = Array.isArray(markers) ? markers.filter((marker) => marker?.coordinates?.length === 2) : [];
    const center = coordinates || list[0]?.coordinates;
    if (!center) return undefined;

    mapboxgl.accessToken = token;

    const map = new mapboxgl.Map({
      container: containerRef.current,
      style,
      center,
      zoom: list.length > 1 ? 12 : zoom,
    });

    if (list.length) {
      const bounds = new mapboxgl.LngLatBounds();
      list.forEach((marker) => {
        bounds.extend(marker.coordinates);
        const el = pinElement(marker.color || '#111317', marker.id === activeMarkerId);
        el.addEventListener('click', () => onMarkerClick?.(marker.id));
        new mapboxgl.Marker({ element: el }).setLngLat(marker.coordinates).addTo(map);
      });
      if (list.length > 1) map.fitBounds(bounds, { padding: 36, maxZoom: 14 });
    } else if (addMarker) {
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
  }, [containerRef, coordinates, shouldInit, token, style, zoom, addMarker, reinitKey, markers, activeMarkerId, onMarkerClick]);
};