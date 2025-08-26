import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom'
import { Header as MusicianHeader } from '@features/musician/components/Header';
import { Header as VenueHeader } from '@features/venue/components/Header';
import { arrayRemove, arrayUnion } from 'firebase/firestore';
import { OverviewTab } from '@features/musician/profile/OverviewTab';
import { MusicTab } from '@features/musician/profile/MusicTab';
import { ReviewsTab } from '@features/musician/profile/ReviewsTab';
import { 
    InviteIcon,
    SaveIcon,
    SavedIcon,
    StarIcon,
    TickIcon } from '@features/shared/ui/extras/Icons';
import { LoadingScreen } from '@features/shared/ui/loading/LoadingScreen';
import { LoadingThreeDots } from '@features/shared/ui/loading/Loading';
import { getMusicianProfileByMusicianId, updateMusicianProfile } from '@services/musicians';
import { updateUserDocument } from '@services/users';
import { validateVenueUser } from '@services/utils/validation';
import { formatDate } from '@services/utils/dates';
import { getGigsByIds, inviteToGig } from '@services/gigs';
import { filterFutureGigs } from '@services/utils/filtering';
import { getOrCreateConversation } from '@services/conversations';
import { sendGigInvitationMessage } from '@services/messages';
import { useResizeEffect } from '@hooks/useResizeEffect';
import { BandMembersTab } from '../bands/BandMembersTab';
import { getBandDataOnly } from '../../../services/bands';
import { filterInvitableGigsForMusician } from '../../../services/utils/filtering';
import { toast } from 'sonner';
import { InviteIconSolid } from '../../shared/ui/extras/Icons';


export const MusicianProfile = ({ user, setAuthModal, setAuthType }) => {

    const { musicianId, gigId } = useParams();
    const navigate = useNavigate();
    const [musicianProfile, setMusicianProfile] = useState();
    const [activeTab, setActiveTab] = useState('overview');
    const [loading, setLoading] = useState(true);
    const [padding, setPadding] = useState('5%');
    const [musicianSaved, setMusicianSaved] = useState(false);
    const [savingMusician, setSavingMusician] = useState(false);
    const [inviteMusicianModal, setInviteMusicianModal] = useState(false);
    const [usersGigs, setUsersGigs] = useState([]);
    const [selectedGig, setSelectedGig] = useState();
    const [band, setBand] = useState(null);
    const [bandMembers, setBandMembers] = useState(null);


    useEffect(() => {
        const fetchMusicianProfile = async () => {
            try {
                const musician = await getMusicianProfileByMusicianId(musicianId);
                setMusicianProfile(musician);
                if (musician.bandProfile) {
                    const bandData = await getBandDataOnly(musician.musicianId);
                    setBand(bandData);
                }
            } catch (error) {
                console.error('Error fetching musician profile', error);
            } finally {
                setLoading(false);
            }
        };
        const getSavedMusicians = async () => {
            if (user?.savedMusicians && user.savedMusicians.length > 0) {
                const activeMusicianSaved = user.savedMusicians.includes(musicianId);
                setMusicianSaved(!!activeMusicianSaved);
            } else {
                setMusicianSaved(false);
            }
        }
        fetchMusicianProfile();
        getSavedMusicians();

    }, [musicianId, gigId]);

    useResizeEffect((width) => {
        if (width > 1100) {
          setPadding('15vw');
        } else {
          setPadding('1rem');
        }
      });
    
    const renderActiveTabContent = () => {
        switch (activeTab) {
            case 'overview':
                return <OverviewTab musicianData={musicianProfile} />; 
            case 'music':
                return <MusicTab videos={musicianProfile.videos} tracks={musicianProfile.tracks}/>;
            case 'members':
                return <BandMembersTab
                    band={band}
                    bandMembers={bandMembers}
                    setBandMembers={setBandMembers}
                    musicianId={musicianProfile.musicianId}
                    viewing={true}
                />
            case 'reviews':
                return <ReviewsTab profile={musicianProfile} />;
            default:
                return null;
        }        
    };       

    const handleSaveMusician = async () => {
        if (user && musicianId) {
          setSavingMusician(true);
          try {
            await updateUserDocument(user.uid, {
              savedMusicians: arrayUnion(musicianId),
            });
            setMusicianSaved(true);
            toast.success('Musician Saved.')
          } catch (error) {
            console.error('Error saving musician:', error);
            toast.error('Failed to save musician. Please try again.')
          } finally {
            setSavingMusician(false);
          }
        }
    };

    const handleUnsaveMusician = async () => {
        if (user && musicianId) {
          setSavingMusician(true);
          try {
            await updateUserDocument(user.uid, {
              savedMusicians: arrayRemove(musicianId),
            });
            setMusicianSaved(false);
            toast.success('Musician Unsaved.')
          } catch (error) {
            console.error('Error saving musician:', error);
            toast.error('Failed to unsave musician. Please try again.')
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
        const gigIds = venueProfiles
            .flatMap(venueProfile => venueProfile.gigs || []);
        try {
            const fetchedGigs = await getGigsByIds(gigIds);
            const availableGigs = filterInvitableGigsForMusician(fetchedGigs, musicianId);
            setInviteMusicianModal(true);
            setUsersGigs(availableGigs)
        } catch (error) {
            console.error('Error fetching future gigs:', error);
            toast.error('We encountered an error. Please try again.')
        }
    };

    const handleSendMusicianInvite = async (gigData) => {
        if (!musicianProfile || !gigData) {
            return;
        }
        const venueToSend = user.venueProfiles.find(venue => venue.id === gigData.venueId);
        if (!venueToSend) {
            console.error('Venue not found in user profiles.');
            return;
        }
        try {
            await inviteToGig(gigData.gigId, musicianProfile);
            const newGigApplicationEntry = {
                gigId: gigData.gigId,
                profileId: musicianProfile.musicianId,
                name: musicianProfile.name,
            };
    
            const updatedGigApplicationsArray = musicianProfile.gigApplications
                ? [...musicianProfile.gigApplications, newGigApplicationEntry]
                : [newGigApplicationEntry];
    
            await updateMusicianProfile(musicianProfile.musicianId, {
                gigApplications: updatedGigApplicationsArray,
            });
            const conversationId = await getOrCreateConversation(musicianProfile, gigData, venueToSend, 'invitation');
            await sendGigInvitationMessage(conversationId, {
                senderId: user.uid,
                text: `${venueToSend.accountName} invited ${musicianProfile.name} to play at their gig at ${gigData.venue.venueName} on the ${formatDate(gigData.date)} for ${gigData.budget}.`,
            })
            setInviteMusicianModal(false);
            toast.success(`Invite sent to ${musicianProfile.name}`)
        } catch (error) {
            console.error('Error while creating or fetching conversation:', error);
            toast.error('Error inviting musician. Please try again.')
        }
    };

    const handleBuildGigForMusician = () => {
        navigate('/venues/dashboard/gigs', { state: {
            musicianData: {
                id: musicianProfile.id,
                type: musicianProfile.musicianType,
                plays: musicianProfile.musicType,
                genres: musicianProfile.genres,
                name: musicianProfile.name,
                bandProfile: musicianProfile.bandProfile,
            },
            buildingForMusician: true,
            showGigPostModal: true,
        }})
    }

    return (
        <div className='musician-profile-page'>
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
            {loading ? (
                <LoadingScreen />
            ) : (
                <div className='profile' style={{ padding: `0 ${padding}` }}>
                    <div className='profile-banner'>
                        <div className='profile-information'>
                            <figure className='profile-picture'>
                                <img src={musicianProfile.picture} alt={`${musicianProfile.name}'s Profile Picture`} />
                            </figure>
                            <div className='profile-details'>
                                <h1>{musicianProfile.name}</h1>
                                <h4>{musicianProfile?.bandProfile ? 'Band' : 'Musician'}</h4>
                                <div className='data'>
                                    {musicianProfile.avgReviews && (
                                        <h6><StarIcon /> {musicianProfile.avgReviews.avgRating} ({musicianProfile.avgReviews.totalReviews})</h6>
                                    )}
                                    <h6>{musicianProfile?.gigsPerformed || '0'} gigs played</h6>
                                </div>
                                <div className='genre-tags'>
                                    {musicianProfile.genres && musicianProfile.genres.map((genre, index) => (
                                        <div className='genre-tag' key={index}>
                                            {genre}
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                            {/* {applicantData && (
                        <div className='profile-actions applicant'>
                            <h2>{applicantData.fee}</h2>
                            {applicantData.status === 'Accepted' && (
                                <div className='status-box'>
                                    <div className='status confirmed'>
                                        <TickIcon />
                                        Accepted
                                    </div>
                                </div>
                            )}
                            {applicantData.status === 'Declined' && (
                                <div className='status-box'>
                                    <div className='status rejected'>
                                        <RejectedIcon />
                                        Declined
                                    </div>
                                </div>
                            )}
                        </div>
                            )} */}
                        {user.venueProfiles.length > 0 && (
                            <div className='profile-actions venue'>
                                <button className='btn primary' onClick={handleInviteMusician}>
                                    <InviteIcon />
                                    Invite
                                </button>
                                    {!musicianSaved ? (
                                        <button className='btn secondary' onClick={handleSaveMusician}>
                                            {savingMusician ? (
                                                <LoadingThreeDots />
                                            ) : (
                                                <>
                                                    <SaveIcon />
                                                    Save
                                                </>
                                            )}
                                        </button>
                                    ) : (
                                        <button className='btn secondary' onClick={handleUnsaveMusician}>
                                            {savingMusician ? (
                                                <LoadingThreeDots />
                                            ) : (
                                                <>
                                                    <SavedIcon />
                                                    Unsave
                                                </>
                                            )}
                                        </button>   
                                    )}
                            </div>
                        )}
                    </div>
                    <nav className='profile-tabs'>
                        <p onClick={() => setActiveTab('overview')} className={`profile-tab ${activeTab === 'overview' ? 'active' : ''}`}>
                            Overview
                        </p>
                        <p onClick={() => setActiveTab('music')} className={`profile-tab ${activeTab === 'music' ? 'active' : ''}`}>
                            Music
                        </p>
                        {band && (
                            <p onClick={() => setActiveTab('members')} className={`profile-tab ${activeTab === 'members' ? 'active' : ''}`}>Band Members</p>
                        )}
                        <p onClick={() => setActiveTab('reviews')} className={`profile-tab ${activeTab === 'reviews' ? 'active' : ''}`}>
                            Reviews
                        </p>
                    </nav>
                    <div className='profile-sections'>
                        {renderActiveTabContent()}
                    </div>
                </div>
            )}

            {inviteMusicianModal && (
                <div className='modal'>
                    <div className='modal-content'>
                        <div className="modal-header">
                            <InviteIconSolid />
                            <h2>Invite {musicianProfile.name} to a Gig?</h2>
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
}