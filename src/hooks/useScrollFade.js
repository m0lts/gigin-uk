import { useState, useEffect, useRef } from 'react';

/**
 * Hook to fade out and minimize elements as they scroll out of view at the top of a scroll container
 * @param {React.RefObject} elementRef - Ref to the element to observe
 * @param {React.RefObject} scrollContainerRef - Ref to the scrollable container
 * @param {number} fadeHeight - Height in pixels where the fade should occur (default: 30px)
 * @returns {{opacity: number, scale: number}} - Object with opacity (0-1) and scale (0.85-1) values
 */
export const useScrollFade = (elementRef, scrollContainerRef = null, fadeHeight = 30) => {
  const [opacity, setOpacity] = useState(1);
  const [scale, setScale] = useState(1);
  const rafRef = useRef(null);

  useEffect(() => {
    const element = elementRef?.current;
    const scrollContainer = scrollContainerRef?.current;

    if (!element || !scrollContainer) return;

    const updateValues = () => {
      if (!element || !scrollContainer) return;

      const containerRect = scrollContainer.getBoundingClientRect();
      const elementRect = element.getBoundingClientRect();

      // Calculate the distance from the top of the scroll container
      const distanceFromTop = elementRect.top - containerRect.top;
      
      // Check if element is actually visible in container
      const elementBottom = elementRect.bottom;
      const containerBottom = containerRect.bottom;
      const isElementVisible = elementRect.top < containerBottom && elementBottom > containerRect.top;

      // Only fade/minimize when element is at or past the top edge
      const fadeZone = fadeHeight;
      let newOpacity = 1;
      let newScale = 1;
      
      // If element is clearly visible and not near the top, force opacity to 1
      if (isElementVisible && distanceFromTop > fadeZone + 10) {
        // Element is fully visible with buffer - FORCE exactly 1
        newOpacity = 1;
        newScale = 1;
      } else if (distanceFromTop < 0) {
        // Element is past the top - fully faded
        newOpacity = 0;
        newScale = 0.85;
      } else if (distanceFromTop >= 0 && distanceFromTop <= fadeZone) {
        // Element is in fade zone - calculate fade
        const progress = distanceFromTop / fadeZone;
        newOpacity = Math.max(0, Math.min(1, progress));
        newScale = 0.85 + (progress * 0.15);
      } else {
        // Element is visible but close to fade zone - still force to 1
        newOpacity = 1;
        newScale = 1;
      }
      
      // Final safety: ALWAYS force to 1 if >= 0.9
      if (newOpacity >= 0.9) {
        newOpacity = 1;
      }
      if (newScale >= 0.9) {
        newScale = 1;
      }

      setOpacity(newOpacity);
      setScale(newScale);
      rafRef.current = null;
    };

    const handleScroll = () => {
      if (rafRef.current === null) {
        rafRef.current = requestAnimationFrame(updateValues);
      }
    };

    const handleResize = () => {
      if (rafRef.current === null) {
        rafRef.current = requestAnimationFrame(updateValues);
      }
    };

    // Delay initial calculation to ensure element is properly positioned
    const initialTimeout = setTimeout(() => {
      updateValues();
    }, 0);

    // Listen to scroll events on the container (throttled with requestAnimationFrame)
    scrollContainer.addEventListener('scroll', handleScroll, { passive: true });
    // Also listen to resize in case container size changes
    window.addEventListener('resize', handleResize, { passive: true });

    return () => {
      clearTimeout(initialTimeout);
      scrollContainer.removeEventListener('scroll', handleScroll);
      window.removeEventListener('resize', handleResize);
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current);
      }
    };
  }, [elementRef, scrollContainerRef, fadeHeight]);

  return { opacity, scale };
};

