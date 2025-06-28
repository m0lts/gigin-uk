import { useEffect, useState } from 'react';

/**
 * Hook to get the user's current geolocation from the browser.
 * @returns {{
 *   location: { latitude: number, longitude: number } | null,
 *   error: string | null
 * }}
 */
export const useUserLocation = () => {
  const [location, setLocation] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!navigator.geolocation) {
      setError('Geolocation is not supported by this browser.');
      return;
    }

    navigator.geolocation.getCurrentPosition(
      ({ coords }) => {
        setLocation({ latitude: coords.latitude, longitude: coords.longitude });
      },
      (err) => {
        setError(err.message || 'Failed to get location');
      }
    );
  }, []);

  return { location, error };
};