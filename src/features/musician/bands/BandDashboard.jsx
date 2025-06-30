import { useEffect, useState } from 'react';
import { leaveBand } from '@services/bands';
import { LoadingScreen } from '@features/shared/ui/loading/LoadingScreen';
import { getBandsByMusicianId } from '@services/bands';
import { DeleteIcon, DoorIcon, EditIcon, RemoveMember, StarIcon } from '../../shared/ui/extras/Icons';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { OverviewTab } from '../profile/OverviewTab';
import { MusicTab } from '../profile/MusicTab';
import { ReviewsTab } from '../profile/ReviewsTab';
import { updateMusicianProfile } from '@services/musicians';
import { BandMembersTab } from './BandMembersTab';

export const BandDashboard = ({ musicianProfile }) => {
  const { bandId } = useParams();
  const { state } = useLocation();
  const navigate = useNavigate();
  const [band, setBand] = useState(state?.band || null);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('overview');
  const [bandMembers, setBandMembers] = useState(null);
  const [editingMedia, setEditingMedia] = useState(false);
  const [localVideos, setLocalVideos] = useState([]);
  const [localTracks, setLocalTracks] = useState([]);

  useEffect(() => {
    if (!band && musicianProfile?.musicianId) {
      getBandsByMusicianId(musicianProfile.musicianId).then((bands) => {
        const found = bands.find((b) => b.id === bandId);
        if (found) {
          setBand(found);
          setActiveTab(!band.bandProfile.completed ? 'members' : 'overview')
        } else {
          navigate('/dashboard/bands')
        };
      });
    } else {
      setBand(state?.band);
      setLocalVideos(state?.band.bandProfile?.videos || []);
      setLocalTracks(state?.band.bandProfile?.tracks || [])
    }
  }, [band, bandId, musicianProfile]);

  useEffect(() => {
    if (!band.bandProfile?.completed && activeTab !== 'members') {
      setActiveTab('members');
    }
  }, [band, activeTab]);

  const saveChanges = async () => {
    try {
        await updateMusicianProfile(band.id, {
            videos: localVideos,
            tracks: localTracks,
        });
        setEditingMedia(false);
    } catch (err) {
        console.error('Error saving changes:', err);
    }
};

  const refreshBandInfo = async () => {
    try {
      const bands = await getBandsByMusicianId(musicianProfile.musicianId);
      const updated = bands.find((b) => b.id === bandId);
      if (updated) setBand(updated);
    } catch (err) {
      console.error('Failed to refresh band info:', err);
    }
  };

  const handleLeaveBand = async () => {
    const confirmLeave = window.confirm('Are you sure you want to leave this band?');
    if (!confirmLeave) return;
    try {
      setLoading(true);
      await leaveBand(band.id, musicianProfile.musicianId, musicianProfile.userId);
      alert('You’ve successfully left the band.');
      navigate('/dashboard/bands');
    } catch (err) {
      console.error('Failed to leave band:', err);
      alert('Failed to leave the band. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteBand = async () => {
    const confirmDelete = window.confirm(
      'Are you sure you want to delete this band? This action cannot be undone.'
    );
    if (!confirmDelete) return;
    try {
      setLoading(true);
      await deleteBand(band.id);
      alert('The band has been deleted successfully.');
      navigate('/dashboard/bands');
    } catch (err) {
      console.error('Failed to delete band:', err);
      alert('Failed to delete the band. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  if (!band || loading) {
    return <LoadingScreen />;
  }

  const renderActiveTabContent = () => {
    if (!band.bandProfile?.completed && activeTab !== 'members') {
      return (
        <div className="tab-locked">
          <p>Please complete your band profile to access this section.</p>
        </div>
      );
    }
  
    switch (activeTab) {
      case 'overview':
        return <OverviewTab musicianData={band.bandProfile} />;
      case 'members':
        return (
          <BandMembersTab
            band={band}
            bandMembers={bandMembers}
            setBandMembers={setBandMembers}
            musicianId={musicianProfile.musicianId}
            refreshBandInfo={refreshBandInfo}
          />
        );
      case 'music':
        return (
          <MusicTab
            videos={localVideos}
            tracks={localTracks}
            setVideos={setLocalVideos}
            setTracks={setLocalTracks}
            musicianId={band.bandProfile.musicianId}
            editingMedia={editingMedia}
            setEditingMedia={setEditingMedia}
          />
        );
      case 'reviews':
        return <ReviewsTab profile={band.bandProfile} />;
      default:
        return null;
    }
  };

  const editMusicianProfileRedirect = () => {
    if (!band.bandProfile) return;
    const { ref, ...bandProfile } = band.bandProfile;
    navigate('/create-profile', { state: { musicianProfile: bandProfile } });
  };

  const handleProfileNavigation = () => {
    navigate('/create-profile', {
        state: {
            musicianProfile: {
              name: band.name,
              picture: band.picture,
              musicianId: band.id,
              email: band.email,
              bandProfile: true,
              musicianType: 'Band'
            },
        },
    })
  }

  if (!band) {
    return (
      <div className="profile">
        <LoadingScreen />
      </div>
    )
  }

  return (
    <div className="band-dashboard profile">
      <div className='profile-banner' style={{
        padding: '2%',
      }}>
        <div className='profile-information'>
          <figure className='profile-picture'>
              <img src={band.picture} alt={`${band.name}'s Profile Picture`} />
          </figure>
          <div className='profile-details'>
              <div className='name'>
                  <h1>{band.name}</h1>
                  <button className='btn icon' onClick={editMusicianProfileRedirect}>
                      <EditIcon />
                  </button>
              </div>
              <h4>Band</h4>
              <div className='data'>
                  {band.bandProfile?.avgReviews && (
                      <h6><StarIcon /> {band.bandProfile?.avgReviews.avgRating} ({band.bandProfile?.avgReviews.totalReviews})</h6>
                  )}
                  <h6>{band.bandProfile?.clearedFees && band.bandProfile?.clearedFees.length || '0'} gigs played</h6>
              </div>
              <div className='genre-tags'>
                  {band.bandProfile?.genres && band.bandProfile?.genres.map((genre, index) => (
                      <div className='genre-tag' key={index}>
                          {genre}
                      </div>
                  ))}
              </div>
          </div>
        </div>
        {!band.bandProfile?.completed ? (
            <div className="profile-incomplete">
                <h2>Please add some more information before applying to gigs.</h2>
                <button className='btn primary-alt' onClick={handleProfileNavigation}>
                    Finish Band Profile
                </button>
            </div>
        ) : (
          <div className="profile-actions">
            {band.admin.musicianId === musicianProfile.musicianId ? (
              <button className="btn danger" onClick={handleDeleteBand}><DeleteIcon /></button>
            ) : (
              <button className="btn danger" onClick={handleLeaveBand}><DoorIcon /></button>
            )}
        </div>
        )}
      </div>
        <div className='profile-view band'>
        <nav className='profile-tabs band'>
          <div className="left-side">
            {band.bandProfile?.completed && (
              <>
                <p
                  onClick={() => band.bandProfile.completed && setActiveTab('overview')}
                  className={`profile-tab ${activeTab === 'overview' ? 'active' : ''} ${!band.bandProfile.completed ? 'disabled' : ''}`}
                >
                  Overview
                </p>
                <p
                  onClick={() => band.bandProfile.completed && setActiveTab('music')}
                  className={`profile-tab ${activeTab === 'music' ? 'active' : ''} ${!band.bandProfile.completed ? 'disabled' : ''}`}
                >
                  Music
                </p>
              </>
            )}
            <p
              onClick={() => setActiveTab('members')}
              className={`profile-tab ${activeTab === 'members' ? 'active' : ''}`}
            >
              Band Members
            </p>
            {band.bandProfile?.completed && (
              <p
                onClick={() => band.bandProfile.completed && setActiveTab('reviews')}
                className={`profile-tab ${activeTab === 'reviews' ? 'active' : ''} ${!band.bandProfile.completed ? 'disabled' : ''}`}
              >
                Reviews
              </p>
             )}
          </div>
          <div className="right-side">
            {editingMedia && band.bandProfile?.completed && (
              <button className='btn primary-alt' onClick={saveChanges}>
                Save Changes
              </button>
            )}
          </div>
        </nav>
            <div className='profile-sections'>
                {renderActiveTabContent()}
            </div>
        </div>
    </div>
  );
};
