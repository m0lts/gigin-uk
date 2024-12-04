import { useState } from "react"
import { useNavigate } from "react-router-dom";
import { collection, deleteDoc, doc, getDocs, query, updateDoc, where, arrayRemove } from "firebase/firestore";
import { ref, listAll, deleteObject } from "firebase/storage";
import { firestore, storage } from '../../../firebase';
import { EditIcon } from "../../../components/ui/Extras/Icons";

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
          // Delete the venue document from the venueProfiles collection
          const venueRef = doc(firestore, 'venueProfiles', venueId);
          await deleteDoc(venueRef);
      
          // Remove the venue ID from the user's venueProfiles array
          const userRef = doc(firestore, 'users', user);
          await updateDoc(userRef, {
            venueProfiles: arrayRemove(venueId)
          });
      
          // Delete all gigs associated with the venue
          const gigsQuery = query(collection(firestore, 'gigs'), where('venueId', '==', venueId));
          const gigsSnapshot = await getDocs(gigsQuery);
          const gigDeletionPromises = gigsSnapshot.docs.map(doc => deleteDoc(doc.ref));
          await Promise.all(gigDeletionPromises);
      
          // Delete all templates associated with the venue
          const templatesQuery = query(collection(firestore, 'templates'), where('venueId', '==', venueId));
          const templatesSnapshot = await getDocs(templatesQuery);
          const templateDeletionPromises = templatesSnapshot.docs.map(doc => deleteDoc(doc.ref));
          await Promise.all(templateDeletionPromises);

          // Delete all files in Google Cloud Storage associated with the venue
          const storageRef = ref(storage, `venues/${venueId}`);
          const listResults = await listAll(storageRef);
          const deletePromises = listResults.items.map(itemRef => deleteObject(itemRef));
          await Promise.all(deletePromises);
      
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
            <div className="head">
                <h1 className="title">Venues</h1>
                <button className="btn primary" onClick={() => navigate('/venues/add-venue')}>
                    Add another Venue
                </button>
            </div>
            <div className="body venues">
                {venues.map((venue, index) => (
                    <div className="card venue" key={index}>
                        <div className="venue-image">
                            <img src={venue.photos[0]} alt={venue.name} />
                        </div>
                        <h2 className="venue-name">{venue.name}</h2>
                        <h4 className="venue-address">{removeTrailingComma(venue.address)}</h4>
                        <div className="two-buttons">
                            <button className="btn icon" onClick={() => handleEditVenue(venue)}>
                                <EditIcon />
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
                            <p style={{ textAlign: 'center' }}>Are you sure you want to delete '{venueToDelete.name}'? <br /> This will also delete all of this venue's gigs.</p>
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