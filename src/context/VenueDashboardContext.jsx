import { createContext, useContext, useEffect, useRef, useState } from 'react';
import { getGigsByVenueIds } from '@services/client-side/gigs';
import { getTemplatesByVenueIds } from '@services/client-side/venues';
import { subscribeToUpcomingOrRecentGigs } from '@services/client-side/gigs';
import { fetchMyVenueMembership, getVenueRequestsByVenueIds } from '../services/client-side/venues';
import { fetchCustomerData } from '../services/function-calls/payments';

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

  const sortReceiptsByDateDesc = (arr = []) =>
  [...arr].sort((a, b) => (b?.created || 0) - (a?.created || 0));
  
  const fetchAllData = async () => {
    setLoading(true);
    try {
      const { completeVenues, venueIds } = extractVenueInfo(user);
      const venueProfilesWithMembership = await Promise.all(
        completeVenues.map((venue) => fetchMyVenueMembership(venue, user.uid))
      );
      const safeVenues = venueProfilesWithMembership.filter(Boolean);
      setVenueProfiles(safeVenues);
      const [gigsRes, templatesRes, requestsRes] = await Promise.all([
        getGigsByVenueIds(venueIds),
        getTemplatesByVenueIds(venueIds),
        getVenueRequestsByVenueIds(venueIds),
      ]);
      const customerIds = [
        null,
        ...safeVenues.map(v => v.stripeCustomerId).filter(Boolean),
      ];
      const bundles = await Promise.all(customerIds.map(id => fetchCustomerData(id)));
      const userBundle = bundles[0];
      const venueBundles = bundles.slice(1);
      const mergedSavedCards = [
        ...(userBundle?.paymentMethods || []).map(pm => ({
          ...pm,
          default: pm.id === userBundle?.defaultPaymentMethodId,
        })),
        ...venueBundles.flatMap(b =>
          (b?.paymentMethods || []).map(pm => ({
            ...pm,
            default: pm.id === b?.defaultPaymentMethodId,
          }))
        ),
      ].sort((a, b) => (b.default === a.default ? 0 : b.default ? 1 : -1));
      const mergedReceipts = [
        ...(userBundle?.receipts || []),
        ...venueBundles.flatMap(b => b?.receipts || []),
      ];
      const stripeRes = {
        customerDetails: userBundle?.customer || null,
        savedCards: mergedSavedCards,
        receipts: sortReceiptsByDateDesc(mergedReceipts.filter(r => r?.metadata?.gigId)),
      };
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
      const venuesWithCustomers = venueProfiles.filter(v => v.stripeCustomerId);
      const customerIds = [
        null,
        ...venuesWithCustomers.map(v => v.stripeCustomerId),
      ];
      const bundles = await Promise.all(customerIds.map(id => fetchCustomerData(id)));
  
      const userBundle = bundles[0];
      const venueBundles = bundles.slice(1);
  
      const mergedSavedCards = [
        ...(userBundle?.paymentMethods || []).map(pm => ({
          ...pm,
          default: pm.id === userBundle?.defaultPaymentMethodId,
        })),
        ...venueBundles.flatMap(b =>
          (b?.paymentMethods || []).map(pm => ({
            ...pm,
            default: pm.id === b?.defaultPaymentMethodId,
          }))
        ),
      ].sort((a, b) => (b.default === a.default ? 0 : b.default ? 1 : -1));
  
      const mergedReceipts = [
        ...(userBundle?.receipts || []),
        ...venueBundles.flatMap(b => b?.receipts || []),
      ];
  
      setStripe({
        customerDetails: userBundle?.customer || null,
        savedCards: mergedSavedCards,
        receipts: sortReceiptsByDateDesc(mergedReceipts.filter(r => r?.metadata?.gigId)),
      });
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
      value={{ loading, venueProfiles, setVenueProfiles, gigs, incompleteGigs, templates, requests, setRequests, stripe, refreshData, setStripe,
        refreshGigs,
        refreshTemplates,
        refreshStripe }}
    >
      {children}
    </VenueDashboardContext.Provider>
  );
};

export const useVenueDashboard = () => useContext(VenueDashboardContext);