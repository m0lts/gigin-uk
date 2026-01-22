import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import '@styles/host/venue-page.styles.css';
import { 
    ClubIcon,
    FacebookIcon,
    GuitarsIcon,
    InstagramIcon,
    MicrophoneIcon,
    SpeakersIcon,
    TwitterIcon } from '@features/shared/ui/extras/Icons';
import { getVenueProfileById } from '@services/client-side/venues';
import 'mapbox-gl/dist/mapbox-gl.css';
import { toast } from 'sonner';
import { AmpIcon, LinkIcon, MonitorIcon, NewTabIcon, PianoIcon, PlugIcon, VerifiedIcon } from '@icons';
import { MapSection } from '../components/MapSection';
import { ensureProtocol } from '@services/utils/misc';
import { LoadingScreen } from '../../shared/ui/loading/LoadingScreen';
import { AddMember, BassIcon, DeleteGigIcon, EditIcon, LeftArrowIcon, SettingsIcon, ShareIcon, SpeakerIcon } from '../../shared/ui/extras/Icons';
import { openInNewTab } from '../../../services/utils/misc';
import { deleteGigsBatch, getGigsByVenueId } from '../../../services/client-side/gigs';
import { getReviewsByVenueId } from '../../../services/client-side/reviews';
import { deleteFolderFromStorage } from '../../../services/storage';
import Portal from '../../shared/components/Portal';
import { LoadingModal } from '../../shared/ui/loading/LoadingModal';
import { AddStaffModal } from '../components/AddStaffModal';
import { StaffPermissionsModal } from '../components/StaffPermissionsModal';
import { hasVenuePerm } from '../../../services/utils/permissions';
import { updateUserArrayField } from '@services/api/users';
import { deleteVenueData, fetchVenueMembersWithUsers } from '@services/api/venues';
import { deleteReview } from '@services/api/reviews';
import { useBreakpoint } from '../../../hooks/useBreakpoint';

export const VenuePage = ({ user, venues, setVenues, venueId, onClose }) => {
    const navigate = useNavigate();
    const {isSmUp} = useBreakpoint();
    const [venueData, setVenueData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [fullscreenImage, setFullscreenImage] = useState(null);
    const [currentImageIndex, setCurrentImageIndex] = useState(0);
    const [expanded, setExpanded] = useState(false);
    const [showDeleteModal, setShowDeleteModal] = useState(false);
    const [venueToDelete, setVenueToDelete] = useState(null);
    const [deleting, setDeleting] = useState(false);
    const [showAddStaffModal, setShowAddStaffModal] = useState(false);
    const [showPermissionsModal, setShowPermissionsModal] = useState(false);

    useEffect(() => {
        if (!venueId) return;
        const fetchVenue = async () => {
            setLoading(true);
            try {
                const [profile, members] = await Promise.all([
                    getVenueProfileById(venueId),
                    fetchVenueMembersWithUsers({ venueId }),
                  ]);
            
                  // Combine into one object
                  setVenueData({
                    ...profile,
                    members, // attach members as an array
                  });
            } catch (error) {
              console.error('Error loading venue profile:', error);
            } finally {
              setLoading(false);
            }
          };
        fetchVenue();
    }, [venueId]);

    const closeFullscreen = () => {
        setFullscreenImage(null);
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

    const handleEditVenue = (venue) => {
        if (!hasVenuePerm(venues, venueId, 'venue.update')) {
            toast.error('You do not have permission to edit this venue.');
            return;
        };
        navigate('/venues/add-venue', { state: { venue } });
    };

    const handleDeleteVenue = (venue) => {
        setVenueToDelete(venue);
        setShowDeleteModal(true);
    };

    const confirmDeleteVenue = async () => {
        if (!venueToDelete) return;
        const { venueId } = venueToDelete;
        try {
            setDeleting(true);
            setShowDeleteModal(false);
            await updateUserArrayField({ field: 'venueProfiles', op: 'remove', value: venueId });
            const gigs = await getGigsByVenueId(venueId);
            const gigIds = gigs.map(gig => gig.id);
            await deleteGigsBatch(gigIds);
            const reviews = await getReviewsByVenueId(venueId);
            for (const { id } of reviews) {
                await deleteReview({ reviewId: id });
            }
            await deleteFolderFromStorage(`venues/${venueId}`);
            await deleteVenueData({ venueId });
            toast.success('Venue Deleted');
            setVenues(prevVenues => prevVenues.filter(venue => venue.venueId !== venueId));
            if (onClose) onClose();
        } catch (error) {
            console.error('An error occurred while deleting the venue:', error);
            toast.error('Failed to delete venue. Please try again.')
        } finally {
          setShowDeleteModal(false);
          setVenueToDelete(null);
          setDeleting(false);
        }
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

    const rawOff = venueData?.primaryImageOffsetY;
    let percentFromTop;
    if (rawOff == null) {
        percentFromTop = 50;
    } else {
        const n = parseFloat(rawOff);
        if (Number.isFinite(n)) {
            percentFromTop = n <= 0 ? Math.max(0, Math.min(100, 50 + n))
                                    : Math.max(0, Math.min(100, n));
        } else {
            percentFromTop = 50;
        }
    }

    if (loading) {
        return (
            <Portal>
                <div className='modal' onClick={onClose}>
                    <div className='modal-content' onClick={(e) => e.stopPropagation()}>
                        <LoadingScreen />
                    </div>
                </div>
            </Portal>
        )
    }

    return (
        <Portal>
            <div className='modal venue-settings' onClick={onClose}>
                <div className='modal-content' onClick={(e) => e.stopPropagation()}>
                    <div className="modal-header">
                        <SettingsIcon />
                        <h2>Venue Settings</h2>
                    </div>
                    <button className='btn close tertiary' onClick={onClose}>
                        Close
                    </button>
                    <div className='modal-body'>
                        <ul className="settings-list" style={{ marginTop: '1rem', listStyle: 'none', width: '100%', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                            <li className="settings-item" >
                                <button className="btn secondary" onClick={() => copyToClipboard(venueData.id)} style={{ width: '100%', flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'space-between'}}>
                                    Share Venue Link
                                    <ShareIcon />
                                </button>
                            </li>
                            <li className="settings-item" >
                                <button className="btn secondary" onClick={(e) => openInNewTab(`/venues/${venueData.id}?venueViewing=true`, e)} style={{ width: '100%', flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'space-between'}}>
                                    View Venue Page
                                    <NewTabIcon />
                                </button>
                            </li>
                            {hasVenuePerm(venues, venueId, 'venue.update') && (
                                <li className="settings-item" >
                                    <button className="btn secondary" onClick={() => handleEditVenue(venueData)} style={{ width: '100%', flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'space-between'}}>
                                        Edit Venue Profile
                                        <EditIcon />
                                    </button>
                                </li>
                            )}
                            {hasVenuePerm(venues, venueId, 'members.invite') && (
                                <li className="settings-item" >
                                    <button className="btn secondary" onClick={() => setShowAddStaffModal(true)} style={{ width: '100%', flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'space-between'}}>
                                        Add Staff to Venue
                                        <AddMember />
                                    </button>
                                </li>
                            )}
                            {hasVenuePerm(venues, venueId, 'members.update') && (
                                <li className="settings-item" >
                                    <button className="btn secondary" onClick={() => setShowPermissionsModal(true)} style={{ width: '100%', flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'space-between'}}>
                                        Manage Staff Members
                                        <SettingsIcon />
                                    </button>
                                </li>
                            )}
                            {hasVenuePerm(venues, venueId, 'owner') && (
                                <li className="settings-item" >
                                    <button className="btn danger" onClick={() => handleDeleteVenue(venueData)} style={{ width: '100%', flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'space-between'}}>
                                        Delete Venue
                                        <DeleteGigIcon />
                                    </button>
                                </li>
                            )}
                        </ul>
                    </div>
                    {fullscreenImage && (
                        <div className='fullscreen-overlay' onClick={closeFullscreen}>
                            <span className='arrow left' onClick={showPrevImage}>&#8249;</span>
                            <img src={fullscreenImage} alt='Fullscreen' />
                            <span className='arrow right' onClick={showNextImage}>&#8250;</span>
                        </div>
                    )}
                </div>
            </div>

            {showAddStaffModal && (
                <Portal>
                    <AddStaffModal user={user} venue={venueData} onClose={() => setShowAddStaffModal(false)} />
                </Portal>
            )}

            {showPermissionsModal && (
                <Portal>
                    <StaffPermissionsModal user={user} venue={venueData} onClose={() => setShowPermissionsModal(false)} />
                </Portal>
            )}

            {showDeleteModal && (
                <Portal>
                    <div className='modal' onClick={() => setShowDeleteModal(false)}>
                        <div className='modal-content' onClick={(e) => e.stopPropagation()}>
                            <div className="modal-header">
                                <DeleteGigIcon />
                                <h2>Confirm Venue Deletion</h2>
                                <p>Are you sure you want to delete '{venueToDelete.name}'? <br /> This will also delete all of this venue's gigs.</p>
                            </div>
                            <div className='two-buttons'>
                                <button className='btn secondary' onClick={() => setShowDeleteModal(false)}>Cancel</button>
                                <button className='btn danger' onClick={confirmDeleteVenue}>Delete</button>
                            </div>
                        </div>
                    </div>
                </Portal>
            )}

            {deleting && (
                <LoadingModal title={'Deleting Venue'} text={'This may take a minute or two...'} />
            )}
        </Portal>
    );
};