import { useEffect, useState, useRef } from 'react';
import { useLocation, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { Header as MusicianHeader } from '@features/musician/components/Header';
import { Header as VenueHeader } from '@features/venue/components/Header';
import '@styles/musician/gig-page.styles.css';
import { 
    BackgroundMusicIcon,
    ClubIcon,
    FacebookIcon,
    GuitarsIcon,
    HouseIconLight,
    InstagramIcon,
    InviteIcon,
    MicrophoneIcon,
    MicrophoneLinesIcon,
    PeopleGroupIcon,
    SpeakersIcon,
    TicketIcon,
    TwitterIcon,
    WeddingIcon } from '@features/shared/ui/extras/Icons';
import { LoadingThreeDots } from '@features/shared/ui/loading/Loading';
import Skeleton from 'react-loading-skeleton';
import 'react-loading-skeleton/dist/skeleton.css';
import { getVenueProfileById } from '@services/venues';
import { updateMusicianGigApplications } from '@services/musicians';
import { applyToGig, negotiateGigFee } from '@services/gigs';
import { getOrCreateConversation } from '@services/conversations';
import { sendGigApplicationMessage, sendNegotiationMessage } from '@services/messages';
import { sendGigApplicationEmail, sendNegotiationEmail } from '@services/emails';
import { validateMusicianUser } from '@services/utils/validation';
import { useResizeEffect } from '@hooks/useResizeEffect';
import { useMapbox } from '@hooks/useMapbox';
import { formatDate } from '@services/utils/dates';
import { formatDurationSpan, getCityFromAddress } from '@services/utils/misc';
import { getMusicianProfilesByIds, saveGigToMusicianProfile, unSaveGigFromMusicianProfile, updateBandMembersGigApplications } from '../../services/musicians';
import { getBandMembers } from '../../services/bands';
import { acceptGigOffer, getGigById } from '../../services/gigs';
import { getMostRecentMessage, sendGigAcceptedMessage } from '../../services/messages';
import { toast } from 'sonner';
import { sendInvitationAcceptedEmailToVenue } from '../../services/emails';
import { CoinsIconSolid, NewTabIcon, ProfileIconSolid, SaveIcon, SavedIcon, ShareIcon } from '../shared/ui/extras/Icons';
import { ensureProtocol, openInNewTab } from '../../services/utils/misc';
import { useMusicianEligibility } from '@hooks/useMusicianEligibility';
import { ProfileCreator } from '../musician/profile-creator/ProfileCreator';

export const GigPage = ({ user, setAuthModal, setAuthType }) => {
    const { gigId } = useParams();
    const navigate = useNavigate();

    const [searchParams] = useSearchParams();
    const inviteToken = searchParams.get('token'); 
    const venueVisiting = searchParams.get('venue');
    const appliedProfile = searchParams.get('appliedAs');

    const [gigData, setGigData] = useState(null);
    const [venueProfile, setVenueProfile] = useState(null);
    const [similarGigs, setSimilarGigs] = useState([]);
    const [loading, setLoading] = useState(true);
    const mapContainerRef = useRef(null);
    const [padding, setPadding] = useState('5%');
    const [fullscreenImage, setFullscreenImage] = useState(null);
    const [currentImageIndex, setCurrentImageIndex] = useState(0);
    const [applyingToGig, setApplyingToGig] = useState(false);
    const [noProfileModal, setNoProfileModal] = useState(false);
    const [incompleteMusicianProfile, setIncompleteMusicianProfile] = useState(null);
    const [userAppliedToGig, setUserAppliedToGig] = useState(false);
    const [negotiateModal, setNegotiateModal] = useState(false);
    const [newOffer, setNewOffer] = useState('');
    const [width, setWidth] = useState('100%');
    const [multipleProfiles, setMultipleProfiles] = useState(false);
    const [validProfiles, setValidProfiles] = useState();
    const [profileModalOpen, setProfileModalOpen] = useState(false);
    const [selectedProfile, setSelectedProfile] = useState(user?.musicianProfile);
    const [hasAccessToPrivateGig, setHasAccessToPrivateGig] = useState(true);
    const [accessTokenIsMusicianProfile, setAccessTokenIsMusicianProfile] = useState(false);
    const [invitedToGig, setInvitedToGig] = useState(false);
    const [userAcceptedInvite, setUserAcceptedInvite] = useState(false);
    const [showCreateProfileModal, setShowCreateProfileModal] = useState(false);
    const [gigSaved, setGigSaved] = useState(false);

    useResizeEffect((width) => {
        if (width > 1100) {
          setPadding('10%');
          setWidth('80%');
        } else {
          setPadding('2.5%');
          setWidth('95%');
        }
    });

    const getLocalGigDateTime = (gig) => {
        const dateObj = gig.date.toDate();
        const [hours, minutes] = gig.startTime.split(':').map(Number);
        dateObj.setHours(hours);
        dateObj.setMinutes(minutes);
        dateObj.setSeconds(0);
        dateObj.setMilliseconds(0);
        return dateObj;
      };

    useMapbox({
        containerRef: mapContainerRef,
        coordinates: venueProfile?.coordinates,
      });
    
    useEffect(() => {
        const filterGigData = async () => {
            if (!gigId) return;
            const gig = await getGigById(gigId);
            if (!gig) return;
            setGigData(gig);
            setValidProfiles([user?.musicianProfile])
            if (gig?.privateApplications) {
                const savedToken = gig.privateApplicationToken;
                const isTokenValid = !!inviteToken && inviteToken === savedToken;
                const validMusicianProfile = validProfiles?.find(
                    profile => profile.musicianId === inviteToken
                );
                const isMusicianValid = !!validMusicianProfile;
                if (!isTokenValid && !isMusicianValid) {
                    setHasAccessToPrivateGig(false);
                } else {
                    setHasAccessToPrivateGig(true);
                    setInvitedToGig(true);
                    if (isMusicianValid) {
                        setSelectedProfile(validMusicianProfile);
                        setAccessTokenIsMusicianProfile(true);
                        setInvitedToGig(true);
                    }
                }
            }
            const musicianId = user?.musicianProfile?.musicianId;
            const bandIds = user?.musicianProfile?.bands || [];
            if (musicianId && gig?.applicants?.length > 0) {
                const matchingApplicant = gig.applicants.find(
                    app => app.id === musicianId || bandIds.includes(app.id)
                );
                if (matchingApplicant) {
                    if (matchingApplicant.invited) {
                        setUserAppliedToGig(false);
                        setInvitedToGig(true);
                        if (matchingApplicant.status === 'accepted') {
                            setUserAcceptedInvite(true);
                        }
                    } else {
                        setUserAppliedToGig(true);
                        setInvitedToGig(false);
                    }
                }
            }
            if (user.musicianProfile?.savedGigs?.includes(gig.gigId)) {
                setGigSaved(true);
              }
            if (gig?.venueId) {
                const venue = await getVenueProfileById(gig.venueId);
                if (venue) setVenueProfile(venue);
            }
            // const similarGigsList = gigs
            // .filter(g => g.id !== gigId && getLocalGigDateTime(g) > new Date() && !g.confirmed)
            // .map(g => ({ id: g.id, ...g }));
            // setSimilarGigs(similarGigsList);
            setLoading(false)
        }

        const fetchBandData = async () => {
            if (!user?.musicianProfile?.bands?.length) return;
            try {
              const bandProfiles = await getMusicianProfilesByIds(user.musicianProfile.bands);
              if (!Array.isArray(bandProfiles)) {
                console.error('Expected array from getMusicianProfilesByIds, got:', bandProfiles);
                return;
              }
              const validBandProfiles = [];
              for (const bandProfile of bandProfiles) {
                console.log('bandProfile', bandProfile)
                const bandId = bandProfile.bandId;
                try {
                  const members = await getBandMembers(bandId);
                  const userMember = members.find(m => m.musicianProfileId === user.musicianProfile.musicianId);
                  if (userMember?.role === 'Band Leader' || userMember?.role === 'Admin') {
                    validBandProfiles.push(stripFirestoreRefs(bandProfile));
                  }
                  if (bandProfile?.savedGigs?.includes(gigData.gigId)) setGigSaved(true);
                } catch (err) {
                  console.error(`Failed to fetch members for band ${bandId}:`, err);
                }
              }
          
              const combinedProfiles = [...validBandProfiles, user.musicianProfile];
              const correctAppliedProfile = combinedProfiles.find(prof => prof.id === appliedProfile);
              setMultipleProfiles(combinedProfiles.length > 1);
              setValidProfiles(combinedProfiles);
              setSelectedProfile(correctAppliedProfile);
            } catch (err) {
              console.error('Error fetching band data:', err);
            }
          };
        filterGigData();
        if (user?.musicianProfile && user?.musicianProfile?.bands?.length > 0) {
            fetchBandData();
        }
    }, [gigId, user, venueVisiting, inviteToken, multipleProfiles]);

    console.log(user.musicianProfile)


    useEffect(() => {
        if (!selectedProfile || !gigData) return;
        const applicant = gigData.applicants?.find(
            app => app.id === selectedProfile.musicianId
        );
        if (applicant) {
            if (applicant.invited) {
                setUserAppliedToGig(false);
                setInvitedToGig(true);
                if (applicant.status === 'accepted') {
                    setUserAcceptedInvite(true);
                } else {
                    setUserAcceptedInvite(false);
                }
            } else {
                setUserAppliedToGig(true);
                setInvitedToGig(false);
                setUserAcceptedInvite(false);
            }
        } else {
            setUserAppliedToGig(false);
            setInvitedToGig(false);
            setUserAcceptedInvite(false);
        }
    }, [selectedProfile, gigData]);

    const stripFirestoreRefs = (obj) => {
        if (obj === null || typeof obj !== 'object') return obj;
        if (Array.isArray(obj)) return obj.map(stripFirestoreRefs);
        const cleanObj = {};
        for (const key in obj) {
          if (key !== 'ref' && Object.prototype.hasOwnProperty.call(obj, key)) {
            cleanObj[key] = stripFirestoreRefs(obj[key]);
          }
        }
        return cleanObj;
      };

    if (!gigData) {
        return <div>No gig data found.</div>;
    }

    const handleImageClick = (index) => {
        setFullscreenImage(venueProfile.photos[index]);
        setCurrentImageIndex(index);
    };

    const closeFullscreen = () => {
        setFullscreenImage(null);
    };

    const showNextImage = (e) => {
        e.stopPropagation();
        setCurrentImageIndex((prevIndex) => (prevIndex + 1) % venueProfile.photos.length);
        setFullscreenImage(venueProfile.photos[(currentImageIndex + 1) % venueProfile.photos.length]);
    };

    const showPrevImage = (e) => {
        e.stopPropagation();
        setCurrentImageIndex((prevIndex) => (prevIndex - 1 + venueProfile.photos.length) % venueProfile.photos.length);
        setFullscreenImage(venueProfile.photos[(currentImageIndex - 1 + venueProfile.photos.length) % venueProfile.photos.length]);
    };

    const formatGenres = (genres) => {
        if (genres.length === 0) return '';
        if (genres.length === 1) return genres[0];
        const copiedGenres = [...genres];
        const lastGenre = copiedGenres.pop();
        return `${copiedGenres.join(', ')} or ${lastGenre}`;
    };

    const formatTime = (timeString) => {
        const [hours, minutes] = timeString.split(':').map(Number);
        return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
    };

    const calculateTime = (time, offset) => {
        const [hours, minutes] = time.split(':').map(Number);
        const totalMinutes = (hours * 60) + minutes + offset;
        const newHours = Math.floor((totalMinutes + 1440) % 1440 / 60);
        const newMinutes = totalMinutes % 60;
        return `${newHours.toString().padStart(2, '0')}:${newMinutes.toString().padStart(2, '0')}`;
    };

    const calculateEndTime = () => {
        return calculateTime(gigData.startTime, gigData.duration);
    };

    const startTimeMinusOneHour = gigData.startTime ? calculateTime(gigData.startTime, -60) : '00:00';
    const endTime = gigData.startTime && gigData.duration ? calculateEndTime() : '00:00';

    const formatDuration = (duration) => {
        const hours = Math.floor(duration / 60);
        const minutes = duration % 60;
        const hourStr = hours === 1 ? 'hr' : 'hrs';
        const minuteStr = minutes === 1 ? 'min' : 'mins';
    
        if (minutes === 0) {
            return `${hours} ${hourStr}`;
        } else if (hours === 0) {
            return `${minutes} ${minuteStr}`;
        } else {
            return `${hours} ${hourStr} and ${minutes} ${minuteStr}`;
        }
    };

    const calculateServiceFee = (budget) => {
        const numericBudget = parseFloat(budget.replace('£', ''));
        const fee = (numericBudget * 0.05).toFixed(2);
        return fee;
    };
    
    const calculateTotalIncome = (budget) => {
        const numericBudget = parseFloat(budget.replace('£', ''));
        const fee = (numericBudget * 0.05).toFixed(2);
        const income = numericBudget - parseFloat(fee);
        return income.toFixed(2);
    };

    const performerIcon = (input) => {
        if (input === 'Musician') {
            return <MicrophoneIcon />
        } else if (input === 'Band') {
            <PeopleGroupIcon />
        } else {
            return <ClubIcon />
        }
    }

    const privacyIcon = (input) => {
        if (input === 'Public') {
            return <PeopleGroupIcon />
        } else {
            return <InviteIcon />
        }
    }

    const typeIcon = (input) => {
        if (input === 'Background Music') {
            return <BackgroundMusicIcon />
        } else if (input === 'Live Music') {
            return <GuitarsIcon />
        } else if (input === 'Ticketed Gig') {
            return <TicketIcon />
        } else if (input === 'House Party') {
            return <HouseIconLight />
        } else if (input === 'Wedding') {
            return <WeddingIcon />
        } else {
            <MicrophoneLinesIcon />
        }
    }

    const handleBudgetChange = (e) => {
        const value = e.target.value.replace(/[^0-9]/g, '');
        setNewOffer(`£${value}`)
    };

    const handleGigApplication = async () => {
        const { valid, musicianProfile } = validateMusicianUser({
            user,
            setAuthModal,
            setAuthType,
            setNoProfileModal,
            setIncompleteMusicianProfile,
            profile: selectedProfile,
          });
          if (!valid || userAppliedToGig) return;
          setApplyingToGig(true);
          try {
            const nonPayableGig = gigData.kind === 'Open Mic' || gigData.kind === 'Ticketed Gig';
            const updatedApplicants = await applyToGig(gigId, musicianProfile);
            setGigData(prev => ({ ...prev, applicants: updatedApplicants }));
            if (musicianProfile.bandProfile) {
                await updateBandMembersGigApplications(musicianProfile, gigId);
            } else {
                await updateMusicianGigApplications(musicianProfile, gigId);
            }
            const conversationId = await getOrCreateConversation(
                musicianProfile,
                { ...gigData, gigId },
                venueProfile,
                'application'
            );
            await sendGigApplicationMessage(conversationId, {
                senderId: user.uid,
                text: musicianProfile.bandProfile
                ? `${musicianProfile.name} have applied to your gig on ${formatDate(gigData.date)} at ${gigData.venue.venueName}${nonPayableGig ? '' : ` for ${gigData.budget}`}`
                : `${musicianProfile.name} has applied to your gig on ${formatDate(gigData.date)} at ${gigData.venue.venueName}${nonPayableGig ? '' : ` for ${gigData.budget}`}`,                profileId: musicianProfile.musicianId,
                profileType: musicianProfile.bandProfile ? 'band' : 'musician',
            });
            await sendGigApplicationEmail({
                to: venueProfile.email,
                musicianName: musicianProfile.name,
                venueName: gigData.venue.venueName,
                date: formatDate(gigData.date),
                budget: gigData.budget,
                profileType: musicianProfile.bandProfile ? 'band' : 'musician',
                nonPayableGig,
            });
            setUserAppliedToGig(true);
            toast.success('Applied to gig!')
        } catch (error) {
            console.error(error)
            toast.error('Failed to apply to gig. Please try again.')
        } finally {
            setApplyingToGig(false);
        }
    }

    const handleNegotiateButtonClick = () => {
        const { valid, musicianProfile } = validateMusicianUser({
            user,
            setAuthModal,
            setAuthType,
            setNoProfileModal,
            setIncompleteMusicianProfile,
            profile: selectedProfile,
          });
      
        if (valid) {
          setNegotiateModal(true);
        } else {
          setApplyingToGig(false);
        }
      };

    const handleNegotiate = async () => {
        if (userAppliedToGig || !newOffer) return;
        const { valid, musicianProfile } = validateMusicianUser({
            user,
            setAuthModal,
            setAuthType,
            setNoProfileModal,
            setIncompleteMusicianProfile,
            profile: selectedProfile,
          });
        if (!valid) return;
        const value = (newOffer || '').trim();
        const numericPart = value.replace(/£|\s/g, '');
        const num = Number(numericPart);
        if (!numericPart || isNaN(num) || num <= 0) {
            toast.info('Please enter a valid value.');
            return;
        }
        setApplyingToGig(true);
        try {
            const updatedApplicants = await negotiateGigFee(gigId, musicianProfile, newOffer);
            setGigData(prev => ({ ...prev, applicants: updatedApplicants }));
            if (musicianProfile.bandProfile) {
                await updateBandMembersGigApplications(musicianProfile, gigId);
            } else {
                await updateMusicianGigApplications(musicianProfile, gigId);
            }
            const conversationId = await getOrCreateConversation(musicianProfile, gigData, venueProfile, 'negotiation');
            const profileType = musicianProfile.bandProfile ? 'band' : 'musician';
            const senderName = musicianProfile.name;
            const venueName = gigData.venue?.venueName || 'the venue';
            await sendNegotiationMessage(conversationId, {
                senderId: user.uid,
                oldFee: gigData.budget,
                newFee: newOffer,
                text: `${senderName} want${musicianProfile.bandProfile ? '' : 's'} to negotiate the fee for the gig on ${formatDate(gigData.date)} at ${venueName}`,
                profileId: musicianProfile.musicianId,
                profileType
            });

            await sendNegotiationEmail({
                to: venueProfile.email,
                musicianName: senderName,
                venueName,
                oldFee: gigData.budget,
                newFee: newOffer,
                date: formatDate(gigData.date),
                profileType
            });
            toast.success('Negotiation sent to venue.')
        } catch (error) {
            console.error('Error sending negotiation message:', error);
            toast.error('Failed to negotiate gig fee. Please try again.')
        } finally {
            setNegotiateModal(false);
            setApplyingToGig(false);
        }
    };
    
    const handleMessage = async () => {
        const { valid, musicianProfile } = validateMusicianUser({
            user,
            setAuthModal,
            setAuthType,
            setNoProfileModal,
            setIncompleteMusicianProfile,
            profile: selectedProfile,
          });
        if (!valid) return;
        try {
            const conversationId = await getOrCreateConversation(musicianProfile, gigData, venueProfile, 'message');
            navigate(`/messages?conversationId=${conversationId}`);
            toast.success('Message sent to venue.')
        } catch (error) {
            console.error('Error while creating or fetching conversation:', error);
            toast.error('Failed to send message. Please try again')
        }
    };

    const handleAccept = async (event, proposedFee) => {
        event.stopPropagation();
        const musicianId = selectedProfile.id;
        try {
            if (!gigData) return console.error('Gig data is missing');
            if (getLocalGigDateTime(gigData) < new Date()) return console.error('Gig is in the past.');
            const nonPayableGig = gigData.kind === 'Open Mic' || gigData.kind === "Ticketed Gig";
            const { updatedApplicants, agreedFee } = await acceptGigOffer(gigData, musicianId, nonPayableGig);
            setGigData((prevgigData) => ({
                ...prevgigData,
                applicants: updatedApplicants,
                agreedFee: `${agreedFee}`,
                paid: false,
            }));
            const musicianProfile = selectedProfile;
            const venueProfile = await getVenueProfileById(gigData.venueId);
            const conversationId = await getOrCreateConversation(musicianProfile, gigData, venueProfile, 'application');
            const applicationMessage = await getMostRecentMessage(conversationId, 'invitation');
            await sendGigAcceptedMessage(conversationId, applicationMessage.id, user.uid, gigData.budget, 'musician', nonPayableGig);
            const venueEmail = venueProfile.email;
            const musicianName = musicianProfile.name;
            await sendInvitationAcceptedEmailToVenue({
                venueEmail: venueEmail,
                musicianName: musicianName,
                venueProfile: venueProfile,
                gigData: gigData,
                agreedFee: agreedFee,
                nonPayableGig: nonPayableGig,
            })
            toast.success('Invitation Accepted.')
        } catch (error) {
            toast.error('Error accepting gig invitation. Please try again.')
            console.error('Error updating gig document:', error);
        }
    };

    const handleUnSaveGig = async () => {
        try {
          const profileIds = validProfiles.map(prof => prof.musicianId);
          await unSaveGigFromMusicianProfile(gigData.gigId, profileIds);
          setGigSaved(false);
          toast.success('Gig Unsaved');
        } catch (error) {
          console.error(error);
          toast.error('Failed to unsave gig. Please try again.');
        }
      };
      
      const handleSaveGig = async () => {
        try {
          const profileIds = validProfiles.map(prof => prof.musicianId);
          await saveGigToMusicianProfile(gigData.gigId, profileIds);
          setGigSaved(true);
          toast.success('Gig Saved');
        } catch (error) {
          console.error(error);
          toast.error('Failed to save gig. Please try again.');
        }
      };
    
    return (
        <div className='gig-page'>
            {user?.venueProfiles?.length > 0 && (!user.musicianProfile) ? (
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
                    padding={padding}
                />
            )}
            <section className='gig-page-body' style={{ width: `${width}`}}>
                {loading ? (
                    <>
                        <div className='head'>
                            <div className='title'>
                                <Skeleton height={40} width={400} />
                            </div>
                        </div>
                        <div className='images'>
                            <Skeleton height={350} width='100%' />
                        </div>
                    </>
                ) : (
                    <>
                        <div className='head'>
                            <div className='title'>
                                <h1>{gigData.gigName}</h1>
                                <p>{getCityFromAddress(gigData.venue.address)}</p>
                            </div>
                            <div className='options'>
                                <button className="btn tertiary" onClick={(e) => openInNewTab(`/venues/${gigData.venueId}?musicianId=${selectedProfile.id}`, e)}>
                                    See Venue Page <NewTabIcon />
                                </button>
                                {/* <button className='btn tertiary'>
                                    <ShareIcon />
                                </button> */}
                                {gigSaved ? (
                                    <button className='btn tertiary' onClick={() => handleUnSaveGig()}>
                                        <SavedIcon />
                                    </button>
                                ) : (
                                    <button className='btn tertiary' onClick={() => handleSaveGig()}>
                                        <SaveIcon />
                                    </button>
                                )}
                            </div>
                        </div>
                        <div className='images-and-location'>
                            <div className='main-image'>
                                <figure className='img' onClick={() => handleImageClick(0)}>
                                    <img src={venueProfile?.photos[0]} alt={`${gigData.venue.venueName} photo`} />
                                    <div className='more-overlay'>
                                        <h2>+{venueProfile?.photos.length - 1}</h2>
                                    </div>
                                </figure>
                            </div>
                            <div className='location'>
                                <div ref={mapContainerRef} className='map-container' style={{ height: '100%', width: '100%' }} />
                            </div>
                        </div>
                        <div className='main'>
                            <div className='gig-info'>
                                <div className='important-info'>
                                    <div className='date-and-time'>
                                        <h2>{gigData.venue.venueName}, {formatDate(gigData.date)}</h2>
                                        <h3>{formatDurationSpan(gigData.startTime, gigData.duration)}</h3>
                                    </div>
                                    <div className='address'>
                                        <h4>{gigData.venue.address}</h4>
                                    </div>
                                </div>
                                <div className='details'>
                                    <div className='details-list'>
                                        <div className='detail'>
                                            <h6>Performer</h6>
                                            <div className='data'>
                                                {performerIcon(gigData.gigType)}
                                                <p>{gigData.gigType}</p>
                                            </div>
                                        </div>
                                        <div className='detail'>
                                            <h6>Audience</h6>
                                            <div className='data'>
                                                {privacyIcon(gigData.privacy)}
                                                <p>{gigData.privacy}</p>
                                            </div>
                                        </div>
                                        <div className='detail'>
                                            <h6>Type</h6>
                                            <div className='data'>
                                                {typeIcon(gigData.kind)}
                                                <p>{gigData.kind}</p>
                                            </div>
                                        </div>
                                        {gigData.genre.length > 0 && (
                                            <div className='detail'>
                                                <h6>Genres</h6>
                                                <div className='data'>
                                                    <SpeakersIcon />
                                                    <p>{formatGenres(gigData.genre)}</p>
                                                </div>
                                            </div>
                                        )}
                                        {gigData.genre.length === 0 && gigData.noMusicPreference && (
                                            <div className='detail'>
                                                <h6>Genres</h6>
                                                <div className='data'>
                                                    <SpeakersIcon />
                                                    <p>No Preference</p>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                </div>
                                <div className='timeline'>
                                    <h4 className='subtitle'>Gig Timeline</h4>
                                    {gigData.startTime && (
                                        <div className='timeline-cont'>
                                            <div className='timeline-event'>
                                                <div className='timeline-content'>
                                                    <p>Musician Arrives</p>
                                                    <div className='timeline-time'>{startTimeMinusOneHour !== '00:00' ? formatTime(startTimeMinusOneHour) : '00:00'}</div>
                                                </div>
                                                <div className='timeline-line'></div>
                                            </div>
                                            <div className='timeline-event'>
                                                <div className='timeline-content'>
                                                    <p>Gig Starts</p>
                                                    <div className='timeline-time orange'>{formatTime(gigData.startTime)}</div>
                                                </div>
                                                <div className='timeline-line'></div>
                                            </div>
                                            <div className='timeline-event'>
                                                <div className='timeline-content'>
                                                    <p>Gig Ends</p>
                                                    <div className='timeline-time orange'>{endTime !== '00:00' ? formatTime(endTime) : '00:00'}</div>
                                                </div>
                                                <div className='timeline-line'></div>
                                            </div>
                                            <div className='timeline-event'>
                                                <div className='timeline-content'>
                                                    <p>Musician Leaves</p>
                                                    <div className='timeline-time'>{endTime !== '00:00' ? formatTime(calculateTime(endTime, 60)) : '00:00'}</div>
                                                </div>
                                                <div className='timeline-line'></div>
                                            </div>
                                        </div>
                                    )}
                                    <div className='disclaimers'>
                                        <p>* The host expects musicians to take a break after each hour of performing.</p>
                                        <p>* You can discuss adjustments to the timings with the host in your messages.</p>
                                    </div>
                                </div>
                                <div className='description'>
                                    <h4>Description</h4>
                                    <p>{venueProfile?.description}</p>
                                </div>
                                <div className='extra-info'>
                                    <h4 className='subtitle'>Extra Info</h4>
                                    <div className='info'>
                                        <h6>Gig Applications</h6>
                                        <div className='text'>
                                            <p>{gigData.applicants.length}</p>
                                        </div>
                                    </div>
                                    <div className='info'>
                                        <h6>Venue Information</h6>
                                        <div className='text'>
                                            <p>{venueProfile?.extraInformation}</p>
                                        </div>
                                    </div>
                                </div>
                                {venueProfile?.socialMedia && (
                                    <div className='socials'>
                                        <h4 className='subtitle'>Socials</h4>
                                        <div className='links'>
                                            {venueProfile.socialMedia.facebook && (
                                                <a href={ensureProtocol(venueProfile.socialMedia.facebook)} target='_blank' rel='noreferrer'>
                                                    <FacebookIcon />
                                                </a>
                                            )}
                                            {venueProfile.socialMedia.instagram && (
                                                <a href={ensureProtocol(venueProfile.socialMedia.instagram)} target='_blank' rel='noreferrer'>
                                                    <InstagramIcon />
                                                </a>
                                            )}
                                            {venueProfile.socialMedia.twitter && (
                                                <a href={ensureProtocol(venueProfile.socialMedia.twitter)} target='_blank' rel='noreferrer'>
                                                    <TwitterIcon />
                                                </a>
                                            )}
                                        </div>
                                    </div>
                                )}
                                {/* {similarGigs.length > 0 && (
                                    <div className='similar-gigs'>
                                        <h4 className='subtitle'>More Gigs</h4>
                                        <div className='similar-gigs-list'>
                                            {similarGigs.map(gig => (
                                                <div key={gig.id} className='similar-gig-item' onClick={() => openGig(gig.id)}>
                                                    <div className='similar-gig-item-venue'>
                                                        <figure className='similar-gig-img'>
                                                            <img src={gig.venue.photo} alt={gig.venue.venueName} />
                                                        </figure>
                                                        <div className='similar-gig-info'>
                                                            <h4>{gig.venue.venueName}</h4>
                                                            <p>{formatDate(gig.date)}</p>
                                                        </div>
                                                    </div>
                                                    <div className='similar-gig-budget'>
                                                        <h3>{gig.budget}</h3>
                                                    </div>
                                                </div>                                            
                                            ))}
                                        </div>
                                    </div>
                                )} */}
                            </div>
                            <div className='action-box'>
                                <div className='action-box-info'>
                                    <div className='action-box-budget'>
                                        {gigData.kind === 'Open Mic' || gigData.kind === 'Ticketed Gig' ? (
                                            <h1>{gigData.kind}</h1>
                                        ) : (
                                            <>
                                                <h1>{gigData.budget}</h1>
                                                <p>gig fee</p>
                                            </>
                                        )}
                                    </div>
                                    <div className='action-box-duration'>
                                        <h4>{formatDuration(gigData.duration)}</h4>
                                    </div>
                                </div>
                                <div className='action-box-date-and-time'>
                                    <div className='action-box-date'>
                                        <h3>{formatDate(gigData.date)}, {gigData.startTime}</h3>
                                    </div>
                                </div>
                                {!(gigData.kind === 'Open Mic' || gigData.kind === 'Ticketed Gig') && (
                                    <div className='action-box-fees'>
                                        <div className='action-box-service-fee'>
                                            <p>Service Fee</p>
                                            <p>£{calculateServiceFee(gigData.budget)}</p>
                                        </div>
                                        <div className='action-box-total-income'>
                                            <p>Total Income</p>
                                            <p>£{calculateTotalIncome(gigData.budget)}</p>
                                        </div>
                                    </div>
                                )}
                                {!(user?.venueProfiles?.length > 0 && (!user.musicianProfile)) && hasAccessToPrivateGig && !venueVisiting && (
                                    <>
                                        {(validProfiles?.length > 1 && !accessTokenIsMusicianProfile) && (
                                            <div className="profile-select-wrapper">
                                                <label htmlFor="profileSelect" className="profile-select-label">Applying as:</label>
                                                <select
                                                id="profileSelect"
                                                className="input"
                                                value={selectedProfile?.musicianId}
                                                onChange={(e) => {
                                                    const selected = validProfiles.find(profile => profile.musicianId === e.target.value);
                                                    setSelectedProfile(selected);
                                                }}
                                                >
                                                {validProfiles.map((profile) => (
                                                    <option key={profile.musicianId} value={profile.musicianId}>
                                                    {profile.name} {profile.bandProfile ? '(Band)' : '(Solo)'}
                                                    </option>
                                                ))}
                                                </select>
                                            </div>
                                        )}
                                        <div className='action-box-buttons'>
                                        {(getLocalGigDateTime(gigData) > new Date() && gigData.status !== 'closed') ? (
                                            <>
                                            {userAppliedToGig ? (
                                                <button className='btn primary-alt disabled' disabled>
                                                    Applied To Gig
                                                </button>
                                            ) : userAcceptedInvite ? (
                                                <button className='btn primary-alt disabled' disabled>
                                                    Invitation Accepted
                                                </button>
                                            ) : invitedToGig ? (
                                                <button className='btn primary-alt' onClick={handleAccept}>
                                                    {applyingToGig ? <LoadingThreeDots /> : 'Accept Invitation'}
                                                </button>
                                            ) : (
                                                <button className='btn primary-alt' onClick={handleGigApplication}>
                                                    {applyingToGig ? <LoadingThreeDots /> : 'Apply To Gig'}
                                                </button>
                                            )}

                                            <div className='two-buttons'>
                                                {!userAppliedToGig && !invitedToGig && (
                                                    <button className='btn secondary' onClick={handleNegotiateButtonClick}>
                                                        Negotiate
                                                    </button>
                                                )}
                                                <button className='btn secondary' onClick={handleMessage}>
                                                Message
                                                </button>
                                            </div>
                                            </>
                                        ) : (
                                            <>
                                            <div className='two-buttons'>
                                                <button className='btn secondary' onClick={handleMessage}>
                                                    Message
                                                </button>
                                            </div>
                                                <button className='btn secondary'>
                                                    Other Gigs at {gigData.venue.venueName}
                                                </button>
                                            </>
                                        )}
                                        </div>
                                    </>
                                )}
                            </div>
                        </div>
                    </>
                )}
                {fullscreenImage && (
                    <div className='fullscreen-overlay' onClick={closeFullscreen}>
                        <span className='arrow left' onClick={showPrevImage}>&#8249;</span>
                        <img src={fullscreenImage} alt='Fullscreen' />
                        <span className='arrow right' onClick={showNextImage}>&#8250;</span>
                    </div>
                )}
            </section>

            {noProfileModal && (
                <div className='modal' onClick={() => setNoProfileModal(false) }>
                    <div className='modal-content' onClick={(e) => e.stopPropagation() } style={{ maxWidth: 500 }}>
                        {user.musicianProfile ? (
                            <>
                                <div className="modal-header">
                                    <ProfileIconSolid />
                                    <h2>Finish Your Musician Profile First</h2>
                                    <p>Please finish your profile before applying to gigs. All you have to do is save a profile picture.</p>
                                </div>
                                <div className='modal-buttons'>
                                    <button className='btn tertiary' onClick={() => setNoProfileModal(false)}>Cancel</button>
                                    <button className='btn primary' onClick={() => { setShowCreateProfileModal(true); setNoProfileModal(false) }}>Finish Profile</button>
                                </div>
                            </>
                        ) : (
                            <>
                                <div className="modal-header">
                                    <ProfileIconSolid />
                                    <h2>Create a Musician Profile First</h2>
                                    <p>Please create your profile before applying to gigs. It'll take 2 minutes to get you applying to gigs.</p>
                                </div>
                                <div className='modal-buttons'>
                                    <button className='btn tertiary' onClick={() => setNoProfileModal(false)}>Cancel</button>
                                    <button className='btn primary' onClick={() => { setShowCreateProfileModal(true); setNoProfileModal(false) }}>Create Profile</button>
                                </div>

                            </>
                        )}
                    </div>
                </div>
            )}

            {negotiateModal && (
                <div className='modal negotiation'>
                    <div className='modal-content'>
                        <div className="modal-header">
                            <CoinsIconSolid />
                            <h2>Negotiate the Gig Fee</h2>
                            <p>Enter a value below. If the venue accepts your negotiation, this will be the final gig fee.</p>
                        </div>
                        <input type='text' className='input' id='negotiation-value' value={newOffer} onChange={(e) => handleBudgetChange(e)} placeholder={`Current Fee: ${gigData.budget}`} />
                        <div className='two-buttons'>
                            <button className='btn tertiary' onClick={() => setNegotiateModal(false)}>Cancel</button>
                            {newOffer && (
                                <button className='btn primary' disabled={!newOffer || newOffer === '£'} onClick={handleNegotiate}>Offer {newOffer}</button>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {showCreateProfileModal && (
                <ProfileCreator user={user} setShowModal={setShowCreateProfileModal} />
            )}
        </div>
    );
};