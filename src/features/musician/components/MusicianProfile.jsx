import { useState, useEffect, useMemo, useRef } from 'react';
import '@styles/musician/musician-profile.styles.css'
import { OverviewTab } from '@features/musician/profile/OverviewTab';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { EmptyIcon, InviteIconSolid, NoImageIcon, PlayIcon, PlayVideoIcon, SaveIcon, SavedIcon, TrackIcon, VerifiedIcon, VideoIcon } from '../../shared/ui/extras/Icons';
import { AboutTab } from '../profile/AboutTab';
import { getGigsByIds, } from '../../../services/client-side/gigs';
import { getMusicianProfileByMusicianId, updateMusicianProfile } from '../../../services/client-side/musicians';
import { Header as MusicianHeader } from '@features/musician/components/Header';
import { Header as VenueHeader } from '@features/venue/components/Header';
import { getOrCreateConversation } from '@services/api/conversations';
import { sendGigInvitationMessage } from '../../../services/client-side/messages';
import { toast } from 'sonner';
import { validateVenueUser } from '../../../services/utils/validation';
import { filterInvitableGigsForMusician } from '../../../services/utils/filtering';
import { LoadingSpinner, LoadingThreeDots } from '../../shared/ui/loading/Loading';
import { formatDate } from '@services/utils/dates';
import { BandMembersTab } from '../bands/BandMembersTab';
import Portal from '../../shared/components/Portal';
import { LoadingModal } from '../../shared/ui/loading/LoadingModal';
import { updateUserArrayField } from '@services/api/users';
import { inviteToGig } from '@services/api/gigs';
import { fetchMyVenueMembership } from '../../../services/client-side/venues';
import { useBreakpoint } from '../../../hooks/useBreakpoint';


const VideoModal = ({ video, onClose }) => {
    return (
        <div className='modal' onClick={onClose}>
            <div className='modal-content transparent' onClick={(e) => e.stopPropagation()}>
                <span className='close' onClick={onClose}>&times;</span>
                <video controls autoPlay style={{ width: '100%' }}>
                    <source src={video.file} type='video/mp4' />
                    Your browser does not support the video tag.
                </video>
            </div>
        </div>
    );
};

export const MusicianProfile = ({ musicianProfile: musicianProfileProp, viewingOwnProfile = false, setShowPreview, user, setAuthModal, setAuthType, bandProfile = false, bandMembers, setBandMembers, musicianId, bandAdmin=false }) => {
    const { musicianId: routeMusicianId } = useParams();
    const {isMdUp, isLgUp} = useBreakpoint();
    const [activeTab, setActiveTab] = useState('home');
    const [upcomingGigs, setUpcomingGigs] = useState([]);
    const [loadingGigs, setLoadingGigs] = useState(false);
    const [expanded, setExpanded] = useState(false);
    const [videoToPlay, setVideoToPlay] = useState(null);
    const displayed = useMemo(() => (expanded ? upcomingGigs : upcomingGigs?.slice(0, 3) ?? []), [expanded, upcomingGigs]);
    const [currentTrack, setCurrentTrack] = useState(null);
    const audioRef = useRef(null);
    const navigate = useNavigate();
    const location = useLocation();
    const [padding, setPadding] = useState('5%');
    const [inviteMusicianModal, setInviteMusicianModal] = useState(false);
    const [usersGigs, setUsersGigs] = useState([]);
    const [musicianSaved, setMusicianSaved] = useState(false);
    const [savingMusician, setSavingMusician] = useState(false);
    const [selectedGig, setSelectedGig] = useState();
    const [inviting, setInviting] = useState(false);


    useEffect(() => {
      if (isLgUp) {
        setPadding('15vw');
      } else {
        setPadding('1rem');
      }
    }, [isLgUp])


    // Local state for fetched profile (when coming from public route)
    const [fetchedProfile, setFetchedProfile] = useState(null);
    const [profileLoading, setProfileLoading] = useState(false);
    const [profileError, setProfileError] = useState(null);

    // Unified source of truth for the profile
    const profile = useMemo(
        () => musicianProfileProp ?? fetchedProfile,
        [musicianProfileProp, fetchedProfile]
    );

    // Fetch when no prop provided
    useEffect(() => {
        if (musicianProfileProp) return; // dashboard flow, nothing to fetch
        if (!routeMusicianId) return;

        let cancelled = false;
        (async () => {
        try {
            setProfileLoading(true);
            setProfileError(null);
            const p = await getMusicianProfileByMusicianId(routeMusicianId);
            if (!cancelled) setFetchedProfile(p || null);
        } catch (e) {
            console.error("Failed to load musician profile", e);
            if (!cancelled) setProfileError("Unable to load musician profile.");
        } finally {
            if (!cancelled) setProfileLoading(false);
        }
        })();

        const getSavedMusicians = async () => {
            if (user?.savedMusicians && user.savedMusicians.length > 0) {
                const activeMusicianSaved = user.savedMusicians.includes(routeMusicianId);
                setMusicianSaved(!!activeMusicianSaved);
            } else {
                setMusicianSaved(false);
            }
        }
        getSavedMusicians();

        return () => {
            cancelled = true;
        };
    }, [musicianProfileProp, routeMusicianId]);
    
    const handlePlayTrack = (track) => {
      setCurrentTrack(track);
      setTimeout(() => {
        if (audioRef.current) {
          audioRef.current.play();
        }
      }, 0);
    };
    
    const handleStopTrack = () => {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.currentTime = 0;
      }
      setCurrentTrack(null);
    };

    useEffect(() => {
        const confirmed = profile?.confirmedGigs;
        if (!confirmed?.length) {
          setUpcomingGigs([]);
          return;
        }
        const ids = confirmed
          .map((g) => (typeof g === "string" ? g : g?.gigId))
          .filter(Boolean);
    
        if (ids.length === 0) {
          setUpcomingGigs([]);
          return;
        }
    
        let cancelled = false;
        (async () => {
          try {
            setLoadingGigs(true);
            const gigs = await getGigsByIds(ids);
            if (!cancelled) setUpcomingGigs(gigs || []);
          } catch (error) {
            console.error("Error fetching gigs:", error);
            if (!cancelled) setUpcomingGigs([]);
          } finally {
            if (!cancelled) setLoadingGigs(false);
          }
        })();
    
        return () => {
          cancelled = true;
        };
      }, [profile?.confirmedGigs]);

      const handleBuildGigForMusician = () => {
        navigate('/venues/dashboard/gigs', { state: {
            musicianData: {
                id: profile.id,
                type: profile.musicianType,
                plays: profile.musicType,
                genres: profile.genres,
                name: profile.name,
                bandProfile: profile.bandProfile,
            },
            buildingForMusician: true,
            showGigPostModal: true,
        }})
    }

    const renderActiveTabContent = () => {
        switch (activeTab) {
            case 'home':
                return <OverviewTab musicianData={profile} viewingOwnProfile={viewingOwnProfile} setShowPreview={setShowPreview} videoToPlay={videoToPlay} setVideoToPlay={setVideoToPlay} bandAdmin={bandAdmin} setCurrentTrack={setCurrentTrack} currentTrack={currentTrack} audioRef={audioRef} handlePlayTrack={handlePlayTrack} handleStopTrack={handleStopTrack} profile={profile} />; 
            case 'tech-info':
                return <AboutTab musicianData={profile} viewingOwnProfile={viewingOwnProfile} setShowPreview={setShowPreview} bandAdmin={bandAdmin} />;
            default:
                return null;
        }        
    };

    const closeModal = () => {
        setVideoToPlay(null);
    };

    if (!musicianProfileProp && (profileLoading || !profile) && !profileError) {
        return <div className="musician-profile"><p>Loading profile…</p></div>;
    }

    if (profileError) {
        return (
          <div className="musician-profile">
            <p className="error">{profileError}</p>
          </div>
        );
    }

    const canInviteForVenue = (gig) => {
      const role = gig?.myMembership?.role || "member";
      const perms = gig?.myMembership?.permissions || {};
      return role === "owner" || perms["gigs.invite"] === true;
    };

    const handleSendMusicianInvite = async (gigData) => {
        if (!profile || !gigData) {
          return;
        }
        // if (!canInviteForVenue(gigData)) {
        //   toast.error("You do not have permission to invite musicians to gigs at this venue.");
        //   setInviting(false);
        //   return;
        // }
        const venueToSend = user.venueProfiles.find(venue => venue.id === gigData.venueId);
        if (!venueToSend) {
          console.error('Venue not found in user profiles.');
          return;
        }
        try {
          const res = await inviteToGig({ gigId: gigData.gigId, musicianProfile: profile });
          if (!res.success) {
            if (res.code === "permission-denied") {
              toast.error("You don’t have permission to invite musicians for this venue.");
            } else if (res.code === "failed-precondition") {
              toast.error("This gig is missing required venue info.");
            } else {
              toast.error("Error inviting musician. Do you have permission to invite musicians to gigs at this venue?");
            }
            return;
          }
          const { conversationId } = await getOrCreateConversation(
            { musicianProfile: profile, gigData, venueProfile: venueToSend, type: 'invitation' }
          );
          if (gigData.kind === 'Ticketed Gig' || gigData.kind === 'Open Mic') {
            await sendGigInvitationMessage(conversationId, {
              senderId: user.uid,
              text: `${venueToSend.accountName} invited ${profile.name} to play at their gig at ${gigData.venue.venueName} on the ${formatDate(
                gigData.date
              )}.`,
            });
          } else {
            await sendGigInvitationMessage(conversationId, {
              senderId: user.uid,
              text: `${venueToSend.accountName} invited ${profile.name} to play at their gig at ${gigData.venue.venueName} on the ${formatDate(
                gigData.date
              )} for ${gigData.budget}.`,
            });
          }
          setInviteMusicianModal(false);
          toast.success(`Invite sent to ${profile.name}`);
        } catch (error) {
          console.error('Error while creating or fetching conversation:', error);
          toast.error('Error inviting musician. Please try again.');
        } finally {
          setInviting(false);
        }
      };
      
      const handleSaveMusician = async () => {
        if (user && routeMusicianId) {
          setSavingMusician(true);
          try {
            await updateUserArrayField({ field: 'savedMusicians', op: 'add', value: routeMusicianId });
            setMusicianSaved(true);
            toast.success('Musician Saved.');
          } catch (error) {
            console.error('Error saving musician:', error);
            toast.error('Failed to save musician. Please try again.');
          } finally {
            setSavingMusician(false);
          }
        }
      };
      
      const handleUnsaveMusician = async () => {
        if (user && routeMusicianId) {
          setSavingMusician(true);
          try {
            await updateUserArrayField({ field: 'savedMusicians', op: 'remove', value: routeMusicianId });
            setMusicianSaved(false);
            toast.success('Musician Unsaved.');
          } catch (error) {
            console.error('Error unsaving musician:', error);
            toast.error('Failed to unsave musician. Please try again.');
          } finally {
            setSavingMusician(false);
          }
        }
      };
      
      const handleInviteMusician = async () => {
        const { valid, venueProfiles } = validateVenueUser({
          user,
          setAuthModal,
          setAuthType,
          showAlert: (msg) => alert(msg),
        });
        if (!valid) return;
        const gigIds = venueProfiles.flatMap(venueProfile => venueProfile.gigs || []);
        try {
          const fetchedGigs = await getGigsByIds(gigIds);
          const availableGigs = filterInvitableGigsForMusician(fetchedGigs, routeMusicianId);
          const venuesWithMembership = await Promise.all(
            (venueProfiles || []).map(v => fetchMyVenueMembership(v, user.uid))
          );
          const membershipByVenueId = Object.fromEntries(
            venuesWithMembership
              .filter(Boolean)
              .map(v => [v.venueId, v.myMembership || null])
          );
          const gigsWithMembership = availableGigs.map(gig => ({
            ...gig,
            myMembership: membershipByVenueId[gig.venueId] || null,
          }));
          setUsersGigs(gigsWithMembership);
          setInviteMusicianModal(true);
        } catch (error) {
          console.error('Error fetching future gigs:', error);
          toast.error('We encountered an error. Please try again.');
        }
      };


return (
    <div className="musician-profile">
      {!viewingOwnProfile && (
        <>
            {user.venueProfiles && user.venueProfiles.length > 0 ? (
                <VenueHeader
                    user={user}
                    setAuthModal={setAuthModal}
                    setAuthType={setAuthType}
                    padding={padding}
                />
            ) : (
                <MusicianHeader
                    user={user}
                    setAuthModal={setAuthModal}
                    setAuthType={setAuthType}
                />
            )}
            {isMdUp ? (
              <div className={`musician-profile-hero ${padding === '15vw' ? 'large-padding' : 'normal-padding'}`}>
                  {profile?.picture ? (
                      <img src={profile?.picture} alt={profile.name} className='background-image' />
                  ) : (
                      <div className="background-image empty">
                          <NoImageIcon />
                          <h4>No Artist Image</h4>
                      </div>
                  )}
                  <div className="primary-information">
                      {profile?.verified && (
                      <div className="verified-tag">
                          <VerifiedIcon />
                          <p>Verified Artist</p>
                      </div>
                      )}
                      <h1 className="venue-name">
                        {profile?.name}
                        <span className="orange-dot">.</span>
                      </h1>
                      {user.venueProfiles && user.venueProfiles.length > 0 && (
                        <div className="action-buttons">
                          <button
                              className="btn quaternary"
                              onClick={() => handleInviteMusician()}
                          >
                              Invite to Gig
                          </button>
                          {!musicianSaved ? (
                              <button className='btn quaternary' onClick={handleSaveMusician}>
                                  {savingMusician ? (
                                      <LoadingSpinner width={10} height={10} />
                                  ) : (
                                      <>
                                          Save
                                      </>
                                  )}
                              </button>
                          ) : (
                              <button className='btn quaternary' onClick={handleUnsaveMusician}>
                                  {savingMusician ? (
                                      <LoadingSpinner width={10} height={10} />
                                  ) : (
                                      <>
                                          Unsave
                                      </>
                                  )}
                              </button>   
                          )}
                        </div>
                      )}
                  </div>
              </div>
            ) : (
              <div className={`musician-profile-hero`}>
                  {profile?.picture ? (
                      <img src={profile?.picture} alt={profile.name} className='background-image' />
                  ) : (
                      <div className="background-image empty">
                          <NoImageIcon />
                          <h4>No Artist Image</h4>
                      </div>
                  )}
                  <div className="primary-information">
                      <h1 className="venue-name">
                        {profile?.name}
                        <span className="orange-dot">.</span>
                      </h1>
                  </div>
              </div>
            )}
        </>
      )}

      <div className={`musician-profile-body ${!isMdUp && 'mobile'} ${!viewingOwnProfile && 'third-party-viewer'}`} style={{ padding: `0 ${!viewingOwnProfile ? padding : '0 !important'}` }}>
        {!isMdUp && !viewingOwnProfile && (
          <div className="top-section">
            {profile?.verified && (
              <div className="verified-tag">
                <VerifiedIcon />
                <h4>Verified Artist</h4>
              </div>
            )}
            {user?.venueProfiles && user?.venueProfiles?.length > 0 && (
              <div className="action-buttons">
                <button
                    className="btn secondary"
                    onClick={() => handleInviteMusician()}
                >
                    Invite to Gig
                </button>
                {!musicianSaved ? (
                    <button className='btn secondary' onClick={handleSaveMusician}>
                        {savingMusician ? (
                            <LoadingSpinner width={15} height={15} />
                        ) : (
                            <>
                                Save
                            </>
                        )}
                    </button>
                ) : (
                    <button className='btn secondary' onClick={handleUnsaveMusician}>
                        {savingMusician ? (
                            <LoadingSpinner width={15} height={15} />
                        ) : (
                            <>
                                Unsave
                            </>
                        )}
                    </button>   
                )}
              </div>
            )}
          </div>
        )}
        <div className="musician-profile-information-container">
          <div className="musician-profile-information">
            <nav
              className="musician-profile-tabs"
              style={{ margin: location.pathname.includes("dashboard") ? "0 5%" : undefined }}
            >
              <p
                onClick={() => setActiveTab("home")}
                className={`musician-profile-tab ${activeTab === "home" ? "active" : ""}`}
              >
                About Me
              </p>
              <p
                onClick={() => setActiveTab("tech-info")}
                className={`musician-profile-tab ${activeTab === "tech-info" ? "active" : ""}`}
              >
                Technical Information
              </p>
            </nav>

            <div className="musician-profile-sections">{renderActiveTabContent()}</div>
          </div>
        </div>

        {isMdUp && (
          <div className="musician-profile-gigs-and-tracks">
                {currentTrack && (
                  <div className="track-player">
                    <div className="track-info">
                      <h4>Now playing: {currentTrack.title}</h4>
                      <button className="btn text" onClick={handleStopTrack}>
                        Close
                      </button>
                    </div>
                    <audio
                      ref={audioRef}
                      controls
                      autoPlay
                      src={currentTrack.file}
                      onEnded={handleStopTrack}
                      />
                  </div>
                )}
              <div className="musician-tracks">
                <h3>Tracks</h3>
                {profile?.tracks?.length ? (
                  <ul className="track-list">
                    {profile.tracks.map((track) => (
                      <li key={track?.id || track?.file} className="track-item">
                        <button
                          type="button"
                          className="btn icon"
                          onClick={() => handlePlayTrack(track)}
                          aria-label={`Play ${track?.title}`}
                        >
                          <PlayIcon />
                        </button>
                        <div className="track-details">
                          <span className="track-name">{track?.title}</span>
                          <p>{track?.date}</p>
                        </div>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <div className="empty-container">
                    <EmptyIcon />
                    <h4>No Tracks Uploaded</h4>
                    {viewingOwnProfile && (
                      <button className="btn tertiary" onClick={() => setShowPreview(false)}>
                        Add Tracks
                      </button>
                    )}
                  </div>
                )}
              </div>
          </div>

        )}
      </div>

      {videoToPlay && <VideoModal video={videoToPlay} onClose={closeModal} />}
      {inviteMusicianModal && !inviting ? (
        <Portal>
          <div className='modal invite-musician' onClick={() => setInviteMusicianModal(false)}>
              <div className='modal-content' onClick={(e) => e.stopPropagation()}>
                  <div className="modal-header">
                    <div className="modal-header-text">
                      <InviteIconSolid />
                      <h2>Invite {profile.name} to one of your available gigs.</h2>
                    </div>
                    <div className="or-separator">
                      <span />
                      <h6>or</h6>
                      <span />
                    </div>
                    <button className="btn secondary" onClick={handleBuildGigForMusician}>
                      Build New Gig For Musician
                    </button>
                  </div>
                  <div className='gig-selection'>
                    {usersGigs.length > 0 && (
                      usersGigs.map((gig, index) => {
                        if (canInviteForVenue(gig)) {
                          return (
                            <div className={`card ${selectedGig === gig ? 'selected' : ''}`} key={index} onClick={() => setSelectedGig(gig)}>
                                <div className="gig-details">
                                    <h4 className='text'>{gig.gigName}</h4>
                                    <h5>{gig.venue.venueName}</h5>
                                </div>
                                <p className='sub-text'>{formatDate(gig.date, 'short')} - {gig.startTime}</p>
                            </div>
                          )
                        } else {
                          return (
                            <div className={`card disabled`} key={index}>
                                <div className="gig-details">
                                    <h4 className='text'>{gig.gigName}</h4>
                                    <h5 className='details-text'>You don't have permission to invite musicians to gigs at this venue.</h5>
                                </div>
                                <p className='sub-text'>{formatDate(gig.date, 'short')} - {gig.startTime}</p>
                            </div>
                          )
                        }
                      })
                    )}
                  </div>
                  <div className='two-buttons'>
                      <button className='btn tertiary' onClick={() => setInviteMusicianModal(false)}>Cancel</button>
                      {selectedGig && (
                        <button className='btn primary' disabled={!selectedGig} onClick={() => {setInviting(true); handleSendMusicianInvite(selectedGig)}}>Invite</button>
                      )}
                  </div>
              </div>
          </div>
        </Portal>
      ) : inviteMusicianModal && inviting && (
        <Portal>
          <LoadingModal title={`Sending Invite`} />
        </Portal>
      )}
    </div>
  );
};