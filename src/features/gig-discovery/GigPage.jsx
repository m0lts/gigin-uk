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
import { getMusicianProfilesByIds, saveGigToMusicianProfile, unSaveGigFromMusicianProfile, updateBandMembersGigApplications, withdrawMusicianApplication } from '../../services/musicians';
import { getBandMembers } from '../../services/bands';
import { acceptGigOffer, getGigById, getGigsByIds } from '../../services/gigs';
import { getMostRecentMessage, sendCounterOfferMessage, sendGigAcceptedMessage, updateDeclinedApplicationMessage } from '../../services/messages';
import { toast } from 'sonner';
import { sendCounterOfferEmail, sendInvitationAcceptedEmailToVenue } from '../../services/emails';
import { AmpIcon, ClubIconSolid, CoinsIconSolid, ErrorIcon, InviteIconSolid, LinkIcon, MonitorIcon, MoreInformationIcon, MusicianIconSolid, NewTabIcon, PeopleGroupIconSolid, PeopleRoofIconLight, PeopleRoofIconSolid, PianoIcon, PlugIcon, ProfileIconSolid, SaveIcon, SavedIcon, ShareIcon, VenueIconSolid } from '../shared/ui/extras/Icons';
import { ensureProtocol, openInNewTab } from '../../services/utils/misc';
import { useMusicianEligibility } from '@hooks/useMusicianEligibility';
import { ProfileCreator } from '../musician/profile-creator/ProfileCreator';
import { NoProfileModal } from '../musician/components/NoProfileModal';
import { getUserById } from '../../services/users';
import { formatFeeDate } from '../../services/utils/dates';
import { LoadingSpinner } from '../shared/ui/loading/Loading';
import Portal from '../shared/components/Portal';
import { notifyOtherApplicantsGigConfirmed } from '../../services/conversations';

export const GigPage = ({ user, setAuthModal, setAuthType, noProfileModal, setNoProfileModal, setNoProfileModalClosable }) => {
    const { gigId } = useParams();
    const navigate = useNavigate();

    const [searchParams] = useSearchParams();
    const inviteToken = searchParams.get('token'); 
    const venueVisiting = searchParams.get('venue');
    const appliedProfile = searchParams.get('appliedAs');

    const [gigData, setGigData] = useState(null);
    const [venueProfile, setVenueProfile] = useState(null);
    const [loading, setLoading] = useState(true);
    const mapContainerRef = useRef(null);
    const [padding, setPadding] = useState('5%');
    const [fullscreenImage, setFullscreenImage] = useState(null);
    const [currentImageIndex, setCurrentImageIndex] = useState(0);
    const [applyingToGig, setApplyingToGig] = useState(false);
    const [incompleteMusicianProfile, setIncompleteMusicianProfile] = useState(null);
    const [userAppliedToGig, setUserAppliedToGig] = useState(false);
    const [negotiateModal, setNegotiateModal] = useState(false);
    const [newOffer, setNewOffer] = useState('');
    const [width, setWidth] = useState('100%');
    const [validProfiles, setValidProfiles] = useState();
    const [selectedProfile, setSelectedProfile] = useState(user?.musicianProfile);
    const [hasAccessToPrivateGig, setHasAccessToPrivateGig] = useState(true);
    const [accessTokenIsMusicianProfile, setAccessTokenIsMusicianProfile] = useState(false);
    const [invitedToGig, setInvitedToGig] = useState(false);
    const [userAcceptedInvite, setUserAcceptedInvite] = useState(false);
    const [showCreateProfileModal, setShowCreateProfileModal] = useState(false);
    const [gigSaved, setGigSaved] = useState(false);
    const [otherSlots, setOtherSlots] = useState(null);

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
        if (gig) {
            const dateObj = gig.date.toDate();
            const [hours, minutes] = gig.startTime.split(':').map(Number);
            dateObj.setHours(hours);
            dateObj.setMinutes(minutes);
            dateObj.setSeconds(0);
            dateObj.setMilliseconds(0);
            return dateObj;
        }
      };

    useMapbox({
        containerRef: mapContainerRef,
        coordinates: venueProfile?.coordinates,
    });
    
    const computeStatusForProfile = (gig, profile) => {
        const applicant = gig?.applicants?.find(a => a?.id === profile?.musicianId);
        const invited = !!(applicant && applicant.invited === true) || (gig?.privateApplications && gig.privateApplicationToken === inviteToken);
        const applied = !!(applicant && applicant.invited !== true);
        const accepted = !!(
            applicant &&
            (applicant?.status === 'accepted' || applicant?.status === 'confirmed')
          );
        return { invited, applied, accepted };
    };
      
    useEffect(() => {
        if (!gigId) return;
        let cancelled = false;
        const run = async () => {
          setLoading(true);
          try {
            const gig = await getGigById(gigId);
            if (!gig || cancelled) return;
            let enrichedGig = gig;
            if (gig?.venue?.userId) {
              const userDoc = await getUserById(gig.venue.userId);
              if (cancelled) return;
              enrichedGig = { ...gig, user: userDoc };
            }
            if (Array.isArray(enrichedGig?.gigSlots)) {
                const ids = enrichedGig.gigSlots;
                const otherGigs = await getGigsByIds(ids);
                if (cancelled) return;
                setOtherSlots(otherGigs.filter(g => (g.status || '').toLowerCase() !== 'closed'));
            }
            const baseMusician = user?.musicianProfile ? [user.musicianProfile] : [];
            let bandProfiles = [];
            if (user?.musicianProfile?.bands?.length) {
              const rawBands = await getMusicianProfilesByIds(user.musicianProfile.bands);
              if (cancelled) return;
              if (Array.isArray(rawBands)) {
                const keep = [];
                for (const band of rawBands) {
                  try {
                    const members = await getBandMembers(band.musicianId);
                    const me = members.find(m => m.musicianProfileId === user.musicianProfile.musicianId);
                    if (me?.role === 'Band Leader' || me?.role === 'Admin') {
                      keep.push(stripFirestoreRefs(band));
                    }
                  } catch (e) {
                    console.error('getBandMembers failed for', band.musicianId, e);
                  }
                }
                bandProfiles = keep;
              } else {
                console.error('getMusicianProfilesByIds did not return array:', rawBands);
              }
            }
            const profiles = [...baseMusician, ...bandProfiles];
            let nextHasAccess = true;
            let nextInvitedToGig = false;
            let defaultSelected = profiles[0] || null;
            if (enrichedGig?.privateApplications) {
              const savedToken = enrichedGig.privateApplicationToken;
              const tokenMatches = !!inviteToken && inviteToken === savedToken;
              const tokenProfile = profiles.find(p => p.musicianId === inviteToken) || null;
              if (!tokenMatches && !tokenProfile) {
                nextHasAccess = false;
              } else {
                nextHasAccess = true;
                nextInvitedToGig = true;
                if (tokenProfile) {
                  defaultSelected = tokenProfile;
                }
              }
            }
            const preferredProfile = appliedProfile
                ? profiles.find(p => p.musicianId === appliedProfile || p.id === appliedProfile)
                : null;

            const finalSelected =
                preferredProfile ||
                (selectedProfile && profiles.find(p => p.musicianId === selectedProfile.musicianId)) ||
                defaultSelected ||
                null;
            setGigData(enrichedGig);
            setValidProfiles(profiles);
            setSelectedProfile(finalSelected);
            setHasAccessToPrivateGig(nextHasAccess);
            if (nextHasAccess) {
                setInvitedToGig(nextHasAccess)
            } else {
                setInvitedToGig(nextInvitedToGig);
            }
            const myIds = [
              user?.musicianProfile?.savedGigs || [],
              ...bandProfiles.map(b => b.savedGigs || []),
            ].flat();
            if (myIds.includes(enrichedGig.gigId)) setGigSaved(true);
            if (enrichedGig?.venueId) {
              const venue = await getVenueProfileById(enrichedGig.venueId);
              if (!cancelled && venue) setVenueProfile(venue);
            }
          } catch (err) {
            console.error('filterGigData failed:', err);
          } finally {
            if (!cancelled) setLoading(false);
          }
        };
        run();
        return () => { cancelled = true; };
    }, [gigId, user, inviteToken]);


    useEffect(() => {
        if (!selectedProfile || !gigData) {
          setUserAppliedToGig(false);
          setInvitedToGig(false);
          setUserAcceptedInvite(false);
          return;
        }
        const { invited, applied, accepted } = computeStatusForProfile(gigData, selectedProfile);
        setInvitedToGig(invited);
        setUserAppliedToGig(applied);
        setUserAcceptedInvite(accepted);
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

    if (!gigData && !loading) {
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
                    <div className='loading-state'>
                        <ErrorIcon />
                        <h4>Sorry, we can't find that gig right now.</h4>
                    </div>
                </section>
            </div>
        );
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

    const endTime = gigData?.startTime && gigData?.duration ? calculateEndTime() : '00:00';

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

    const formatEquipmentIcon = (input) => {
        if (input === 'PA System' || input === 'Speakers') {
            return <SpeakersIcon />
        } else if (input === 'Stage Monitors') {
            return <MonitorIcon />
        } else if (input === 'Guitar Amp' || input === 'Bass Amp') {
            return <AmpIcon />
        } else if (input === 'Mixing/Sound Desk') {
            return <ClubIcon />
        } else if (input === 'DI Boxes') {
            return <PlugIcon />
        } else if (input === 'Cables (XLRs, Jack Leads)') {
            return <LinkIcon />
        } else if (input === 'Guitar') {
            return <GuitarsIcon />
        } else if (input === 'Piano/Keyboard') {
            return <PianoIcon />
        } else if (input === 'Bass') {
            return <PlugIcon />
        } else {
            return <MicrophoneIcon />
        }
    }

    const handleBudgetChange = (e) => {
        const value = e.target.value.replace(/[^0-9]/g, '');
        setNewOffer(`£${value}`)
    };

    const handleGigApplication = async () => {
        if (getLocalGigDateTime(gigData) < new Date()) return toast.error('Gig is in the past.');
        const { valid, musicianProfile } = validateMusicianUser({
            user,
            setAuthModal,
            setAuthType,
            setNoProfileModal,
            setIncompleteMusicianProfile,
            setNoProfileModalClosable,
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

    const handleWithdrawApplication = async () => {
        try {
            const updatedApplicants = await withdrawMusicianApplication(gigId, selectedProfile);
            if (updatedApplicants) {
              setGigData(prev => ({ ...prev, applicants: updatedApplicants }));
            }
            toast.success('Application withdrawn.');
          } catch (e) {
            console.error(e);
            toast.error('Failed to withdraw application.');
          }
    }

    const handleNegotiateButtonClick = () => {
        if (getLocalGigDateTime(gigData) < new Date()) return toast.error('Gig is in the past.');
        const { valid, musicianProfile } = validateMusicianUser({
            user,
            setAuthModal,
            setAuthType,
            setNoProfileModal,
            setIncompleteMusicianProfile,
            setNoProfileModalClosable,
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
            setNoProfileModalClosable,
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
            const updatedApplicants = await negotiateGigFee(gigId, musicianProfile, newOffer, 'musician');
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
            if (invitedToGig) {
                const invitationMessage = await getMostRecentMessage(conversationId, 'invitation');
                await updateDeclinedApplicationMessage(
                    conversationId,
                    invitationMessage.id,
                    user.uid,
                    'musician',
                );
                await sendCounterOfferMessage(
                    conversationId,
                    invitationMessage.id,
                    user.uid,
                    newOffer,
                    gigData.budget,
                    'musician',
                )
                await sendCounterOfferEmail({
                    userRole: 'musician',
                    musicianProfile: musicianProfile,
                    venueProfile: venueProfile,
                    gigData,
                    newOffer,
                });
            } else {
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
            }
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
            setNoProfileModalClosable,
            profile: selectedProfile,
          });
        if (!valid) return;
        try {
            const conversationId = await getOrCreateConversation(musicianProfile, gigData, venueProfile, 'message');
            navigate(`/messages?conversationId=${conversationId}`);
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
            if (getLocalGigDateTime(gigData) < new Date()) return toast.error('Gig is in the past.');
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
            if (nonPayableGig) {
                await notifyOtherApplicantsGigConfirmed(gigData, musicianId);
            }
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

    const formatSlotName = (name = '') => {
        const match = name.match(/\(([^)]+)\)/);
        return match ? match[1] : '';
      };

    const now = new Date();
    const isFutureOpen = getLocalGigDateTime(gigData) > now && (gigData?.status || '').toLowerCase() !== 'closed';
    const isPrivate = !!gigData?.privateApplications;
    const invited = !!invitedToGig;
    const applied = !!userAppliedToGig;
    const accepted = !!userAcceptedInvite;

    // Visibility per your spec
    const showApply =
    !invited && !isPrivate && !applied && !accepted;

    const showApplied =
    ( // already applied covers both public and private
        applied
    ) || (
        // (you also wanted "if invited and already applied" -> show applied)
        invited && applied
    );

    const showAcceptInvite =
        invited && !applied && !accepted; // private or not

    // Negotiate: show only if (not applied/accepted) OR (private AND invited)
    const showNegotiate =
        (!applied && !accepted) || (isPrivate && invited);

    // Message: show in any case EXCEPT (private AND not invited)
    const showMessage =
    !(isPrivate && !invited);

    // Optional: hide negotiate for kinds you excluded earlier
    const kindBlocksNegotiate = gigData?.kind === 'Ticketed Gig' || gigData?.kind === 'Open Mic';
    
    return (
        <div className='gig-page'>
            {user?.venueProfiles?.length > 0 && (!user.musicianProfile) ? (
                <VenueHeader
                    user={user}
                    setAuthModal={setAuthModal}
                    setAuthType={setAuthType}
                    padding={padding}
                    setNoProfileModal={setNoProfileModal}
                />
            ) : (
                <MusicianHeader
                    user={user}
                    setAuthModal={setAuthModal}
                    setAuthType={setAuthType}
                    padding={padding}
                    setNoProfileModal={setNoProfileModal}
                    setNoProfileModalClosable={setNoProfileModalClosable}
                    noProfileModalClosable={true}
                />
            )}
            <section className='gig-page-body' style={{ width: `${width}`}}>
                {loading ? (
                    <div className='loading-state'>
                        <LoadingSpinner />
                    </div>
                ) : (
                    <>
                        <div className='head'>
                            <div className='title'>
                                <h1>{gigData.gigName}</h1>
                            </div>
                            {/* <div className='options'>
                                <button className='btn tertiary'>
                                    <ShareIcon />
                                </button>
                                {gigSaved ? (
                                    <button className='btn tertiary' onClick={() => handleUnSaveGig()}>
                                        <SavedIcon />
                                    </button>
                                ) : (
                                    <button className='btn tertiary' onClick={() => handleSaveGig()}>
                                        <SaveIcon />
                                    </button>
                                )}
                            </div> */}
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
                                        <h2>{gigData.venue.venueName}</h2>
                                        <button className="btn secondary" onClick={
                                            selectedProfile && selectedProfile?.id ? 
                                            (e) => openInNewTab(`/venues/${gigData.venueId}?musicianId=${selectedProfile?.id}`, e)
                                            : (e) => openInNewTab(`/venues/${gigData.venueId}`, e)}>
                                            <VenueIconSolid /> See {venueProfile?.name && venueProfile.name + "'s"} Venue Page
                                        </button>
                                    </div>
                                    <div className='address'>
                                        <h4>{gigData.venue.address}</h4>
                                    </div>
                                </div>
                                <div className="gig-host">
                                    <h5>Gig Posted By: {gigData.accountName}</h5>
                                    {gigData?.user?.createdAt ? (
                                        <p>
                                            Joined in {new Date(gigData.user.createdAt).toLocaleDateString(undefined, {
                                                year: 'numeric',
                                                month: 'long'
                                            })}
                                        </p>
                                    ) : (
                                        <p>A trusted Gigin member</p>
                                    )}
                                </div>
                                <div className='details'>
                                    <div className="detail">
                                        {gigData.gigType === 'Musician/Band' ? (
                                            <GuitarsIcon />
                                        ) : (
                                            <ClubIconSolid />
                                        )}
                                        <div className="detail-copy">
                                            <span className="detail-title">
                                                {gigData.gigType}
                                            </span>
                                            <p className='detail-text'>
                                                {gigData.gigType === 'Musician/Band' ? (
                                                    'This gig is for a live musician/band rather than DJs'
                                                ) : (
                                                    'This gig is for a DJ rather than a live musician/band'
                                                )}
                                            </p>
                                        </div>
                                    </div>
                                    <div className="detail">
                                        {gigData.privacy === 'Public' || '' ? (
                                            <PeopleRoofIconLight />
                                        ) : (
                                            <InviteIcon />
                                        )}
                                        <div className="detail-copy">
                                            <span className="detail-title">
                                                Audience
                                            </span>
                                            <p className='detail-text'>
                                            {(gigData.privacy === 'Public' || '') ? (
                                                'This gig is open to the public, rather than a private event'
                                            ) : (
                                                'This gig is a private event - not open to the public'
                                            )}
                                                
                                            </p>
                                        </div>
                                    </div>
                                    <div className="detail">
                                        <SpeakersIcon />
                                        <div className="detail-copy">
                                            <span className="detail-title">
                                                Genres
                                            </span>
                                            <p className='detail-text'>
                                                {gigData.genre !== '' ? (
                                                    `The preferred genres for this gig are: ${formatGenres(gigData.genre)}`
                                                ) : (
                                                    'There are no preferred genres for this gig'
                                                )}
                                            </p>
                                            <p className='detail-text'>
                                                {gigData.extraInformation !== '' && (
                                                    gigData.extraInformation
                                                )}
                                            </p>
                                        </div>
                                    </div>
                                </div>
                                <div className='timeline'>
                                    <h4 className='subtitle'>Gig Timeline</h4>
                                    {gigData.startTime && (
                                        <div className='timeline-cont'>
                                            <div className='timeline-event'>
                                                <div className='timeline-content'>
                                                    <p>Load In</p>
                                                    <div className='timeline-time'>{gigData?.loadInTime && gigData?.loadInTime !== '' ? formatTime(gigData?.loadInTime) : 'TBC'}</div>
                                                </div>
                                                <div className='timeline-line'></div>
                                            </div>
                                            <div className='timeline-event'>
                                                <div className='timeline-content'>
                                                    <p>Sound Check</p>
                                                    <div className='timeline-time'>{gigData?.soundCheckTime && gigData?.soundCheckTime !== '' ? formatTime(gigData?.soundCheckTime) : 'TBC'}</div>
                                                </div>
                                                <div className='timeline-line'></div>
                                            </div>
                                            <div className='timeline-event'>
                                                <div className='timeline-content'>
                                                    <p>Set Starts</p>
                                                    <div className='timeline-time orange'>{formatTime(gigData.startTime)}</div>
                                                </div>
                                                <div className='timeline-line'></div>
                                            </div>
                                            <div className='timeline-event'>
                                                <div className='timeline-content'>
                                                    <p>Set Ends</p>
                                                    <div className='timeline-time orange'>{endTime !== '00:00' ? formatTime(endTime) : '00:00'}</div>
                                                </div>
                                                <div className='timeline-line'></div>
                                            </div>
                                        </div>
                                    )}
                                </div>
                                <div className='equipment'>
                                    <h4>Equipment Available at {gigData.venue.venueName}</h4>
                                    {venueProfile?.equipmentAvailable === 'yes' ? (
                                        <div className="equipment-grid">
                                            {venueProfile.equipment.map((e) => (
                                                <span className="equipment-item" key={e}>
                                                    {formatEquipmentIcon(e)}
                                                    {e}
                                                </span>
                                            ))}
                                        </div>
                                    ) : (
                                        <p>Unfortunately, the venue has no equipment for use.</p>
                                    )}

                                </div>
                                {venueProfile?.description && (
                                    <div className='description'>
                                        <h4>About {venueProfile?.name}</h4>
                                        <p>{venueProfile?.description}</p>
                                    </div>
                                )}
                                <div className='extra-info'>
                                    <h4 className='subtitle'>Additional Technical Information</h4>
                                    {gigData.applicants.length > 0 && (
                                        <div className='info'>
                                            <h6>Gig Applications</h6>
                                            <div className='text'>
                                                <p>{gigData.applicants.length}</p>
                                            </div>
                                        </div>
                                    )}
                                    {venueProfile?.extraInformation && (
                                        <div className='info'>
                                            <h6>Venue Information</h6>
                                            <div className='text'>
                                                <p>{venueProfile?.extraInformation}</p>
                                            </div>
                                        </div>
                                    )}
                                    {venueProfile?.website && (
                                        <div className='info'>
                                            <h6>Venue Website</h6>
                                            <div className='text'>
                                                <a href={venueProfile.website.startsWith('http') ? venueProfile.website : `https://${venueProfile.website}`} target="_blank" rel="noopener noreferrer">{venueProfile.website}</a>
                                            </div>
                                        </div>
                                    )}
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
                            <div className="sticky-right">
                                <div className='action-box'>
                                    <div className='action-box-info'>
                                        <div className='action-box-budget'>
                                            {gigData.kind === 'Open Mic' || gigData.kind === 'Ticketed Gig' ? (
                                                <h2 className="gig-kind">
                                                    {gigData.kind}
                                                    {gigData.kind === 'Ticketed Gig' && (
                                                    <span
                                                        className="tooltip-wrapper"
                                                        data-tooltip="A ticketed gig means the musician is responsible for ticket sales. Musicians keep 100% of their ticket proceeds."
                                                    >
                                                        <MoreInformationIcon />
                                                    </span>
                                                    )}
                                                </h2>
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
                                    {/* {(gigData.kind !== 'Open Mic' && gigData.kind !== 'Ticketed Gig' && !venueVisiting) && (
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
                                    )} */}
                                    {!(user?.venueProfiles?.length > 0 && !user.musicianProfile) && !venueVisiting && (
                                        <>
                                            {(validProfiles?.length > 1 && !accessTokenIsMusicianProfile) && !applyingToGig && (
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
                                                {isFutureOpen  ? (
                                                    applyingToGig ? (
                                                        <div className="applying-to-gig">
                                                            <LoadingSpinner width={20} height={20} />
                                                        </div>
                                                    ) : (
                                                        <>
                                                            {showApplied && hasAccessToPrivateGig ? (
                                                                <button className='btn primary-alt disabled' disabled>Applied To Gig</button>
                                                            ) : accepted && hasAccessToPrivateGig ? (
                                                                <button className='btn primary-alt disabled' disabled>Invitation Accepted</button>
                                                            ) : showAcceptInvite && hasAccessToPrivateGig ? (
                                                                    <button className='btn primary-alt' onClick={handleAccept}>
                                                                        Accept Invitation
                                                                    </button>
                                                            ) : showApply && hasAccessToPrivateGig ? (
                                                                    <button className='btn primary-alt' onClick={handleGigApplication}>
                                                                        Apply To Gig
                                                                    </button>
                                                            ) : null}

                                                            {showApplied && hasAccessToPrivateGig && (
                                                                <button className='btn primary' onClick={handleWithdrawApplication}>
                                                                    Withdraw Application
                                                                </button>
                                                            )}

                                                            <div className='two-buttons'>
                                                                {/* Negotiate */}
                                                                {showNegotiate && !kindBlocksNegotiate && hasAccessToPrivateGig && (
                                                                    <button className='btn secondary' onClick={handleNegotiateButtonClick}>
                                                                        Negotiate
                                                                    </button>
                                                                )}

                                                                {/* Message */}
                                                                {showMessage && hasAccessToPrivateGig && (
                                                                <button className='btn secondary' onClick={handleMessage}>
                                                                    Message
                                                                </button>
                                                                )}
                                                            </div>

                                                            {/* Private notice (only if private AND no invite) */}
                                                            {isPrivate && !hasAccessToPrivateGig && (
                                                                <div className="private-applications">
                                                                <InviteIconSolid />
                                                                <h5>This gig is for private applications only. You must have the private application link to apply.</h5>
                                                                </div>
                                                            )}
                                                        </>

                                                    )
                                                ) : (
                                                    <>
                                                    <div className='two-buttons'>
                                                        {showMessage && (
                                                            <button className='btn secondary' onClick={handleMessage}>Message</button>
                                                        )}
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
                                {otherSlots && (
                                    <div className="other-slots">
                                        <h4 className='subtitle'>Other Available Sets</h4>
                                        <div className='similar-gigs-list'>
                                            {otherSlots.map(gig => (
                                                <div key={gig.id} className='similar-gig-item' onClick={(e) => openInNewTab(gig.id, e)}>
                                                    <div className='similar-gig-item-venue'>
                                                        <figure className='similar-gig-img'>
                                                            <img src={gig.venue.photo} alt={gig.venue.venueName} />
                                                        </figure>
                                                        <div className='similar-gig-info'>
                                                            <h4>{formatSlotName(gig.gigName)}</h4>
                                                            <p>{formatFeeDate(gig.startDateTime)}</p>
                                                        </div>
                                                    </div>
                                                    <div className='similar-gig-budget'>
                                                        <h3>{gig.budget}</h3>
                                                    </div>
                                                </div>                                            
                                            ))}
                                        </div>
                                    </div>
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

            {negotiateModal && (
                <Portal>
                    <div className='modal negotiation' onClick={() => setNegotiateModal(false)}>
                        {applyingToGig ? (
                            <div className="modal-content" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap:'1rem'}}>
                                <LoadingSpinner />
                                <h3>Sending Negotiation...</h3>
                            </div>
                        ) : (
                            <div className='modal-content' onClick={(e) => e.stopPropagation()}>
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
                        )}
                    </div>
                </Portal>
            )}

            {showCreateProfileModal && (
                <Portal>
                    <ProfileCreator user={user} setShowModal={setShowCreateProfileModal} selectedUserType={selectedUserType} />
                </Portal>
            )}
        </div>
    );
};