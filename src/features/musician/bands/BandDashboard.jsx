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
import { toast } from 'sonner';

export const BandDashboard = ({ musicianProfile, bandProfiles, refreshData }) => {
  const { bandId } = useParams();
  const location = useLocation();
  const state = location.state;
  const navigate = useNavigate();
  const [band, setBand] = useState(state?.band || null);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('overview');
  const [bandMembers, setBandMembers] = useState(band?.members || null);
  const [editingMedia, setEditingMedia] = useState(false);
  const [localVideos, setLocalVideos] = useState(band?.videos || []);
  const [localTracks, setLocalTracks] = useState(band?.tracks || []);

  useEffect(() => {
    if (!band) {
      const found = bandProfiles.find((b) => b.id === bandId);
      if (found) {
        setBand(found);
        setLocalVideos(found.videos);
        setLocalTracks(found.tracks);
        setBandMembers(found.members);
        setActiveTab(!found?.completed ? 'members' : 'overview');
      };
    }
  }, [bandProfiles, bandId]);

  useEffect(() => {
    if (!band?.completed && activeTab !== 'members') {
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
        toast.success('Changes saved.')
    } catch (err) {
        console.error('Error saving changes:', err);
        toast.error('Error saving changes. Please try again.')
    }
  };

  const handleLeaveBand = async () => {
    const confirmLeave = window.confirm('Are you sure you want to leave this band?');
    if (!confirmLeave) return;
    try {
      setLoading(true);
      await leaveBand(band.id, musicianProfile.musicianId, musicianProfile.userId);
      toast.success('Successfully left the band.');
      navigate('/dashboard/bands');
    } catch (err) {
      console.error('Failed to leave band:', err);
      toast.error('Failed to leave the band. Please try again.');
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
      toast.success('Band deleted.');
      navigate('/dashboard/bands');
    } catch (err) {
      console.error('Failed to delete band:', err);
      toast.error('Failed to delete band. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  if (!band || loading) {
    return <LoadingScreen />;
  }

  const renderActiveTabContent = () => {
    if (!band.completed && activeTab !== 'members') {
      return (
        <div className="tab-locked">
          <p>Please complete your band profile to access this section.</p>
        </div>
      );
    }
    switch (activeTab) {
      case 'overview':
        return <OverviewTab musicianData={band} />;
      case 'members':
        return (
          <BandMembersTab
            band={band}
            bandMembers={bandMembers}
            setBandMembers={setBandMembers}
            musicianId={musicianProfile.musicianId}
            refreshBandInfo={refreshData}
          />
        );
      case 'music':
        return (
          <MusicTab
            videos={localVideos}
            tracks={localTracks}
            setVideos={setLocalVideos}
            setTracks={setLocalTracks}
            musicianId={band.musicianId}
            editingMedia={editingMedia}
            setEditingMedia={setEditingMedia}
          />
        );
      case 'reviews':
        return <ReviewsTab profile={band} />;
      default:
        return null;
    }
  };

  const editMusicianProfileRedirect = () => {
    if (!band) return;
    navigate('/create-profile', { state: { musicianProfile: band } });
  };

  const handleProfileNavigation = () => {
    navigate('/create-profile', {
        state: {
            musicianProfile: {
              name: band.name,
              picture: band.picture,
              musicianId: band.bandId,
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
        {!band.completed ? (
            <div className="profile-incomplete">
                <h4>Please add some more information before applying to gigs.</h4>
                <button className='btn primary' onClick={handleProfileNavigation}>
                    Finish Band Profile
                </button>
            </div>
        ) : (
          <div className="profile-actions">
            {band.bandInfo.admin.musicianId === musicianProfile.musicianId ? (
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
            {band.completed && (
              <>
                <p
                  onClick={() => band.completed && setActiveTab('overview')}
                  className={`profile-tab ${activeTab === 'overview' ? 'active' : ''} ${!band.completed ? 'disabled' : ''}`}
                >
                  Overview
                </p>
                <p
                  onClick={() => band.completed && setActiveTab('music')}
                  className={`profile-tab ${activeTab === 'music' ? 'active' : ''} ${!band.completed ? 'disabled' : ''}`}
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
            {band.completed && (
              <p
                onClick={() => band.completed && setActiveTab('reviews')}
                className={`profile-tab ${activeTab === 'reviews' ? 'active' : ''} ${!band.completed ? 'disabled' : ''}`}
              >
                Reviews
              </p>
             )}
          </div>
          <div className="right-side">
            {editingMedia && band.completed && (
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
