import { useRef, useEffect, useCallback } from 'react';
import { markRequestAsViewed } from '@services/venues';
import { openInNewTab } from '../../../services/utils/misc';

export const RequestCard = ({ request, handleRemoveRequest, openBuildGigModal, venues }) => {
  const ref = useRef();

  const handleView = useCallback(async (entry) => {
    if (entry.isIntersecting && !request.viewed) {
      try {
        await markRequestAsViewed(request.id);
      } catch (err) {
        console.error('Failed to mark request as viewed:', err);
      }
    }
  }, [request]);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => handleView(entry),
      { threshold: 0.3 }
    );
    const current = ref.current;
    if (current) observer.observe(current);
    return () => {
      if (current) observer.unobserve(current);
    };
  }, [handleView]);

  const venue = venues.find(v => v.venueId === request.venueId);

  return (
    <div key={request.id} ref={ref} className="request-card">
        <div className="musician-info">
            <img src={request.photoUrl} alt={`${request.musicianName} avatar`} className="avatar" />
        <div>
            <h4>{request.musicianName}</h4>
            <p className="timestamp">{new Date(request.createdAt.toDate()).toLocaleString()}</p>
        </div>
        </div>

        <div className="venue-requested">
          <p>
            Requested to play at: <strong>{venue?.name || 'Unknown Venue'}</strong>
          </p>
      </div>

        <div className="request-message">
            <p>{request.message}</p>
        </div>

        <div className="request-actions">
          <button className="btn tertiary" onClick={(e) => openInNewTab(`/${request.musicianId}`, e)}>
            View Profile
          </button>
        <button className="btn secondary" onClick={() => handleRemoveRequest(request.id)}>
            Remove Request
        </button>
        <button className="btn primary" onClick={() => openBuildGigModal(request)}>
            Build Gig
        </button>
        </div>
    </div>
  );
};