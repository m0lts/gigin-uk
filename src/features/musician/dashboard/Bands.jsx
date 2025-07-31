import { useEffect } from 'react';
import { PlusIcon, PeopleGroupIcon } from "@features/shared/ui/extras/Icons"
import '@styles/musician/bands.styles.css'
import { useNavigate, useSearchParams } from 'react-router-dom';


export const Bands = ({ bandProfiles }) => {

  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  useEffect(() => {
    if (searchParams.has('invite') || searchParams.has('join')) {
      navigate('/dashboard/bands/join', { replace: true });
    } else if (searchParams.has('create')) {
      navigate('/dashboard/bands/create', { replace: true });
    }
  }, [searchParams]);

  return (
    <>
      <div className="head">
        <h1>Bands</h1>
      </div>
      <div className="body bands-page">
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
        {bandProfiles.length > 0 && (
          <div className="band-list">
            <h2>Your Bands</h2>
            <div className="band-cards">
              {bandProfiles.map(band => (
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
    </>
  );
};