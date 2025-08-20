import { useEffect, useState } from 'react';
import { leaveBand } from '@services/bands';
import { LoadingScreen } from '@features/shared/ui/loading/LoadingScreen';
import { getBandsByMusicianId } from '@services/bands';
import { DeleteGigIcon, DeleteIcon, DoorIcon, EditIcon, StarIcon, VerifiedIcon } from '../../shared/ui/extras/Icons';
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
import { LoadingThreeDots } from '../../shared/ui/loading/Loading';
import { MusicianProfile } from '../components/MusicianProfile';

export const BandDashboard = ({ user, bandProfiles, musicianProfile }) => {
  const { refreshMusicianProfile } = useMusicianDashboard();
  const { bandId } = useParams();
  const location = useLocation();
  const state = location.state;
  const [bandProfile, setBandProfile] = useState(state?.band || null);
  const [bandMembers, setBandMembers] = useState(state?.band?.members || null);
  const [showPreview, setShowPreview] = useState(true);
  const [loading, setLoading] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showLeaveModal, setShowLeaveModal] = useState(false);
  const [expand, setExpand] = useState(['your-sound', 'media-upload', 'further-information', 'social-media']);
  const isPrimaryOpen = expand.includes('primary-information');
  const toggleSection = (section) => {
    setExpand(prev =>
      prev.includes(section) ? prev.filter(s => s !== section) : [...prev, section]
    );
  };
  const bandAdmin = musicianProfile.musicianId === bandProfile?.bandInfo?.admin?.musicianId;

  useEffect(() => {
    const found = bandProfiles.find((b) => b.id === bandId);
    if (found) {
      setBandProfile(found);
      setBandMembers(found.members);
    };
  }, [bandProfiles, bandId]);

  const handleLeaveBand = async () => {
    try {
      setLoading(true);
      await leaveBand(bandProfile.id, musicianProfile.musicianId, musicianProfile.userId);
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
      await deleteBand(bandProfile.id);
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

  console.log('MUSICIANID', musicianProfile.musicianId)
  
  if (!bandProfile) {
    return <LoadingScreen />
  }

  return (
      <>
        <div className="musician-profile-hero">
            <img src={bandProfile?.picture} alt={bandProfile.name} className='background-image' />
            <div className="primary-information">
                {!bandProfile?.verified && (
                    <div className="verified-tag">
                        <VerifiedIcon />
                        <p>Verified Band</p>
                    </div>
                )}
                <h1 className="venue-name">
                    {bandProfile?.name}
                    <span className='orange-dot'>.</span>
                </h1>
                <h4 className="number-of-gigs">
                    {bandProfile?.gigsPerformed || 0} Gigs Performed
                </h4>
                <div className="action-buttons">
                  {musicianProfile?.musicianId === bandProfile?.bandInfo?.admin?.musicianId ? (
                    <>
                      <button className="btn quaternary" onClick={() => setShowPreview(!showPreview)}>
                          {showPreview ? (
                            'Edit Profile'
                          ) : (
                            'View Profile'
                          )}
                      </button>
                      {/* COLLAPSED HEADER (shown when NOT expanded) */}
                      {isPrimaryOpen && !showPreview ? (
                          <button
                              className="btn quaternary"
                              onClick={() => toggleSection('primary-information')}
                              aria-expanded={false}
                              aria-controls="primary-information-panel"
                          >
                              Hide Name and Profile Picture
                          </button>
                          ) : !showPreview &&(
                              <button
                              className="btn quaternary"
                              onClick={() => toggleSection('primary-information')}
                              aria-expanded={false}
                              aria-controls="primary-information-panel"
                          >
                              Edit Name and Profile Picture
                          </button>
                          )}
                      <button className="btn quaternary" onClick={() => setShowDeleteModal(true)}>
                        Delete Band
                      </button>
                    </>
                  ) : (
                    <button className="btn quaternary" onClick={() => setShowLeaveModal(true)}>
                      Leave Band
                    </button>
                  )}
                </div>
            </div>
        </div>
        {!showPreview ? (
            <div className="body profile">
                <ProfileForm
                    user={user}
                    musicianProfile={bandProfile}
                    setShowPreview={setShowPreview}
                    expand={expand}
                    setExpand={setExpand}
                    band={true}
                />
            </div>
        ) : (
            <div className="body profile-preview">
                <MusicianProfile
                    musicianProfile={bandProfile}
                    viewingOwnProfile={true}
                    setShowPreview={setShowPreview}
                    bandProfile={true}
                    bandMembers={bandMembers}
                    setBandMembers={setBandMembers}
                    musicianId={musicianProfile.musicianId}
                    bandAdmin={bandAdmin}
                />
            </div>
        )}
        {showDeleteModal && (
            <div className="modal" onClick={() => setShowDeleteModal(false)}>
            <div className="modal-content" onClick={(e) => e.stopPropagation()}>
                  <div className="modal-header">
                      <DeleteGigIcon />
                      <h2>Delete Band?</h2>
                      <p>
                          Are you sure you want to delete "{bandProfile.name}"? This action cannot be undone.
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
                          Are you sure you want to leave "{bandProfile.name}"?
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
    </>
  );
};