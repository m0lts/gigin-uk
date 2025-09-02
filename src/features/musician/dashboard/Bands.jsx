import { useEffect } from 'react';
import { PlusIcon, PeopleGroupIcon } from "@features/shared/ui/extras/Icons"
import '@styles/musician/bands.styles.css'
import { useNavigate, useSearchParams } from 'react-router-dom';
import { PeopleGroupIconSolid, PlusIconSolid, RightChevronIcon, StarIcon } from '../../shared/ui/extras/Icons';
import { openInNewTab } from '@services/utils/misc';


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

  const formatEarnings = (e) => {
    if (e < 100) return '<£100';
    if (e < 500) return '£100+';
    if (e < 1000) return '£500+';
    if (e < 2500) return '£1k+';
    if (e < 5000) return '£2.5k+';
    return '£5k+';
  };

  return (
    <>
      <div className="head">
        <h1 className='title'>Bands</h1>
        <button className="btn primary" onClick={() => navigate('/dashboard/bands/create')}>
          Add Band
        </button>
      </div>
      <div className="body bands">
        <div className="entry-actions">
          {/* <div className="card" onClick={() => navigate('/dashboard/bands/create')}>
            <PlusIconSolid />
            <h4>Create a Band</h4>
            <p className="text">
              Set up your band and apply to gigs!
            </p>
          </div> */}
          {/* <div className="card" onClick={() => navigate('/dashboard/bands/join')}>
            <PeopleGroupIconSolid />
            <h4>Join a Band</h4>
            <p className="text">Already in a band? Join it here using the invite link or band password your band leader shared with you.</p>
          </div> */}
        </div>
        {bandProfiles.length > 0 ? (
          <>
            <div className="users-bands">
              {bandProfiles.map((band) => (
                <div className='band-card' key={band.id}>
                    <div className="profile-picture">
                      <img src={band.picture} alt={band.name} />
                    </div>
                    <div className="band-card-flex">
                        <div className="band-name-type">
                            <h2>{band.name}</h2>
                        </div>
                    </div>
                    {band.completed && (
                      <>
                        <div className="genre-tags">
                            {band.genres.map((g) => (
                                <span className="genre-tag" key={g}>
                                    {g}
                                </span>
                            ))}
                        </div>
                        <div className="stats-container">
                            {band?.avgReviews?.avgRating ? (
                                <div className="stats-box avg-rating">
                                    <span className="large-item">
                                        <StarIcon />
                                        {band.avgReviews.avgRating}
                                    </span>
                                    <span className='text'>avg rating</span>
                                </div>
                            ) : (
                                <div className="stats-box avg-rating">
                                    <span className="large-item">
                                        <StarIcon />
                                        -
                                    </span>
                                    <span className='text'>no ratings</span>
                                </div>
                            )}
                            <span className="spacer"></span>
                            {band?.totalEarnings ? (
                                <div className="stats-box earnings">
                                    <span className="large-item">
                                        {formatEarnings(band.totalEarnings)}
                                    </span>
                                    <span className='text'>earned</span>
                                </div>
                            ) : (
                                <div className="stats-box earnings">
                                    <span className="large-item">
                                        £0
                                    </span>
                                    <span className='text'>earned</span>
                                </div>
                            )}
                            <span className="spacer"></span>
                            {band?.followers ? (
                                <div className="stats-box followers">
                                    <span className="large-item">
                                        {band.followers}
                                    </span>
                                    <span className="text">followers</span>
                                </div>
                            ) : (
                                <div className="stats-box followers">
                                    <span className="large-item">
                                        0
                                    </span>
                                    <span className="text">followers</span>
                                </div>
                            )}
                        </div>
                      </>
                    )}
                    <button className="btn primary" onClick={() => navigate(`/dashboard/bands/${band.id}`, { state: {band: band} })}>
                        <span>View Band Profile <RightChevronIcon /></span>
                    </button>
                </div>
              ))}
            </div>
          </>
        ) : (
<div className="no-bands">
                  <PeopleGroupIconSolid />
                  <h4>You aren't in any bands.</h4>
                </div>
        )}
      </div>
    </>
  );
};