import { useEffect, useState } from 'react';
import axios from 'axios';

const useMapboxAccessToken = () => {
  const [mapboxToken, setMapboxToken] = useState(null);

  useEffect(() => {
    const fetchAccessToken = async () => {
      try {
        // Fetch the access token from your backend API route
        const response = await axios.get('/api/tokens/fetchAccessTokens');

        if (response.data.mapboxToken) {
          setMapboxToken(response.data.mapboxToken);
        } else {
          throw new Error('Mapbox access token not found in response.');
        }
      } catch (error) {
        console.error('Error fetching Mapbox access token:', error.message);
      }
    };

    fetchAccessToken();
  }, []);

  return mapboxToken;
};

export default useMapboxAccessToken;

