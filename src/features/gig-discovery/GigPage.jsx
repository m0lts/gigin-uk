import { useEffect, useState, useRef, useMemo } from 'react';
import { useLocation, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { Header as MusicianHeader } from '@features/artist/components/Header';
import { Header as VenueHeader } from '@features/venue/components/Header';
import { Header as CommonHeader } from '@features/shared/components/Header';
import '@styles/artists/gig-page.styles.css';
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
import { getVenueProfileById } from '@services/client-side/venues';
import { updateMusicianGigApplications, updateArtistGigApplications } from '@services/client-side/artists';
import { getOrCreateConversation, notifyOtherApplicantsGigConfirmed } from '@services/api/conversations';
import { sendGigApplicationMessage, sendNegotiationMessage } from '@services/client-side/messages';
import { sendGigApplicationEmail, sendNegotiationEmail } from '@services/client-side/emails';
import { validateMusicianUser } from '@services/utils/validation';
import { useMapbox } from '@hooks/useMapbox';
import { formatDate } from '@services/utils/dates';
import { formatDurationSpan, getCityFromAddress } from '@services/utils/misc';
import { getMusicianProfilesByIds, updateBandMembersGigApplications, withdrawMusicianApplication, withdrawArtistApplication, getArtistProfileMembers } from '../../services/client-side/artists';
import { getBandMembers } from '../../services/client-side/bands';
import { getGigById, getGigsByIds } from '../../services/client-side/gigs';
import { getMostRecentMessage } from '../../services/client-side/messages';
import { toast } from 'sonner';
import { sendCounterOfferEmail, sendInvitationAcceptedEmailToVenue } from '../../services/client-side/emails';
import { AmpIcon, BassIcon, ClubIconSolid, CoinsIconSolid, ErrorIcon, InviteIconSolid, LinkIcon, MonitorIcon, MoreInformationIcon, MusicianIconSolid, NewTabIcon, PeopleGroupIconSolid, PeopleRoofIconLight, PeopleRoofIconSolid, PermissionsIcon, PianoIcon, PlugIcon, ProfileIconSolid, SaveIcon, SavedIcon, ShareIcon, SpeakerIcon, VenueIconSolid } from '../shared/ui/extras/Icons';
import { ensureProtocol, openInNewTab } from '../../services/utils/misc';
import { ProfileCreator } from '../artist/profile-creator/ProfileCreator';
import { NoProfileModal } from '../artist/components/NoProfileModal';
import { formatFeeDate } from '../../services/utils/dates';
import { LoadingSpinner } from '../shared/ui/loading/Loading';
import Portal from '../shared/components/Portal';
import { getLocalGigDateTime } from '../../services/utils/filtering';
import { sanitizeArtistPermissions } from '@services/utils/permissions';
import { applyToGig, negotiateGigFee, acceptGigOffer, acceptGigOfferOM } from '@services/api/gigs';
import { sendGigAcceptedMessage, updateDeclinedApplicationMessage, sendCounterOfferMessage } from '@services/api/messages';
import { useBreakpoint } from '../../hooks/useBreakpoint';
import { NoTextLogo } from '../shared/ui/logos/Logos';

export const GigPage = ({ user, setAuthModal, setAuthType, noProfileModal, setNoProfileModal, setNoProfileModalClosable }) => {
    const { gigId } = useParams();
    const navigate = useNavigate();
    const {isSmUp, isMdUp, isLgUp} = useBreakpoint();
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
    const [selectedProfile, setSelectedProfile] = useState(null);
    const [hasAccessToPrivateGig, setHasAccessToPrivateGig] = useState(true);
    const [accessTokenIsMusicianProfile, setAccessTokenIsMusicianProfile] = useState(false);
    const [invitedToGig, setInvitedToGig] = useState(false);
    const [userAcceptedInvite, setUserAcceptedInvite] = useState(false);
    const [showCreateProfileModal, setShowCreateProfileModal] = useState(null);
    const [gigSaved, setGigSaved] = useState(false);
    const [otherSlots, setOtherSlots] = useState(null);

    // Permission state for artistProfile members
    const [artistProfilePerms, setArtistProfilePerms] = useState(null);
    const [loadingArtistPerms, setLoadingArtistPerms] = useState(false);

    useEffect(() => {
        if (isLgUp) {
            setPadding('10%');
            setWidth('80%');
        } else if (isMdUp) {
            setPadding('2.5%');
            setWidth('95%');
        } else if (!isLgUp && !isMdUp) {
            setPadding('2.5%');
            setWidth('100%');
        }
    }, [isSmUp, isMdUp, isLgUp]);

    // Extract coordinates from gigData.geopoint or venueProfile.coordinates
    // Mapbox expects [lng, lat] format
    const mapCoordinates = useMemo(() => {
        if (venueProfile?.coordinates && Array.isArray(venueProfile.coordinates) && venueProfile.coordinates.length === 2) {
            // venueProfile.coordinates should already be [lng, lat]
            const [lng, lat] = venueProfile.coordinates;
            if (typeof lng === 'number' && typeof lat === 'number' && !isNaN(lng) && !isNaN(lat)) {
                return [lng, lat];
            }
        }
        // Fallback to gigData.geopoint
        if (gigData?.geopoint) {
            const lat = gigData.geopoint._lat || gigData.geopoint.latitude;
            const lng = gigData.geopoint._long || gigData.geopoint.longitude;
            if (typeof lat === 'number' && typeof lng === 'number' && !isNaN(lat) && !isNaN(lng)) {
                return [lng, lat]; // Mapbox expects [lng, lat]
            }
        }
        // Fallback to gigData.coordinates if it exists
        if (gigData?.coordinates && Array.isArray(gigData.coordinates) && gigData.coordinates.length === 2) {
            const [lng, lat] = gigData.coordinates;
            if (typeof lng === 'number' && typeof lat === 'number' && !isNaN(lng) && !isNaN(lat)) {
                return [lng, lat];
            }
        }
        return null;
    }, [venueProfile?.coordinates, gigData?.geopoint, gigData?.coordinates]);

    useMapbox({
        containerRef: mapContainerRef,
        coordinates: mapCoordinates,
        shouldInit: !!mapCoordinates,
    });
    
    const computeStatusForProfile = (gig, profile) => {
        const profileId = profile?.id || profile?.profileId || profile?.musicianId;
        const applicant = gig?.applicants?.find(a => a?.id === profileId);
        const invited = !!(applicant && applicant.invited === true) || (gig?.privateApplications && gig.privateApplicationToken === inviteToken);
        const applied = !!(applicant && applicant.invited !== true && applicant.status !== 'withdrawn');
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
            if (Array.isArray(enrichedGig?.gigSlots)) {
                const ids = enrichedGig.gigSlots;
                const otherGigs = await getGigsByIds(ids);
                if (cancelled) return;
                setOtherSlots(otherGigs.filter(g => (g.status || '').toLowerCase() !== 'closed'));
            }
            // Get artist profiles and normalize them for compatibility
            const rawArtistProfiles = Array.isArray(user?.artistProfiles) ? user.artistProfiles : [];
            const profiles = rawArtistProfiles
              .map(profile => ({
                ...profile,
                musicianId: profile.id || profile.profileId, // Add musicianId for API compatibility
                profileId: profile.id || profile.profileId,
              }))
              .sort((a, b) => {
                // Sort by createdAt, oldest first
                const aTime = a.createdAt?.seconds || a.createdAt || 0;
                const bTime = b.createdAt?.seconds || b.createdAt || 0;
                return aTime - bTime;
              });
            
            let nextHasAccess = true;
            let nextInvitedToGig = false;
            const defaultSelected = profiles[0] || null; // Oldest profile by createdAt
            
            if (enrichedGig?.privateApplications) {
              const savedToken = enrichedGig.privateApplicationToken;
              const tokenMatches = !!inviteToken && inviteToken === savedToken;
              const profileId = (p) => p.id || p.profileId || p.musicianId;
              const tokenProfile = profiles.find(p => profileId(p) === inviteToken) || null;
              if (!tokenMatches && !tokenProfile) {
                nextHasAccess = false;
              } else {
                nextHasAccess = true;
                nextInvitedToGig = true;
              }
            }
            
            const profileId = (p) => p.id || p.profileId || p.musicianId;
            const preferredProfile = appliedProfile
                ? profiles.find(p => profileId(p) === appliedProfile)
                : null;

            // Get active profile from localStorage
            let activeProfileId = null;
            if (user?.uid) {
                try {
                    const stored = localStorage.getItem(`activeArtistProfileId_${user.uid}`);
                    if (stored) {
                        const profileExists = profiles.some(p => profileId(p) === stored);
                        if (profileExists) {
                            activeProfileId = stored;
                        }
                    }
                } catch (e) {
                    // Ignore localStorage errors
                }
            }
            
            // Fallback to primary profile if no stored active profile
            if (!activeProfileId && user?.primaryArtistProfileId) {
                const primaryExists = profiles.some(p => profileId(p) === user.primaryArtistProfileId);
                if (primaryExists) {
                    activeProfileId = user.primaryArtistProfileId;
                }
            }

            const activeProfile = activeProfileId
                ? profiles.find(p => profileId(p) === activeProfileId)
                : null;

            const finalSelected =
                preferredProfile ||
                activeProfile ||
                (selectedProfile && profiles.find(p => profileId(p) === profileId(selectedProfile))) ||
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
            
            // Check saved gigs across all artist profiles
            const myIds = profiles.flatMap(p => p.savedGigs || []);
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
          setArtistProfilePerms(null);
          return;
        }
        const { invited, applied, accepted } = computeStatusForProfile(gigData, selectedProfile);
        setInvitedToGig(invited);
        setUserAppliedToGig(applied);
        setUserAcceptedInvite(accepted);
    }, [selectedProfile, gigData]);

    // Load artist profile permissions for the current selected profile (if it's an artistProfile)
    useEffect(() => {
        let cancelled = false;
        const run = async () => {
            if (!user?.uid || !selectedProfile) {
                if (!cancelled) setArtistProfilePerms(null);
                return;
            }
            const profileId = selectedProfile.id || selectedProfile.profileId || selectedProfile.musicianId;
            const isArtistProfile = Array.isArray(user?.artistProfiles)
              && user.artistProfiles.some(p => (p.id || p.profileId) === profileId);
            if (!isArtistProfile) {
                if (!cancelled) setArtistProfilePerms(null);
                return;
            }
            try {
                setLoadingArtistPerms(true);
                const members = await getArtistProfileMembers(profileId);
                if (cancelled) return;
                const me = members.find(m => m.id === user.uid && (m.status || 'active') === 'active');
                const perms = sanitizeArtistPermissions(me?.permissions || {});
                setArtistProfilePerms(perms);
            } catch (e) {
                console.error('Failed to load artist profile permissions for gig booking:', e);
                if (!cancelled) setArtistProfilePerms(null);
            } finally {
                if (!cancelled) setLoadingArtistPerms(false);
            }
        };
        run();
        return () => {
            cancelled = true;
        };
    }, [user?.uid, user?.artistProfiles, selectedProfile]);

    // Listen for active profile changes from localStorage
    useEffect(() => {
        if (!user?.uid || !validProfiles?.length) return;

        const handleActiveProfileChange = () => {
            try {
                const stored = localStorage.getItem(`activeArtistProfileId_${user.uid}`);
                if (stored) {
                    const profileId = (p) => p.id || p.profileId || p.musicianId;
                    const newActiveProfile = validProfiles.find(p => profileId(p) === stored);
                    if (newActiveProfile) {
                        const currentProfileId = selectedProfile ? (selectedProfile.id || selectedProfile.profileId || selectedProfile.musicianId) : null;
                        const newProfileId = profileId(newActiveProfile);
                        if (newProfileId !== currentProfileId) {
                            setSelectedProfile(newActiveProfile);
                        }
                    }
                }
            } catch (e) {
                // Ignore errors
            }
        };

        window.addEventListener('activeProfileChanged', handleActiveProfileChange);
        const storageHandler = (e) => {
            if (e.key === `activeArtistProfileId_${user.uid}`) {
                handleActiveProfileChange();
            }
        };
        window.addEventListener('storage', storageHandler);

        return () => {
            window.removeEventListener('activeProfileChanged', handleActiveProfileChange);
            window.removeEventListener('storage', storageHandler);
        };
    }, [user?.uid, validProfiles, selectedProfile]);


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
                {user?.venueProfiles?.length > 0 && (!user.artistProfiles?.length) ? (
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
            return <SpeakerIcon />
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
            return <BassIcon />
        } else {
            return <MicrophoneIcon />
        }
    }

    const handleBudgetChange = (e) => {
        const value = e.target.value.replace(/[^0-9]/g, '');
        setNewOffer(`£${value}`)
    };

    const canBookCurrentArtistProfile = (() => {
        if (!selectedProfile) return true;
        const profileId = selectedProfile.id || selectedProfile.profileId || selectedProfile.musicianId;
        const isArtistProfile = Array.isArray(user?.artistProfiles)
          && user.artistProfiles.some(p => (p.id || p.profileId) === profileId);
        if (!isArtistProfile) return true;
        // Owners will have full perms at backend; here we just respect gigs.book if present
        if (!artistProfilePerms) return true; // fallback: don't block if we couldn't load perms
        return !!artistProfilePerms['gigs.book'];
    })();

    const handleGigApplication = async () => {
        if (!canBookCurrentArtistProfile) {
            return toast.error('You do not have permission to apply to gigs for this artist profile.');
        }
        if (getLocalGigDateTime(gigData) < new Date()) return toast.error('Gig is in the past.');
        const { valid, musicianProfile, modal, reason } = validateMusicianUser({
            user,
            setAuthModal,
            setAuthType,
            profile: selectedProfile,
            navigate,
          });
          if (!valid) {
            if (modal && !musicianProfile) {
              setShowCreateProfileModal(reason);
              if (reason === 'no-profile') {
                toast.info('Create an artist profile to apply for gigs.');
              } else if (reason === 'incomplete-profile') {
                toast.info('Complete your artist profile before applying for gigs.');
              }
            }
            return;
          }
          if (userAppliedToGig) return;
          setApplyingToGig(true);
          try {
            const nonPayableGig = gigData.kind === 'Open Mic' || gigData.kind === 'Ticketed Gig' || gigData.budget === '£' || gigData.budget === '£0';
            // Normalize profile for API compatibility
            const normalizedProfile = {
              ...musicianProfile,
              musicianId: musicianProfile.id || musicianProfile.profileId || musicianProfile.musicianId,
              profileId: musicianProfile.id || musicianProfile.profileId || musicianProfile.musicianId,
            };
            const { updatedApplicants } = await applyToGig({ gigId, musicianProfile: normalizedProfile });
            setGigData(prev => ({ ...prev, applicants: updatedApplicants }));
            
            // Use artist profile update if this is an artist profile
            const isArtistProfile = user?.artistProfiles?.some(p => (p.id || p.profileId) === normalizedProfile.id);
            if (isArtistProfile) {
              await updateArtistGigApplications(normalizedProfile, gigId);
            } else {
              // Fallback to musician profile update for backward compatibility
              await updateMusicianGigApplications(normalizedProfile, gigId);
            }
            
            const { conversationId } = await getOrCreateConversation(
                { musicianProfile: normalizedProfile, gigData: { ...gigData, gigId }, venueProfile, type: 'application' }
            );
            await sendGigApplicationMessage(conversationId, {
                senderId: user.uid,
                text: `${normalizedProfile.name} has applied to your gig on ${formatDate(gigData.startDateTime)} at ${gigData.venue.venueName}${nonPayableGig ? '' : ` for ${gigData.budget}`}`,
                profileId: normalizedProfile.musicianId,
                profileType: 'artist',
            });
            await sendGigApplicationEmail({
                to: venueProfile.email,
                musicianName: normalizedProfile.name,
                venueName: gigData.venue.venueName,
                date: formatDate(gigData.startDateTime),
                budget: gigData.budget,
                profileType: 'artist',
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
        if (!canBookCurrentArtistProfile) {
            return toast.error('You do not have permission to manage gig applications for this artist profile.');
        }
        setApplyingToGig(true);
        try {
            // Check if this is an artist profile
            const isArtistProfile = user?.artistProfiles?.some(p => (p.id || p.profileId) === (selectedProfile?.id || selectedProfile?.profileId));
            let updatedApplicants;
            if (isArtistProfile) {
              updatedApplicants = await withdrawArtistApplication(gigId, selectedProfile);
            } else {
              updatedApplicants = await withdrawMusicianApplication(gigId, selectedProfile);
            }
            if (updatedApplicants) {
              setGigData(prev => ({ ...prev, applicants: updatedApplicants }));
            }
            toast.success('Application withdrawn.');
          } catch (e) {
            console.error(e);
            toast.error('Failed to withdraw application.');
          } finally {
            setApplyingToGig(false);
          }
    }

    const handleNegotiateButtonClick = () => {
        if (!canBookCurrentArtistProfile) {
            return toast.error('You do not have permission to negotiate gigs for this artist profile.');
        }
        if (getLocalGigDateTime(gigData) < new Date()) return toast.error('Gig is in the past.');
        const { valid, musicianProfile, modal, reason } = validateMusicianUser({
            user,
            setAuthModal,
            setAuthType,
            profile: selectedProfile,
            navigate,
        });
        if (!valid) {
          if (modal && !musicianProfile) {
            setShowCreateProfileModal(reason);
            if (reason === 'no-profile') {
              toast.info('Create an artist profile to negotiate gigs.');
            } else if (reason === 'incomplete-profile') {
              toast.info('Complete your artist profile before negotiating gigs.');
            }
          }
          setApplyingToGig(false);
          return;
        }

        setNegotiateModal(true);
      };

    const handleNegotiate = async () => {
        if (!canBookCurrentArtistProfile) {
            return toast.error('You do not have permission to negotiate gigs for this artist profile.');
        }
        if (userAppliedToGig || !newOffer) return;
        const { valid, musicianProfile, modal, reason } = validateMusicianUser({
            user,
            setAuthModal,
            setAuthType,
            profile: selectedProfile,
            navigate,
          });
        if (!valid) {
          if (modal && !musicianProfile) {
            setShowCreateProfileModal(reason);
            if (reason === 'no-profile') {
              toast.info('Create an artist profile to negotiate gigs.');
            } else if (reason === 'incomplete-profile') {
              toast.info('Complete your artist profile before negotiating gigs.');
            }
          }
          return;
        }
        const value = (newOffer || '').trim();
        const numericPart = value.replace(/£|\s/g, '');
        const num = Number(numericPart);
        if (!numericPart || isNaN(num) || num <= 0) {
            toast.info('Please enter a valid value.');
            return;
        }
        setApplyingToGig(true);
        try {
            // Normalize profile for API compatibility
            const normalizedProfile = {
              ...musicianProfile,
              musicianId: musicianProfile.id || musicianProfile.profileId || musicianProfile.musicianId,
              profileId: musicianProfile.id || musicianProfile.profileId || musicianProfile.musicianId,
            };
            const { updatedApplicants } = await negotiateGigFee({ gigId, musicianProfile: normalizedProfile, newFee: newOffer, sender: 'musician' });
            setGigData(prev => ({ ...prev, applicants: updatedApplicants }));
            
            // Use artist profile update if this is an artist profile
            const isArtistProfile = user?.artistProfiles?.some(p => (p.id || p.profileId) === normalizedProfile.id);
            if (isArtistProfile) {
              await updateArtistGigApplications(normalizedProfile, gigId);
            } else {
              // Fallback to musician profile update for backward compatibility
              if (musicianProfile.bandProfile) {
                await updateBandMembersGigApplications(normalizedProfile, gigId);
              } else {
                await updateMusicianGigApplications(normalizedProfile, gigId);
              }
            }
            
            const { conversationId } = await getOrCreateConversation({ musicianProfile: normalizedProfile, gigData, venueProfile, type: 'negotiation' });
            const profileType = isArtistProfile ? 'artist' : (musicianProfile.bandProfile ? 'band' : 'musician');
            const senderName = normalizedProfile.name;
            const venueName = gigData.venue?.venueName || 'the venue';
            if (invitedToGig) {
                const invitationMessage = await getMostRecentMessage(conversationId, 'invitation');
                updateDeclinedApplicationMessage({ conversationId, originalMessageId: invitationMessage.id, senderId: user.uid, userRole: 'musician' });
                await sendCounterOfferMessage({ conversationId, messageId: invitationMessage.id, senderId: user.uid, newFee: newOffer, oldFee: gigData.budget, userRole: 'musician' });
                await sendCounterOfferEmail({
                    userRole: 'musician',
                    musicianProfile: normalizedProfile,
                    venueProfile: venueProfile,
                    gigData,
                    newOffer,
                });
            } else {
                await sendNegotiationMessage(conversationId, {
                    senderId: user.uid,
                    oldFee: gigData.budget,
                    newFee: newOffer,
                    text: `${senderName} wants to negotiate the fee for the gig on ${formatDate(gigData.startDateTime)} at ${venueName}`,
                    profileId: normalizedProfile.musicianId,
                    profileType
                });
                await sendNegotiationEmail({
                    to: venueProfile.email,
                    musicianName: senderName,
                    venueName,
                    oldFee: gigData.budget,
                    newFee: newOffer,
                    date: formatDate(gigData.startDateTime),
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
        if (!canBookCurrentArtistProfile) {
            return toast.error('You do not have permission to message venues about gigs for this artist profile.');
        }
        const { valid, musicianProfile, modal, reason } = validateMusicianUser({
            user,
            setAuthModal,
            setAuthType,
            profile: selectedProfile,
            navigate,
          });
        if (!valid) {
          if (modal && !musicianProfile) {
            setShowCreateProfileModal(reason);
            if (reason === 'no-profile') {
              toast.info('Create an artist profile to message venues about gigs.');
            } else if (reason === 'incomplete-profile') {
              toast.info('Complete your artist profile before messaging venues about gigs.');
            }
          }
          return;
        }
        try {
            // Normalize profile for API compatibility
            const normalizedProfile = {
              ...musicianProfile,
              musicianId: musicianProfile.id || musicianProfile.profileId || musicianProfile.musicianId,
              profileId: musicianProfile.id || musicianProfile.profileId || musicianProfile.musicianId,
            };
            const response = await getOrCreateConversation({ musicianProfile: normalizedProfile, gigData, venueProfile, type: 'message' });
            const conversationId = response?.conversationId || response?.data?.conversationId;
            if (!conversationId) {
              console.error('No conversationId returned from getOrCreateConversation');
              toast.error('Failed to create conversation. Please try again.');
              return;
            }
            // Navigate to artist profile messages URL with conversationId as query param
            const profileId = normalizedProfile.id || normalizedProfile.profileId || normalizedProfile.musicianId;
            navigate(`/artist-profile/${profileId}/messages?conversationId=${conversationId}`);
            console.log('Conversation created and navigated to:', `/artist-profile/${profileId}/messages?conversationId=${conversationId}`);
        } catch (error) {
            console.error('Error while creating or fetching conversation:', error);
            toast.error('Failed to send message. Please try again')
        }
    };

    const handleAccept = async (event, proposedFee) => {
        if (!canBookCurrentArtistProfile) {
            return toast.error('You do not have permission to accept gig invitations for this artist profile.');
        }
        event.stopPropagation();
        setApplyingToGig(true);
        const musicianId = selectedProfile?.id || selectedProfile?.profileId || selectedProfile?.musicianId;
        try {
            if (!gigData) return console.error('Gig data is missing');
            if (getLocalGigDateTime(gigData) < new Date()) return toast.error('Gig is in the past.');
            const nonPayableGig = gigData.kind === 'Open Mic' || gigData.kind === "Ticketed Gig" || gigData.budget === '£' || gigData.budget === '£0';
            let globalAgreedFee;
            if (gigData.kind === 'Open Mic') {
                const { updatedApplicants } = await acceptGigOfferOM({ gigData, musicianProfileId: musicianId, role: 'musician' });
                setGigData((prevGigData) => ({
                    ...prevGigData,
                    applicants: updatedApplicants,
                    paid: true,
                }));
            } else {
                const { updatedApplicants, agreedFee } = await acceptGigOffer({ gigData, musicianProfileId: musicianId, nonPayableGig, role: 'musician' });
                setGigData((prevGigData) => ({
                    ...prevGigData,
                    applicants: updatedApplicants,
                    agreedFee: `${agreedFee}`,
                    paid: false,
                }));
                globalAgreedFee = agreedFee;
            }
            // Normalize profile for API compatibility
            const normalizedProfile = {
              ...selectedProfile,
              musicianId,
              profileId: musicianId,
            };
            const venueProfile = await getVenueProfileById(gigData.venueId);
            const { conversationId } = await getOrCreateConversation({
              musicianProfile: normalizedProfile,
              gigData,
              venueProfile,
              type: 'invitation',
            });
            const applicationMessage = await getMostRecentMessage(conversationId, 'invitation');
            if (applicationMessage?.id) {
              await sendGigAcceptedMessage({
                conversationId,
                originalMessageId: applicationMessage.id,
                senderId: user.uid,
                agreedFee: gigData.budget,
                userRole: 'musician',
                nonPayableGig,
              });
            }
            const venueEmail = venueProfile.email;
            const musicianName = normalizedProfile.name;
            await sendInvitationAcceptedEmailToVenue({
                venueEmail: venueEmail,
                musicianName: musicianName,
                venueProfile: venueProfile,
                gigData: gigData,
                agreedFee: globalAgreedFee,
                nonPayableGig: nonPayableGig,
            })
            if (nonPayableGig) {
                await notifyOtherApplicantsGigConfirmed({ gigData, acceptedMusicianId: musicianId });
            }
            toast.success('Invitation Accepted.')
        } catch (error) {
            toast.error('Error accepting gig invitation. Please try again.')
            console.error('Error updating gig document:', error);
        } finally {
            setApplyingToGig(false);
        }
    };

    function ImageCarousel({ photos = [], altBase = '' }) {
        const trackRef = useRef(null);
        const [index, setIndex] = useState(0);
        const total = photos.length || 1;
        
        useEffect(() => {
            const el = trackRef.current;
            if (!el) return;
          
            let to;
            const compute = () => {
              const i = Math.round(el.scrollLeft / el.clientWidth);
              setIndex(prev => (prev !== i ? i : prev));
            };
          
            const onScrollEnd = () => compute();
            const onScrollFallback = () => {
              clearTimeout(to);
              to = setTimeout(compute, 80); // debounce
            };
          
            if ('onscrollend' in window) {
              el.addEventListener('scrollend', onScrollEnd);
              return () => el.removeEventListener('scrollend', onScrollEnd);
            } else {
              el.addEventListener('scroll', onScrollFallback, { passive: true });
              return () => {
                clearTimeout(to);
                el.removeEventListener('scroll', onScrollFallback);
              };
            }
        }, []);

        useEffect(() => {
            const el = trackRef.current;
            if (!el || !('ResizeObserver' in window)) return;
            const ro = new ResizeObserver(() => {
                el.scrollTo({ left: el.clientWidth * index, behavior: 'auto' });
            });
            ro.observe(el);
            return () => ro.disconnect();
        }, [index]);
    
      
        if (!photos?.length) {
          return (
            <figure className="img single">
              <img src="/placeholder.jpg" alt={`${altBase} photo`} />
            </figure>
          );
        }
      
        return (
          <div className="img-carousel" aria-roledescription="carousel" aria-label="Venue photos">
            <div
              className="img-track"
              ref={trackRef}
              role="group"
              aria-live="polite"
            >
              {photos.map((src, i) => (
                <figure className="img slide" key={i}>
                  <img src={src} alt={`${altBase} photo ${i + 1} of ${total}`} />
                </figure>
              ))}
            </div>
      
              <div className="img-count">
                <span>{index + 1}/{total}</span>
              </div>
          </div>
        );
      }

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
            {!user ? (
                <CommonHeader
                    setAuthModal={setAuthModal}
                    setAuthType={setAuthType}
                    user={user}
                    setNoProfileModal={setNoProfileModal}
                    noProfileModal={noProfileModal}
                    setNoProfileModalClosable={setNoProfileModalClosable}
                />
            ) : user?.venueProfiles?.length > 0 && (!user.artistProfiles?.length) ? (
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
            <section className={`gig-page-body ${!isMdUp && 'mobile'}`} style={{ width: `${width}`, marginTop: `${!user || user?.artistProfiles || user?.artistProfiles?.length > 0 ? '6rem' : '0'}`}}>
                {loading ? (
                    <div className='loading-state'>
                        <LoadingSpinner />
                    </div>
                ) : (
                    isMdUp ? (
                        <>
                            <div className='head'>
                                <div className='title'>
                                    <h1>{gigData.gigName}</h1>
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
                                        <p>A trusted Gigin member</p>
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
                                                    {gigData.gigType === 'Musician/Band' ? (
                                                        'Live Music'
                                                    ) : (
                                                        'DJ'
                                                    )}
                                                </span>
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
                                                {(gigData.privacy === 'Public' || '') ? (
                                                    'Public Audience'
                                                ) : (
                                                    'Private Audience'
                                                )}
                                                </span>
                                            </div>
                                        </div>
                                        <div className="detail">
                                            <SpeakersIcon />
                                            <div className="detail-copy">
                                                <span className="detail-title">
                                                    {gigData.genre !== '' ? (
                                                        `${formatGenres(gigData.genre)}`
                                                    ) : (
                                                        'Any Genre'
                                                    )}
                                                </span>
                                                <p className='detail-text'>
                                                    {gigData.extraInformation !== '' && (
                                                        gigData.extraInformation
                                                    )}
                                                </p>
                                            </div>
                                        </div>
                                    </div>
                                    <div className='equipment'>
                                        <h4 className="subtitle">Gig Description</h4>
                                        <p className='detail-text'>
                                            {gigData.technicalInformation !== '' && (
                                                gigData.technicalInformation
                                            )}
                                        </p>    
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
                                            <>
                                                <div className="equipment-grid">
                                                    {venueProfile.equipment.map((e) => (
                                                        <span className="equipment-item" key={e}>
                                                            {formatEquipmentIcon(e)}
                                                            {e}
                                                        </span>
                                                    ))}
                                                </div>
                                                {venueProfile?.equipmentInformation && (
                                                    <div className="equipment-notes" style={{ marginTop: '1rem' }}>
                                                        <h6>EQUIPMENT INFORMATION</h6>
                                                        <p>{venueProfile?.equipmentInformation}</p>
                                                    </div>
                                                )}
                                            </>
                                        ) : (
                                            <p>The venue has not listed any equipment for use.</p>
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
                                                            data-tooltip="A ticketed gig means the musicians receive 100% of the ticket revenue but the administration of ticket sales is to be discussed between the two of you."
                                                        >
                                                            <MoreInformationIcon />
                                                        </span>
                                                        )}
                                                    </h2>
                                                ) : (
                                                    <>
                                                        <h1>{gigData.budget === '£' || gigData.budget === '£0' ? 'No Fee' : gigData.budget}</h1>
                                                        {gigData.budget !== '£' && gigData.budget !== '£0' && (
                                                            <p>gig fee</p>
                                                        )}
                                                    </>
                                                )}
                                            </div>
                                            <div className='action-box-duration'>
                                                <h4>{formatDuration(gigData.duration)}</h4>
                                            </div>
                                        </div>
                                        <div className='action-box-date-and-time'>
                                            <div className='action-box-date'>
                                                <h3>{formatDate(gigData.startDateTime, 'withTime')}</h3>
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
                                        {!(user?.venueProfiles?.length > 0 && !user.artistProfiles?.length) && !venueVisiting && (
                                            <>
                                                {selectedProfile && !applyingToGig && (
                                                    <div className="active-profile-status">
                                                    <h6 className="active-profile-badge">ACTIVE PROFILE:</h6>
                                                    <span className="active-profile-name">{selectedProfile.name || 'Unnamed Profile'}</span>
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
                                                                        <button className={`btn primary-alt ${!canBookCurrentArtistProfile ? 'disabled' : ''}`} onClick={canBookCurrentArtistProfile ? handleAccept : undefined} disabled={!canBookCurrentArtistProfile}>
                                                                            Accept Invitation
                                                                        </button>
                                                                ) : showApply && hasAccessToPrivateGig ? (
                                                                        <button
                                                                            className={`btn primary-alt ${!canBookCurrentArtistProfile ? 'disabled' : ''}`}
                                                                            onClick={canBookCurrentArtistProfile ? handleGigApplication : undefined}
                                                                            disabled={!canBookCurrentArtistProfile}
                                                                        >
                                                                            Apply To Gig
                                                                        </button>
                                                                ) : null}

                                                                {showApplied && hasAccessToPrivateGig && (
                                                                    <button
                                                                        className={`btn secondary ${!canBookCurrentArtistProfile ? 'disabled' : ''}`}
                                                                        onClick={canBookCurrentArtistProfile ? handleWithdrawApplication : undefined}
                                                                        disabled={!canBookCurrentArtistProfile}
                                                                        style={{ marginTop: '5px'}}
                                                                    >
                                                                        Withdraw Application
                                                                    </button>
                                                                )}

                                                                <div className='two-buttons'>
                                                                    {/* Negotiate */}
                                                                    {showNegotiate && !kindBlocksNegotiate && hasAccessToPrivateGig && (
                                                                        <button
                                                                            className={`btn secondary ${!canBookCurrentArtistProfile ? 'disabled' : ''}`}
                                                                            onClick={canBookCurrentArtistProfile ? handleNegotiateButtonClick : undefined}
                                                                            disabled={!canBookCurrentArtistProfile}
                                                                        >
                                                                            Negotiate
                                                                        </button>
                                                                    )}

                                                                    {/* Message */}
                                                                    {showMessage && hasAccessToPrivateGig && (
                                                                    <button
                                                                        className={`btn secondary ${!canBookCurrentArtistProfile ? 'disabled' : ''}`}
                                                                        onClick={canBookCurrentArtistProfile ? handleMessage : undefined}
                                                                        disabled={!canBookCurrentArtistProfile}
                                                                    >
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

                                                                {/* Permission notice when artist member lacks gigs.book */}
                                                                {!canBookCurrentArtistProfile && hasAccessToPrivateGig && (
                                                                    <div className="status-box permissions">
                                                                        <PermissionsIcon />
                                                                        <p>
                                                                            You don’t have permission to manage gigs for this artist profile. Please contact the profile owner.
                                                                        </p>
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
                                                        <button className='btn secondary' onClick={(e) => openInNewTab(`/venues/${gigData.venueId}`, e)}>
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
                                                            {gigData.kind === 'Open Mic' || gigData.kind === 'Ticketed Gig' ? (
                                                                <h3 className="gig-kind">
                                                                    {gigData.kind}
                                                                </h3>
                                                            ) : (
                                                                <>
                                                                    <h3>{gigData.budget === '£' || gigData.budget === '£0' ? 'No Fee' : gigData.budget}</h3>
                                                                </>
                                                            )}
                                                        </div>
                                                    </div>                                            
                                                ))}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </>
                    ) : (
                        <>
                            <div className='head'>
                                <ImageCarousel
                                    photos={venueProfile?.photos}
                                    altBase={gigData.venue.venueName}
                                />
                            </div>
                            <div className='main'>
                                <div className="section">
                                    <h1>{gigData.gigName}</h1>
                                    <div className="divider">
                                        <span className="line"></span>
                                        <h6>@</h6>
                                        <span className="line"></span>
                                    </div>
                                    <div className="gig-venue">
                                        <h4>{gigData.venue.venueName}</h4>
                                        <p>{gigData.venue.address}</p>
                                        <button
                                            className='btn secondary'
                                            onClick={
                                                selectedProfile && selectedProfile?.id ? 
                                                (e) => openInNewTab(`/venues/${gigData.venueId}?musicianId=${selectedProfile?.id}`, e)
                                                : (e) => openInNewTab(`/venues/${gigData.venueId}`, e)}
                                        >
                                                <VenueIconSolid />
                                                View {gigData.venue.venueName}'s Profile
                                        </button>
                                    </div>
                                </div>
                                <div className="section">
                                    <div className="gig-host">
                                        <h5>Gig Posted By: {gigData.accountName}</h5>
                                        <p>A trusted Gigin member</p>
                                    </div>
                                </div>
                                <div className="section">
                                    <div className='details'>
                                        <div className="detail">
                                            {gigData.gigType === 'Musician/Band' ? (
                                                <GuitarsIcon />
                                            ) : (
                                                <ClubIconSolid />
                                            )}
                                            <div className="detail-copy">
                                                <span className="detail-title">
                                                    {gigData.gigType === 'Musician/Band' ? (
                                                        'Live Music'
                                                    ) : (
                                                        'DJ'
                                                    )}
                                                </span>
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
                                                {(gigData.privacy === 'Public' || '') ? (
                                                    'Public Audience'
                                                ) : (
                                                    'Private Audience'
                                                )}
                                                </span>
                                            </div>
                                        </div>
                                        <div className="detail">
                                            <SpeakersIcon />
                                            <div className="detail-copy">
                                                <span className="detail-title">
                                                    {gigData.genre !== '' ? (
                                                        `${formatGenres(gigData.genre)}`
                                                    ) : (
                                                        'Any Genre'
                                                    )}
                                                </span>
                                                <p className='detail-text'>
                                                    {gigData.extraInformation !== '' && (
                                                        gigData.extraInformation
                                                    )}
                                                </p>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                                <div className="section">
                                    <div className='equipment'>
                                        <h4 className="subtitle">Gig Description</h4>
                                        <p className='detail-text'>
                                            {gigData.technicalInformation !== '' && (
                                                gigData.technicalInformation
                                            )}
                                        </p>    
                                    </div>
                                </div>
                                <div className="section">
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
                                </div>
                                <div className="section">
                                    <div className='equipment'>
                                        <h4>Equipment Available at {gigData.venue.venueName}</h4>
                                        {venueProfile?.equipmentAvailable === 'yes' ? (
                                            <>
                                                <div className="equipment-grid">
                                                    {venueProfile.equipment.map((e) => (
                                                        <span className="equipment-item" key={e}>
                                                            {formatEquipmentIcon(e)}
                                                            {e}
                                                        </span>
                                                    ))}
                                                </div>
                                                {venueProfile?.equipmentInformation && (
                                                    <div className="equipment-notes" style={{ marginTop: '1rem' }}>
                                                        <h6>EQUIPMENT INFORMATION</h6>
                                                        <p>{venueProfile?.equipmentInformation}</p>
                                                    </div>
                                                )}
                                            </>
                                        ) : (
                                            <p>The venue has not listed any equipment for use.</p>
                                        )}
                                    </div>
                                </div>
                                <div className="section">
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
                                </div>
                                {otherSlots && (
                                    <div className="section">
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
                                                        {gigData.kind === 'Open Mic' || gigData.kind === 'Ticketed Gig' ? (
                                                            <h3 className="gig-kind">
                                                                {gigData.kind}
                                                            </h3>
                                                        ) : (
                                                            <>
                                                                <h3>{gigData.budget === '£' || gigData.budget === '£0' ? 'No Fee' : gigData.budget}</h3>
                                                            </>
                                                        )}
                                                        </div>
                                                    </div>                                            
                                                ))}
                                            </div>
                                        </div>
                                    </div>
                                )}
                                <div className="sticky-bottom">
                                        <div className='action-box-info'>
                                            <div className='action-box-budget'>
                                                {gigData.kind === 'Open Mic' || gigData.kind === 'Ticketed Gig' ? (
                                                    <h2 className="gig-kind">
                                                        {gigData.kind}
                                                        {gigData.kind === 'Ticketed Gig' && (
                                                        <span
                                                            className="tooltip-wrapper"
                                                            data-tooltip="A ticketed gig means the musicians receive 100% of the ticket revenue but the administration of ticket sales is to be discussed between the two of you."
                                                        >
                                                            <MoreInformationIcon />
                                                        </span>
                                                        )}
                                                    </h2>
                                                ) : (
                                                    <>
                                                        <h1>{gigData.budget === '£' || gigData.budget === '£0' ? 'No Fee' : gigData.budget}</h1>
                                                        {gigData.budget !== '£' && gigData.budget !== '£0' && (
                                                            <p>gig fee</p>
                                                        )}
                                                    </>
                                                )}
                                            </div>
                                            <div className='action-box-duration'>
                                                <h4>{formatDuration(gigData.duration)}</h4>
                                            </div>
                                        </div>
                                        <div className='action-box-date-and-time'>
                                            <div className='action-box-date'>
                                                <h3>{formatDate(gigData.startDateTime, 'withTime')}</h3>
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
                                        {!(user?.venueProfiles?.length > 0 && !user.artistProfiles?.length) && !venueVisiting && (
                                            <>
                                                {selectedProfile && !applyingToGig && (
                                                    <div className="active-profile-status">
                                                        <h6 className="active-profile-badge">ACTIVE PROFILE</h6>
                                                        <span className="active-profile-name">{selectedProfile.name || 'Unnamed Profile'}</span>
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
                                                                        <button className='btn primary-alt' onClick={canBookCurrentArtistProfile ? handleAccept : undefined} disabled={!canBookCurrentArtistProfile}>
                                                                            Accept Invitation
                                                                        </button>
                                                                ) : showApply && hasAccessToPrivateGig ? (
                                                                        <button className='btn primary-alt' onClick={canBookCurrentArtistProfile ? handleGigApplication : undefined} disabled={!canBookCurrentArtistProfile}>
                                                                            Apply To Gig
                                                                        </button>
                                                                ) : null}

                                                                {showApplied && hasAccessToPrivateGig && (
                                                                    <button
                                                                        className={`btn secondary ${!canBookCurrentArtistProfile ? 'disabled' : ''}`}
                                                                        onClick={canBookCurrentArtistProfile ? handleWithdrawApplication : undefined}
                                                                        disabled={!canBookCurrentArtistProfile}
                                                                        style={{ marginTop: '5px'}}
                                                                    >
                                                                        Withdraw Application
                                                                    </button>
                                                                )}

                                                                <div className='two-buttons'>
                                                                    {/* Negotiate */}
                                                                    {showNegotiate && !kindBlocksNegotiate && hasAccessToPrivateGig && (
                                                                        <button
                                                                            className={`btn secondary ${!canBookCurrentArtistProfile ? 'disabled' : ''}`}
                                                                            onClick={canBookCurrentArtistProfile ? handleNegotiateButtonClick : undefined}
                                                                            disabled={!canBookCurrentArtistProfile}
                                                                        >
                                                                            Negotiate
                                                                        </button>
                                                                    )}

                                                                    {/* Message */}
                                                                    {showMessage && hasAccessToPrivateGig && (
                                                                    <button
                                                                        className={`btn secondary ${!canBookCurrentArtistProfile ? 'disabled' : ''}`}
                                                                        onClick={canBookCurrentArtistProfile ? handleMessage : undefined}
                                                                        disabled={!canBookCurrentArtistProfile}
                                                                    >
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
                                                        </>
                                                    )}
                                                </div>
                                            </>
                                        )}
                                </div>
                            </div>
                        </>
                    )
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

            {showCreateProfileModal !== null && (
                <Portal>
                    <div className="modal">
                        <div className="modal-content">
                            <button className="btn close tertiary" onClick={() => setShowCreateProfileModal(null)}>Close</button>
                            <div className="modal-header">
                                <GuitarsIcon />
                                <h3>{showCreateProfileModal === 'no-profile' ? 'Create Your Artist Profile' : 'Complete Your Artist Profile'}</h3>
                                <p>{showCreateProfileModal === 'no-profile' ? 'You must create an artist profile to apply for gigs.' : 'Complete your artist profile to apply for gigs.'}</p>
                            </div>
                            <div className="modal-body">
                                <div className="modal-actions">
                                    <button className="btn artist-profile" onClick={() => {setShowCreateProfileModal(null); navigate('/artist-profile')}}>{showCreateProfileModal === 'no-profile' ? 'Create Artist Profile' : 'Complete Artist Profile'}</button>
                                </div>
                            </div>
                        </div>
                    </div>
                </Portal>
            )}
        </div>
    );
};