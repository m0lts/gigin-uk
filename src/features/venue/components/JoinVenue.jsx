import React, { useEffect, useMemo, useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { Timestamp } from 'firebase/firestore';
// import { getVenueProfileById } from '@/services/venues'; // <-- adjust to your path
import { getVenueProfileById } from '@services/venues'; // example path
import { getVenueInviteById } from '../../../services/venues';
import { LoadingSpinner } from '../../shared/ui/loading/Loading';
import { TextLogoLink } from '../../shared/ui/logos/Logos';
import '@styles/host/join-venue.styles.css';
import { useAuth } from '../../../hooks/useAuth';
import { getUserById } from '../../../services/users';
import { acceptVenueInvite } from '../../../services/functions';
import { toast } from 'sonner';

export const JoinVenuePage = ({ user, setAuthModal, setAuthType }) => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { logout } = useAuth();

  const inviteId = useMemo(() => searchParams.get('invite')?.trim() || '', [searchParams]);

  const [state, setState] = useState({
    loading: true,
    notFound: false,
    expired: false,
    venue: null,
    percentFromTop: 50,
    inviter: null
  });

  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      if (!inviteId) {
        if (!cancelled) setState(s => ({ ...s, loading: false, notFound: true }));
        return;
      }
      try {
        const invite = await getVenueInviteById(inviteId);
        if (!invite) {
          setState({ loading: false, notFound: true, expired: false, venueName: '' });
          return;
        }
        const expiresAt = invite.expiresAt;
        const venueId = invite.venueId;
        const now = Timestamp.now();
        const isExpired = expiresAt instanceof Timestamp ? expiresAt.toMillis() <= now.toMillis() : true;
        if (isExpired) {
          if (!cancelled) setState({ loading: false, notFound: false, expired: true, venueName: '' });
          return;
        }
        if (!venueId) {
          if (!cancelled) setState({ loading: false, notFound: true, expired: false, venueName: '' });
          return;
        }
        const venue = await getVenueProfileById(venueId);
        const rawOff = venue?.primaryImageOffsetY;
        let percentFromTop;
        if (rawOff == null) {
            percentFromTop = 50;
        } else {
            const n = parseFloat(rawOff);
            if (Number.isFinite(n)) {
                percentFromTop = n <= 0 ? Math.max(0, Math.min(100, 50 + n)) : Math.max(0, Math.min(100, n));
            } else {
                percentFromTop = 50;
            }
        }
        const inviter = await getUserById(invite.invitedBy);
        if (!cancelled) {
          setState({ loading: false, notFound: false, expired: false, venue: venue, percentFromTop: percentFromTop, inviter: inviter });
        }
      } catch (err) {
        console.error('Failed to load invite:', err);
        if (!cancelled) setState({ loading: false, notFound: true, expired: false, venueName: '' });
      }
    };
    run();
    return () => {
      cancelled = true;
    };
  }, [inviteId]);

  const handleJoinVenue = async () => {
    try {
      const result = await acceptVenueInvite(inviteId);
      if (result?.ok) {
        toast.success(`Joined ${state.venue?.name}`);
        navigate(`/venues/dashboard/my-venues`, { replace: true });
      } else {
        toast.error(result?.message || "Failed to join venue");
      }
    } catch (err) {
      console.error(err);
      toast.error("Could not accept invite");
    }
  };

  if (state.loading) {
    return (
      <div className="join-venue-container">
        <LoadingSpinner />
        <h2>Checking your invite…</h2>
      </div>
    );
  }

  if (state.notFound) {
    return (
      <div className="join-venue-container">
        <TextLogoLink />
        <h2>Invite Not Found</h2>
        <h4>
          We couldn’t find an invite with that link. It may have been deleted or the link is incorrect. Please try again or ask your inviter for a new invite.
        </h4>
        <button
          onClick={() => navigate('/', {replace: true})}
          className="btn tertiary"
        >
          Go to Gigin Homepage
        </button>
      </div>
    );
  }

  if (state.expired) {
    return (
      <div className="join-venue-container">
        <TextLogoLink />
        <h2>Invite Expired</h2>
        <h4>
          Ask your inviter to resend a new invite link. For security, invites automatically expire after 7 days.
        </h4>
        <button
          onClick={() => navigate('/', {replace: true})}
          className="btn tertiary"
        >
          Go to Gigin Homepage
        </button>
      </div>
    );
  }

  return (
    <div className="join-venue-container">
        <TextLogoLink />
        <div className='join-venue-hero'>
            <img
                src={state.venue?.photos[0]}
                alt={state.venue?.name}
                className='background-image'
                style={{
                    objectPosition: `50% ${50 - state.venue.percentFromTop}%`,
                    transition: 'object-position 0.3s ease-out',
                }}
            />
            <div className="primary-information">
                <h1 className="venue-name">
                    {state.venue?.name}
                    <span className='orange-dot'>.</span>
                </h1>
            </div>
        </div>
        <h3>
            You’ve been invited by {state.inviter.name} to join {state.venue.name}.
        </h3>
        <div className="join-venue-options">
            {user ? (
                <div className="join-options">
                    <p>Logged in as: {user.name}, {user.email}.</p>
                    <button
                        onClick={handleJoinVenue}
                        className="btn primary"
                    >
                        Join {state.venue.name}
                    </button>
                    <button className="btn text" onClick={() => logout(window.location.pathname + window.location.search)}>
                        Log Out
                    </button>
                </div>
            ) : (
                <div className="two-buttons">
                    <button
                        onClick={() => { setAuthModal(true); setAuthType('login'); sessionStorage.setItem('redirect', `join-venue?invite=${inviteId}`) }}
                        className="btn tertiary"
                    >
                        Login
                    </button>
                    <button
                        onClick={() => { setAuthModal(true); setAuthType('signup'); sessionStorage.setItem('redirect', `join-venue?invite=${inviteId}`) }}
                        className="btn tertiary"
                    >
                        Signup
                    </button>
                </div>
            )}
        </div>
    </div>
  );
};