import { useState, useEffect } from 'react';
import { BandCreator } from '@features/musician/bands/BandCreator';
import { JoinBand } from '@features/musician/bands/JoinBand';
import { BandDashboard } from '@features/musician/bands/BandDashboard';
import { PlusIcon, PeopleGroupIcon } from "@features/shared/ui/extras/Icons"
import '@styles/musician/bands.styles.css'
import { getBandsByMusicianId } from '@services/bands';
import { LoadingScreen } from '@features/shared/ui/loading/LoadingScreen';
import { useNavigate, useSearchParams } from 'react-router-dom';


export const Bands = ({ musicianProfile }) => {
  const [bandData, setBandData] = useState([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const stripFirestoreRefs = (obj) => {
    if (obj === null || typeof obj !== 'object') return obj;
    if (Array.isArray(obj)) return obj.map(stripFirestoreRefs);
    const cleanObj = {};
    for (const key in obj) {
      if (key !== 'ref' && Object.prototype.hasOwnProperty.call(obj, key)) {
        cleanObj[key] = stripFirestoreRefs(obj[key]);
      }
    }
    return cleanObj;
  };

  useEffect(() => {
    const fetchBands = async () => {
      if (!musicianProfile?.musicianId) return;
      try {
        const bands = await getBandsByMusicianId(musicianProfile.musicianId);
        const cleaned = bands.map(stripFirestoreRefs);
        setBandData(cleaned);

        if (searchParams.has('invite') || searchParams.has('join')) {
          navigate('/dashboard/bands/join', { replace: true });
        } else if (searchParams.has('create')) {
          navigate('/dashboard/bands/create', { replace: true });
        }

      } catch (err) {
        console.error('Failed to fetch bands:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchBands();
  }, [musicianProfile, searchParams, navigate]);

  if (loading) {
    return (
      <div className="bands-page">
        <LoadingScreen />
      </div>
    );
  }

  return (
    <div className="bands-page">
      <div className="entry-text">
        <h1>Bands, Done Better<span>.</span></h1>
        <p>
          Every musician signs up individually, then joins their band here. That means no more shared logins, smoother gig applications, and automatic payout splits. Whether you’re a duo or a 10-piece funk machine, everyone stays in the loop — and finding a last-minute fill-in is just a few clicks away.
        </p>
      </div>

      <div className="entry-actions">
        <div className="card" onClick={() => navigate('/dashboard/bands/create')}>
          <PlusIcon />
          <h4 className="text">Create</h4>
        </div>
        <div className="card" onClick={() => navigate('/dashboard/bands/join')}>
          <PeopleGroupIcon />
          <h4 className="text">Join</h4>
        </div>
      </div>
      {bandData.length > 0 && (
        <div className="band-list">
          <h2>Your Bands</h2>
          <div className="band-cards">
            {bandData.map(band => (
              <div
                key={band.id}
                className="band-card"
                onClick={() => navigate(`/dashboard/bands/${band.id}`, { state: { band } })}
              >
                <img className='band-img' src={band.picture} alt={band.name} />
                <h1 className='band-name'>{band.name}</h1>
              </div>
            ))}
          </div>
        </div>
      )}

    </div>
  );
};