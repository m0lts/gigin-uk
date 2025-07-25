import { createContext, useContext, useEffect, useRef, useState } from 'react';
import { getGigsByVenueIds } from '@services/gigs';
import { getTemplatesByVenueIds } from '@services/venues';
import { fetchStripeCustomerData } from '@services/payments';
import { subscribeToUpcomingOrRecentGigs } from '@services/gigs';
import { getVenueRequestsByVenueIds } from '../services/venues';

const VenueDashboardContext = createContext();

export const VenueDashboardProvider = ({ user, children }) => {
  const [loading, setLoading] = useState(true);
  const [venueProfiles, setVenueProfiles] = useState([]);
  const [gigs, setGigs] = useState([]);
  const [incompleteGigs, setIncompleteGigs] = useState([]);
  const [templates, setTemplates] = useState([]);
  const [requests, setRequests] = useState([]);
  const [stripe, setStripe] = useState({ customerDetails: null, savedCards: [], receipts: [] });

  const loadedOnce = useRef(false);

  useEffect(() => {
    if (!user || loadedOnce.current) return;
    fetchAllData();
  }, [user]);

  useEffect(() => {
    if (!venueProfiles.length) return;
  
    const venueIds = venueProfiles.map(v => v.venueId);
    const unsubscribe = subscribeToUpcomingOrRecentGigs(venueIds, (updatedGigs) => {
      setGigs(updatedGigs.filter(g => g.complete !== false));
      setIncompleteGigs(updatedGigs.filter(g => g.complete === false));
    });
  
    return () => unsubscribe();
  }, [venueProfiles.map(v => v.venueId).join(',')]);
  
  const fetchAllData = async () => {
    setLoading(true);
    try {
      const { completeVenues, venueIds } = extractVenueInfo(user);
      setVenueProfiles(completeVenues);
  
      const [gigsRes, templatesRes, requestsRes, stripeRes] = await Promise.all([
        getGigsByVenueIds(venueIds),
        getTemplatesByVenueIds(venueIds),
        getVenueRequestsByVenueIds(venueIds),
        fetchStripeCustomerData()
      ]);
      
      applyGigs(gigsRes);
      setTemplates(templatesRes);
      const visibleRequests = requestsRes.filter(req => !req.removed);
      setRequests(visibleRequests);
      setStripe(stripeRes);
  
      loadedOnce.current = true;
    } catch (error) {
      console.error('Venue dashboard fetch error:', error);
    } finally {
      setLoading(false);
    }
  };

  const refreshGigs = async () => {
    try {
      const venueIds = venueProfiles.map(v => v.venueId);
      const gigsRes = await getGigsByVenueIds(venueIds);
      applyGigs(gigsRes);
    } catch (err) {
      console.error('Error refreshing gigs:', err);
    }
  };
  
  const refreshTemplates = async () => {
    try {
      const venueIds = venueProfiles.map(v => v.venueId);
      const templatesRes = await getTemplatesByVenueIds(venueIds);
      setTemplates(templatesRes);
    } catch (err) {
      console.error('Error refreshing templates:', err);
    }
  };
  
  const refreshStripe = async () => {
    try {
      const stripeRes = await fetchStripeCustomerData();
      setStripe(stripeRes);
    } catch (err) {
      console.error('Error refreshing Stripe:', err);
    }
  };
  
  const refreshData = async () => {
    await Promise.all([refreshGigs(), refreshTemplates(), refreshStripe()]);
  };
  
  const extractVenueInfo = (user) => {
    const completeVenues = user.venueProfiles?.filter(p => p.completed) || [];
    const venueIds = completeVenues.map(v => v.venueId);
    return { completeVenues, venueIds };
  };
  
  const applyGigs = (gigsRes) => {
    setGigs(gigsRes.filter(g => g.complete !== false));
    setIncompleteGigs(gigsRes.filter(g => g.complete === false));
  };

  return (
    <VenueDashboardContext.Provider
      value={{ loading, venueProfiles, gigs, incompleteGigs, templates, requests, setRequests, stripe, refreshData,
        refreshGigs,
        refreshTemplates,
        refreshStripe }}
    >
      {children}
    </VenueDashboardContext.Provider>
  );
};

export const useVenueDashboard = () => useContext(VenueDashboardContext);