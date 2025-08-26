import { useState } from 'react'
import { useNavigate } from 'react-router-dom';
import { EditIcon } from '@features/shared/ui/extras/Icons';
import { deleteTemplatesByVenueId, deleteVenueProfile, removeVenueIdFromUser } from '@services/venues';
import { deleteGig, getGigsByVenueId } from '@services/gigs';
import { deleteFolderFromStorage } from '@services/storage';
import { deleteReview, getReviewsByVenueId } from '@services/reviews';
import { deleteConversation, getConversationsByParticipantId } from '@services/conversations';
import { openInNewTab } from '@services/utils/misc';
import { DeleteGigIcon, HouseIconSolid, NewTabIcon, PeopleRoofIconSolid, ShareIcon } from '../../shared/ui/extras/Icons';
import { getCityFromAddress } from '../../../services/utils/misc';
import { toast } from 'sonner';

export const Venues = ({ venues }) => {

    const navigate = useNavigate();
    const [showDeleteModal, setShowDeleteModal] = useState(false);
    const [venueToDelete, setVenueToDelete] = useState(null);

    const handleEditVenue = (venue) => {
        navigate('/venues/add-venue', { state: { venue } });
    };

    const handleDeleteVenue = (venue) => {
        setVenueToDelete(venue);
        setShowDeleteModal(true);
    };


    const confirmDeleteVenue = async () => {
        if (!venueToDelete) return;
        const { user, venueId } = venueToDelete;
        try {
            await deleteVenueProfile(venueId);
            await removeVenueIdFromUser(user, venueId);
            const gigs = await getGigsByVenueId(venueId);
            for (const { id } of gigs) {
                await deleteGig(id);
            }
            const reviews = await getReviewsByVenueId(venueId);
            for (const { id } of reviews) {
                await deleteReview(id);
            }
            const conversations = await getConversationsByParticipantId(venueId);
            for (const { id } of conversations) {
                await deleteConversation(id);
            }
            await deleteTemplatesByVenueId(venueId);
            await deleteFolderFromStorage(`venues/${venueId}`);
            navigate(0);
            toast.success('Venue Deleted');
        } catch (error) {
          console.error('An error occurred while deleting the venue:', error);
          toast.error('Failed to delete venue. Please try again.')
        } finally {
          setShowDeleteModal(false);
          setVenueToDelete(null);
        }
      };

    const formatVenueType = (type) => {
        if (type === 'Public Establishment') {
            return <PeopleRoofIconSolid />
        } else {
            return <HouseIconSolid />
        }
    }

    const copyToClipboard = (venueId) => {
        navigator.clipboard.writeText(`https://gigin.ltd/venues/${venueId}`).then(() => {
            toast.success(`Copied Venue Link: https://gigin.ltd/venues/${venueId}`);
        }).catch((err) => {
            toast.error('Failed to copy link. Please try again.')
            console.error('Failed to copy link: ', err);
        });
    };

    return (
        <>
            <div className='head'>
                <h1 className='title'>My Venues</h1>
                <button className='btn primary' onClick={() => navigate('/venues/add-venue')}>
                    Add Another Venue
                </button>
            </div>
            <div className='body venues'>
                {venues.map((venue, index) => (
                    <div className='venue-card' key={index}>
                        <div>
                            <div className='venue-image'>
                                <img src={venue.photos[0]} alt={venue.name} />
                            </div>
                            <div className="venue-flex">
                                <div className="venue-name">
                                    <h3 className='venue-name'>{venue.name}</h3>
                                    <p className='venue-address'>{getCityFromAddress(venue.address)}</p>
                                </div>
                                <button className="btn icon" onClick={(e) => openInNewTab(`/venues/${venue.venueId}?venueViewing=true`, e)}>
                                    <NewTabIcon />
                                </button>
                            </div>
                            <div className="venue-gigs">
                                <span className="gigs">{(venue?.gigs ?? []).length}</span>
                                <span className='text'>gigs posted.</span>
                            </div>
                        </div>
                        <div className="action-buttons">
                            <button className="btn tertiary" onClick={() => copyToClipboard(venue.venueId)}>
                                Share
                                <ShareIcon />
                            </button>
                            <button className='btn tertiary' onClick={() => handleEditVenue(venue)}>
                                Edit
                                <EditIcon />
                            </button>
                            <button className='btn danger' onClick={() => handleDeleteVenue(venue)}>
                                Delete
                                <DeleteGigIcon />
                            </button>
                        </div>
                    </div>
                ))}

                {showDeleteModal && (
                    <div className='modal'>
                        <div className='modal-content'>
                            <h2>Confirm Venue Deletion</h2>
                            <p style={{ textAlign: 'center' }}>Are you sure you want to delete '{venueToDelete.name}'? <br /> This will also delete all of this venue's gigs.</p>
                            <div className='two-buttons'>
                                <button className='btn secondary' onClick={() => setShowDeleteModal(false)}>Cancel</button>
                                <button className='btn danger' onClick={confirmDeleteVenue}>Delete</button>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </>
    )
}