import { useEffect, useRef, useState, useMemo } from "react";
import { useMapbox } from "../../../hooks/useMapbox";

export const MapSection = ({ venueData }) => {
  const mapContainerRef = useRef(null);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const el = mapContainerRef.current;
    if (!el) return;

    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some(e => e.isIntersecting)) setIsVisible(true);
      },
      { threshold: 0.01 }
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  // Extract coordinates from venueData, handling various formats
  // Mapbox expects [lng, lat] format
  const mapCoordinates = useMemo(() => {
    if (venueData?.coordinates && Array.isArray(venueData.coordinates) && venueData.coordinates.length === 2) {
      // venueData.coordinates should already be [lng, lat]
      const [lng, lat] = venueData.coordinates;
      if (typeof lng === 'number' && typeof lat === 'number' && !isNaN(lng) && !isNaN(lat)) {
        return [lng, lat];
      }
    }
    // Fallback to venueData.geopoint if it exists
    if (venueData?.geopoint) {
      const lat = venueData.geopoint._lat || venueData.geopoint.latitude;
      const lng = venueData.geopoint._long || venueData.geopoint.longitude;
      if (typeof lat === 'number' && typeof lng === 'number' && !isNaN(lat) && !isNaN(lng)) {
        return [lng, lat]; // Mapbox expects [lng, lat]
      }
    }
    return null;
  }, [venueData?.coordinates, venueData?.geopoint]);

  useMapbox({
    containerRef: mapContainerRef,
    coordinates: mapCoordinates,
    shouldInit: isVisible && !!mapCoordinates, // wait until visible + valid coords ready
    reinitKey: isVisible ? "visible" : "hidden",  // nudge reinit if visibility changes
  });

  return <div ref={mapContainerRef} className="map-container" />;
};