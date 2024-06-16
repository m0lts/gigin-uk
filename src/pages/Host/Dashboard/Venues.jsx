import { useState } from "react"
import { useNavigate } from "react-router-dom";

export const Venues = ({ venues }) => {

    const navigate = useNavigate();
    const [showDeleteModal, setShowDeleteModal] = useState(false);
    const [venueToDelete, setVenueToDelete] = useState(null);

    const handleEditVenue = (venue) => {
        navigate('/host/venue-builder', { state: { venue } });
    };

    const handleDeleteVenue = (venue) => {
        setVenueToDelete(venue);
        setShowDeleteModal(true);
    };

    const confirmDeleteVenue = async () => {
        if (!venueToDelete) return;

        try {
            const response = await fetch('/api/venues/deleteVenue', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ userId: venueToDelete.userId, venueId: venueToDelete.venueId }),
            });

            if (response.ok) {
                navigate(0);
            } else {
                console.error('Failed to delete venue');
            }
        } catch (error) {
            console.error('An error occurred while deleting the venue:', error);
        } finally {
            setShowDeleteModal(false);
            setVenueToDelete(null);
        }
    };

    return (
        <>
            <div className="head">
                <h1 className="title">Venues</h1>
                <button className="btn secondary" onClick={() => navigate('/host/venue-builder')}>
                    New Venue
                </button>
            </div>
            <div className="body venues">
                {venues.map((venue, index) => (
                    <div className="card venue" key={index}>
                        <div className="venue-image">
                            <img src={venue.photos[0]} alt={venue.name} />
                        </div>
                        <h2 className="venue-name">{venue.name}</h2>
                        <h3 className="venue-address">{venue.address}</h3>
                        <p className="venue-description">{venue.description}</p>
                        <div className="two-buttons">
                            <button className="btn secondary" onClick={() => handleEditVenue(venue)}>
                                Edit
                            </button>
                            <button className="btn danger" onClick={() => handleDeleteVenue(venue)}>
                                Delete
                            </button>
                        </div>
                    </div>
                ))}

                {showDeleteModal && (
                    <div className="modal">
                        <div className="modal-content">
                            <h2>Confirm Venue Deletion</h2>
                            <p>Are you sure you want to delete '{venueToDelete.name}'? <br /> This will also delete all of this venue's gigs.</p>
                            <div className="two-buttons">
                                <button className="btn secondary" onClick={() => setShowDeleteModal(false)}>Cancel</button>
                                <button className="btn danger" onClick={confirmDeleteVenue}>Delete</button>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </>
    )
}