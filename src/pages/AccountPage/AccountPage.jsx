import { useNavigate } from "react-router-dom";
import { useAuth } from "../../hooks/useAuth";
import { LoadingScreen } from "../../components/ui/loading/LoadingScreen";
import { updateEmail, updatePassword, deleteUser, reauthenticateWithCredential, EmailAuthProvider } from "firebase/auth";
import { doc, updateDoc, collection, getDocs, query, where, deleteDoc, getDoc, deleteField } from "firebase/firestore";
import { auth, firestore, storage } from "../../firebase";
import { useEffect, useState } from "react";
import { deleteObject, listAll, ref } from "firebase/storage";
import '../../assets/styles/common/account-page.styles.css';
import { EditIcon } from "../../components/ui/Extras/Icons";

export const AccountPage = () => {
    const { user } = useAuth();
    const navigate = useNavigate();

    const [showEmailModal, setShowEmailModal] = useState(false);
    const [newEmail, setNewEmail] = useState("");
    const [showPasswordModal, setShowPasswordModal] = useState(false);
    const [newPassword, setNewPassword] = useState("");
    const [confirmPassword, setConfirmPassword] = useState("");
    const [currentPassword, setCurrentPassword] = useState("");
    const [showDeleteModal, setShowDeleteModal] = useState(false);
    const [width, setWidth] = useState('100%');

    useEffect(() => {
        const handleResize = () => {
            if (window.innerWidth > 1100) {
                setWidth('80%');
            } else {
                setWidth('95%');
            }
        };
        handleResize();
        window.addEventListener('resize', handleResize);
        return () => {
            window.removeEventListener('resize', handleResize);
        };
    }, []);

    const reauthenticateUser = async () => {
        try {
            if (!currentPassword) {
                alert("Please enter your current password.");
                return false;
            }
            const credential = EmailAuthProvider.credential(auth.currentUser.email, currentPassword);
            await reauthenticateWithCredential(auth.currentUser, credential);
            return true;
        } catch (error) {
            console.error("Reauthentication failed:", error);
            alert("Reauthentication failed. Please ensure your current password is correct.");
            return false;
        }
    };

    const handleEmailUpdate = async () => {
        if (!newEmail) {
            alert("Please enter a new email address.");
            return;
        }
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(newEmail)) {
            alert("Please enter a valid email address.");
            return;
        }
        try {
            if (auth.currentUser) {
                await updateEmail(auth.currentUser, newEmail);
                const userId = auth.currentUser.uid;
                const venueProfilesQuery = query(
                    collection(db, "venueProfiles"), 
                    where("userId", "==", userId)
                );
                const venueProfilesSnapshot = await getDocs(venueProfilesQuery);
                const batch = db.batch();
                venueProfilesSnapshot.forEach((doc) => {
                    const venueRef = doc.ref;
                    batch.update(venueRef, { email: newEmail });
                });
                const musicianProfileQuery = query(
                    collection(db, "musicianProfiles"),
                    where("user", "==", userId)
                );
                const musicianProfileSnapshot = await getDocs(musicianProfileQuery);
                musicianProfileSnapshot.forEach((doc) => {
                    const musicianRef = doc.ref;
                    batch.update(musicianRef, { email: newEmail });
                });
                await batch.commit();
                alert("Email updated successfully");
                setShowEmailModal(false);
                setNewEmail("");
            }
        } catch (error) {
            console.error("Error updating email:", error);
            alert("Failed to update email: " + error.message);
        }
    };

    const handlePasswordUpdate = async () => {
        if (!newPassword || !confirmPassword) {
            alert("Please fill in both password fields.");
            return;
        }
        if (newPassword !== confirmPassword) {
            alert("Passwords do not match. Please try again.");
            return;
        }
        const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,}$/;
        if (!passwordRegex.test(newPassword)) {
            alert("Password must be at least 8 characters long and include at least one uppercase letter, one lowercase letter, and one number.");
            return;
        }
        if (!(await reauthenticateUser())) return;
        try {
            await updatePassword(auth.currentUser, newPassword);
            alert("Password updated successfully");
            setShowPasswordModal(false);
            setNewPassword("");
            setConfirmPassword("");
        } catch (error) {
            console.error("Error updating password:", error);
            alert("Failed to update password: " + error.message);
        }
    };

    const deleteAssociatedData = async () => {
        const userId = auth.currentUser.uid;
        try {
            // 1. Delete venueProfiles
            const venueProfilesQuery = query(collection(firestore, "venueProfiles"), where("user", "==", userId));
            const venueProfilesSnapshot = await getDocs(venueProfilesQuery);
            const venueIds = [];
            for (const venueDoc of venueProfilesSnapshot.docs) {
                venueIds.push(venueDoc.id);
                await deleteDoc(venueDoc.ref);
            }

            // 2. Delete musicianProfile
            const musicianProfileQuery = query(collection(firestore, "musicianProfiles"), where("user", "==", userId));
            const musicianProfileSnapshot = await getDocs(musicianProfileQuery);
            const musicianId = musicianProfileSnapshot.docs[0]?.id;
            if (musicianId) await deleteDoc(musicianProfileSnapshot.docs[0].ref);

            // 3. Delete gigs posted by venues
            for (const venueId of venueIds) {
                const gigsQuery = query(collection(firestore, "gigs"), where("venueId", "==", venueId));
                const gigsSnapshot = await getDocs(gigsQuery);
                for (const gigDoc of gigsSnapshot.docs) {
                    await deleteDoc(gigDoc.ref);
                }
            }

            // 4. Delete reviews by venues/musician
            if (venueIds.length > 0) {
                const venueReviewsQuery = query(
                    collection(firestore, "reviews"),
                    where("venueId", "in", venueIds)
                );
                const venueReviewsSnapshot = await getDocs(venueReviewsQuery);
                for (const reviewDoc of venueReviewsSnapshot.docs) {
                    await deleteDoc(reviewDoc.ref);
                }
            }
            
            if (musicianId) {
                const musicianReviewsQuery = query(
                    collection(firestore, "reviews"),
                    where("musicianId", "==", musicianId)
                );
                const musicianReviewsSnapshot = await getDocs(musicianReviewsQuery);
                for (const reviewDoc of musicianReviewsSnapshot.docs) {
                    await deleteDoc(reviewDoc.ref);
                }
            }

            // 5. Delete gig applicants for musician
            if (musicianId) {
                const musicianDoc = musicianProfileSnapshot.docs[0];
                const gigApplications = musicianDoc.data().gigApplications || [];
                for (const gigId of gigApplications) {
                    const gigRef = doc(firestore, "gigs", gigId);
                    const gigDoc = await getDoc(gigRef);
                    if (gigDoc.exists()) {
                        const updatedApplicants = gigDoc.data().applicants.filter(applicant => applicant !== musicianId);
                        await updateDoc(gigRef, { applicants: updatedApplicants });
                    }
                }
            }

            // 6. Delete conversations
            const conversationsQuery = query(
                collection(firestore, "conversations"),
                where("participants", "array-contains-any", venueIds.concat(musicianId).filter(Boolean))
            );
            const conversationsSnapshot = await getDocs(conversationsQuery);
            for (const conversationDoc of conversationsSnapshot.docs) {
                await deleteDoc(conversationDoc.ref);
            }

            // 7. Delete files from Cloud Storage
            for (const venueId of venueIds) {
                const venueFolderRef = ref(storage, `venues/${venueId}`);
                const venueFolderSnapshot = await listAll(venueFolderRef);
                for (const file of venueFolderSnapshot.items) {
                    await deleteObject(file);
                }
            }
            
            // Delete files for musician profile
            if (musicianId) {
                const musicianFolderRef = ref(storage, `musicians/${musicianId}`);
                const musicianFolderSnapshot = await listAll(musicianFolderRef);
                for (const file of musicianFolderSnapshot.items) {
                    await deleteObject(file);
                }
            }

            // 8. Delete user document and authentication record
            await deleteDoc(doc(firestore, "users", userId));
            await deleteUser(auth.currentUser);
            alert("Account and all associated data deleted successfully.");
            navigate("/");
        } catch (error) {
            console.error("Error deleting associated data:", error);
            alert("Failed to delete account: " + error.message);
        }
    };
    
    const confirmAccountDeletion = async () => {
        if (!(await reauthenticateUser())) return;
        if (window.confirm("Are you sure you want to delete your account? This action cannot be undone.")) {
            await deleteAssociatedData();
            setShowDeleteModal(false);
        }
    };

    const handleDeleteMusicianProfile = async (musicianId) => {
        try {   
            if (window.confirm("Are you sure you want to delete your musician profile? This action cannot be undone.")) {
                // 1. Delete musician profile document
                const musicianProfileRef = doc(firestore, "musicianProfiles", musicianId);
                await deleteDoc(musicianProfileRef);
    
                // 2. Delete reviews associated with the musician
                const reviewsQuery = query(
                    collection(firestore, "reviews"),
                    where("musicianId", "==", musicianId)
                );
                const reviewsSnapshot = await getDocs(reviewsQuery);
                for (const reviewDoc of reviewsSnapshot.docs) {
                    await deleteDoc(reviewDoc.ref);
                }
    
                // 3. Delete conversations involving the musician
                const conversationsQuery = query(
                    collection(firestore, "conversations"),
                    where("participants", "array-contains", musicianId)
                );
                const conversationsSnapshot = await getDocs(conversationsQuery);
                for (const conversationDoc of conversationsSnapshot.docs) {
                    await deleteDoc(conversationDoc.ref);
                }
    
                // 4. Delete musician's gig applications
                const musicianProfileDoc = await getDoc(musicianProfileRef);
                if (musicianProfileDoc.exists()) {
                    const gigApplications = musicianProfileDoc.data().gigApplications || [];
                    for (const gigId of gigApplications) {
                        const gigRef = doc(firestore, "gigs", gigId);
                        const gigDoc = await getDoc(gigRef);
                        if (gigDoc.exists()) {
                            const updatedApplicants = gigDoc.data().applicants.filter(
                                (applicant) => applicant !== musicianId
                            );
                            await updateDoc(gigRef, { applicants: updatedApplicants });
                        }
                    }
                }

                // 5. Delete files from Cloud Storage
                const musicianFolderRef = ref(storage, `musicians/${musicianId}`);
                const musicianFolderSnapshot = await listAll(musicianFolderRef);
                for (const file of musicianFolderSnapshot.items) {
                    await deleteObject(file);
                }
    
                // 6. Remove musicianProfile ID from user's document
                const userRef = doc(firestore, "users", auth.currentUser.uid);
                await updateDoc(userRef, { musicianProfile: deleteField() });
    
                alert("Musician profile deleted successfully.");
            }
        } catch (error) {
            console.error("Error deleting musician profile:", error);
            alert("Failed to delete musician profile: " + error.message);
        }
    };

    const handleDeleteVenueProfile = async (venueId) => {
        try {   
            if (window.confirm("Are you sure you want to delete this venue profile? This action cannot be undone.")) {
                // 1. Delete the venue profile document
                const venueProfileRef = doc(firestore, "venueProfiles", venueId);
                await deleteDoc(venueProfileRef);
    
                // 2. Delete gigs created by the venue
                const gigsQuery = query(collection(firestore, "gigs"), where("venueId", "==", venueId));
                const gigsSnapshot = await getDocs(gigsQuery);
                for (const gigDoc of gigsSnapshot.docs) {
                    await deleteDoc(gigDoc.ref);
                }
    
                // 3. Delete reviews associated with the venue
                const reviewsQuery = query(collection(firestore, "reviews"), where("venueId", "==", venueId));
                const reviewsSnapshot = await getDocs(reviewsQuery);
                for (const reviewDoc of reviewsSnapshot.docs) {
                    await deleteDoc(reviewDoc.ref);
                }
    
                // 4. Delete conversations involving the venue
                const conversationsQuery = query(
                    collection(firestore, "conversations"),
                    where("participants", "array-contains", venueId)
                );
                const conversationsSnapshot = await getDocs(conversationsQuery);
                for (const conversationDoc of conversationsSnapshot.docs) {
                    await deleteDoc(conversationDoc.ref);
                }

                // 5. Delete files from Cloud Storage
                const venueFolderRef = ref(storage, `venues/${venueId}`);
                const venueFolderSnapshot = await listAll(venueFolderRef);
                for (const file of venueFolderSnapshot.items) {
                    await deleteObject(file);
                }
    
                // 6. Remove venue profile ID from the user's document
                const userRef = doc(firestore, "users", auth.currentUser.uid);
                const userDoc = await getDoc(userRef);
                if (userDoc.exists()) {
                    const updatedVenueProfiles = (userDoc.data().venueProfiles || []).filter(
                        (id) => id !== venueId
                    );
                    await updateDoc(userRef, { venueProfiles: updatedVenueProfiles });
                }
    
                alert("Venue profile deleted successfully.");
            }
        } catch (error) {
            console.error("Error deleting venue profile:", error);
            alert("Failed to delete venue profile: " + error.message);
        }
    };

    if (!user) {
        return <LoadingScreen />;
    } else {
        return (
            <div className="account-page" style={{ width: width }}>
                <div className="heading">
                    <h1>Your Gigin Account</h1>
                </div>

                <div className="account-settings">
                    <h2>Account Settings</h2>
                    <div className="name-settings">
                        <h3>Name:</h3>
                        <div className="data-highlight">
                            <h4>{user.name}</h4>
                        </div>
                    </div>
                    <div className="email-settings">
                        <h3>Email Address:</h3>
                        <div className="data-highlight">
                            <h4>{user.email}</h4>
                            <button className="btn primary" onClick={() => setShowEmailModal(true)}>
                                Change Email Address
                            </button>
                        </div>
                    </div>
                    <div className="password-settings">
                        <h3>Password:</h3>
                        <div className="data-highlight">
                            <h4>For security reasons, we cannot show your password.</h4>
                            <button className="btn primary" onClick={() => setShowPasswordModal(true)}>
                                Change Password
                            </button>
                        </div>
                    </div>
                    <div className="delete-settings">
                        <h3>Delete Account:</h3>
                        <div className="data-highlight">
                            <h4>Once you delete your account, all associated data will be lost.</h4>
                            <button className="btn danger" onClick={() => setShowDeleteModal(true)}>Delete Account</button>
                        </div>
                    </div>
                </div>

                <div className="profile-settings">
                    {user.venueProfiles && user.venueProfiles.length > 0 && (
                        <>
                            <h2>Venue Profiles</h2>
                            <ul className="account-profile-list">
                                {user.venueProfiles.map((venue) => (
                                    <li key={venue.id} className="account-profile">
                                        <div className="account-profile-data">
                                            <figure className="account-profile-img">
                                                <img src={venue.photos[0]} alt={venue.name} />
                                            </figure>
                                            <div className="account-profile-details">
                                                <h3>{venue.name}</h3>
                                                <h4>{venue.address}</h4>
                                            </div>
                                        </div>
                                        <div className="account-profile-actions">
                                            <button
                                                className="btn tertiary"
                                                onClick={() =>
                                                    navigate("/venues/add-venue", { state: { venueProfile: venue } })
                                                }
                                            >
                                                <EditIcon />
                                            </button>
                                            <button
                                                className="btn danger"
                                                onClick={() => handleDeleteVenueProfile(venue.id)}
                                            >
                                                Delete Profile
                                            </button>
                                        </div>
                                    </li>
                                ))}
                            </ul>
                        </>
                    )}

                    {/* Musician Profile Section */}
                    {user.musicianProfile && (
                        <>
                            <h2>Musician Profile</h2>
                            <div className="account-profile">
                                <div className="account-profile-data">
                                    <figure className="account-profile-img">
                                        <img src={user.musicianProfile.picture} alt={user.musicianProfile.name} />
                                    </figure>
                                    <div className="account-profile-details">
                                        <h3>{user.musicianProfile.name}</h3>
                                        <h4>{user.musicianProfile.musicianType}</h4>
                                    </div>
                                </div>
                                <div className="account-profile-actions">
                                    <button
                                        className="btn tertiary"
                                        onClick={() =>
                                            navigate("/create-musician-profile", { state: { musicianProfile: user.musicianProfile } })
                                        }
                                    >
                                        <EditIcon />
                                    </button>
                                    <button
                                        className="btn danger"
                                        onClick={() => handleDeleteMusicianProfile(user.musicianProfile.id)}
                                    >
                                        Delete Profile
                                    </button>
                                </div>
                            </div>
                        </>
                    )}
                </div>
                {showEmailModal && (
                    <div className="modal">
                        <div className="modal-content">
                            <h2>Change Your Email Address</h2>
                            <div className="input-container">
                                <input
                                    className="input"
                                    type="email"
                                    placeholder="Enter new email address..."
                                    value={newEmail}
                                    onChange={(e) => setNewEmail(e.target.value)}
                                />
                            </div>
                            <div className="two-buttons">
                                <button className="btn primary" onClick={handleEmailUpdate}>Submit</button>
                                <button className="btn secondary" onClick={() => setShowEmailModal(false)}>Cancel</button>
                            </div>
                            <div className="btn close tertiary" onClick={() => setShowEmailModal(false)}>
                                Close
                            </div>
                        </div>
                    </div>
                )}
                {showPasswordModal && (
                    <div className="modal">
                        <div className="modal-content">
                            <h2>Change Your Password</h2>
                            <input
                                type="password"
                                placeholder="Enter your current password"
                                value={currentPassword}
                                onChange={(e) => setCurrentPassword(e.target.value)}
                            />
                            <input
                                type="password"
                                placeholder="Enter new password"
                                value={newPassword}
                                onChange={(e) => setNewPassword(e.target.value)}
                            />
                            <input
                                type="password"
                                placeholder="Confirm new password"
                                value={confirmPassword}
                                onChange={(e) => setConfirmPassword(e.target.value)}
                            />
                            <button onClick={handlePasswordUpdate}>Submit</button>
                            <button onClick={() => setShowPasswordModal(false)}>Cancel</button>
                        </div>
                    </div>
                )}
                {showDeleteModal && (
                    <div className="modal">
                        <div className="modal-content">
                            <h2>Delete Account</h2>
                            <p>Are you sure? This action cannot be undone.</p>
                            <input
                                type="password"
                                placeholder="Enter your password to confirm"
                                value={confirmPassword}
                                onChange={(e) => setConfirmPassword(e.target.value)}
                            />
                            <button onClick={confirmAccountDeletion}>Confirm Account Deletion</button>
                            <button onClick={() => setShowDeleteModal(false)}>Cancel</button>
                        </div>
                    </div>
                )}
            </div>
        );
    }
};