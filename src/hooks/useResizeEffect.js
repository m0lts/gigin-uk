import { useEffect } from 'react';

/**
 * Custom resize hook to run logic on window resize.
 * @param {(width: number) => void} callback - A function that receives window.innerWidth and handles resize logic.
 * @param {boolean} [runOnMount=true] - Whether to call the callback immediately on mount.
 */
export const useResizeEffect = (callback, runOnMount = true) => {
  useEffect(() => {
    const handleResize = () => {
      callback(window.innerWidth);
    };
    if (runOnMount) handleResize();
    window.addEventListener('resize', handleResize);
    return () => {
      window.removeEventListener('resize', handleResize);
    };
  }, [callback, runOnMount]);
};