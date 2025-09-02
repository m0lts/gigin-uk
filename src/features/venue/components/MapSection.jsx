import { useEffect, useRef, useState } from "react";
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

  useMapbox({
    containerRef: mapContainerRef,
    coordinates: venueData?.coordinates,          // [lng, lat]
    shouldInit: isVisible && !!venueData?.coordinates, // wait until visible + coords ready
    reinitKey: isVisible ? "visible" : "hidden",  // nudge reinit if visibility changes
  });

  return <div ref={mapContainerRef} className="map-container" />;
};