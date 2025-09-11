import { useEffect, useState } from 'react';
import { useNavigate, useLocation, useSearchParams } from 'react-router-dom';
import { acceptBandInvite } from '@services/bands';
import { useAuth } from '@hooks/useAuth';
import { LoadingThreeDots } from '@features/shared/ui/loading/Loading';
import { joinBandByPassword, getBandByPassword } from '@services/bands';
import { toast } from 'sonner';
import { useMusicianDashboard } from '../../../context/MusicianDashboardContext';
import { ProfileCreator } from '../profile-creator/ProfileCreator';
import { LoadingSpinner } from '../../shared/ui/loading/Loading';

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
    const [showProfileModal, setShowProfileModal] = useState(false);

    const {
      refreshMusicianProfile
    } = useMusicianDashboard();
  
    useEffect(() => {
      if (!inviteId || user === undefined) return;
      const joinViaLink = async () => {
        if (!user) {
          setError('You must be logged in to join a band.');
          console.log('user error');
          return;
        }
        if (!user.musicianProfile?.musicianId) {
          setShowProfileModal(true);
          return;
        }
        setStatus('loading');
        try {
          await acceptBandInvite(inviteId, user.musicianProfile);
          setStatus('success');
          setMessage('You’ve successfully joined the band!');
          toast.success('Joined Band!')
          navigate('/dashboard/bands', { replace: true });
        } catch (err) {
          setStatus('error');
          setMessage(err.message);
          toast.error('Failed to join band. Please try again.')
        }
      };
    
      joinViaLink();
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
        if (band.members.includes(user.musicianProfile.musicianId)) {
          toast.error("You're already a member of this band.");
          setStatus('idle')
          return;
        }
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
        await refreshMusicianProfile();
        setTimeout(() => {
          navigate(`/dashboard/bands/${band.id}`, { replace: true });
          toast.success("Joined band.")
          setLoading(false);
        }, 1500);
      } catch (err) {
        console.error(err);
        setStatus('error');
        setMessage('Failed to join band.');
        toast.error('Failed to join band. Please try again.')
        setLoading(false);
      }
    };
  
    if (status === 'loading') return <LoadingSpinner />;
  
    return (
      <div className="bands-page">
        {band ? (
          <div className="join">
            <img src={band.picture} alt={band.name} />
            <h1>Join {band.name}?</h1>
            {loading ? (
              <LoadingSpinner />
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
              placeholder="Enter Band Password"
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
        {showProfileModal && (
          <ProfileCreator user={user} setShowModal={setShowProfileModal} closable={false}/>
        )}
      </div>
    );
  };