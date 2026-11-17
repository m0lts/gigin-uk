import { useAuth } from '@hooks/useAuth';
import { useOwnedDesk } from '../../shared/useOwnedDesk';
import { readLegwork } from './legworkStorage';

export function useVenueLegwork(venueId) {
  const { user } = useAuth();
  return useOwnedDesk({
    scope: 'venue',
    id: user?.uid && venueId ? venueId : '',
    kind: 'legwork',
    empty: {},
    readLocal: () => readLegwork(venueId),
    writeLocal: (next) => {
      if (!venueId) return;
      try { localStorage.setItem(`gigin.legwork.${venueId}`, JSON.stringify(next || {})); } catch { /* keep the Firestore copy */ }
    },
  });
}
