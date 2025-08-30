import { useState, useEffect, useMemo, useRef } from 'react';
import { EditIcon, StarIcon } from '@features/shared/ui/extras/Icons';
import '@styles/musician/musician-profile.styles.css'
import { OverviewTab } from '@features/musician/profile/OverviewTab';
import { MusicTab } from '@features/musician/profile/MusicTab';
import { ReviewsTab } from '@features/musician/profile/ReviewsTab';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { EmptyIcon, InviteIconSolid, NoImageIcon, PlayIcon, PlayVideoIcon, SaveIcon, SavedIcon, TrackIcon, VerifiedIcon, VideoIcon } from '../../shared/ui/extras/Icons';
import { AboutTab } from '../profile/AboutTab';
import { getGigsByIds, inviteToGig } from '../../../services/gigs';
import Skeleton from 'react-loading-skeleton';
import { openInNewTab } from '@services/utils/misc';
import { getMusicianProfileByMusicianId, updateMusicianProfile } from '../../../services/musicians';
import { Header as MusicianHeader } from '@features/musician/components/Header';
import { Header as VenueHeader } from '@features/venue/components/Header';
import { useResizeEffect } from '@hooks/useResizeEffect';
import { getOrCreateConversation } from '../../../services/conversations';
import { sendGigInvitationMessage } from '../../../services/messages';
import { toast } from 'sonner';
import { updateUserDocument } from '../../../services/users';
import { validateVenueUser } from '../../../services/utils/validation';
import { filterInvitableGigsForMusician } from '../../../services/utils/filtering';
import { LoadingThreeDots } from '../../shared/ui/loading/Loading';
import { arrayRemove, arrayUnion } from 'firebase/firestore';
import { formatDate } from '@services/utils/dates';
import { BandMembersTab } from '../bands/BandMembersTab';


const VideoModal = ({ video, onClose }) => {
    return (
        <div className='modal'>
            <div className='modal-content transparent'>
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


    useResizeEffect((width) => {
        if (width > 1100) {
          setPadding('15vw');
        } else {
          setPadding('1rem');
        }
      });


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
                return <OverviewTab musicianData={profile} viewingOwnProfile={viewingOwnProfile} setShowPreview={setShowPreview} videoToPlay={videoToPlay} setVideoToPlay={setVideoToPlay} bandAdmin={bandAdmin} setCurrentTrack={setCurrentTrack} />; 
            case 'tech-info':
                return <AboutTab musicianData={profile} viewingOwnProfile={viewingOwnProfile} setShowPreview={setShowPreview} bandAdmin={bandAdmin} />;
            // case 'tech-info':
            //     return <ReviewsTab profile={profile} viewingOwnProfile={viewingOwnProfile} setShowPreview={setShowPreview} bandAdmin={bandAdmin} />;
            // case 'members':
            //   return bandProfile ? <BandMembersTab band={profile} bandMembers={bandMembers} setBandMembers={setBandMembers} musicianId={musicianId} bandAdmin={bandAdmin} /> : null;
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

    const handleSendMusicianInvite = async (gigData) => {
        if (!profile || !gigData) {
          return;
        }
      
        const venueToSend = user.venueProfiles.find(venue => venue.id === gigData.venueId);
        if (!venueToSend) {
          console.error('Venue not found in user profiles.');
          return;
        }
      
        try {
          await inviteToGig(gigData.gigId, profile);
      
          const newGigApplicationEntry = {
            gigId: gigData.gigId,
            profileId: profile.musicianId,
            name: profile.name,
          };
      
          const updatedGigApplicationsArray = profile.gigApplications
            ? [...profile.gigApplications, newGigApplicationEntry]
            : [newGigApplicationEntry];
      
          await updateMusicianProfile(profile.musicianId, {
            gigApplications: updatedGigApplicationsArray,
          });
      
          const conversationId = await getOrCreateConversation(
            profile,
            gigData,
            venueToSend,
            'invitation'
          );
      
          await sendGigInvitationMessage(conversationId, {
            senderId: user.uid,
            text: `${venueToSend.accountName} invited ${profile.name} to play at their gig at ${gigData.venue.venueName} on the ${formatDate(
              gigData.date
            )} for ${gigData.budget}.`,
          });
      
          setInviteMusicianModal(false);
          toast.success(`Invite sent to ${profile.name}`);
        } catch (error) {
          console.error('Error while creating or fetching conversation:', error);
          toast.error('Error inviting musician. Please try again.');
        }
      };
      
      const handleSaveMusician = async () => {
        if (user && routeMusicianId) {
          setSavingMusician(true);
          try {
            await updateUserDocument(user.uid, {
              savedMusicians: arrayUnion(routeMusicianId),
            });
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
            await updateUserDocument(user.uid, {
              savedMusicians: arrayRemove(routeMusicianId),
            });
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
      
          setInviteMusicianModal(true);
          setUsersGigs(availableGigs);
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
                    <h4 className="number-of-gigs">
                      {profile?.gigsPerformed || 0} Gigs Performed
                    </h4>
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
                                  <LoadingThreeDots />
                              ) : (
                                  <>
                                      Save
                                  </>
                              )}
                          </button>
                      ) : (
                          <button className='btn quaternary' onClick={handleUnsaveMusician}>
                              {savingMusician ? (
                                  <LoadingThreeDots />
                              ) : (
                                  <>
                                      Unsave
                                  </>
                              )}
                          </button>   
                      )}
                    </div>
                </div>
            </div>
        </>
      )}

      <div className="musician-profile-body" style={{ padding: `0 ${!viewingOwnProfile ? padding : '0 !important'}` }}>
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

            {/* {!!profile?.confirmedGigs?.length && (
              <div className="gigs-box">
                {loadingGigs ? (
                  <Skeleton width={"100%"} height={250} />
                ) : upcomingGigs.length > 0 ? (
                  <>
                    <div className="gigs-box-header">
                      <h3>Upcoming Gigs</h3>
                      {upcomingGigs.length > 3 && (
                        <button
                          type="button"
                          className="btn text"
                          onClick={() => setExpanded((v) => !v)}
                          aria-expanded={expanded}
                        >
                          {expanded ? "See less" : `See more (${upcomingGigs.length - 3})`}
                        </button>
                      )}
                    </div>

                    {displayed.map((gig) => {
                      const gigDate = gig.date?.toDate ? gig.date.toDate() : new Date(gig.date);
                      const day = gigDate.toLocaleDateString("en-US", { day: "2-digit" });
                      const month = gigDate.toLocaleDateString("en-US", { month: "short" });

                      return (
                        <div key={gig.id || gig.gigId} className="gig-card">
                          <div className="date-box">
                            <h4 className="month">{month.toUpperCase()}</h4>
                            <h2 className="day">{day}</h2>
                          </div>
                          <div className="gig-type">
                            <h4>{gig.gigName}</h4>
                          </div>
                          <button
                            className="btn tertiary"
                            onClick={(e) => openInNewTab(`/gig/${gig.gigId ?? gig.id}`, e)}
                          >
                            Open
                          </button>
                        </div>
                      );
                    })}
                  </>
                ) : (
                  <p>No upcoming gigs found</p>
                )}
              </div>
          )} */}

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
      </div>

      {videoToPlay && <VideoModal video={videoToPlay} onClose={closeModal} />}
      {inviteMusicianModal && (
              <div className='modal'>
                  <div className='modal-content'>
                      <div className="modal-header">
                          <InviteIconSolid />
                          <h2>Invite {profile.name} to a Gig?</h2>
                          {usersGigs.length > 0 ? (
                              <p>Select a gig you've already posted, or click 'Build New Gig For Musician' to post a gig and automatically invite this musician.</p>
                          ) : (
                              <p>You have no gig posts availabe for invitation. You can create one by clicking 'Build New Gig For Musician' to post a gig and automatically invite this musician.</p>
                          )}
                      </div>
                      <div className='gig-selection'>
                          {usersGigs.length > 0 && (
                              usersGigs.map((gig, index) => (
                                  <div className={`card ${selectedGig === gig ? 'selected' : ''}`} key={index} onClick={() => setSelectedGig(gig)}>
                                      <div className="gig-details">
                                          <h4 className='text'>{gig.gigName}</h4>
                                          <h5>{gig.venue.venueName}</h5>
                                      </div>
                                      <p className='sub-text'>{formatDate(gig.date, 'short')} - {gig.startTime}</p>
                                  </div>
                              ))
                          )}
                      </div>
                      <button className="btn secondary" onClick={handleBuildGigForMusician}>
                          Build New Gig For Musician
                      </button>
                      <div className='two-buttons'>
                          <button className='btn tertiary' onClick={() => setInviteMusicianModal(false)}>Cancel</button>
                          <button className='btn primary' disabled={!selectedGig} onClick={() => handleSendMusicianInvite(selectedGig)}>Invite</button>
                      </div>
                  </div>
              </div>
          )}
    </div>
  );
};