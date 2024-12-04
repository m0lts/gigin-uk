import React, { createContext, useContext, useEffect, useState } from 'react';
import { collection, onSnapshot } from 'firebase/firestore';
import { firestore } from '../firebase';

const GigsContext = createContext();

export const useGigs = () => {
  return useContext(GigsContext);
};

export const GigsProvider = ({ children }) => {
  const [gigs, setGigs] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const gigsRef = collection(firestore, 'gigs');
    
    // Set up the snapshot listener
    const unsubscribe = onSnapshot(gigsRef, (snapshot) => {
      const gigsData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
      }));
      setGigs(gigsData);
      setLoading(false);
    }, (error) => {
      console.error("Error fetching gigs: ", error);
      setLoading(false);
    });

    // Clean up the listener on unmount
    return () => unsubscribe();
  }, []);

  return (
    <GigsContext.Provider value={{ gigs, loading }}>
      {children}
    </GigsContext.Provider>
  );
};