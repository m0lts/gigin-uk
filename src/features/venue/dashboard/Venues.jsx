import { useState } from 'react'
import { useNavigate } from 'react-router-dom';
import { EditIcon } from '@features/shared/ui/extras/Icons';
import { deleteTemplatesByVenueId, deleteVenueProfile, removeVenueIdFromUser } from '@services/venues';
import { deleteGig, getGigsByVenueId } from '@services/gigs';
import { deleteFolderFromStorage } from '@services/storage';
import { deleteReview, getReviewsByVenueId } from '@services/reviews';
import { deleteConversation, getConversationsByParticipantId } from '@services/conversations';

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
        } catch (error) {
          console.error('An error occurred while deleting the venue:', error);
        } finally {
          setShowDeleteModal(false);
          setVenueToDelete(null);
        }
      };

    const removeTrailingComma = (str) => {
        return str.replace(/[\s,]+$/, '');
    };

    return (
        <>
            <div className='head'>
                <h1 className='title'>My Venues</h1>
                <button className='btn primary' onClick={() => navigate('/venues/add-venue')}>
                    Add another Venue
                </button>
            </div>
            <div className='body venues'>
                {venues.map((venue, index) => (
                    <div className='card venue' key={index}>
                        <div className='venue-image'>
                            <img src={venue.photos[0]} alt={venue.name} />
                        </div>
                        <h2 className='venue-name'>{venue.name}</h2>
                        <h4 className='venue-address'>{removeTrailingComma(venue.address)}</h4>
                        <div className='two-buttons'>
                            <button className='btn icon' onClick={() => handleEditVenue(venue)}>
                                <EditIcon />
                            </button>
                            <button className='btn danger' onClick={() => handleDeleteVenue(venue)}>
                                Delete
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