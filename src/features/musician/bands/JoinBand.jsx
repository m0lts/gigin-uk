import { useEffect, useState } from 'react';
import { useNavigate, useLocation, useSearchParams } from 'react-router-dom';
import { acceptBandInvite } from '@services/bands';
import { useAuth } from '@hooks/useAuth';
import { LoadingThreeDots } from '@features/shared/ui/loading/Loading';
import { joinBandByPassword, getBandByPassword } from '@services/bands';

export const JoinBand = () => {
    const { user } = useAuth();
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const inviteId = searchParams.get('invite');
  
    const [status, setStatus] = useState('idle');
    const [message, setMessage] = useState('');
    const [band, setBand] = useState(null);
    const [code, setCode] = useState('');
    const [error, setError] = useState(null);
    const [loading, setLoading] = useState(false);
  
    useEffect(() => {
      const joinViaLink = async () => {
        if (!user) {
          setError('You must be logged in to join a band.');
          return;
        }
        if (!user.musicianProfile?.musicianId) {
          navigate('/create-profile', {
            state: { redirectToInvite: inviteId },
          });
          return;
        }
        setStatus('loading');
        try {
          await acceptBandInvite(inviteId, user.musicianProfile);
          setStatus('success');
          setMessage('You’ve successfully joined the band!');
          navigate('/dashboard/bands', { replace: true });
        } catch (err) {
          setStatus('error');
          setMessage(err.message);
        }
      };
  
      if (inviteId) {
        joinViaLink();
      }
    }, [inviteId, user]);
  
    const handleManualCodeSubmit = async () => {
      if (!code.trim()) {
        setStatus('error');
        setMessage('Please enter a code.');
        return;
      }
      setStatus('loading');
      try {
        const band = await getBandByPassword(code.trim().toLowerCase());
        setBand(band);
        setStatus('idle');
      } catch (err) {
        setStatus('error');
        setMessage(err.message);
      }
    };
  
    const handleConfirmJoin = async () => {
      if (!user?.musicianProfile || !band?.id) return;
      try {
        setLoading(true);
        await joinBandByPassword(band.id, user.musicianProfile);
        navigate('/dashboard/bands', { replace: true });
      } catch (err) {
        console.error(err);
        setStatus('error');
        setMessage('Failed to join band.');
      } finally {
        setLoading(false);
      }
    };
  
    if (status === 'loading') return <LoadingThreeDots />;
  
    return (
      <div className="bands-page">
        {band ? (
          <div className="join">
            <img src={band.picture} alt={band.name} />
            <h1>Join {band.name}?</h1>
            {loading ? (
              <LoadingThreeDots />
            ) : (
              <>
                <button className="btn primary" onClick={handleConfirmJoin}>
                  Yes, Join Band
                </button>
                <button className="btn tertiary" onClick={() => setBand(null)}>Back</button>
              </>
            )}
          </div>
        ) : (
          <div className="join">
            <h1>Join a Band</h1>
            <input
              className={`input ${status === 'error' ? 'error' : ''}`}
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder="Enter band join code"
            />
            {status === 'error' && <p style={{ color: 'red' }} className="error">{message}</p>}
            <button className="btn primary" onClick={handleManualCodeSubmit}>
              Join by Code
            </button>
            <button className="btn tertiary" onClick={() => navigate('/dashboard/bands', { replace: true })}>
              Back
            </button>
          </div>
        )}
      </div>
    );
  };