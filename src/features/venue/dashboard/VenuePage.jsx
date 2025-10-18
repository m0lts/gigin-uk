import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Header as VenueHeader } from '@features/venue/components/Header';
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
import { AddMember, DeleteGigIcon, EditIcon, LeftArrowIcon, SettingsIcon, ShareIcon } from '../../shared/ui/extras/Icons';
import { openInNewTab } from '../../../services/utils/misc';
import { deleteGigsBatch, getGigsByVenueId } from '../../../services/client-side/gigs';
import { getReviewsByVenueId } from '../../../services/client-side/reviews';
import { deleteFolderFromStorage } from '../../../services/storage';
import Portal from '../../shared/components/Portal';
import { LoadingModal } from '../../shared/ui/loading/LoadingModal';
import { AddStaffModal } from '../components/AddStaffModal';
import { StaffPermissionsModal } from '../components/StaffPermissionsModal';
import { hasVenuePerm } from '../../../services/utils/permissions';
import { updateUserArrayField } from '../../../services/function-calls/users';
import { confirmDeleteVenueData, fetchVenueMembersWithUsers } from '../../../services/function-calls/venues';
import { deleteReview } from '../../../services/function-calls/reviews';

export const VenuePage = ({ user, venues, setVenues }) => {
    const navigate = useNavigate();
    const { venueId } = useParams();
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
        if (!user) navigate('/');
    }, [user]);

    useEffect(() => {
        if (!venueId) return;
        const fetchVenue = async () => {
            setLoading(true);
            try {
                const [profile, members] = await Promise.all([
                    getVenueProfileById(venueId),
                    fetchVenueMembersWithUsers(venueId),
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
            await updateUserArrayField('venueProfiles', 'remove', venueId);
            const gigs = await getGigsByVenueId(venueId);
            const gigIds = gigs.map(gig => gig.id);
            await deleteGigsBatch(gigIds);
            const reviews = await getReviewsByVenueId(venueId);
            for (const { id } of reviews) {
                await deleteReview(id);
            }
            await deleteFolderFromStorage(`venues/${venueId}`);
            await confirmDeleteVenueData(venueId);
            toast.success('Venue Deleted');
            navigate('/venues/dashboard/my-venues', { replace: true });
            setVenues(prevVenues => prevVenues.filter(venue => venue.venueId !== venueId));
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
            <LoadingScreen />
        )
    }

    return (
        <div className='venue-page'>
            <section className='venue-page-body'>
                <div className='venue-page-hero'>
                    <img
                        src={venueData?.photos[0]}
                        alt={venueData?.name}
                        className='background-image'
                        style={{
                            objectPosition: `50% ${50 - percentFromTop}%`,
                            transition: 'object-position 0.3s ease-out',
                        }}
                    />
                    <div className="primary-information">
                        {venueData?.verified && (
                            <div className="verified-tag">
                                <VerifiedIcon />
                                <p>Verified Venue</p>
                            </div>
                        )}
                        <h1 className="venue-name">
                            {venueData?.name}
                            <span className='orange-dot'>.</span>
                        </h1>
                        <h4 className="number-of-gigs">
                            {venueData?.gigs?.length} Gigs Posted
                        </h4>
                    </div>
                </div>
                <div className="venue-page-information" style={{ width: `95%`, margin: '0 auto'}}>
                    <div className="venue-page-details">
                        <div className="section bio">
                            <h2>Bio</h2>
                            <p>{venueData?.description}</p>
                        </div>
                        <div className="section secondary-information">
                            <div className="info-box location">
                                <h2>Location</h2>
                                <MapSection venueData={venueData} />
                                <h5>{venueData?.address}</h5>
                                <button className="btn tertiary" onClick={() => openGoogleMaps(venueData.address, venueData.coordinates)}>
                                    Get Directions <NewTabIcon />
                                </button>
                            </div>
                            <div className="info-box equipment">
                                <div className="info-box-header" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between'}}>
                                    <h2>Equipment at {venueData.name}</h2>
                                    <button className="btn text" onClick={() => setExpanded(!expanded)}>
                                        {expanded ? 'Hide' : 'Show'}
                                    </button>
                                </div>
                                {expanded && venueData.type === 'Public Establishment' && (
                                    venueData.equipment.map((e) => (
                                        <span className="equipment-item" key={e}>
                                            {formatEquipmentIcon(e)}
                                            {e}
                                        </span>
                                    ))
                                )}
                            </div>
                            {venueData?.website && (
                                <div className="info-box website">
                                    <h2>Website</h2>
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
                                <div className="info-box socials">
                                    <h2>Socials</h2>
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
                        {venueData?.photos?.length > 1 && (
                            <div className="section photos">
                                <h2>Photos</h2>
                                <div className="photos-collage">
                                {venueData.photos.map((photo, index) => (
                                    <figure className="collage-item" key={photo}>
                                    <img
                                        src={photo}
                                        alt={venueData.name}
                                        loading="lazy"
                                        decoding="async"
                                    />
                                    </figure>
                                ))}
                                </div>
                            </div>
                        )}
                    </div>
                    <div className="venue-page-settings">
                        <h2>Venue Settings</h2>
                        <ul className="settings-list">
                            <li className="settings-item">
                                <button className="btn secondary" onClick={() => copyToClipboard(venueData.id)}>
                                    Share Venue Link
                                    <ShareIcon />
                                </button>
                            </li>
                            <li className="settings-item">
                                <button className="btn secondary" onClick={(e) => openInNewTab(`/venues/${venueData.id}?venueViewing=true`, e)}>
                                    See What Musicians See
                                    <NewTabIcon />
                                </button>
                            </li>
                            {hasVenuePerm(venues, venueId, 'venue.update') && (
                                <li className="settings-item">
                                    <button className="btn secondary" onClick={() => handleEditVenue(venueData)}>
                                        Edit Venue Profile
                                        <EditIcon />
                                    </button>
                                </li>
                            )}
                            {hasVenuePerm(venues, venueId, 'members.invite') && (
                                <li className="settings-item">
                                    <button className="btn secondary" onClick={() => setShowAddStaffModal(true)}>
                                        Add Staff to Venue
                                        <AddMember />
                                    </button>
                                </li>
                            )}
                            {venueData?.members?.length > 1 && hasVenuePerm(venues, venueId, 'members.update') && (
                                <li className="settings-item">
                                    <button className="btn secondary" onClick={() => setShowPermissionsModal(true)}>
                                        Manage Staff Members
                                        <SettingsIcon />
                                    </button>
                                </li>
                            )}
                            {hasVenuePerm(venues, venueId, 'owner') && (
                                <li className="settings-item">
                                    <button className="btn danger" onClick={() => handleDeleteVenue(venueData)}>
                                        Delete Venue
                                        <DeleteGigIcon />
                                    </button>
                                </li>
                            )}
                        </ul>
                    </div>
                </div>
                {fullscreenImage && (
                    <div className='fullscreen-overlay' onClick={closeFullscreen}>
                        <span className='arrow left' onClick={showPrevImage}>&#8249;</span>
                        <img src={fullscreenImage} alt='Fullscreen' />
                        <span className='arrow right' onClick={showNextImage}>&#8250;</span>
                    </div>
                )}
            </section>

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

        </div>
    );
};