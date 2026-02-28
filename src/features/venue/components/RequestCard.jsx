import { useRef, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { markRequestAsViewed } from '@services/client-side/venues';
import { openInNewTab } from '../../../services/utils/misc';
import { format } from 'date-fns';

export const RequestCard = ({ request, handleRemoveRequest, openBuildGigModal, openBuildGigModalWithDate, venues }) => {
  const ref = useRef();
  const navigate = useNavigate();

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

  const handleAcceptDateRequest = (date) => {
    if (openBuildGigModalWithDate) {
      openBuildGigModalWithDate(request, date);
      return;
    }
    navigate('/venues/dashboard/gigs?showRequests=true', { 
      state: {
        musicianData: {
          id: request.musicianId,
          name: request.musicianName,
          genres: request.musicianGenres || [],
          type: request.musicianType || 'Musician/Band',
          bandProfile: false,
          userId: null,
          venueId: request.venueId,
          email: null,
          phone: null,
          instagram: null,
          facebook: null,
          other: null,
        },
        buildingForMusician: true,
        showGigPostModal: true,
        skipTemplate: true,
        requestId: request.id,
        preferredDate: date, // Pass the date
      }
    });
  };

  const parseDate = (dateStr) => {
    try {
      // Handle Firestore Timestamp or ISO string
      if (dateStr.toDate && typeof dateStr.toDate === 'function') {
        return dateStr.toDate();
      } else if (dateStr._seconds || dateStr.seconds) {
        const seconds = dateStr._seconds || dateStr.seconds;
        const nanoseconds = dateStr._nanoseconds || dateStr.nanoseconds || 0;
        return new Date(seconds * 1000 + nanoseconds / 1000000);
      } else {
        return new Date(dateStr);
      }
    } catch (error) {
      console.error('Error parsing date:', error);
      return null;
    }
  };

  return (
    <div key={request.id} ref={ref} className="request-card">
      <div className="request-card-content">
        <div className="request-card-left">
          <div className="top-banner">
            <div className="musician-info">
              {request.musicianImage && (
                <img src={request.musicianImage} alt={`${request.musicianName}`} className="avatar" />
              )}
              <div>
                <h3>{request.musicianName}</h3>
                <p className="timestamp">{new Date(request.createdAt.toDate()).toLocaleString()}</p>
              </div>
            </div>
            <button className="btn tertiary" onClick={(e) => openInNewTab(`/${request.musicianId}`, e)}>
              View Profile
            </button>
          </div>
          {request.message && (
            <div className="request-message">
              <h4>
                Has requested to play at: <strong>{venue?.name || 'Unknown Venue'}</strong>
              </h4>
              <h6 style={{ marginTop: '1rem'}}>Artist Message:</h6>
              <p>{request.message}</p>
            </div>
          )}
          <div className="request-actions">
            <button className="btn danger" onClick={() => handleRemoveRequest(request.id)}>
              Remove Request
            </button>
            <button className="btn artist-profile" onClick={() => {openBuildGigModal(request)}}>
              Create Gig For Artist
            </button>
          </div>
        </div>
        {request.preferredDates && Array.isArray(request.preferredDates) && request.preferredDates.length > 0 && (
          <div className="request-card-right">
            <h4 style={{ marginBottom: '1rem', fontSize: '1rem', fontWeight: 600 }}>Preferred Dates</h4>
            <div className="request-dates-list">
              {request.preferredDates.map((dateStr, idx) => {
                const date = parseDate(dateStr);
                if (!date || isNaN(date.getTime())) return null;
                return (
                  <div key={idx} className="request-date-box">
                    <div className="request-date-info">
                      <p className="request-date-day">{format(date, 'EEE')}</p>
                      <p className="request-date-date">{format(date, 'MMM d')}</p>
                      <p className="request-date-year">{format(date, 'yyyy')}</p>
                    </div>
                    <button 
                      className="btn artist-profile" 
                      onClick={() => handleAcceptDateRequest(date)}
                      style={{ width: '100%', marginTop: '0.75rem' }}
                    >
                      Create Gig
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
