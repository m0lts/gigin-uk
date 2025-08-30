import { useEffect, useState } from 'react';

/**
 * Hook to get the user's current geolocation from the browser,
 * with Cambridge, UK as the default fallback.
 * @returns {{
*   location: { latitude: number, longitude: number },
*   error: string | null
* }}
*/
export const useUserLocation = () => {
 const CAMBRIDGE_COORDS = { latitude: 52.2053, longitude: 0.1218 };
 const [location, setLocation] = useState(CAMBRIDGE_COORDS);
 const [error, setError] = useState(null);

 useEffect(() => {
   if (!navigator.geolocation) {
     setError("Geolocation is not supported by this browser.");
     return;
   }

   navigator.geolocation.getCurrentPosition(
     ({ coords }) => {
       setLocation({ latitude: coords.latitude, longitude: coords.longitude });
     },
     (err) => {
       setError(err.message || "Failed to get location");
       setLocation(CAMBRIDGE_COORDS);
     }
   );
 }, []);

 return { location, error };
};