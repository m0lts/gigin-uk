import { useEffect, useState, useRef, useMemo } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { Header as MusicianHeader } from '@features/artist/components/Header';
import { Header as VenueHeader } from '@features/venue/components/Header';
import { Header as CommonHeader } from '@features/shared/components/Header';
import '@styles/host/venue-page.styles.css';
import { 
    ClubIcon,
    FacebookIcon,
    GuitarsIcon,
    InstagramIcon,
    MicrophoneIcon,
    SpeakersIcon,
    TwitterIcon,
    PermissionsIcon,
    MapIcon } from '@features/shared/ui/extras/Icons';
import Skeleton from 'react-loading-skeleton';
import 'react-loading-skeleton/dist/skeleton.css';
import { getVenueProfileById } from '@services/client-side/venues';
import { getGigsByVenueId } from '../../../services/client-side/gigs';
import { getReviewsByVenueId } from '../../../services/client-side/reviews';
import { useMapbox } from '@hooks/useMapbox';
import 'mapbox-gl/dist/mapbox-gl.css';
import { getMusicianProfilesByIds, getArtistProfileMembers } from '../../../services/client-side/artists';
import { toast } from 'sonner';
import { AmpIcon, BassIcon, LinkIcon, MonitorIcon, NewTabIcon, PianoIcon, PlugIcon, RequestIcon, SpeakerIcon, VerifiedIcon, TechRiderIcon, SaveIcon, SavedIcon, ShareIcon, EditIcon, MoreInformationIcon, InvoiceIcon } from '../../shared/ui/extras/Icons';
import { TechRiderEquipmentCard } from '../../shared/ui/tech-rider/TechRiderEquipmentCard';
import { VenueGigsList } from './VenueGigsList';
import { MapSection } from './MapSection';
import { ensureProtocol } from '../../../services/utils/misc';
import Portal from '../../shared/components/Portal';
import { LoadingModal } from '../../shared/ui/loading/LoadingModal';
import { toJsDate } from '../../../services/utils/dates';
import { useBreakpoint } from '../../../hooks/useBreakpoint';
import { sanitizeArtistPermissions } from '../../../services/utils/permissions';
import { createVenueRequest } from '@services/api/artists';
import { updateUserArrayField } from '@services/api/users';
import { LoadingScreen } from '../../shared/ui/loading/LoadingScreen';
import { LoadingSpinner } from '../../shared/ui/loading/Loading';

export const VenuePage = ({ user, setAuthModal, setAuthType }) => {
    const { venueId } = useParams();
    const { isMdUp, isSmUp } = useBreakpoint();
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const musicianId = searchParams.get('musicianId');
    const venueViewing = searchParams.get('venueViewing');
    const [venueData, setVenueData] = useState(null);
    const [venueGigs, setVenueGigs] = useState([]);
    const [loading, setLoading] = useState(true);
    const mapContainerRef = useRef(null);
    const [fullscreenImage, setFullscreenImage] = useState(null);
    const [currentImageIndex, setCurrentImageIndex] = useState(0);
    const [showRequestModal, setShowRequestModal] = useState(false);
    const [requestMessage, setRequestMessage] = useState('');
    const [confirmedGigs, setConfirmedGigs] = useState([]);
    const [expanded, setExpanded] = useState(false);
    const [loadingRequest, setLoadingRequest] = useState(false);
    const [musicianProfiles, setMusicianProfiles] = useState([]);
    const [selectedProfile, setSelectedProfile] = useState(null);
    const [canRequestGigForSelectedProfile, setCanRequestGigForSelectedProfile] = useState(true);
    const [checkingRequestPerms, setCheckingRequestPerms] = useState(false);
    const [selectedAdditionalInfo, setSelectedAdditionalInfo] = useState(null); // 'location', 'equipment', 'website-socials'
    const [activeContentTab, setActiveContentTab] = useState(null); // 'tech-rider', 'venue-info', null (for gigs)
    const [venueReviews, setVenueReviews] = useState([]);
    const [loadingReviews, setLoadingReviews] = useState(false);
    const [venueSaved, setVenueSaved] = useState(false);
    const [savingVenue, setSavingVenue] = useState(false);

    useEffect(() => {
        if (!venueId) return;
        const fetchVenueAndGigs = async () => {
          setLoading(true);
          try {
            const profile = await getVenueProfileById(venueId);
            setVenueData(profile);
            const gigs = await getGigsByVenueId(venueId);
            const now = new Date();
            const normalized = gigs.map(g => {
              const dt = toJsDate(g.startDateTime);
              return {
                ...g,
                startDateTimeDate: dt,
                startDateTimeMs: dt ? dt.getTime() : Number.NaN,
              };
            });
            const futureGigs = normalized
              .filter(gig => gig.startDateTimeDate && gig.startDateTimeDate > now && gig.status !== 'closed')
              .sort((a, b) => a.startDateTimeMs - b.startDateTimeMs);
            
            // Filter out private gigs unless artist is invited
            const artistProfileIds = user?.artistProfiles?.map(profile => profile.id || profile.profileId).filter(Boolean) || [];
            const filteredGigs = futureGigs.filter(gig => {
              // If gig is not private, show it
              if (!gig.private) return true;
              
              // If gig is private and user is not logged in, hide it
              if (!user || !artistProfileIds.length) return false;
              
              // If gig is private, check if artist is in applicants array with invited: true
              const applicants = Array.isArray(gig.applicants) ? gig.applicants : [];
              const isInvited = applicants.some(applicant => 
                applicant?.id && 
                artistProfileIds.includes(applicant.id) &&
                applicant?.invited === true
              );
              
              // Only show private gigs if artist is invited
              return isInvited;
            });
            
            setVenueGigs(filteredGigs);
            const confirmed = filteredGigs.filter(gig =>
              Array.isArray(gig.applicants) && gig.applicants.some(a => a.status === 'confirmed')
            );
            setConfirmedGigs(confirmed);
          } catch (error) {
            console.error('Error loading venue profile or gigs:', error);
          } finally {
            setLoading(false);
          }
        };
        fetchVenueAndGigs();
      }, [venueId, user]);

    // Group gigs by their gigSlots relationship (same logic as venue dashboard and gig discovery)
    const groupedGigs = useMemo(() => {
      const processed = new Set();
      const groups = [];
      
      venueGigs.forEach(gig => {
        if (processed.has(gig.gigId)) return;
        
        // Check if this gig has gigSlots (is part of a multi-slot group)
        const hasSlots = Array.isArray(gig.gigSlots) && gig.gigSlots.length > 0;
        
        if (hasSlots) {
          // Build the complete group by collecting all related gigs
          const groupGigs = [gig];
          const groupIds = new Set([gig.gigId]);
          processed.add(gig.gigId);
          
          // Use a queue to find all related gigs
          const queue = [...gig.gigSlots];
          
          while (queue.length > 0) {
            const slotId = queue.shift();
            if (processed.has(slotId)) continue;
            
            const slotGig = venueGigs.find(g => g.gigId === slotId);
            if (slotGig) {
              groupGigs.push(slotGig);
              groupIds.add(slotId);
              processed.add(slotId);
              
              // Add any slots from this gig that we haven't seen yet
              if (Array.isArray(slotGig.gigSlots)) {
                slotGig.gigSlots.forEach(id => {
                  if (!groupIds.has(id) && !processed.has(id)) {
                    queue.push(id);
                  }
                });
              }
            }
          }
          
          // Sort by startDateTime to get the first slot
          groupGigs.sort((a, b) => {
            const aDate = toJsDate(a.startDateTime);
            const bDate = toJsDate(b.startDateTime);
            if (!aDate || !bDate) return 0;
            return aDate.getTime() - bDate.getTime();
          });
          
          groups.push({
            isGroup: true,
            primaryGig: groupGigs[0],
            allGigs: groupGigs,
            gigIds: Array.from(groupIds)
          });
        } else {
          // Standalone gig
          groups.push({
            isGroup: false,
            primaryGig: gig,
            allGigs: [gig],
            gigIds: [gig.gigId]
          });
          processed.add(gig.gigId);
        }
      });
      
      return groups;
    }, [venueGigs]);

    // Extract only primary gigs for display
    const primaryGigsForDisplay = useMemo(() => {
      return groupedGigs.map(group => group.primaryGig);
    }, [groupedGigs]);
    useEffect(() => {
        if (!venueViewing) return;
        const hasArtistProfiles = Array.isArray(user?.artistProfiles) && user.artistProfiles.length > 0;
        const isMusician = !!user?.musicianProfile?.id || hasArtistProfiles;
        const shouldHideVenueView = !user || isMusician;
        if (!shouldHideVenueView) return;

        const params = new URLSearchParams(searchParams);
        params.delete('venueViewing');

        if (isMusician) {
          const primaryArtistId = hasArtistProfiles ? user.artistProfiles[0].id : null;
          const idForParam = user?.musicianProfile?.id || primaryArtistId;
          if (idForParam) {
            params.set('musicianId', idForParam);
          }
        } else {
          params.delete('musicianId');
        }

        navigate(
          {
            pathname: `/venues/${venueId}`,
            search: params.toString() ? `?${params.toString()}` : '',
          },
          { replace: true }
        );
      }, [venueViewing, user, searchParams, venueId, navigate]);


    // Extract coordinates from venueData, handling various formats
    // Mapbox expects [lng, lat] format
    const mapCoordinates = useMemo(() => {
        if (venueData?.coordinates && Array.isArray(venueData.coordinates) && venueData.coordinates.length === 2) {
            // venueData.coordinates should already be [lng, lat]
            const [lng, lat] = venueData.coordinates;
            if (typeof lng === 'number' && typeof lat === 'number' && !isNaN(lng) && !isNaN(lat)) {
                return [lng, lat];
            }
        }
        // Fallback to venueData.geopoint if it exists
        if (venueData?.geopoint) {
            const lat = venueData.geopoint._lat || venueData.geopoint.latitude;
            const lng = venueData.geopoint._long || venueData.geopoint.longitude;
            if (typeof lat === 'number' && typeof lng === 'number' && !isNaN(lat) && !isNaN(lng)) {
                return [lng, lat]; // Mapbox expects [lng, lat]
            }
        }
        return null;
    }, [venueData?.coordinates, venueData?.geopoint]);

    useMapbox({
        containerRef: mapContainerRef,
        coordinates: mapCoordinates,
        shouldInit: !!mapCoordinates,
    });
    

    const closeFullscreen = () => {
        setFullscreenImage(null);
    };

    const renderTechRider = () => {
        if (!venueData?.techRider) {
            return <p>The venue has not listed any tech rider information.</p>;
        }

        const { soundSystem, backline, houseRules } = venueData.techRider;
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
                <div className="tech-rider-grid">
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

    const showNextImage = (e) => {
        e.stopPropagation();
        setCurrentImageIndex((prevIndex) => (prevIndex + 1) % venueData.photos.length);
        setFullscreenImage(venueData.photos[(currentImageIndex + 1) % venueData.photos.length]);
    };

    const showPrevImage = (e) => {
        e.stopPropagation();
        setCurrentImageIndex((prevIndex) => (prevIndex - 1 + venueData.photos.length) % venueData.photos.length);
        setFullscreenImage(venueData.photos[(currentImageIndex - 1 + venueData.photos.length) % venueData.photos.length]);
    };

    const handleMusicianRequest = async () => {
        try {
            setLoadingRequest(true);
          const profile = selectedProfile;
          if (!profile) throw new Error('Musician profile not found');

          // Front-end guard: ensure we already determined this member can request gigs
          if (!canRequestGigForSelectedProfile) {
            toast.error('You do not have permission to request gigs on behalf of this artist profile.');
            setLoadingRequest(false);
            return;
          }

          await createVenueRequest({
            venueId: venueData.id,
            musicianId: profile.musicianId,
            musicianName: profile.name,
            musicianImage: profile.picture || '',
            musicianGenres: profile.genres || [],
            musicianType: profile.musicianType || null,
            musicianPlays: profile.musicType || null,
            message: requestMessage,
            createdAt: new Date(),
            viewed: false,
          });
          toast.success('Request sent to venue!');
          setRequestMessage('');
          setShowRequestModal(false);
        } catch (err) {
          console.error('Error sending request:', err);
          toast.error('Failed to send request. Please try again.');
        } finally {
            setLoadingRequest(false);
        }
    };

    const copyToClipboard = (venueId) => {
        navigator.clipboard.writeText(`https://giginmusic.com/venues/${venueId}`).then(() => {
            toast.success('Link copied to clipboard');
        }).catch((err) => {
            toast.error('Failed to copy link. Please try again.')
            console.error('Failed to copy link: ', err);
        });
    };
    
    const openGoogleMaps = (address, coordinates) => {
        const baseUrl = 'https://www.google.com/maps/dir/?api=1';
        const queryParams = coordinates 
            ? `&destination=${coordinates[1]},${coordinates[0]}`
            : `&destination=${encodeURIComponent(address)}`;
        window.open(baseUrl + queryParams, '_blank');
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

    const handleFetchMusicianProfiles = async () => {
        try {
            if (!user) return;

            // Prefer new artistProfiles structure if present
            const artistProfiles = Array.isArray(user.artistProfiles) ? user.artistProfiles : [];
            if (artistProfiles.length > 0) {
                const normalized = artistProfiles.map((p) => ({
                    id: p.id,
                    musicianId: p.id,
                    name: p.name,
                    picture: p.heroMedia?.url || '',
                    genres: p.genres || [],
                    musicianType: p.artistType || 'Musician/Band',
                    musicType: p.genres || [],
                    bandProfile: false,
                    userId: p.userId,
                }));
                setMusicianProfiles(normalized);

                const paramId = musicianId;
                if (paramId) {
                    const match = normalized.find(
                        (profile) => profile.id === paramId || profile.musicianId === paramId
                    );
                    setSelectedProfile(match || normalized[0] || null);
                } else {
                    setSelectedProfile(normalized[0] || null);
                }
                setLoadingRequest(false);
                return;
            }

            // Legacy musicianProfile / bands flow
            if (user?.bands && user.bands.length > 0 && musicianId) {
                const allIds = [...user.bands, musicianId];
                const profiles = await getMusicianProfilesByIds(allIds);
                setMusicianProfiles(profiles);
                setLoadingRequest(false);
            } else {
                setSelectedProfile(user?.musicianProfile || null);
                setLoadingRequest(false);
            }
        } catch (error) {
            console.error(error);
            toast.error('Failed to request a gig.');
        }
    }

    // When the selected profile changes, check whether the current user
    // has gigs.book permission for that artist profile (if applicable).
    useEffect(() => {
        let cancelled = false;
        const run = async () => {
            const profile = selectedProfile;
            if (!user?.uid || !profile) {
                if (!cancelled) setCanRequestGigForSelectedProfile(true);
                return;
            }

            const artistProfiles = Array.isArray(user.artistProfiles) ? user.artistProfiles : [];
            const isArtistProfile = artistProfiles.some((p) => p.id === profile.musicianId);
            if (!isArtistProfile) {
                if (!cancelled) setCanRequestGigForSelectedProfile(true);
                return;
            }

            try {
                if (!cancelled) setCheckingRequestPerms(true);
                const members = await getArtistProfileMembers(profile.musicianId);
                if (cancelled) return;
                const me = members.find(
                    (m) => m.id === user.uid && (m.status || 'active') === 'active'
                );
                const perms = sanitizeArtistPermissions(me?.permissions || {});
                if (!cancelled) setCanRequestGigForSelectedProfile(!!perms['gigs.book']);
            } catch (e) {
                console.error('Failed to load artist permissions for venue request:', e);
                if (!cancelled) setCanRequestGigForSelectedProfile(false);
            } finally {
                if (!cancelled) setCheckingRequestPerms(false);
            }
        };

        run();
        return () => {
            cancelled = true;
        };
    }, [selectedProfile, user?.uid, user?.artistProfiles]);

    // Check if venue is saved
    useEffect(() => {
        if (!user || !venueId) {
            setVenueSaved(false);
            return;
        }
        const saved = Array.isArray(user?.savedVenues)
            ? user.savedVenues.includes(venueId)
            : false;
        setVenueSaved(saved);
    }, [user?.savedVenues, venueId]);

    // Fetch reviews when venue info tab is active
    useEffect(() => {
        if (activeContentTab === 'venue-info' && venueId && !venueReviews.length && !loadingReviews) {
            const fetchReviews = async () => {
                setLoadingReviews(true);
                try {
                    const reviews = await getReviewsByVenueId(venueId);
                    setVenueReviews(reviews || []);
                } catch (error) {
                    console.error('Error fetching reviews:', error);
                } finally {
                    setLoadingReviews(false);
                }
            };
            fetchReviews();
        }
    }, [activeContentTab, venueId]);

    const rawOff = venueData?.primaryImageOffsetY;
    let percentFromTop;
    if (rawOff == null) {
    percentFromTop = 50; // sensible default: center
    } else {
    const n = parseFloat(rawOff);
    if (Number.isFinite(n)) {
        // Legacy negative/[-50..0]: map to [0..50] via 50 + n
        percentFromTop = n <= 0 ? Math.max(0, Math.min(100, 50 + n))
                                : Math.max(0, Math.min(100, n));
    } else {
        percentFromTop = 50;
    }
    }

    // Calculate blur value from venueData
    const blurValue = venueData?.primaryImageBlur != null 
        ? Math.max(0, Math.min(20, parseFloat(venueData.primaryImageBlur) || 0))
        : 0;

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

    const checkRequestModal = () => {
        if (musicianId) {
            setLoadingRequest(true);
            setShowRequestModal(true);
            handleFetchMusicianProfiles();
        } else if (!musicianId && user) {
            const musicianProfile = user?.musicianProfile;
            const venueProfile = user?.venueProfiles?.[0];
            const isVenueOwner = venueId === venueProfile?.venueId;
            const hasArtistProfiles = Array.isArray(user.artistProfiles) && user.artistProfiles.length > 0;
            const hasAnyMusicProfile = !!musicianProfile || hasArtistProfiles;

            if (hasAnyMusicProfile) {
                const isMusician = hasAnyMusicProfile;
                const shouldHideVenueView = !user || isMusician;
                if (!shouldHideVenueView) return;

                const params = new URLSearchParams(searchParams);
                params.delete('venueViewing');
                const primaryArtistId = hasArtistProfiles ? user.artistProfiles[0].id : null;
                const idForParam = musicianProfile?.id || primaryArtistId;
                if (idForParam) {
                    params.set('musicianId', idForParam);
                } else {
                    params.delete('musicianId');
                }

                navigate(
                    {
                      pathname: `/venues/${venueId}`,
                      search: params.toString() ? `?${params.toString()}` : '',
                    },
                    { replace: true }
                );
                setLoadingRequest(true);
                setShowRequestModal(true);
                handleFetchMusicianProfiles();
            } else if (venueProfile && isVenueOwner) {
                const params = new URLSearchParams(searchParams);
                params.set('venueViewing', true);
                navigate(
                    {
                      pathname: `/venues/${venueId}`,
                      search: params.toString() ? `?${params.toString()}` : '',
                    },
                    { replace: true }
                );
                return;
            } else {
                toast.info('You are signed in as a venue owner. Please sign in as a musician to request a gig.');
                return;
            }
        } else if (!user) {
            sessionStorage.setItem('redirect', `venues/${venueId}`);
            setAuthModal(true);
            setAuthType('login');
            return;
        } else {
            return;
        }
        }

    // Get the primary photo URL
    const primaryPhotoUrl = venueData?.photos?.[0];

    return (
        <div className='venue-page'>
            {!user ? (
                <CommonHeader
                    setAuthModal={setAuthModal}
                    setAuthType={setAuthType}
                    user={user}
                />
            ) : user?.venueProfiles?.length > 0 && (!user.artistProfiles?.length) ? (
                <VenueHeader
                    user={user}
                    setAuthModal={setAuthModal}
                    setAuthType={setAuthType}
                />
            ) : (
                <MusicianHeader
                    user={user}
                    setAuthModal={setAuthModal}
                    setAuthType={setAuthType}
                />
            )}
            <section className='venue-page-body'>
                {loading ? (
                    <LoadingScreen />
                ) : (
                    isMdUp ? (
                        <>
                            {/* Background wrapper with image */}
                            {primaryPhotoUrl && (
                                <div className="venue-profile-background-wrapper">
                                    <div
                                        className="venue-profile-background image-layer"
                                        style={{
                                            backgroundImage: `url("${primaryPhotoUrl}")`,
                                            backgroundPosition: `center ${50 - percentFromTop}%`,
                                            filter: blurValue > 0 ? `blur(${blurValue}px)` : 'none',
                                        }}
                                    />
                                </div>
                            )}

                            {/* Content overlay */}
                            <div className="venue-profile-content">
                                {/* Centered stack at bottom */}
                                <div className="venue-profile-stack">
                                    {/* Venue name */}
                                    <h1 className="venue-name-text">
                                        {venueData?.name}
                                    </h1>

                                    {/* Venue address - clickable */}
                                    {venueData?.address && (
                                        <button 
                                            className="venue-address-text"
                                            onClick={() => setActiveContentTab(activeContentTab === 'location' ? null : 'location')}
                                        >
                                            {venueData.address}
                                        </button>
                                    )}

                                    {/* Venue bio */}
                                    {venueData?.description && (
                                        <p className="venue-bio-text">
                                            {venueData.description}
                                        </p>
                                    )}

                                    {/* Action buttons row */}
                                    <div className="venue-action-buttons-row">
                                        <button 
                                            className={`btn secondary venue-action-btn ${activeContentTab === 'tech-rider' ? 'active' : ''}`}
                                            onClick={() => setActiveContentTab(activeContentTab === 'tech-rider' ? null : 'tech-rider')}
                                        >
                                            <TechRiderIcon />
                                            Tech Rider
                                        </button>
                                        {!venueViewing ? (
                                            <>
                                                <button 
                                                    className={`btn secondary venue-action-btn ${venueSaved ? 'saved' : ''}`}
                                                    onClick={async () => {
                                                        if (!user) {
                                                            sessionStorage.setItem('redirect', `venues/${venueId}`);
                                                            setAuthModal(true);
                                                            setAuthType('login');
                                                            return;
                                                        }
                                                        if (savingVenue) return;
                                                        try {
                                                            setSavingVenue(true);
                                                            const field = 'savedVenues';
                                                            const op = venueSaved ? 'remove' : 'add';
                                                            await updateUserArrayField({ field, op, value: venueId });
                                                            setVenueSaved(!venueSaved);
                                                            toast.success(venueSaved ? 'Venue removed from saved.' : 'Venue saved.');
                                                        } catch (err) {
                                                            console.error('Error toggling saved venue:', err);
                                                            toast.error('Failed to update saved venue. Please try again.');
                                                        } finally {
                                                            setSavingVenue(false);
                                                        }
                                                    }}
                                                    disabled={savingVenue}
                                                >
                                                    {venueSaved ? <SavedIcon /> : <SaveIcon />}
                                                    {venueSaved ? 'Saved' : 'Save Venue'}
                                                </button>
                                                <button className="btn secondary venue-action-btn" onClick={() => checkRequestModal()}>
                                                    <RequestIcon />
                                                    Request a Gig
                                                </button>
                                            </>
                                        ) : (
                                            <>
                                                <button className="btn secondary venue-action-btn" onClick={() => copyToClipboard(venueData.venueId)}>
                                                    <ShareIcon />
                                                    Share Venue
                                                </button>
                                                <button className="btn secondary venue-action-btn" onClick={() => navigate(`/venues/add-venue`, {state: { venue: venueData }})}>
                                                    <EditIcon />
                                                    Edit Venue
                                                </button>
                                            </>
                                        )}
                                        <button 
                                            className={`btn secondary venue-action-btn ${activeContentTab === 'venue-info' ? 'active' : ''}`}
                                            onClick={() => setActiveContentTab(activeContentTab === 'venue-info' ? null : 'venue-info')}
                                        >
                                            <MoreInformationIcon />
                                            Venue Info
                                        </button>
                                    </div>

                                    {/* Content Box - Changes based on active tab */}
                                    {activeContentTab === 'tech-rider' && (
                                        <div className="venue-content-section">
                                            {renderTechRider()}
                                        </div>
                                    )}
                                    {activeContentTab === 'location' && (
                                        <div className="venue-content-section">
                                            <div className="location-content">
                                                <div className="location-map-container">
                                                    <MapSection venueData={venueData} />
                                                </div>
                                                <div className="location-actions">
                                                    <button 
                                                        className="btn secondary"
                                                        onClick={() => openGoogleMaps(venueData.address, venueData.coordinates)}
                                                    >
                                                        Google Maps
                                                    </button>
                                                    <button 
                                                        className="btn secondary"
                                                        onClick={() => {
                                                            navigator.clipboard.writeText(venueData.address).then(() => {
                                                                toast.success('Address copied to clipboard');
                                                            }).catch((err) => {
                                                                toast.error('Failed to copy address');
                                                                console.error('Failed to copy address: ', err);
                                                            });
                                                        }}
                                                    >
                                                        Copy Address
                                                    </button>
                                                </div>
                                            </div>
                                        </div>
                                    )}
                                    {activeContentTab === 'venue-info' && (
                                        <div className="venue-content-section">
                                            <div className="venue-info-content">
                                                {/* Venue Type */}
                                                {venueData?.type && (
                                                    <div className="venue-info-item">
                                                        <h6>Venue Type</h6>
                                                        <p className="venue-info-value">{venueData.type}</p>
                                                    </div>
                                                )}

                                                {/* Establishment */}
                                                {venueData?.establishment && (
                                                    <div className="venue-info-item">
                                                        <h6>Establishment</h6>
                                                        <p className="venue-info-value">{venueData.establishment}</p>
                                                    </div>
                                                )}

                                                {/* Reviews */}
                                                <div className="venue-info-item">
                                                    <h6>Reviews</h6>
                                                    {venueData?.avgReviews?.totalReviews > 0 ? (
                                                        <div className="reviews-section">
                                                            <p className="venue-info-value">
                                                                {venueData.avgReviews.positive > 0 && (
                                                                    `${venueData.avgReviews.positive} positive review${venueData.avgReviews.positive !== 1 ? 's' : ''}`
                                                                )}
                                                            </p>
                                                            {loadingReviews ? (
                                                                <LoadingSpinner width={15} height={15} marginTop={0} marginBottom={0}  />
                                                            ) : venueReviews.length > 0 ? (
                                                                <div className="reviews-list">
                                                                    {venueReviews.map((review) => (
                                                                        review.reviewText ? (
                                                                            <div key={review.id} className="review-item">
                                                                                {review.reviewText && (
                                                                                    <p className="review-text">{review.reviewText}</p>
                                                                                )}
                                                                            </div>
                                                                        )
                                                                        : null
                                                                    ))}
                                                                </div>
                                                            ) : (
                                                                <p className="no-reviews">No reviews yet</p>
                                                            )}
                                                        </div>
                                                    ) : (
                                                        <p className="venue-info-value">No reviews yet</p>
                                                    )}
                                                </div>

                                                {/* Extra Information */}
                                                {venueData?.extraInformation && (
                                                    <div className="venue-info-item">
                                                        <h6>Additional Information</h6>
                                                        <p className="venue-info-value">{venueData.extraInformation}</p>
                                                    </div>
                                                )}

                                                {/* Social Media Links */}
                                                {(venueData?.socialMedia?.facebook || venueData?.socialMedia?.instagram || venueData?.socialMedia?.twitter) && (
                                                    <div className="venue-info-item">
                                                        <h6>Social Media</h6>
                                                        <div className="social-media-links">
                                                            {venueData.socialMedia.facebook && (
                                                                <a 
                                                                    href={ensureProtocol(venueData.socialMedia.facebook)} 
                                                                    target='_blank' 
                                                                    rel='noreferrer'
                                                                    className="social-link"
                                                                >
                                                                    <FacebookIcon />
                                                                    <span>Facebook</span>
                                                                </a>
                                                            )}
                                                            {venueData.socialMedia.instagram && (
                                                                <a 
                                                                    href={ensureProtocol(venueData.socialMedia.instagram)} 
                                                                    target='_blank' 
                                                                    rel='noreferrer'
                                                                    className="social-link"
                                                                >
                                                                    <InstagramIcon />
                                                                    <span>Instagram</span>
                                                                </a>
                                                            )}
                                                            {venueData.socialMedia.twitter && (
                                                                <a 
                                                                    href={ensureProtocol(venueData.socialMedia.twitter)} 
                                                                    target='_blank' 
                                                                    rel='noreferrer'
                                                                    className="social-link"
                                                                >
                                                                    <TwitterIcon />
                                                                    <span>Twitter</span>
                                                                </a>
                                                            )}
                                                        </div>
                                                    </div>
                                                )}

                                                {/* Terms and Conditions Document */}
                                                {venueData?.termsAndConditions && (
                                                    <div className="venue-info-item">
                                                        <h6>Terms and Conditions</h6>
                                                        <a 
                                                            href={venueData.termsAndConditions} 
                                                            target='_blank' 
                                                            rel='noreferrer'
                                                            className="btn secondary"
                                                            style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', marginTop: '0.5rem', textDecoration: 'none' }}
                                                        >
                                                            <InvoiceIcon />
                                                            <span>View Document</span>
                                                        </a>
                                                    </div>
                                                )}

                                                {/* PRS Document */}
                                                {venueData?.prs && (
                                                    <div className="venue-info-item">
                                                        <h6>PRS</h6>
                                                        <a 
                                                            href={venueData.prs} 
                                                            target='_blank' 
                                                            rel='noreferrer'
                                                            className="btn secondary"
                                                            style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', marginTop: '0.5rem', textDecoration: 'none' }}
                                                        >
                                                            <InvoiceIcon />
                                                            <span>View Document</span>
                                                        </a>
                                                    </div>
                                                )}

                                                {/* Other Documents */}
                                                {venueData?.otherDocuments && (
                                                    <div className="venue-info-item">
                                                        <h6>Other Documents</h6>
                                                        <a 
                                                            href={venueData.otherDocuments} 
                                                            target='_blank' 
                                                            rel='noreferrer'
                                                            className="btn secondary"
                                                            style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', marginTop: '0.5rem', textDecoration: 'none' }}
                                                        >
                                                            <InvoiceIcon />
                                                            <span>View Document</span>
                                                        </a>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    )}
                                    {!activeContentTab && venueGigs && venueGigs.length > 0 && (
                                        <div className="venue-gigs-section">
                                            <VenueGigsList title={'Gig Vacancies'} gigs={primaryGigsForDisplay} groupedGigs={groupedGigs} isVenue={venueViewing} musicianId={musicianId} venueId={venueId} />
                                        </div>
                                    )}
                                </div>
                            </div>
                        </>
                    ) : (
                        <>
                            <div className='venue-page-hero'>
                                <ImageCarousel
                                    photos={venueData?.photos}
                                    altBase={venueData?.name}
                                />
                            </div>
                            <div className="venue-page-information">
                                <div className="section">
                                    <div className={`highlights ${!venueData?.verified && 'single'}`}>
                                        {venueData?.verified && (
                                            <div className="verified-tag">
                                                <VerifiedIcon />
                                                <h4>Verified Venue</h4>
                                            </div>
                                        )}
                                        <h4 className="number-of-gigs">
                                            {venueData?.gigs?.length} Gigs Posted
                                        </h4>
                                    </div>
                                    <h1 className="venue-name">
                                        {venueData?.name}
                                        <span className='orange-dot'>.</span>
                                    </h1>
                                    {(musicianId && !venueViewing) ? (
                                        <div className="action-buttons">
                                            <button className="btn secondary" onClick={() => {setLoadingRequest(true); setShowRequestModal(true); handleFetchMusicianProfiles()}}>
                                                Request a Gig
                                            </button>
                                        </div>
                                    ) : venueViewing && (
                                        <div className="action-buttons">
                                            <button className="btn secondary" onClick={() => navigate(`/venues/add-venue`, {state: { venue: venueData }})}>
                                                Edit Profile
                                            </button>
                                            <button className="btn secondary" onClick={() => copyToClipboard(venueData.venueId)}>
                                                Share
                                            </button>
                                        </div>
                                    )}
                                </div>
                                <div className="section venue-page-gigs">
                                    <VenueGigsList title={'Gig Vacancies'} gigs={primaryGigsForDisplay} groupedGigs={groupedGigs} isVenue={venueViewing} musicianId={musicianId} venueId={venueId} />
                                </div>
                                {venueData?.description && (
                                    <div className="section">
                                        <h4 className='subtitle'>Bio</h4>
                                        <p>{venueData?.description}</p>
                                    </div>
                                )}
                                <div className="section location">
                                    <h4 className='subtitle'>Location</h4>
                                    <MapSection venueData={venueData} />
                                    <h5>{venueData?.address}</h5>
                                    <button className="btn tertiary" onClick={() => openGoogleMaps(venueData.address, venueData.coordinates)}>
                                        Get Directions <NewTabIcon />
                                    </button>
                                </div>
                                {venueData.equipment.length > 0 && (
                                    <div className="section equipment">
                                        <h4>Equipment at {venueData.name}</h4>
                                        <div className="equipment-list">
                                            {venueData.type === 'Public Establishment' && (
                                                venueData.equipment.map((e) => (
                                                    <span className="equipment-item" key={e}>
                                                        {formatEquipmentIcon(e)}
                                                        {e}
                                                    </span>
                                                ))
                                            )}
                                        </div>
                                    </div>
                                )}
                                {venueData?.website && (
                                    <div className="section">
                                        <h4 className='subtitle'>Website</h4>
                                        <a
                                            href={venueData.website.startsWith('http') ? venueData.website : `https://${venueData.website}`}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                        >
                                            <p>{venueData.website}</p>
                                        </a>
                                    </div>
                                )}
                                {(venueData?.socialMedia?.facebook !== '' || venueData?.socialMedia?.facebook !== '' || venueData?.socialMedia?.facebook !== '') && (
                                    <div className="section">
                                        <h4 className='subtitle'>Socials</h4>
                                        <div className="socials-buttons">
                                            {venueData?.socialMedia?.facebook && (
                                                <a href={ensureProtocol(venueData.socialMedia.facebook)} target='_blank' rel='noreferrer'>
                                                    <FacebookIcon />
                                                </a>
                                            )}
                                            {venueData?.socialMedia?.instagram && (
                                                <a href={ensureProtocol(venueData.socialMedia.instagram)} target='_blank' rel='noreferrer'>
                                                    <InstagramIcon />
                                                </a>
                                            )}
                                            {venueData?.socialMedia?.twitter && (
                                                <a href={ensureProtocol(venueData.socialMedia.twitter)} target='_blank' rel='noreferrer'>
                                                    <TwitterIcon />
                                                </a>
                                            )}
                                        </div>
                                    </div>
                                )}
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
            {showRequestModal && (
                loadingRequest ? (
                    <Portal>
                        <LoadingModal />
                    </Portal>
                ) : (
                    <Portal>
                        <div className="modal musician-request" onClick={() => setShowRequestModal(false)}>
                            <div className="modal-content" onClick={(e) => e.stopPropagation()}>
                                <button className='btn close tertiary' onClick={() => setShowRequestModal(false)}>
                                    Close
                                </button>
                                <div className="modal-header">
                                    <RequestIcon />
                                    <h2>Request to perform at {venueData.name}</h2>
                                    <p>Send a gig request to the venue. If they accept your request, they'll build a gig for you and you'll automatically be invited.</p>
                                </div>
                                <div className="modal-body form">
                                    {musicianProfiles.length > 0 && (
                                        <div className="input-group">
                                            <select
                                            value={selectedProfile?.id || ""}
                                            onChange={(e) => {
                                                const profileId = e.target.value;
                                                const profile = musicianProfiles.find(p => p.id === profileId);
                                                setSelectedProfile(profile || null);
                                            }}
                                            className='select'
                                            >
                                            <option value="">-- Select a profile --</option>
                                            {musicianProfiles.map((profile) => (
                                                <option key={profile.id} value={profile.id}>
                                                {profile.name}
                                                </option>
                                            ))}
                                            </select>
                                        </div>
                                    )}
                                    <textarea
                                        className="input"
                                        rows={3}
                                        placeholder="Write a message to the venue..."
                                        value={requestMessage}
                                        onChange={(e) => setRequestMessage(e.target.value)}
                                    />
                                    <div className="two-buttons">
                                        <button className="btn tertiary" onClick={() => setShowRequestModal(false)}>
                                            Cancel
                                        </button>
                                        <button
                                            className={`btn primary ${!canRequestGigForSelectedProfile ? 'disabled' : ''}`}
                                            onClick={() => handleMusicianRequest(selectedProfile)}
                                            disabled={loadingRequest || !canRequestGigForSelectedProfile}
                                        >
                                            Request To Play Here
                                        </button>
                                    </div>
                                    {!canRequestGigForSelectedProfile && (
                                        <div
                                            className="status-box"
                                            style={{ marginTop: '0.75rem' }}
                                        >
                                            <div
                                                className="status past"
                                                style={{
                                                    display: 'inline-flex',
                                                    alignItems: 'center',
                                                    gap: '0.4rem',
                                                    border: '1px solid var(--gn-grey-400)',
                                                    backgroundColor: 'var(--gn-grey-250)',
                                                    color: 'var(--gn-grey-700)',
                                                    padding: '0.35rem 0.6rem',
                                                    borderRadius: '5px',
                                                    fontSize: '0.8rem',
                                                }}
                                            >
                                                <PermissionsIcon />
                                                You do not have permission to request gigs for this artist profile
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    </Portal>
                )
            )}
        </div>
    );
};