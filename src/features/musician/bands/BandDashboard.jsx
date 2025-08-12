import { useEffect, useState } from 'react';
import { leaveBand } from '@services/bands';
import { LoadingScreen } from '@features/shared/ui/loading/LoadingScreen';
import { getBandsByMusicianId } from '@services/bands';
import { DeleteGigIcon, DeleteIcon, DoorIcon, EditIcon, StarIcon } from '../../shared/ui/extras/Icons';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { OverviewTab } from '../profile/OverviewTab';
import { MusicTab } from '../profile/MusicTab';
import { ReviewsTab } from '../profile/ReviewsTab';
import { updateMusicianProfile } from '@services/musicians';
import { BandMembersTab } from './BandMembersTab';
import { toast } from 'sonner';
import { deleteBand } from '../../../services/bands';
import { useMusicianDashboard } from '../../../context/MusicianDashboardContext';
import { ProfileForm } from '../dashboard/profile-form/ProfileForm';

export const BandDashboard = ({ user, musicianProfile, bandProfiles, refreshData }) => {
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
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showLeaveModal, setShowLeaveModal] = useState(false);
  const {
    refreshMusicianProfile
  } = useMusicianDashboard();

  useEffect(() => {
    const found = bandProfiles.find((b) => b.id === bandId);
    if (found) {
      setBand(found);
      setLocalVideos(found.videos);
      setLocalTracks(found.tracks);
      setBandMembers(found.members);
      setActiveTab('profile');
    };
  }, [bandProfiles, bandId]);

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
    try {
      setLoading(true);
      await leaveBand(band.id, musicianProfile.musicianId, musicianProfile.userId);
      await refreshMusicianProfile();
      setTimeout(() => {
        toast.success('Left the band.');
        navigate('/dashboard/bands');
    }, 1500);
    } catch (err) {
      console.error('Failed to leave band:', err);
      toast.error('Failed to leave the band. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteBand = async () => {
    try {
      setLoading(true);
      await deleteBand(band.id);
      await refreshMusicianProfile();
      setTimeout(() => {
        toast.success('Band deleted.');
        navigate('/dashboard/bands');
      }, 1500);
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
    switch (activeTab) {
      case 'profile':
        return <ProfileForm musicianProfile={band} user={user} band={true} />;
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
      default:
        return null;
    }
  };

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
          <div className="profile-actions">
            {band.bandInfo.admin.musicianId === musicianProfile.musicianId ? (
              <button className="btn danger" onClick={() => setShowDeleteModal(true)}>Delete Band</button>
            ) : (
              <button className="btn danger" onClick={() => setShowLeaveModal(true)}>Leave Band</button>
            )}
        </div>
      </div>
        <div className='profile-view band'>
          <nav className='profile-tabs band'>
            <div className="left-side">
              <p
                onClick={() => setActiveTab('profile')}
                className={`profile-tab ${activeTab === 'profile' ? 'active' : ''}`}
              >
                Band Profile
              </p>
              <p
                onClick={() => setActiveTab('members')}
                className={`profile-tab ${activeTab === 'members' ? 'active' : ''}`}
              >
                Band Members
              </p>
            </div>
          </nav>
          <div className='profile-sections'>
            {renderActiveTabContent()}
          </div>
        </div>
        {showDeleteModal && (
            <div className="modal" onClick={() => setShowDeleteModal(false)}>
            <div className="modal-content" onClick={(e) => e.stopPropagation()}>
                  <div className="modal-header">
                      <DeleteGigIcon />
                      <h2>Delete Band?</h2>
                      <p>
                          Are you sure you want to delete "{band.name}"? This action cannot be undone.
                      </p>
                  </div>
              <div className="modal-actions">
                  <button className="btn tertiary" onClick={() => setShowDeleteModal(false)}>
                      Cancel
                  </button>
                  <button
                      className="btn danger"
                      onClick={() => {
                          handleDeleteBand();
                          setShowDeleteModal(false);
                      }}
                  >
                      Yes, Delete Band
                  </button>
              </div>
              </div>
          </div>
        )}
        {showLeaveModal && (
            <div className="modal" onClick={() => setShowLeaveModal(false)}>
            <div className="modal-content" onClick={(e) => e.stopPropagation()}>
                  <div className="modal-header">
                      <DoorIcon />
                      <h2>Leave Band?</h2>
                      <p>
                          Are you sure you want to leave "{band.name}"?
                      </p>
                  </div>
              <div className="modal-actions">
                  <button className="btn tertiary" onClick={() => setShowLeaveModal(false)}>
                      Cancel
                  </button>
                  <button
                      className="btn danger"
                      onClick={() => {
                          handleLeaveBand();
                          setShowLeaveModal(false);
                      }}
                  >
                      Yes, Leave Band
                  </button>
              </div>
              </div>
          </div>
        )}
    </div>
  );
};
