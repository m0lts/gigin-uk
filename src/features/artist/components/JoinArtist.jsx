import { useEffect, useMemo, useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { Timestamp } from 'firebase/firestore';
import { toast } from 'sonner';
import { useAuth } from '@hooks/useAuth';
import { TextLogoLink } from '../../shared/ui/logos/Logos';
import { LoadingSpinner } from '../../shared/ui/loading/Loading';
import { getArtistInviteById } from '@services/client-side/artistInvites';
import { getArtistProfileById } from '@services/client-side/artists';
import { acceptArtistInvite } from '@services/api/artists';
import '@styles/artists/join-artist.styles.css';

export const JoinArtistPage = ({ user, setAuthModal, setAuthType }) => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { logout } = useAuth();

  const inviteId = useMemo(
    () => searchParams.get('invite')?.trim() || '',
    [searchParams],
  );

  const [state, setState] = useState({
    loading: true,
    notFound: false,
    expired: false,
    artist: null,
    inviter: null,
    invalid: false,
  });

  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      if (!inviteId) {
        if (!cancelled)
          setState((s) => ({ ...s, loading: false, notFound: true }));
        return;
      }
      try {
        const invite = await getArtistInviteById(inviteId);
        if (!invite) {
          if (!cancelled)
            setState({
              loading: false,
              notFound: true,
              expired: false,
              artist: null,
              inviter: null,
              invalid: false,
            });
          return;
        }
        // If invite is not pending (e.g. already accepted/used), treat as invalid
        if (invite.status && invite.status !== 'pending') {
          if (!cancelled) {
            setState({
              loading: false,
              notFound: false,
              expired: false,
              artist: null,
              inviter: null,
              invalid: true,
            });
          }
          return;
        }
        const expiresAt = invite.expiresAt;
        const artistProfileId = invite.artistProfileId;
        const now = Timestamp.now();
        const isExpired =
          expiresAt instanceof Timestamp
            ? expiresAt.toMillis() <= now.toMillis()
            : true;
        if (isExpired) {
          if (!cancelled)
            setState({
              loading: false,
              notFound: false,
              expired: true,
              artist: null,
              inviter: null,
              invalid: false,
            });
          return;
        }
        if (!artistProfileId) {
          if (!cancelled)
            setState({
              loading: false,
              notFound: true,
              expired: false,
              artist: null,
              inviter: null,
              invalid: false,
            });
          return;
        }
        const artist = await getArtistProfileById(artistProfileId);
        if (!cancelled) {
          setState({
            loading: false,
            notFound: false,
            expired: false,
            artist,
            inviter: invite.invitedByName || null,
            invalid: false,
          });
        }
      } catch (err) {
        console.error('Failed to load artist invite:', err);
        if (!cancelled)
          setState({
            loading: false,
            notFound: true,
            expired: false,
            artist: null,
            inviter: null,
            invalid: false,
          });
      }
    };
    run();
    return () => {
      cancelled = true;
    };
  }, [inviteId]);

  const handleJoinArtist = async () => {
    try {
      setState((s) => ({ ...s, loading: true }));
      const result = await acceptArtistInvite({ inviteId });
      if (result?.ok) {
        toast.success(
          `Joined ${state.artist?.name || 'the artist profile'} successfully`,
        );
        navigate(`/`, { replace: true });
      } else {
        toast.error(result?.message || 'Failed to join artist profile');
      }
    } catch (err) {
      console.error(err);
      toast.error('Could not accept artist invite');
    } finally {
      setState((s) => ({ ...s, loading: false }));
    }
  };

  if (state.loading) {
    return (
      <div className="join-venue-container">
        <LoadingSpinner />
      </div>
    );
  }

  if (state.notFound) {
    return (
      <div className="join-venue-container">
        <TextLogoLink />
        <h2>Invite Not Found</h2>
        <h4>
          We couldn’t find an invite with that link. It may have been deleted or
          the link is incorrect. Please try again or ask your inviter for a new
          invite.
        </h4>
        <button
          onClick={() => navigate('/', { replace: true })}
          className="btn tertiary"
        >
          Go to Gigin Homepage
        </button>
      </div>
    );
  }

  if (state.invalid) {
    return (
      <div className="join-venue-container">
        <TextLogoLink />
        <h2>Invite Invalid</h2>
        <h4>
          This invite link has already been used or is no longer valid. Please
          ask the artist to send you a new invite if you still need access.
        </h4>
        <button
          onClick={() => navigate('/', { replace: true })}
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
          Ask your inviter to resend a new invite link. For security, invites
          automatically expire after 7 days.
        </h4>
        <button
          onClick={() => navigate('/', { replace: true })}
          className="btn tertiary"
        >
          Go to Gigin Homepage
        </button>
      </div>
    );
  }

  const artistName = state.artist?.name || 'this artist';

  return (
    <div className="join-venue-container">
      <TextLogoLink />
      <figure className="artist-profile-image">
        <img src={state.artist?.heroMedia?.url} alt={state.artist?.name} />
      </figure>
      <h3>
        You’ve been invited
        {state.inviter ? ` by ${state.inviter}` : ''} to join the artist profile: {artistName}.
      </h3>
      <div className="join-venue-options">
        {user ? (
          <div className="join-options">
            <p>
              Logged in as: {user.name}, {user.email}.
            </p>
            <button onClick={handleJoinArtist} className="btn primary">
              Join {artistName}
            </button>
            <button
              className="btn text"
              onClick={() =>
                logout(window.location.pathname + window.location.search)
              }
            >
              Log Out
            </button>
          </div>
        ) : (
          <div className="two-buttons">
            <button
              onClick={() => {
                setAuthModal(true);
                setAuthType('login');
                sessionStorage.setItem(
                  'redirect',
                  `join-artist?invite=${inviteId}`,
                );
              }}
              className="btn tertiary"
            >
              Login
            </button>
            <button
              onClick={() => {
                setAuthModal(true);
                setAuthType('signup');
                sessionStorage.setItem(
                  'redirect',
                  `join-artist?invite=${inviteId}`,
                );
              }}
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


