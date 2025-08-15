import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@hooks/useAuth';
import { LoadingScreen } from '@features/shared/ui/loading/LoadingScreen';
import { EditIcon } from '@features/shared/ui/extras/Icons';
import { updateEmail, updatePassword, deleteUser, reauthenticateWithCredential, EmailAuthProvider } from 'firebase/auth';
import { auth } from '@lib/firebase';
import '@styles/shared/account-page.styles.css';
import { removeGigApplicant } from '@services/gigs';
import { getVenueProfilesByUserId } from '@services/venues';
import { getMusicianProfileByUserId } from '@services/musicians';
import { deleteGig, getGigsByVenueId, getGigsByVenueIds } from '@services/gigs';
import { deleteReview, getReviewsByMusicianId, getReviewsByVenueId, getReviewsByVenueIds } from '@services/reviews';
import { deleteConversation, getConversationsByParticipantId, getConversationsByParticipants } from '@services/conversations';
import { deleteMusicianProfileInUserDocument, deleteUserDocument, getUserById } from '@services/users';
import { deleteMusicianProfile, getMusicianProfileByMusicianId } from '@services/musicians';
import { deleteFolderFromStorage } from '@services/storage';
import { deleteTemplatesByVenueId, deleteVenueProfile } from '@services/venues';
import { useResizeEffect } from '@hooks/useResizeEffect';
import { getUserByEmail, updateUserDocument } from '../../services/users';
import { transferVenueOwnership, updateVenueProfileAccountNames } from '../../services/venues';
import { toast } from 'sonner';

export const Account = () => {
    const { user,  } = useAuth();
    const navigate = useNavigate();

    const [showNameModal, setShowNameModal] = useState(false);
    const [newName, setNewName] = useState('');
    const [showEmailModal, setShowEmailModal] = useState(false);
    const [newEmail, setNewEmail] = useState('');
    const [showPasswordModal, setShowPasswordModal] = useState(false);
    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [currentPassword, setCurrentPassword] = useState('');
    const [showDeleteModal, setShowDeleteModal] = useState(false);
    const [width, setWidth] = useState('100%');
    const [venueList, setVenueList] = useState(user?.venueProfiles || []);
    const [showTransferModal, setShowTransferModal] = useState(false);
    const [venueToTransfer, setVenueToTransfer] = useState(null);
    const [recipientEmail, setRecipientEmail] = useState('');
    const [transferLoading, setTransferLoading] = useState(false);

    useResizeEffect((width) => {
        if (width > 1100) {
          setWidth('80%');
        } else {
          setWidth('95%');
        }
    });

    useEffect(() => {
        setVenueList(user?.venueProfiles || []);
      }, [user]);

    const reauthenticateUser = async () => {
        try {
            if (!currentPassword) {
                alert('Please enter your current password.');
                return false;
            }
            const credential = EmailAuthProvider.credential(auth.currentUser.email, currentPassword);
            await reauthenticateWithCredential(auth.currentUser, credential);
            return true;
        } catch (error) {
            console.error('Reauthentication failed:', error);
            alert('Reauthentication failed. Please ensure your current password is correct.');
            return false;
        }
    };

    const handleNameUpdate = async () => {
        if (!newName) {
            alert('Please enter a new account name.');
            return;
        }
        try {
            if (auth.currentUser) {
                await updateUserDocument(auth.currentUser.uid, {
                    name: newName,
                });
                if (user.venueProfiles && user.venueProfiles.length > 0) {
                    await updateVenueProfileAccountNames(auth.currentUser.uid, user.venueProfiles, newName);
                }
                alert('Account name updated successfully');
                setShowNameModal(false);
                setNewName('');
            }
        } catch (error) {
            console.error('Error updating account name:', error);
            alert('Failed to update account name: ' + error.message);
        }
    };

    const handleEmailUpdate = async () => {
        if (!newEmail) {
            alert('Please enter a new email address.');
            return;
        }
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(newEmail)) {
            alert('Please enter a valid email address.');
            return;
        }
        try {
            if (auth.currentUser) {
                await updateEmail(auth.currentUser, newEmail);
                const userId = auth.currentUser.uid;
                const batch = db.batch();
                const venueProfiles = await getVenueProfilesByUserId(userId);
                venueProfiles.forEach(profile => {
                    batch.update(profile.ref, { email: newEmail });
                });
                const musicianProfile = await getMusicianProfileByUserId(userId);
                if (musicianProfile) {
                    batch.update(musicianProfile.ref, { email: newEmail });
                }
                await batch.commit();
                alert('Email updated successfully');
                setShowEmailModal(false);
                setNewEmail('');
            }
        } catch (error) {
            console.error('Error updating email:', error);
            alert('Failed to update email: ' + error.message);
        }
    };

    const handlePasswordUpdate = async () => {
        if (!newPassword || !confirmPassword) {
            alert('Please fill in both password fields.');
            return;
        }
        if (newPassword !== confirmPassword) {
            alert('Passwords do not match. Please try again.');
            return;
        }
        const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,}$/;
        if (!passwordRegex.test(newPassword)) {
            alert('Password must be at least 8 characters long and include at least one uppercase letter, one lowercase letter, and one number.');
            return;
        }
        if (!(await reauthenticateUser())) return;
        try {
            await updatePassword(auth.currentUser, newPassword);
            alert('Password updated successfully');
            setShowPasswordModal(false);
            setNewPassword('');
            setConfirmPassword('');
        } catch (error) {
            console.error('Error updating password:', error);
            alert('Failed to update password: ' + error.message);
        }
    };

    const deleteAssociatedData = async () => {
        const userId = auth.currentUser.uid;
        try {
            const venueProfiles = await getVenueProfilesByUserId(userId);
            const venueIds = venueProfiles.map(profile => profile.id);
            for (const id of venueIds) {
                await deleteVenueProfile(id);
            }
            const musicianProfile = await getMusicianProfileByUserId(userId);
            const musicianId = musicianProfile?.id;
            await deleteMusicianProfile(musicianId);
            const venueGigs = await getGigsByVenueIds(venueIds);
            for (const { id } of venueGigs) {
                await deleteGig(id);
            }
            const venueReviews = await getReviewsByVenueIds(venueIds);
            for (const { id } of venueReviews) {
                await deleteReview(id);
            }
            if (musicianId) {
                const musicianReviews = await getReviewsByMusicianId(musicianId);
                for (const { id } of musicianReviews) {
                  await deleteReview(id);
                }
            }
            if (musicianProfile?.gigApplications?.length) {
                for (const application of musicianProfile.gigApplications) {
                    await removeGigApplicant(application.gigId, musicianProfile.musicianId);
                }
            }
            const participantIds = [...venueIds, musicianId].filter(Boolean);
            const conversations = await getConversationsByParticipants(participantIds);
            for (const { id } of conversations) {
                await deleteConversation(id);
            }
            for (const venueId of venueIds) {
                await deleteFolderFromStorage(`venues/${venueId}`);
              }
            if (musicianId) {
                await deleteFolderFromStorage(`musicians/${musicianId}`);
            }
            await deleteUserDocument(userId);
            await deleteUser(auth.currentUser);
            alert('Account and all associated data deleted successfully.');
            navigate('/');
        } catch (error) {
            console.error('Error deleting associated data:', error);
            alert('Failed to delete account: ' + error.message);
        }
    };
    
    const confirmAccountDeletion = async () => {
        if (!(await reauthenticateUser())) return;
        if (window.confirm('Are you sure you want to delete your account? This action cannot be undone.')) {
            await deleteAssociatedData();
            setShowDeleteModal(false);
        }
    };

    const handleDeleteMusicianProfile = async (musicianId) => {
        try {   
            if (window.confirm('Are you sure you want to delete your musician profile? This action cannot be undone.')) {
                const musicianProfile = await getMusicianProfileByMusicianId(musicianId);
                if (musicianProfile?.gigApplications?.length) {
                    for (const application of musicianProfile.gigApplications) {
                        await removeGigApplicant(application.gigId, musicianId);
                    }
                }
                await deleteMusicianProfile(musicianId);
                const musicianReviews = await getReviewsByMusicianId(musicianId);
                for (const { id } of musicianReviews) {
                  await deleteReview(id);
                }
                const conversations = await getConversationsByParticipants(musicianId);
                for (const { id } of conversations) {
                    await deleteConversation(id);
                }
                await deleteFolderFromStorage(`musicians/${musicianId}`);
                await deleteMusicianProfileInUserDocument(auth.currentUser.uid);
                alert('Musician profile deleted successfully.');
            }
        } catch (error) {
            console.error('Error deleting musician profile:', error);
            alert('Failed to delete musician profile: ' + error.message);
        }
    };

    const handleDeleteVenueProfile = async (venueId) => {
        try {   
            if (window.confirm('Are you sure you want to delete this venue profile? This action cannot be undone.')) {
                await deleteVenueProfile(id);
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
                await removeVenueIdFromUser(auth.currentUser.uid, venueId);
                alert('Venue profile deleted successfully.');
            }
        } catch (error) {
            console.error('Error deleting venue profile:', error);
            alert('Failed to delete venue profile: ' + error.message);
        }
    };

    if (!user) {
        return <LoadingScreen />;
    } else {
        return (
            <div className='account-page' style={{ width: width }}>
                <div className='heading'>
                    <h1>Your Gigin Account</h1>
                </div>

                <div className='account-settings'>
                    <h2>Account Settings</h2>
                    <div className='name-settings'>
                        <h3>Name:</h3>
                        <div className='data-highlight'>
                            <h4>{user.name}</h4>
                            <button className='btn primary' onClick={() => setShowNameModal(true)}>
                                Change Account Name
                            </button>
                        </div>
                    </div>
                    <div className='email-settings'>
                        <h3>Email Address:</h3>
                        <div className='data-highlight'>
                            <h4>{user.email}</h4>
                            <button className='btn primary' onClick={() => setShowEmailModal(true)}>
                                Change Email Address
                            </button>
                        </div>
                    </div>
                    <div className='password-settings'>
                        <h3>Password:</h3>
                        <div className='data-highlight'>
                            <h4>For security reasons, we cannot show your password.</h4>
                            <button className='btn primary' onClick={() => setShowPasswordModal(true)}>
                                Change Password
                            </button>
                        </div>
                    </div>
                    <div className='delete-settings'>
                        <h3>Delete Account:</h3>
                        <div className='data-highlight'>
                            <h4>Once you delete your account, all associated data will be lost.</h4>
                            <button className='btn danger' onClick={() => setShowDeleteModal(true)}>Delete Account</button>
                        </div>
                    </div>
                </div>

                <div className='profile-settings'>
                    {user.venueProfiles && user.venueProfiles.length > 0 && (
                        <>
                            <h2>Venue Profiles</h2>
                            <ul className='account-profile-list'>
                                {venueList.map((venue) => (
                                    <li key={venue.id} className='account-profile'>
                                        <div className='account-profile-data'>
                                            <figure className='account-profile-img'>
                                                <img src={venue.photos[0]} alt={venue.name} />
                                            </figure>
                                            <div className='account-profile-details'>
                                                <h3>{venue.name}</h3>
                                                <h4>{venue.address}</h4>
                                            </div>
                                        </div>
                                        <div className='account-profile-actions'>

                                            <button
                                                className='btn tertiary'
                                                onClick={() =>
                                                    navigate('/venues/add-venue', { state: { venueProfile: venue } })
                                                }
                                            >
                                                <EditIcon />
                                            </button>
                                            <button
                                                className='btn secondary'
                                                onClick={() => {
                                                    setVenueToTransfer(venue);
                                                    setRecipientEmail('');
                                                    setShowTransferModal(true);
                                                }}
                                                >
                                                Transfer Ownership
                                                </button>
                                            <button
                                                className='btn danger'
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
                            <div className='account-profile'>
                                <div className='account-profile-data'>
                                    <figure className='account-profile-img'>
                                        <img src={user.musicianProfile.picture} alt={user.musicianProfile.name} />
                                    </figure>
                                    <div className='account-profile-details'>
                                        <h3>{user.musicianProfile.name}</h3>
                                        <h4>{user.musicianProfile.musicianType}</h4>
                                    </div>
                                </div>
                                <div className='account-profile-actions'>
                                    <button
                                        className='btn tertiary'
                                        onClick={() =>
                                            navigate('/dashboard/profile')
                                        }
                                    >
                                        <EditIcon />
                                    </button>
                                    <button
                                        className='btn danger'
                                        onClick={() => handleDeleteMusicianProfile(user.musicianProfile.musicianId)}
                                    >
                                        Delete Profile
                                    </button>
                                </div>
                            </div>
                        </>
                    )}
                </div>
                {showNameModal && (
                    <div className='modal'>
                        <div className='modal-content'>
                            <h2>Change Your Account Name</h2>
                            <div className='input-container'>
                                <input
                                    className='input'
                                    type='text'
                                    placeholder='Enter new name...'
                                    value={newName}
                                    onChange={(e) => setNewName(e.target.value)}
                                />
                            </div>
                            <div className='two-buttons'>
                                <button className='btn primary' onClick={handleNameUpdate}>Submit</button>
                                <button className='btn secondary' onClick={() => setShowNameModal(false)}>Cancel</button>
                            </div>
                            <div className='btn close tertiary' onClick={() => setShowNameModal(false)}>
                                Close
                            </div>
                        </div>
                    </div>
                )}
                {showEmailModal && (
                    <div className='modal'>
                        <div className='modal-content'>
                            <h2>Change Your Email Address</h2>
                            <div className='input-container'>
                                <input
                                    className='input'
                                    type='email'
                                    placeholder='Enter new email address...'
                                    value={newEmail}
                                    onChange={(e) => setNewEmail(e.target.value)}
                                />
                            </div>
                            <div className='two-buttons'>
                                <button className='btn primary' onClick={handleEmailUpdate}>Submit</button>
                                <button className='btn secondary' onClick={() => setShowEmailModal(false)}>Cancel</button>
                            </div>
                            <div className='btn close tertiary' onClick={() => setShowEmailModal(false)}>
                                Close
                            </div>
                        </div>
                    </div>
                )}
                {showPasswordModal && (
                    <div className='modal'>
                        <div className='modal-content'>
                            <h2>Change Your Password</h2>
                            <input
                                type='password'
                                placeholder='Enter your current password'
                                value={currentPassword}
                                onChange={(e) => setCurrentPassword(e.target.value)}
                            />
                            <input
                                type='password'
                                placeholder='Enter new password'
                                value={newPassword}
                                onChange={(e) => setNewPassword(e.target.value)}
                            />
                            <input
                                type='password'
                                placeholder='Confirm new password'
                                value={confirmPassword}
                                onChange={(e) => setConfirmPassword(e.target.value)}
                            />
                            <button onClick={handlePasswordUpdate}>Submit</button>
                            <button onClick={() => setShowPasswordModal(false)}>Cancel</button>
                        </div>
                    </div>
                )}
                {showDeleteModal && (
                    <div className='modal'>
                        <div className='modal-content'>
                            <h2>Delete Account</h2>
                            <p>Are you sure? This action cannot be undone.</p>
                            <input
                                type='password'
                                placeholder='Enter your password to confirm'
                                value={confirmPassword}
                                onChange={(e) => setConfirmPassword(e.target.value)}
                            />
                            <button onClick={confirmAccountDeletion}>Confirm Account Deletion</button>
                            <button onClick={() => setShowDeleteModal(false)}>Cancel</button>
                        </div>
                    </div>
                )}
                {showTransferModal && (
                    <div className="modal" onClick={() => !transferLoading && setShowTransferModal(false)}>
                        <div className="modal-content" onClick={(e) => e.stopPropagation()}>
                            <div className="modal-header">

                                <h2>Transfer Venue Ownership</h2>
                                <p>
                                    You’re transferring <strong>{venueToTransfer?.name}</strong> to another Gigin account.
                                    The recipient will become the new owner and you’ll lose access to this venue.
                                </p>
                            </div>
                            <div className="modal-body">
                                <div className="input-container" style={{ marginTop: 10 }}>
                                    <label htmlFor="recipientEmail">Recipient’s email</label>
                                    <input
                                    id="recipientEmail"
                                    type="email"
                                    className="input"
                                    placeholder="name@example.com"
                                    value={recipientEmail}
                                    onChange={(e) => setRecipientEmail(e.target.value.trim())}
                                    disabled={transferLoading}
                                    />
                                </div>

                                <div className="notes" style={{ marginTop: 10 }}>
                                    <small>
                                    Tip: Make sure the recipient has already created a Gigin account with this email.
                                    </small>
                                </div>

                                <div className="two-buttons" style={{ marginTop: 16 }}>
                                    <button
                                    className="btn danger"
                                    disabled={transferLoading || !recipientEmail}
                                    onClick={async () => {
                                        if (!recipientEmail) return alert('Please enter a valid email.');
                                        if (!venueToTransfer) return;
                                        const ok = window.confirm(
                                        `Transfer "${venueToTransfer.name}" to ${recipientEmail}? You will lose access.`
                                        );
                                        if (!ok) return;
                                            setTransferLoading(true);
                                        try {
                                            const target = await getUserByEmail(recipientEmail);
                                            if (!target) {
                                                toast.error('No Gigin account found for that email.');
                                                setTransferLoading(false);
                                                return;
                                            }
                                            if (target.id === user.uid) {
                                                toast.error('You already own this venue profile.')
                                                setTransferLoading(false);
                                                return;
                                            }
                                            toast.info('Transferring venue ownership...')
                                            await transferVenueOwnership({
                                                venueId: venueToTransfer.id,
                                                fromUserId: user.uid,
                                                toUserId: target.id,
                                            });
                                            setVenueList(prev => prev.filter(v => v.id !== venueToTransfer.id));
                                            toast.success('Venue ownership transferred successfully.');
                                            setShowTransferModal(false);
                                            setVenueToTransfer(null);
                                            setRecipientEmail('');
                                            navigate('/');
                                        } catch (err) {
                                            console.error('Transfer failed:', err);
                                            toast.error(`Failed to transfer venue.`);
                                        } finally {
                                            setTransferLoading(false);
                                        }
                                    }}
                                    >
                                    {transferLoading ? 'Transferring, please wait...' : 'Confirm Transfer'}
                                    </button>
                                    <button
                                        className="btn secondary"
                                        disabled={transferLoading}
                                        onClick={() => setShowTransferModal(false)}
                                    >
                                        Cancel
                                    </button>
                                </div>

                                <button
                                    className="btn close tertiary"
                                    disabled={transferLoading}
                                    onClick={() => setShowTransferModal(false)}
                                >
                                    Close
                                </button>
                            </div>
                        </div>
                    </div>
                    )}
            </div>
        );
    }
};