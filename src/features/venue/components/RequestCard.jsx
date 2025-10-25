import { useRef, useEffect, useCallback } from 'react';
import { markRequestAsViewed } from '@services/client-side/venues';
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
      <div className="top-banner">
        <div className="musician-info" onClick={(e) => openInNewTab(`/${request.musicianId}`, e)}>
          {request.musicianImage && (
            <img src={request.musicianImage} alt={`${request.musicianName}`} className="avatar" />
          )}
          <div>
            <h3>{request.musicianName}</h3>
            <p className="timestamp">{new Date(request.createdAt.toDate()).toLocaleString()}</p>
          </div>
        </div>
        <p className='venue-requested'>
          Requested to play at: <strong>{venue?.name || 'Unknown Venue'}</strong>
        </p>
      </div>
      {request.message && (
        <div className="request-message">
          <h4>Request Message:</h4>
          <p style={{ marginTop: 5}}>{request.message}</p>
        </div>
      )}
      <div className="request-actions">
      <button className="btn secondary" onClick={() => handleRemoveRequest(request.id)}>
          Remove Request
      </button>
      <button className="btn primary" onClick={() => {openBuildGigModal(request)}}>
          Build Gig For Musician
      </button>
      </div>
    </div>
  );
};