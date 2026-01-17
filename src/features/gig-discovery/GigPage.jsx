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
import { sendGigApplicationMessage, sendNegotiationMessage, sendGigInvitationMessage } from '@services/client-side/messages';
import { sendGigApplicationEmail, sendNegotiationEmail } from '@services/client-side/emails';
import { validateMusicianUser } from '@services/utils/validation';
import { useMapbox } from '@hooks/useMapbox';
import { formatDate } from '@services/utils/dates';
import { formatDurationSpan, getCityFromAddress } from '@services/utils/misc';
import { getMusicianProfilesByIds, updateBandMembersGigApplications, withdrawMusicianApplication, withdrawArtistApplication, getArtistProfileMembers } from '../../services/client-side/artists';
import { getBandMembers } from '../../services/client-side/bands';
import { getGigById, getGigsByIds, getGigInviteById } from '../../services/client-side/gigs';
import { getMostRecentMessage } from '../../services/client-side/messages';
import { toast } from 'sonner';
import { sendCounterOfferEmail, sendInvitationAcceptedEmailToVenue } from '../../services/client-side/emails';
import { AmpIcon, BassIcon, ClubIconSolid, CoinsIconSolid, ErrorIcon, InviteIconSolid, LinkIcon, LeftArrowIcon, RightArrowIcon, MonitorIcon, MoreInformationIcon, MusicianIconSolid, NewTabIcon, PeopleGroupIconSolid, PeopleRoofIconLight, PeopleRoofIconSolid, PermissionsIcon, PianoIcon, PlugIcon, ProfileIconSolid, SaveIcon, SavedIcon, ShareIcon, SpeakerIcon, VenueIconSolid, WarningIcon } from '../shared/ui/extras/Icons';
import { TechRiderEquipmentCard } from '../shared/ui/tech-rider/TechRiderEquipmentCard';
import { ensureProtocol, openInNewTab } from '../../services/utils/misc';
import { ProfileCreator } from '../artist/profile-creator/ProfileCreator';
import { NoProfileModal } from '../artist/components/NoProfileModal';
import { formatFeeDate } from '../../services/utils/dates';
import { LoadingSpinner } from '../shared/ui/loading/Loading';
import Portal from '../shared/components/Portal';
import { getLocalGigDateTime } from '../../services/utils/filtering';
import { sanitizeArtistPermissions } from '@services/utils/permissions';
import { applyToGig, negotiateGigFee, acceptGigOffer, acceptGigOfferOM } from '@services/api/gigs';
import { sendGigAcceptedMessage, updateDeclinedApplicationMessage, sendCounterOfferMessage, sendGigAcceptanceAnnouncement } from '@services/api/messages';
import { useBreakpoint } from '../../hooks/useBreakpoint';
import { NoTextLogo } from '../shared/ui/logos/Logos';
import { updateCRMEntryWithArtistId } from '../../services/api/users';

export const GigPage = ({ user, setAuthModal, setAuthType, noProfileModal, setNoProfileModal, setNoProfileModalClosable }) => {
    const { gigId } = useParams();
    const navigate = useNavigate();
    const {isSmUp, isMdUp, isLgUp} = useBreakpoint();
    const [searchParams] = useSearchParams();
    const inviteToken = searchParams.get('token'); 
    const inviteId = searchParams.get('inviteId');
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
    const [currentSlotIndex, setCurrentSlotIndex] = useState(0);
    const [isTransitioning, setIsTransitioning] = useState(false);
    const [transitionDirection, setTransitionDirection] = useState(null); // 'left' or 'right'
    const [touchStart, setTouchStart] = useState(null);
    const [touchEnd, setTouchEnd] = useState(null);

    // Permission state for artistProfile members
    const [artistProfilePerms, setArtistProfilePerms] = useState(null);
    const [loadingArtistPerms, setLoadingArtistPerms] = useState(false);
    
    // Invite validation state
    const [inviteData, setInviteData] = useState(null);
    const [inviteValidationStatus, setInviteValidationStatus] = useState(null); // 'valid' | 'invalid' | 'expired' | 'wrong-artist' | null
    const [inviteCrmEntryId, setInviteCrmEntryId] = useState(null);
    const [inviteVenueUserId, setInviteVenueUserId] = useState(null);

    // Combine gigData with otherSlots into allSlots array, sorted by startTime
    const allSlots = useMemo(() => {
        if (!gigData) return [];
        const slots = [gigData];
        if (otherSlots && Array.isArray(otherSlots) && otherSlots.length > 0) {
            slots.push(...otherSlots);
        }
        // Sort by startTime
        return slots.sort((a, b) => {
            const aTime = a.startTime || '';
            const bTime = b.startTime || '';
            if (!aTime || !bTime) return 0;
            const [aH, aM] = aTime.split(':').map(Number);
            const [bH, bM] = bTime.split(':').map(Number);
            return (aH * 60 + aM) - (bH * 60 + bM);
        });
    }, [gigData, otherSlots]);

    // Current slot being displayed
    const currentSlot = useMemo(() => {
        return allSlots[currentSlotIndex] || gigData;
    }, [allSlots, currentSlotIndex, gigData]);

    // Find initial slot index when gigData loads
    useEffect(() => {
        if (gigData && allSlots.length > 0) {
            const index = allSlots.findIndex(slot => slot.gigId === gigData.gigId);
            if (index !== -1) {
                setCurrentSlotIndex(index);
            }
        }
    }, [gigData?.gigId, allSlots.length]);

    // Navigation functions
    const goToNextSlot = () => {
        if (currentSlotIndex < allSlots.length - 1 && !isTransitioning) {
            setIsTransitioning(true);
            setTransitionDirection('left');
            setCurrentSlotIndex(prev => prev + 1);
            setTimeout(() => {
                setIsTransitioning(false);
                setTransitionDirection(null);
            }, 400);
        }
    };

    const goToPreviousSlot = () => {
        if (currentSlotIndex > 0 && !isTransitioning) {
            setIsTransitioning(true);
            setTransitionDirection('right');
            setCurrentSlotIndex(prev => prev - 1);
            setTimeout(() => {
                setIsTransitioning(false);
                setTransitionDirection(null);
            }, 400);
        }
    };

    // Swipe handlers
    const minSwipeDistance = 50;
    const onTouchStart = (e) => {
        setTouchEnd(null);
        setTouchStart(e.targetTouches[0].clientX);
    };
    const onTouchMove = (e) => {
        setTouchEnd(e.targetTouches[0].clientX);
    };
    const onTouchEnd = () => {
        if (!touchStart || !touchEnd) return;
        const distance = touchStart - touchEnd;
        const isLeftSwipe = distance > minSwipeDistance;
        const isRightSwipe = distance < -minSwipeDistance;
        if (isLeftSwipe) {
            goToNextSlot();
        } else if (isRightSwipe) {
            goToPreviousSlot();
        }
        setTouchStart(null);
        setTouchEnd(null);
    };

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
        const invited = !!(applicant && applicant.invited === true);
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
            let inviteValidation = null;
            let inviteDoc = null;
            let crmEntryId = null;
            const defaultSelected = profiles[0] || null; // Oldest profile by createdAt
            
            // Validate invite if gig is private
            if (enrichedGig?.private) {
              // If no inviteId in URL, show invalid access
              if (!inviteId) {
                nextHasAccess = false;
                inviteValidation = 'invalid';
              } else {
                // Fetch and validate invite document
                inviteDoc = await getGigInviteById(inviteId);
                
                if (!inviteDoc) {
                  // Invite document doesn't exist
                  nextHasAccess = false;
                  inviteValidation = 'invalid';
                } else {
                  // Check if inviteId is in gig's inviteIds array
                  const gigInviteIds = Array.isArray(enrichedGig.inviteIds) ? enrichedGig.inviteIds : [];
                  if (!gigInviteIds.includes(inviteId)) {
                    nextHasAccess = false;
                    inviteValidation = 'invalid';
                  } else if (!inviteDoc.active) {
                    // Invite is not active
                    nextHasAccess = false;
                    inviteValidation = 'invalid';
                  } else {
                    // Check if invite has expired
                    let isExpired = false;
                    if (inviteDoc.expiresAt) {
                      const expiresAt = inviteDoc.expiresAt?.toDate ? inviteDoc.expiresAt.toDate() : 
                                       inviteDoc.expiresAt?._seconds ? new Date(inviteDoc.expiresAt._seconds * 1000) :
                                       inviteDoc.expiresAt?.seconds ? new Date(inviteDoc.expiresAt.seconds * 1000) :
                                       new Date(inviteDoc.expiresAt);
                      if (isNaN(expiresAt.getTime()) || expiresAt < new Date()) {
                        isExpired = true;
                      }
                    }
                    
                    if (isExpired) {
                      // Invite has expired - show gig but with limited access
                      nextHasAccess = true;
                      inviteValidation = 'expired';
                    } else {
                      // Invite is valid - check artistId match if present
                      if (inviteDoc.artistId) {
                        const artistProfileIds = profiles.map(p => p.id || p.profileId || p.musicianId).filter(Boolean);
                        if (!user || !artistProfileIds.includes(inviteDoc.artistId)) {
                          // ArtistId doesn't match logged-in artist
                          nextHasAccess = false;
                          inviteValidation = 'wrong-artist';
                        } else {
                          // Valid invite with matching artistId
                          nextHasAccess = true;
                          inviteValidation = 'valid';
                          nextInvitedToGig = true;
                        }
                      } else {
                        // Valid invite without specific artistId
                        nextHasAccess = true;
                        inviteValidation = 'valid';
                        nextInvitedToGig = true;
                      }
                      
                      // Store crmEntryId if present
                      if (inviteDoc.crmEntryId) {
                        crmEntryId = inviteDoc.crmEntryId;
                      }
                    }
                  }
                }
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
            setInviteValidationStatus(inviteValidation);
            setInviteData(inviteDoc);
            setInviteCrmEntryId(crmEntryId);
            // Store the venue user ID from the invite (createdBy field)
            if (inviteDoc?.createdBy) {
                setInviteVenueUserId(inviteDoc.createdBy);
            }
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
    }, [gigId, user, inviteToken, inviteId]);


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

    // Update CRM entry when profile is created from invite
    useEffect(() => {
        if (!inviteCrmEntryId || !inviteVenueUserId || !user?.artistProfiles?.length) return;
        
        const updateCRM = async () => {
            try {
                // Get the most recently created profile (assuming it's the one just created)
                const profiles = Array.isArray(user.artistProfiles) ? user.artistProfiles : [];
                if (profiles.length === 0) return;
                
                // Get the newest profile (assuming last in array or by createdAt)
                const newestProfile = profiles[profiles.length - 1];
                const profileId = newestProfile.id || newestProfile.profileId;
                
                if (profileId) {
                    // Use server-side API to update CRM entry
                    await updateCRMEntryWithArtistId({
                        venueUserId: inviteVenueUserId,
                        crmEntryId: inviteCrmEntryId,
                        artistId: profileId,
                        inviteId: inviteId || null, // Pass inviteId for validation if available
                    });
                }
            } catch (error) {
                console.error('Failed to update CRM entry with artist profile ID:', error);
            }
        };
        
        updateCRM();
    }, [inviteCrmEntryId, inviteVenueUserId, user?.artistProfiles, inviteId]);

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

    const calculateEndTime = (slot) => {
        if (!slot) return '00:00';
        return calculateTime(slot.startTime, slot.duration);
    };

    // Calculate end time for current slot
    const endTime = useMemo(() => {
        return currentSlot?.startTime && currentSlot?.duration ? calculateEndTime(currentSlot) : '00:00';
    }, [currentSlot]);

    // Helper to remove "(Set X)" suffix from gig name
    const getBaseGigName = (gigName) => {
        if (!gigName) return '';
        return gigName.replace(/\s*\(Set\s+\d+\)\s*$/, '');
    };

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
          if (currentSlotStatus.applied) return;
          setApplyingToGig(true);
          try {
            const slotGigId = currentSlot.gigId;
            const nonPayableGig = currentSlot.kind === 'Open Mic' || currentSlot.kind === 'Ticketed Gig' || currentSlot.budget === '£' || currentSlot.budget === '£0';
            // Normalize profile for API compatibility
            const normalizedProfile = {
              ...musicianProfile,
              musicianId: musicianProfile.id || musicianProfile.profileId || musicianProfile.musicianId,
              profileId: musicianProfile.id || musicianProfile.profileId || musicianProfile.musicianId,
            };
            const { updatedApplicants } = await applyToGig({ gigId: slotGigId, musicianProfile: normalizedProfile, inviteId });
            // Update the slot in allSlots
            setGigData(prev => {
                if (prev.gigId === slotGigId) {
                    return { ...prev, applicants: updatedApplicants };
                }
                return prev;
            });
            setOtherSlots(prev => {
                if (!prev) return prev;
                return prev.map(slot => 
                    slot.gigId === slotGigId 
                        ? { ...slot, applicants: updatedApplicants }
                        : slot
                );
            });
            
            // Use artist profile update if this is an artist profile
            const isArtistProfile = user?.artistProfiles?.some(p => (p.id || p.profileId) === normalizedProfile.id);
            if (isArtistProfile) {
              await updateArtistGigApplications(normalizedProfile, slotGigId);
            } else {
              // Fallback to musician profile update for backward compatibility
              await updateMusicianGigApplications(normalizedProfile, slotGigId);
            }
            
            const { conversationId } = await getOrCreateConversation(
                { musicianProfile: normalizedProfile, gigData: { ...currentSlot, gigId: slotGigId }, venueProfile, type: 'application' }
            );
            await sendGigApplicationMessage(conversationId, {
                senderId: user.uid,
                text: `${normalizedProfile.name} has applied to your gig on ${formatDate(currentSlot.startDateTime)} at ${currentSlot.venue.venueName}${nonPayableGig ? '' : ` for ${currentSlot.budget}`}`,
                profileId: normalizedProfile.musicianId,
                profileType: 'artist',
            });
            await sendGigApplicationEmail({
                to: venueProfile.email,
                musicianName: normalizedProfile.name,
                venueName: currentSlot.venue.venueName,
                date: formatDate(currentSlot.startDateTime),
                budget: currentSlot.budget,
                profileType: 'artist',
                nonPayableGig,
            });
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
            const slotGigId = currentSlot.gigId;
            // Check if this is an artist profile
            const isArtistProfile = user?.artistProfiles?.some(p => (p.id || p.profileId) === (selectedProfile?.id || selectedProfile?.profileId));
            let updatedApplicants;
            if (isArtistProfile) {
              updatedApplicants = await withdrawArtistApplication(slotGigId, selectedProfile);
            } else {
              updatedApplicants = await withdrawMusicianApplication(slotGigId, selectedProfile);
            }
            if (updatedApplicants) {
              setGigData(prev => {
                  if (prev.gigId === slotGigId) {
                      return { ...prev, applicants: updatedApplicants };
                  }
                  return prev;
              });
              setOtherSlots(prev => {
                  if (!prev) return prev;
                  return prev.map(slot => 
                      slot.gigId === slotGigId 
                          ? { ...slot, applicants: updatedApplicants }
                          : slot
                  );
              });
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
        if (getLocalGigDateTime(currentSlot) < new Date()) return toast.error('Gig is in the past.');
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
        if (currentSlotStatus.applied || !newOffer) return;
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
            const slotGigId = currentSlot.gigId;
            const { updatedApplicants } = await negotiateGigFee({ gigId: slotGigId, musicianProfile: normalizedProfile, newFee: newOffer, sender: 'musician' });
            // Update the slot in allSlots
            setGigData(prev => {
                if (prev.gigId === slotGigId) {
                    return { ...prev, applicants: updatedApplicants };
                }
                return prev;
            });
            setOtherSlots(prev => {
                if (!prev) return prev;
                return prev.map(slot => 
                    slot.gigId === slotGigId 
                        ? { ...slot, applicants: updatedApplicants }
                        : slot
                );
            });
            
            // Use artist profile update if this is an artist profile
            const isArtistProfile = user?.artistProfiles?.some(p => (p.id || p.profileId) === normalizedProfile.id);
            if (isArtistProfile) {
              await updateArtistGigApplications(normalizedProfile, slotGigId);
            } else {
              // Fallback to musician profile update for backward compatibility
              if (musicianProfile.bandProfile) {
                await updateBandMembersGigApplications(normalizedProfile, slotGigId);
              } else {
                await updateMusicianGigApplications(normalizedProfile, slotGigId);
              }
            }
            
            const { conversationId } = await getOrCreateConversation({ musicianProfile: normalizedProfile, gigData: currentSlot, venueProfile, type: 'negotiation' });
            const profileType = isArtistProfile ? 'artist' : (musicianProfile.bandProfile ? 'band' : 'musician');
            const senderName = normalizedProfile.name;
            const venueName = currentSlot.venue?.venueName || 'the venue';
            if (currentSlotStatus.invited) {
                const invitationMessage = await getMostRecentMessage(conversationId, 'invitation');
                updateDeclinedApplicationMessage({ conversationId, originalMessageId: invitationMessage.id, senderId: user.uid, userRole: 'musician' });
                await sendCounterOfferMessage({ conversationId, messageId: invitationMessage.id, senderId: user.uid, newFee: newOffer, oldFee: currentSlot.budget, userRole: 'musician' });
                await sendCounterOfferEmail({
                    userRole: 'musician',
                    musicianProfile: normalizedProfile,
                    venueProfile: venueProfile,
                    gigData: currentSlot,
                    newOffer,
                });
            } else {
                await sendNegotiationMessage(conversationId, {
                    senderId: user.uid,
                    oldFee: currentSlot.budget,
                    newFee: newOffer,
                    text: `${senderName} wants to negotiate the fee for the gig on ${formatDate(currentSlot.startDateTime)} at ${venueName}`,
                    profileId: normalizedProfile.musicianId,
                    profileType
                });
                await sendNegotiationEmail({
                    to: venueProfile.email,
                    musicianName: senderName,
                    venueName,
                    oldFee: currentSlot.budget,
                    newFee: newOffer,
                    date: formatDate(currentSlot.startDateTime),
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
            const response = await getOrCreateConversation({ musicianProfile: normalizedProfile, gigData: currentSlot, venueProfile, type: 'message' });
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
            if (!currentSlot) return console.error('Gig data is missing');
            const slotGigId = currentSlot.gigId;
            if (getLocalGigDateTime(currentSlot) < new Date()) return toast.error('Gig is in the past.');
            const nonPayableGig = currentSlot.kind === 'Open Mic' || currentSlot.kind === "Ticketed Gig" || currentSlot.budget === '£' || currentSlot.budget === '£0';
            let globalAgreedFee;
            if (currentSlot.kind === 'Open Mic') {
                const { updatedApplicants } = await acceptGigOfferOM({ gigData: currentSlot, musicianProfileId: musicianId, role: 'musician', inviteId });
                setGigData(prev => {
                    if (prev.gigId === slotGigId) {
                        return { ...prev, applicants: updatedApplicants, paid: true };
                    }
                    return prev;
                });
                setOtherSlots(prev => {
                    if (!prev) return prev;
                    return prev.map(slot => 
                        slot.gigId === slotGigId 
                            ? { ...slot, applicants: updatedApplicants, paid: true }
                            : slot
                    );
                });
            } else {
                const { updatedApplicants, agreedFee } = await acceptGigOffer({ gigData: currentSlot, musicianProfileId: musicianId, nonPayableGig, role: 'musician', inviteId });
                setGigData(prev => {
                    if (prev.gigId === slotGigId) {
                        return { ...prev, applicants: updatedApplicants, agreedFee: `${agreedFee}`, paid: false };
                    }
                    return prev;
                });
                setOtherSlots(prev => {
                    if (!prev) return prev;
                    return prev.map(slot => 
                        slot.gigId === slotGigId 
                            ? { ...slot, applicants: updatedApplicants, agreedFee: `${agreedFee}`, paid: false }
                            : slot
                    );
                });
                globalAgreedFee = agreedFee;
            }
            // Normalize profile for API compatibility
            const normalizedProfile = {
              ...selectedProfile,
              musicianId,
              profileId: musicianId,
            };
            const venueProfile = await getVenueProfileById(currentSlot.venueId);
            
            // Check if artist is in applicants array - if not, we need to create conversation and send message
            const applicants = Array.isArray(currentSlot.applicants) ? currentSlot.applicants : [];
            const isInApplicants = applicants.some(a => a?.id === musicianId);
            
            // Get or create conversation
            const { conversationId } = await getOrCreateConversation({
              musicianProfile: normalizedProfile,
              gigData: currentSlot,
              venueProfile,
              type: 'invitation',
            });
            
            // If artist wasn't in applicants (invite via link), send a new announcement message
            // Otherwise, try to find existing invitation message
            if (!isInApplicants) {
              // Send an announcement message indicating the invitation was accepted
              const venueName = venueProfile?.venueName || 'the venue';
              const messageText = nonPayableGig
                ? `${normalizedProfile.name} has accepted the invitation to play at ${venueName} on ${formatDate(currentSlot.startDateTime)}.`
                : `${normalizedProfile.name} has accepted the invitation to play at ${venueName} on ${formatDate(currentSlot.startDateTime)} for ${currentSlot.budget}.`;
              await sendGigAcceptanceAnnouncement({
                conversationId,
                senderId: user.uid,
                text: messageText,
                nonPayableGig,
              });
            } else {
              // Normal flow: find existing invitation message and send accepted message
              const applicationMessage = await getMostRecentMessage(conversationId, 'invitation');
              if (applicationMessage?.id) {
                await sendGigAcceptedMessage({
                  conversationId,
                  originalMessageId: applicationMessage.id,
                  senderId: user.uid,
                  agreedFee: currentSlot.budget,
                  userRole: 'musician',
                  nonPayableGig,
                });
              }
            }
            const venueEmail = venueProfile.email;
            const musicianName = normalizedProfile.name;
            await sendInvitationAcceptedEmailToVenue({
                venueEmail: venueEmail,
                musicianName: musicianName,
                venueProfile: venueProfile,
                gigData: currentSlot,
                agreedFee: globalAgreedFee,
                nonPayableGig: nonPayableGig,
            })
            if (nonPayableGig) {
                await notifyOtherApplicantsGigConfirmed({ gigData: currentSlot, acceptedMusicianId: musicianId });
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

    const checkTechRiderMismatches = () => {
        if (!selectedProfile?.techRider || !venueProfile?.techRider) {
            return [];
        }

        const artistTechRider = selectedProfile.techRider;
        const venueTechRider = venueProfile.techRider;
        const mismatches = [];

        // Extract artist equipment needs
        const artistNeeds = {
            needsDrumKit: false,
            needsBassAmp: false,
            needsGuitarAmp: false,
            needsKeyboard: false,
            needsMic: false,
            needsMicCount: 0,
            needsDIBoxes: 0,
            needsPA: true, // Assume PA is always needed for live performance
            needsMixingConsole: true, // Assume mixing console is always needed
        };

        // Check lineup and performer details
        if (artistTechRider.lineup && artistTechRider.performerDetails) {
            artistTechRider.lineup.forEach((performer, index) => {
                const details = artistTechRider.performerDetails[index];
                if (!details) return;

                const instruments = performer.instruments || [];
                
                instruments.forEach(instrument => {
                    const instrumentLower = instrument.toLowerCase();
                    
                    // Check for drum kit
                    if (instrumentLower.includes('drum')) {
                        if (details.Drums?.needsDrumKit === true) {
                            artistNeeds.needsDrumKit = true;
                        }
                    }
                    
                    // Check for bass amp (if bass instrument is present)
                    if (instrumentLower.includes('bass') && !instrumentLower.includes('drum')) {
                        artistNeeds.needsBassAmp = true;
                    }
                    
                    // Check for guitar amp (if guitar instrument is present)
                    if (instrumentLower.includes('guitar')) {
                        artistNeeds.needsGuitarAmp = true;
                    }
                    
                    // Check for keyboard/piano
                    if (instrumentLower.includes('keyboard') || instrumentLower.includes('piano') || instrumentLower.includes('keys')) {
                        artistNeeds.needsKeyboard = true;
                    }
                });

                // Check for mic needs (vocalists or singers)
                if (details.Vocals?.needsMic === true || details.singing === true) {
                    artistNeeds.needsMic = true;
                    artistNeeds.needsMicCount += 1;
                }
                
                // Check for DI boxes in various instrument details
                if (details.Drums?.needsDIBoxes && typeof details.Drums.needsDIBoxes === 'number') {
                    artistNeeds.needsDIBoxes += details.Drums.needsDIBoxes;
                }
                if (details.Bass?.needsDIBoxes && typeof details.Bass.needsDIBoxes === 'number') {
                    artistNeeds.needsDIBoxes += details.Bass.needsDIBoxes;
                }
                if (details.Guitar?.needsDIBoxes && typeof details.Guitar.needsDIBoxes === 'number') {
                    artistNeeds.needsDIBoxes += details.Guitar.needsDIBoxes;
                }
                if (details.Keyboard?.needsDIBoxes && typeof details.Keyboard.needsDIBoxes === 'number') {
                    artistNeeds.needsDIBoxes += details.Keyboard.needsDIBoxes;
                }
                if (details.Piano?.needsDIBoxes && typeof details.Piano.needsDIBoxes === 'number') {
                    artistNeeds.needsDIBoxes += details.Piano.needsDIBoxes;
                }
            });
        }

        // Compare with venue availability
        // PA
        if (artistNeeds.needsPA && venueTechRider.soundSystem?.pa?.available === 'no') {
            mismatches.push('PA System');
        }

        // Mixing Console
        if (artistNeeds.needsMixingConsole && venueTechRider.soundSystem?.mixingConsole?.available === 'no') {
            mismatches.push('Mixing Console');
        }

        // Vocal Mics
        if (artistNeeds.needsMic) {
            const venueMicCount = parseInt(venueTechRider.soundSystem?.vocalMics?.count || '0');
            if (venueMicCount < artistNeeds.needsMicCount) {
                mismatches.push(`Vocal Mics (need ${artistNeeds.needsMicCount}, venue has ${venueMicCount})`);
            }
        }

        // DI Boxes
        if (artistNeeds.needsDIBoxes > 0) {
            const venueDICount = parseInt(venueTechRider.soundSystem?.diBoxes?.count || '0');
            if (venueDICount < artistNeeds.needsDIBoxes) {
                mismatches.push(`DI Boxes (need ${artistNeeds.needsDIBoxes}, venue has ${venueDICount})`);
            }
        }

        // Drum Kit
        if (artistNeeds.needsDrumKit && venueTechRider.backline?.drumKit?.available === 'no') {
            mismatches.push('Drum Kit');
        }

        // Bass Amp
        if (artistNeeds.needsBassAmp && venueTechRider.backline?.bassAmp?.available === 'no') {
            mismatches.push('Bass Amp');
        }

        // Guitar Amp
        if (artistNeeds.needsGuitarAmp && venueTechRider.backline?.guitarAmp?.available === 'no') {
            mismatches.push('Guitar Amp');
        }

        // Keyboard
        if (artistNeeds.needsKeyboard && venueTechRider.backline?.keyboard?.available === 'no') {
            mismatches.push('Keyboard');
        }

        return mismatches;
    };

    const formatTechRiderWarningText = (mismatches) => {
        if (mismatches.length === 0) return '';
        
        // Clean up mismatch strings to get just the equipment names
        const equipmentNames = mismatches.map(mismatch => {
            // Remove count information if present (e.g., "Vocal Mics (need 2, venue has 1)" -> "vocal mics")
            const cleaned = mismatch.split('(')[0].trim().toLowerCase();
            // Handle special cases
            if (cleaned.includes('pa system')) return 'a PA system';
            if (cleaned.includes('mixing console')) return 'a mixing console';
            if (cleaned.includes('vocal mics')) return 'microphones';
            if (cleaned.includes('di boxes')) return 'DI boxes';
            if (cleaned.includes('drum kit')) return 'a drum kit';
            if (cleaned.includes('bass amp')) return 'a bass amp';
            if (cleaned.includes('guitar amp')) return 'a guitar amp';
            if (cleaned.includes('keyboard')) return 'a keyboard';
            return `a ${cleaned}`;
        });

        if (equipmentNames.length === 1) {
            return `The venue does not have ${equipmentNames[0]} available for use.`;
        } else if (equipmentNames.length === 2) {
            return `The venue does not have ${equipmentNames[0]} or ${equipmentNames[1]} available for use.`;
        } else {
            // For 3 or more, use Oxford comma
            const lastItem = equipmentNames[equipmentNames.length - 1];
            const otherItems = equipmentNames.slice(0, -1).join(', ');
            return `The venue does not have ${otherItems}, or ${lastItem} available for use.`;
        }
    };

    const renderTechRider = () => {
        if (!venueProfile?.techRider) {
            return <p>The venue has not listed any tech rider information.</p>;
        }

        const { soundSystem, backline, houseRules } = venueProfile.techRider;
        const equipmentItems = [];

        // PA
        if (soundSystem?.pa) {
            equipmentItems.push(
                <TechRiderEquipmentCard
                    key="pa"
                    equipmentName="PA"
                    available={soundSystem.pa.available}
                    notes={soundSystem.pa.notes}
                />
            );
        }

        // Mixing Console
        if (soundSystem?.mixingConsole) {
            equipmentItems.push(
                <TechRiderEquipmentCard
                    key="mixingConsole"
                    equipmentName="Mixing Console"
                    available={soundSystem.mixingConsole.available}
                    notes={soundSystem.mixingConsole.notes}
                />
            );
        }

        // Vocal Mics
        if (soundSystem?.vocalMics) {
            equipmentItems.push(
                <TechRiderEquipmentCard
                    key="vocalMics"
                    equipmentName="Vocal Mics"
                    count={soundSystem.vocalMics.count}
                    notes={soundSystem.vocalMics.notes}
                />
            );
        }

        // DI Boxes
        if (soundSystem?.diBoxes) {
            equipmentItems.push(
                <TechRiderEquipmentCard
                    key="diBoxes"
                    equipmentName="DI Boxes"
                    count={soundSystem.diBoxes.count}
                    notes={soundSystem.diBoxes.notes}
                />
            );
        }

        // Drum Kit
        if (backline?.drumKit) {
            equipmentItems.push(
                <TechRiderEquipmentCard
                    key="drumKit"
                    equipmentName="Drum Kit"
                    available={backline.drumKit.available}
                    notes={backline.drumKit.notes}
                />
            );
        }

        // Bass Amp
        if (backline?.bassAmp) {
            equipmentItems.push(
                <TechRiderEquipmentCard
                    key="bassAmp"
                    equipmentName="Bass Amp"
                    available={backline.bassAmp.available}
                    notes={backline.bassAmp.notes}
                />
            );
        }

        // Guitar Amp
        if (backline?.guitarAmp) {
            equipmentItems.push(
                <TechRiderEquipmentCard
                    key="guitarAmp"
                    equipmentName="Guitar Amp"
                    available={backline.guitarAmp.available}
                    notes={backline.guitarAmp.notes}
                />
            );
        }

        // Keyboard
        if (backline?.keyboard) {
            equipmentItems.push(
                <TechRiderEquipmentCard
                    key="keyboard"
                    equipmentName="Keyboard"
                    available={backline.keyboard.available}
                    notes={backline.keyboard.notes}
                />
            );
        }

        return (
            <>
                <div className="tech-rider-grid" style={{ marginTop: '1rem', alignItems: 'flex-start' }}>
                    {equipmentItems}
                </div>
                
                {/* Other Note Fields */}
                {(soundSystem?.monitoring || soundSystem?.cables || backline?.other || backline?.stageSize || houseRules?.powerAccess || houseRules?.houseRules || houseRules?.volumeLevel || houseRules?.noiseCurfew || houseRules?.volumeNotes) && (
                    <div className="tech-rider-notes-section">
                        {houseRules?.volumeLevel && (
                            <div>
                                <h6>Volume Level</h6>
                                <p>{houseRules.volumeLevel.charAt(0).toUpperCase() + houseRules.volumeLevel.slice(1)}</p>
                            </div>
                        )}
                        {houseRules?.noiseCurfew && (
                            <div>
                                <h6>Noise Curfew</h6>
                                <p>{houseRules.noiseCurfew}</p>
                            </div>
                        )}
                        {houseRules?.volumeNotes && (
                            <div>
                                <h6>Volume Notes</h6>
                                <p>{houseRules.volumeNotes}</p>
                            </div>
                        )}
                        {soundSystem?.monitoring && (
                            <div>
                                <h6>Monitoring</h6>
                                <p>{soundSystem.monitoring}</p>
                            </div>
                        )}
                        {soundSystem?.cables && (
                            <div>
                                <h6>Cables</h6>
                                <p>{soundSystem.cables}</p>
                            </div>
                        )}
                        {backline?.other && (
                            <div>
                                <h6>Other Backline</h6>
                                <p>{backline.other}</p>
                            </div>
                        )}
                        {backline?.stageSize && (
                            <div>
                                <h6>Stage Size</h6>
                                <p>{backline.stageSize}</p>
                            </div>
                        )}
                        {houseRules?.powerAccess && (
                            <div>
                                <h6>Power Access</h6>
                                <p>{houseRules.powerAccess}</p>
                            </div>
                        )}
                        {houseRules?.houseRules && (
                            <div>
                                <h6>House Rules</h6>
                                <p>{houseRules.houseRules}</p>
                            </div>
                        )}
                    </div>
                )}
            </>
        );
    };

    const now = new Date();
    // Compute status for current slot
    const currentSlotStatus = useMemo(() => {
        if (!currentSlot || !selectedProfile) return { invited: false, applied: false, accepted: false };
        return computeStatusForProfile(currentSlot, selectedProfile);
    }, [currentSlot, selectedProfile, inviteToken]);

    const isFutureOpen = getLocalGigDateTime(currentSlot) > now && (currentSlot?.status || '').toLowerCase() !== 'closed';
    const isPrivate = !!currentSlot?.private;
    const invited = !!currentSlotStatus.invited;
    const applied = !!currentSlotStatus.applied;
    const accepted = !!currentSlotStatus.accepted;
    const inviteExpired = inviteValidationStatus === 'expired';
    const inviteInvalid = inviteValidationStatus === 'invalid' || inviteValidationStatus === 'wrong-artist';
    const inviteValid = inviteValidationStatus === 'valid';
    const hasValidInvite = inviteValid && hasAccessToPrivateGig;

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
        (invited && !applied && !accepted && !inviteExpired) || (hasValidInvite && !applied && !accepted); // private or not, but not if expired

    // Negotiate: show only if (not applied/accepted) OR (private AND invited), but not if invite expired, and user must be logged in
    const showNegotiate =
        ((!applied && !accepted) || (isPrivate && invited)) && !inviteExpired && !!user;

    // Message: show in any case EXCEPT (private AND not invited AND not expired), and user must be logged in
    const showMessage =
    !(isPrivate && !invited && !inviteExpired) && !!user;

    // Optional: hide negotiate for kinds you excluded earlier
    const kindBlocksNegotiate = currentSlot?.kind === 'Ticketed Gig' || currentSlot?.kind === 'Open Mic';
    
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
            <section className={`gig-page-body ${!isMdUp && 'mobile'}`} style={{ width: `${width}`, marginTop: `${!user || user || user?.artistProfiles || user?.artistProfiles?.length > 0 || user.venueProfiles?.length > 0 ? '6rem' : '0'}`}}>
                {loading ? (
                    <div className='loading-state'>
                        <LoadingSpinner />
                    </div>
                ) : (
                    isMdUp ? (
                        <>
                            <div className='head'>
                                <div className='title'>
                                    <h1>{getBaseGigName(gigData.gigName)}</h1>
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
                                    {gigData.technicalInformation !== '' && (
                                        <div className='equipment'>
                                            <h4 className="subtitle">Gig Description</h4>
                                            <p className='detail-text'>
                                                  {gigData.technicalInformation !== '' && (
                                                    gigData.technicalInformation
                                                  )}
                                            </p>    
                                        </div>
                                    )}
                                    <div className='timeline'>
                                        <h4 className='subtitle'>Gig Timeline</h4>
                                        {currentSlot?.startTime && (
                                            <div className='timeline-cont'>
                                                <div className='timeline-event'>
                                                    <div className='timeline-content'>
                                                        <p>Load In</p>
                                                        <div className='timeline-time'>{currentSlot?.loadInTime && currentSlot?.loadInTime !== '' ? formatTime(currentSlot?.loadInTime) : 'TBC'}</div>
                                                    </div>
                                                    <div className='timeline-line'></div>
                                                </div>
                                                <div className='timeline-event'>
                                                    <div className='timeline-content'>
                                                        <p>Sound Check</p>
                                                        <div className='timeline-time'>{currentSlot?.soundCheckTime && currentSlot?.soundCheckTime !== '' ? formatTime(currentSlot?.soundCheckTime) : 'TBC'}</div>
                                                    </div>
                                                    <div className='timeline-line'></div>
                                                </div>
                                                <div className='timeline-event'>
                                                    <div className='timeline-content'>
                                                        <p>Set Starts</p>
                                                        <div className='timeline-time orange'>{formatTime(currentSlot.startTime)}</div>
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
                                        <h4>{venueProfile?.name || gigData.venue.venueName}'s Tech Rider</h4>
                                        {renderTechRider()}
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
                                    <div 
                                        className='action-box'
                                        onTouchStart={onTouchStart}
                                        onTouchMove={onTouchMove}
                                        onTouchEnd={onTouchEnd}
                                        style={{ overflow: 'hidden' }}
                                    >
                                        {allSlots.length > 1 && (
                                            <div className='slot-navigation' style={{ 
                                                display: 'flex', 
                                                alignItems: 'center', 
                                                justifyContent: 'space-between',
                                                padding: '1rem',
                                                borderBottom: '1px solid var(--gn-grey-300)',
                                                marginBottom: '1rem'
                                            }}>
                                                <button 
                                                    className='btn icon' 
                                                    onClick={goToPreviousSlot}
                                                    disabled={currentSlotIndex === 0 || isTransitioning}
                                                    style={{ opacity: currentSlotIndex === 0 ? 0.5 : 1 }}
                                                >
                                                    <LeftArrowIcon />
                                                </button>
                                                <h4 style={{ margin: 0, fontSize: '0.9rem', fontWeight: '600' }}>
                                                    Set {currentSlotIndex + 1} of {allSlots.length}
                                                </h4>
                                                <button 
                                                    className='btn icon' 
                                                    onClick={goToNextSlot}
                                                    disabled={currentSlotIndex === allSlots.length - 1 || isTransitioning}
                                                    style={{ opacity: currentSlotIndex === allSlots.length - 1 ? 0.5 : 1 }}
                                                >
                                                    <RightArrowIcon />
                                                </button>
                                            </div>
                                        )}
                                        <div 
                                            className='action-box-content'
                                            style={{
                                                transition: 'transform 0.4s cubic-bezier(0.4, 0, 0.2, 1), opacity 0.4s ease-in-out',
                                                transform: isTransitioning 
                                                    ? (transitionDirection === 'left' ? 'translateX(-50px)' : 'translateX(50px)')
                                                    : 'translateX(0)',
                                                opacity: isTransitioning ? 0.5 : 1
                                            }}
                                        >
                                            <div className='action-box-info'>
                                                <div className='action-box-budget'>
                                                    {currentSlot?.kind === 'Open Mic' || currentSlot?.kind === 'Ticketed Gig' ? (
                                                        <h2 className="gig-kind">
                                                            {currentSlot.kind}
                                                            {currentSlot.kind === 'Ticketed Gig' && (
                                                            <span
                                                                className="tooltip-wrapper"
                                                                data-tooltip="Ticket sales, administration, and any revenue split are to be agreed directly between you and the venue."
                                                            >
                                                                <MoreInformationIcon />
                                                            </span>
                                                            )}
                                                        </h2>
                                                    ) : (
                                                        <>
                                                            <h1>{currentSlot?.budget === '£' || currentSlot?.budget === '£0' ? 'No Fee' : currentSlot?.budget}</h1>
                                                            {currentSlot?.budget !== '£' && currentSlot?.budget !== '£0' && (
                                                                <p>gig fee</p>
                                                            )}
                                                        </>
                                                    )}
                                                </div>
                                                <div className='action-box-duration'>
                                                    <h4>{formatDuration(currentSlot?.duration)}</h4>
                                                </div>
                                            </div>
                                            <div className='action-box-date-and-time'>
                                                <div className='action-box-date'>
                                                    <h3>{formatDate(currentSlot?.startDateTime, 'withTime')}</h3>
                                                </div>
                                            </div>
                                        </div>
                                        {/* {(currentSlot?.kind !== 'Open Mic' && currentSlot?.kind !== 'Ticketed Gig' && !venueVisiting) && (
                                            <div className='action-box-fees'>
                                                <div className='action-box-service-fee'>
                                                <p>Service Fee</p>
                                                <p>£{calculateServiceFee(currentSlot.budget)}</p>
                                                </div>
                                                <div className='action-box-total-income'>
                                                <p>Total Income</p>
                                                <p>£{calculateTotalIncome(currentSlot.budget)}</p>
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
                                                        ) : inviteInvalid ? (
                                                            // Invalid invite screen
                                                            <div className="private-applications">
                                                                <InviteIconSolid />
                                                                <h5>This gig is private and requires a valid invite link to apply.</h5>
                                                            </div>
                                                        ) : (
                                                            <>
                                                                {showApplied && hasAccessToPrivateGig ? (
                                                                    <button className='btn artist-profile disabled' disabled>Applied To Gig</button>
                                                                ) : accepted && hasAccessToPrivateGig ? (
                                                                    <button className='btn artist-profile disabled' disabled>Invitation Accepted</button>
                                                                ) : showAcceptInvite && hasAccessToPrivateGig && user && user.artistProfiles?.length > 0 && selectedProfile.isComplete ? (
                                                                        <button className={`btn artist-profile ${!canBookCurrentArtistProfile ? 'disabled' : ''}`} onClick={canBookCurrentArtistProfile ? handleAccept : undefined} disabled={!canBookCurrentArtistProfile}>
                                                                            Accept Invitation
                                                                        </button>
                                                                ) : showAcceptInvite && hasAccessToPrivateGig ? (
                                                                        <button 
                                                                            className="btn artist-profile" 
                                                                            onClick={() => {
                                                                                if (!user) {
                                                                                    sessionStorage.setItem('redirect', `/artist-profile`);
                                                                                    setAuthModal(true);
                                                                                    setAuthType('signup');
                                                                                } else {
                                                                                    sessionStorage.setItem('redirect', `/gig/${gigId}?inviteId=${inviteId}`);
                                                                                    navigate(`/artist-profile`);
                                                                                }
                                                                            }}
                                                                        >
                                                                            Create Artist Profile to Accept Invitation
                                                                        </button>
                                                                ) : showApply && hasAccessToPrivateGig && user && user.artistProfiles?.length > 0 && !selectedProfile.isComplete ? (
                                                                        <button className='btn artist-profile' onClick={() => navigate(`/artist-profile`)}>
                                                                            Complete Artist Profile to Apply
                                                                        </button>
                                                                ) : showApply && hasAccessToPrivateGig ? (
                                                                        <button
                                                                            className={`btn artist-profile ${!canBookCurrentArtistProfile ? 'disabled' : ''}`}
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
                                                                    {showNegotiate && !kindBlocksNegotiate && hasAccessToPrivateGig && user && user.artistProfiles?.length > 0 && selectedProfile.isComplete && (
                                                                        <button
                                                                            className={`btn secondary ${!canBookCurrentArtistProfile ? 'disabled' : ''}`}
                                                                            onClick={canBookCurrentArtistProfile ? handleNegotiateButtonClick : undefined}
                                                                            disabled={!canBookCurrentArtistProfile}
                                                                        >
                                                                            Negotiate
                                                                        </button>
                                                                    )}

                                                                    {/* Message */}
                                                                    {showMessage && hasAccessToPrivateGig && user && user.artistProfiles?.length > 0 && selectedProfile.isComplete && (
                                                                    <button
                                                                        className={`btn secondary ${!canBookCurrentArtistProfile ? 'disabled' : ''}`}
                                                                        onClick={canBookCurrentArtistProfile ? handleMessage : undefined}
                                                                        disabled={!canBookCurrentArtistProfile}
                                                                    >
                                                                        Message
                                                                    </button>
                                                                    )}
                                                                </div>

                                                                {/* Expired invite notice */}
                                                                {inviteExpired && hasAccessToPrivateGig && (
                                                                    <div className="status-box permissions" style={{ marginTop: '1rem' }}>
                                                                        <WarningIcon />
                                                                        <p>This invite has expired.</p>
                                                                    </div>
                                                                )}

                                                                {/* Private notice (only if private AND no invite) */}
                                                                {isPrivate && !hasAccessToPrivateGig && !inviteInvalid && (
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
                                                                            You don't have permission to manage gigs for this artist profile. Please contact the profile owner.
                                                                        </p>
                                                                    </div>
                                                                )}

                                                                {/* Tech Rider Mismatch Warning */}
                                                                {selectedProfile && hasAccessToPrivateGig && (() => {
                                                                    const mismatches = checkTechRiderMismatches();
                                                                    if (mismatches.length > 0) {
                                                                        return (
                                                                            <div className="tech-rider-warning">
                                                                                <WarningIcon />
                                                                                <p>{formatTechRiderWarningText(mismatches)}</p>
                                                                            </div>
                                                                        );
                                                                    }
                                                                    return null;
                                                                })()}
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
                                    <h1>{getBaseGigName(gigData.gigName)}</h1>
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
                                        {currentSlot?.startTime && (
                                            <div className='timeline-cont'>
                                                <div className='timeline-event'>
                                                    <div className='timeline-content'>
                                                        <p>Load In</p>
                                                        <div className='timeline-time'>{currentSlot?.loadInTime && currentSlot?.loadInTime !== '' ? formatTime(currentSlot?.loadInTime) : 'TBC'}</div>
                                                    </div>
                                                    <div className='timeline-line'></div>
                                                </div>
                                                <div className='timeline-event'>
                                                    <div className='timeline-content'>
                                                        <p>Sound Check</p>
                                                        <div className='timeline-time'>{currentSlot?.soundCheckTime && currentSlot?.soundCheckTime !== '' ? formatTime(currentSlot?.soundCheckTime) : 'TBC'}</div>
                                                    </div>
                                                    <div className='timeline-line'></div>
                                                </div>
                                                <div className='timeline-event'>
                                                    <div className='timeline-content'>
                                                        <p>Set Starts</p>
                                                        <div className='timeline-time orange'>{formatTime(currentSlot.startTime)}</div>
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
                                        <h4>{venueProfile?.name || gigData.venue.venueName}'s Tech Rider</h4>
                                        {renderTechRider()}
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
                                <div className="sticky-bottom">
                                    <div 
                                        className='action-box'
                                        onTouchStart={onTouchStart}
                                        onTouchMove={onTouchMove}
                                        onTouchEnd={onTouchEnd}
                                        style={{ overflow: 'hidden' }}
                                    >
                                        {allSlots.length > 1 && (
                                            <div className='slot-navigation' style={{ 
                                                display: 'flex', 
                                                alignItems: 'center', 
                                                justifyContent: 'space-between',
                                                padding: '1rem',
                                                borderBottom: '1px solid var(--gn-grey-300)',
                                                marginBottom: '1rem'
                                            }}>
                                                <button 
                                                    className='btn icon' 
                                                    onClick={goToPreviousSlot}
                                                    disabled={currentSlotIndex === 0 || isTransitioning}
                                                    style={{ opacity: currentSlotIndex === 0 ? 0.5 : 1 }}
                                                >
                                                    <LeftArrowIcon />
                                                </button>
                                                <h4 style={{ margin: 0, fontSize: '0.9rem', fontWeight: '600' }}>
                                                    Set {currentSlotIndex + 1} of {allSlots.length}
                                                </h4>
                                                <button 
                                                    className='btn icon' 
                                                    onClick={goToNextSlot}
                                                    disabled={currentSlotIndex === allSlots.length - 1 || isTransitioning}
                                                    style={{ opacity: currentSlotIndex === allSlots.length - 1 ? 0.5 : 1 }}
                                                >
                                                    <RightArrowIcon />
                                                </button>
                                            </div>
                                        )}
                                        <div 
                                            className='action-box-content'
                                            style={{
                                                transition: 'transform 0.4s cubic-bezier(0.4, 0, 0.2, 1), opacity 0.4s ease-in-out',
                                                transform: isTransitioning 
                                                    ? (transitionDirection === 'left' ? 'translateX(-50px)' : 'translateX(50px)')
                                                    : 'translateX(0)',
                                                opacity: isTransitioning ? 0.5 : 1
                                            }}
                                        >
                                            <div className='action-box-info'>
                                                <div className='action-box-budget'>
                                                    {currentSlot?.kind === 'Open Mic' || currentSlot?.kind === 'Ticketed Gig' ? (
                                                        <h2 className="gig-kind">
                                                            {currentSlot.kind}
                                                            {currentSlot.kind === 'Ticketed Gig' && (
                                                            <span
                                                                className="tooltip-wrapper"
                                                                data-tooltip="Ticket sales, administration, and any revenue split are to be agreed directly between you and the venue."
                                                            >
                                                                <MoreInformationIcon />
                                                            </span>
                                                            )}
                                                        </h2>
                                                    ) : (
                                                        <>
                                                            <h1>{currentSlot?.budget === '£' || currentSlot?.budget === '£0' ? 'No Fee' : currentSlot?.budget}</h1>
                                                            {currentSlot?.budget !== '£' && currentSlot?.budget !== '£0' && (
                                                                <p>gig fee</p>
                                                            )}
                                                        </>
                                                    )}
                                                </div>
                                                <div className='action-box-duration'>
                                                    <h4>{formatDuration(currentSlot?.duration)}</h4>
                                                </div>
                                            </div>
                                            <div className='action-box-date-and-time'>
                                                <div className='action-box-date'>
                                                    <h3>{formatDate(currentSlot?.startDateTime, 'withTime')}</h3>
                                                </div>
                                            </div>
                                        </div>
                                        {/* {(currentSlot?.kind !== 'Open Mic' && currentSlot?.kind !== 'Ticketed Gig' && !venueVisiting) && (
                                            <div className='action-box-fees'>
                                                <div className='action-box-service-fee'>
                                                <p>Service Fee</p>
                                                <p>£{calculateServiceFee(currentSlot.budget)}</p>
                                                </div>
                                                <div className='action-box-total-income'>
                                                <p>Total Income</p>
                                                <p>£{calculateTotalIncome(currentSlot.budget)}</p>
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
                                                {/* Tech Rider Mismatch Warning */}
                                                {selectedProfile && hasAccessToPrivateGig && (() => {
                                                    const mismatches = checkTechRiderMismatches();
                                                    if (mismatches.length > 0) {
                                                        return (
                                                            <div className="status-box tech-rider-warning">
                                                                <ErrorIcon />
                                                                <div>
                                                                    <h6>Equipment Mismatch</h6>
                                                                    <p>The venue may not have all the equipment you need:</p>
                                                                    <ul>
                                                                        {mismatches.map((mismatch, index) => (
                                                                            <li key={index}>{mismatch}</li>
                                                                        ))}
                                                                    </ul>
                                                                </div>
                                                            </div>
                                                        );
                                                    }
                                                    return null;
                                                })()}
                                                <div className='action-box-buttons'>
                                                    {isFutureOpen  ? (
                                                        applyingToGig ? (
                                                            <div className="applying-to-gig">
                                                                <LoadingSpinner width={20} height={20} />
                                                            </div>
                                                        ) : inviteInvalid ? (
                                                            // Invalid invite screen
                                                            <div className="private-applications">
                                                                <InviteIconSolid />
                                                                <h5>This gig is private and requires a valid invite link to apply.</h5>
                                                            </div>
                                                        ) : (
                                                            <>
                                                                {showApplied && hasAccessToPrivateGig ? (
                                                                    <button className='btn artist-profile disabled' disabled>Applied To Gig</button>
                                                                ) : accepted && hasAccessToPrivateGig ? (
                                                                    <button className='btn artist-profile disabled' disabled>Invitation Accepted</button>
                                                                ) : showAcceptInvite && hasAccessToPrivateGig && user && user.artistProfiles?.length > 0 && selectedProfile.isComplete ? (
                                                                        <button className='btn artist-profile' onClick={canBookCurrentArtistProfile ? handleAccept : undefined} disabled={!canBookCurrentArtistProfile}>
                                                                            Accept Invitation
                                                                        </button>
                                                                ) : showAcceptInvite && hasAccessToPrivateGig ? (
                                                                        <button 
                                                                            className="btn artist-profile" 
                                                                            onClick={() => {
                                                                                if (!user) {
                                                                                    sessionStorage.setItem('redirect', `/artist-profile`);
                                                                                    setAuthModal(true);
                                                                                    setAuthType('signup');
                                                                                } else {
                                                                                    sessionStorage.setItem('redirect', `/gig/${gigId}?inviteId=${inviteId}`);
                                                                                    navigate(`/artist-profile`);
                                                                                }
                                                                            }}
                                                                        >
                                                                            Create Artist Profile to Accept Invitation
                                                                        </button>
                                                                ) : showApply && hasAccessToPrivateGig && user && user.artistProfiles?.length > 0 && !selectedProfile.isComplete ? (
                                                                        <button className='btn artist-profile' onClick={() => navigate(`/artist-profile`)}>
                                                                            Complete Artist Profile to Apply
                                                                        </button>
                                                                ) : showApply && hasAccessToPrivateGig ? (
                                                                        <button className='btn artist-profile' onClick={canBookCurrentArtistProfile ? handleGigApplication : undefined} disabled={!canBookCurrentArtistProfile}>
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
                                                                    {showNegotiate && !kindBlocksNegotiate && hasAccessToPrivateGig && user && user.artistProfiles?.length > 0 && selectedProfile.isComplete && (
                                                                        <button
                                                                            className={`btn secondary ${!canBookCurrentArtistProfile ? 'disabled' : ''}`}
                                                                            onClick={canBookCurrentArtistProfile ? handleNegotiateButtonClick : undefined}
                                                                            disabled={!canBookCurrentArtistProfile}
                                                                        >
                                                                            Negotiate
                                                                        </button>
                                                                    )}

                                                                    {/* Message */}
                                                                    {showMessage && hasAccessToPrivateGig && user && user.artistProfiles?.length > 0 && selectedProfile.isComplete && (
                                                                    <button
                                                                        className={`btn secondary ${!canBookCurrentArtistProfile ? 'disabled' : ''}`}
                                                                        onClick={canBookCurrentArtistProfile ? handleMessage : undefined}
                                                                        disabled={!canBookCurrentArtistProfile}
                                                                    >
                                                                        Message
                                                                    </button>
                                                                    )}
                                                                </div>

                                                                {/* Expired invite notice */}
                                                                {inviteExpired && hasAccessToPrivateGig && (
                                                                    <div className="status-box permissions" style={{ marginTop: '1rem' }}>
                                                                        <WarningIcon />
                                                                        <p>This invite has expired.</p>
                                                                    </div>
                                                                )}

                                                                {/* Private notice (only if private AND no invite) */}
                                                                {isPrivate && !hasAccessToPrivateGig && !inviteInvalid && (
                                                                    <div className="private-applications">
                                                                    <InviteIconSolid />
                                                                    <h5>This gig is for private applications only. You must have the private application link to apply.</h5>
                                                                    </div>
                                                                )}

                                                                {/* Tech Rider Mismatch Warning */}
                                                                {selectedProfile && hasAccessToPrivateGig && (() => {
                                                                    const mismatches = checkTechRiderMismatches();
                                                                    if (mismatches.length > 0) {
                                                                        return (
                                                                            <div className="tech-rider-warning">
                                                                                <WarningIcon />
                                                                                <p>{formatTechRiderWarningText(mismatches)}</p>
                                                                            </div>
                                                                        );
                                                                    }
                                                                    return null;
                                                                })()}
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