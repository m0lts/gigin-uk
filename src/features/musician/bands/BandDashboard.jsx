import { useEffect, useState } from 'react';
import { LoadingScreen } from '@features/shared/ui/loading/LoadingScreen';
import { DeleteGigIcon, DeleteIcon, DoorIcon, EditIcon, NoImageIcon, StarIcon, VerifiedIcon } from '../../shared/ui/extras/Icons';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { toast } from 'sonner';
import { deleteBand, leaveBand } from '@services/api/bands';
import { useMusicianDashboard } from '../../../context/MusicianDashboardContext';
import { ProfileForm } from '../dashboard/profile-form/ProfileForm';
import { MusicianProfile } from '../components/MusicianProfile';
import Portal from '../../shared/components/Portal';
import { useBreakpoint } from '../../../hooks/useBreakpoint';

export const BandDashboard = ({ user, bandProfiles, musicianProfile }) => {
  const { refreshMusicianProfile, loading, setLoading } = useMusicianDashboard();
  const { bandId } = useParams();
  const {isMdUp} = useBreakpoint();
  const location = useLocation();
  const navigate = useNavigate();
  const state = location.state;
  const [bandProfile, setBandProfile] = useState(state?.band || null);
  const [bandMembers, setBandMembers] = useState(state?.band?.members || null);
  const [showPreview, setShowPreview] = useState(state?.preview === false ? false : true);
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
    if (!state) {
      const found = bandProfiles.find((b) => b.id === bandId);
      if (found) {
        setBandProfile(found);
        setBandMembers(found.members);
      };
    }
  }, [bandProfiles, bandId, musicianProfile.bands, state]);

  const handleLeaveBand = async () => {
    try {
      setLoading(true);
      await leaveBand({ bandId: bandProfile.id, musicianProfileId: musicianProfile.musicianId, userId: musicianProfile.userId });
      await refreshMusicianProfile();
      toast.success('Left the band.');
      navigate('/dashboard/bands');
    } catch (err) {
      console.error('Failed to leave band:', err);
      toast.error('Failed to leave the band. Please try again.');
    }
  };

  const handleDeleteBand = async () => {
    setLoading(true);
    try {
      await deleteBand({ bandId: bandProfile.id });
      await refreshMusicianProfile();
      toast.success('Band deleted.');
      navigate('/dashboard/bands');
    } catch (err) {
      console.error('Failed to delete band:', err);
      toast.error('Failed to delete band. Please try again.');
    }
  };
  
  if (!bandProfile) {
    return <LoadingScreen />
  }

  if (loading) {
    return <LoadingScreen />
  }

  const loadBandFromProfiles = () => {
    const found = (bandProfiles || []).find(b => (b.id || b.bandId) === bandId);
    if (found) {
      setBandProfile(found);
      setBandMembers(found.members || null);
    }
  };

  return (
      <>
          {isMdUp ? (
            <div className="musician-profile-hero">
              {bandProfile?.picture ? (
                  <img src={bandProfile?.picture} alt={bandProfile.name} className='background-image' />
              ) : (
                  <div className="background-image empty">
                      <NoImageIcon />
                      <h4>No Band Image</h4>
                  </div>
              )}
                <div className="primary-information">
                    {bandProfile?.verified && (
                        <div className="verified-tag">
                            <VerifiedIcon />
                            <p>Verified Band</p>
                        </div>
                    )}
                    <h1 className="venue-name">
                        {bandProfile?.name}
                        <span className='orange-dot'>.</span>
                    </h1>
                    <div className="action-buttons">
                      {bandAdmin ? (
                        <>
                          <button className="btn quaternary" onClick={() => {
                              const next = !showPreview;
                              setShowPreview(next);
                              if (next) {
                                navigate(location.pathname, { replace: true, state: null });
                                setBandProfile(null);
                                setBandMembers(null);
                                loadBandFromProfiles();
                              }
                            }}
                          >
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
          ) : (
            <div className="musician-profile-hero">
              {bandProfile?.picture ? (
                  <img src={bandProfile?.picture} alt={bandProfile.name} className='background-image' />
              ) : (
                  <div className="background-image empty">
                      <NoImageIcon />
                      <h4>No Band Image</h4>
                  </div>
              )}
                <div className="primary-information">
                    <h1 className="venue-name">
                        {bandProfile?.name}
                        <span className='orange-dot'>.</span>
                    </h1>
                    <div className="action-buttons">
                        <>
                          
                          {/* COLLAPSED HEADER (shown when NOT expanded) */}
                          

                        </>
                    </div>
                </div>
            </div>
          )}
        {!showPreview ? (
            <div className="body profile">
                {!isMdUp && (
                    <div className='top-section'>
                        {bandProfile?.verified && (
                            <div className="verified-tag">
                                <VerifiedIcon />
                                <h4>Verified Artist</h4>
                            </div>
                        )}
                        {bandAdmin ? (
                          <div className="action-buttons">
                              <button className="btn secondary" onClick={() => {
                                  const next = !showPreview;
                                  setShowPreview(next);
                                  if (next) {
                                    navigate(location.pathname, { replace: true, state: null });
                                    setBandProfile(null);
                                    setBandMembers(null);
                                    loadBandFromProfiles();
                                  }
                                }}
                              >
                                {showPreview ? (
                                  'Edit Profile'
                                ) : (
                                  'View Profile'
                                )}
                              </button>
                              {isPrimaryOpen ? (
                              <button
                                  className="btn secondary"
                                  onClick={() => toggleSection('primary-information')}
                                  aria-expanded={false}
                                  aria-controls="primary-information-panel"
                              >
                                  Hide Name and Profile Picture
                              </button>
                              ) : (
                                  <button
                                  className="btn secondary"
                                  onClick={() => toggleSection('primary-information')}
                                  aria-expanded={false}
                                  aria-controls="primary-information-panel"
                              >
                                  Edit Name and Profile Picture
                              </button>
                              )}
                              <button className="btn secondary" onClick={() => setShowDeleteModal(true)}>
                                Delete Band
                              </button>
                          </div>
                        ) : (
                          <button className="btn secondary" onClick={() => setShowLeaveModal(true)}>
                            Leave Band
                          </button>
                        )}
                    </div>
                  )}
                <ProfileForm
                    user={user}
                    musicianProfile={bandProfile}
                    setShowPreview={setShowPreview}
                    expand={expand}
                    setExpand={setExpand}
                    band={true}
                    bandAdmin={bandAdmin}
                />
            </div>
        ) : (
            <div className="body profile-preview">
                  {!isMdUp && (
                    <div className='top-section'>
                        {bandProfile?.verified && (
                            <div className="verified-tag">
                                <VerifiedIcon />
                                <h4>Verified Artist</h4>
                            </div>
                        )}
                        {bandAdmin ? (
                          <div className="action-buttons">
                              <button className="btn secondary" onClick={() => {
                                  const next = !showPreview;
                                  setShowPreview(next);
                                  if (next) {
                                    navigate(location.pathname, { replace: true, state: null });
                                    setBandProfile(null);
                                    setBandMembers(null);
                                    loadBandFromProfiles();
                                  }
                                }}
                              >
                                {showPreview ? (
                                  'Edit Profile'
                                ) : (
                                  'View Profile'
                                )}
                              </button>
                              <button className="btn secondary" onClick={() => setShowDeleteModal(true)}>
                                Delete Band
                              </button>
                          </div>
                        ) : (
                          <button className="btn secondary" onClick={() => setShowLeaveModal(true)}>
                            Leave Band
                          </button>
                        )}
                    </div>
                  )}
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
          <Portal>
            <div className="modal" onClick={() => setShowDeleteModal(false)}>
              <div className="modal-content" onClick={(e) => e.stopPropagation()}>
                    <div className="modal-header">
                        <DeleteGigIcon />
                        <h2>Delete Band?</h2>
                        <p>
                            Are you sure you want to delete "{bandProfile.name}"? This action cannot be undone.
                        </p>
                    </div>
                <div className="modal-actions" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap:'1rem'}}>
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
          </Portal>
        )}
        {showLeaveModal && (
          <Portal>
            <div className="modal" onClick={() => setShowLeaveModal(false)}>
              <div className="modal-content" onClick={(e) => e.stopPropagation()}>
                  <div className="modal-header">
                      <DoorIcon />
                      <h2>Leave Band?</h2>
                      <p>
                          Are you sure you want to leave "{bandProfile.name}"?
                      </p>
                  </div>
              <div className="modal-actions" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap:'1rem'}}>
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
          </Portal>
        )}
    </>
  );
};