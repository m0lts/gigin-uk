import React, { createContext, useContext, useEffect, useState } from 'react';
import { subscribeToGigs } from '@services/gigs';

const GigsContext = createContext();

export const useGigs = () => {
  return useContext(GigsContext);
};

export const GigsProvider = ({ children }) => {
  const [gigs, setGigs] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = subscribeToGigs((gigsData) => {
      setGigs(gigsData);
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  return (
    <GigsContext.Provider value={{ gigs, loading }}>
      {children}
    </GigsContext.Provider>
  );
};