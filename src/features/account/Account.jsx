import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@hooks/useAuth';
import { LoadingScreen } from '@features/shared/ui/loading/LoadingScreen';
import { EditIcon } from '@features/shared/ui/extras/Icons';
import { updateEmail, updatePassword, deleteUser, reauthenticateWithCredential, EmailAuthProvider } from 'firebase/auth';
import { auth } from '@lib/firebase';
import '@styles/shared/account-page.styles.css';
import { removeGigApplicant } from '@services/function-calls/gigs';
import { getVenueProfilesByUserId } from '@services/client-side/venues';
import { getMusicianProfileByUserId } from '@services/client-side/musicians';
import { getGigsByVenueId, getGigsByVenueIds } from '@services/client-side/gigs';
import { getReviewsByMusicianId, getReviewsByVenueId, getReviewsByVenueIds } from '@services/client-side/reviews';
import { getConversationsByParticipantId, getConversationsByParticipants } from '@services/client-side/conversations';
import { deleteMusicianProfile, getMusicianProfileByMusicianId } from '@services/client-side/musicians';
import { deleteFolderFromStorage } from '@services/storage';
import { deleteTemplatesByVenueId, deleteVenueProfile } from '@services/client-side/venues';
import { useResizeEffect } from '@hooks/useResizeEffect';
import { updateUserDocument } from '../../services/client-side/users';
import { updateVenueProfileAccountNames } from '../../services/client-side/venues';
import { toast } from 'sonner';
import Portal from '../shared/components/Portal';
import { CameraIcon, DeleteGigIcon, InviteIconSolid, LogOutIcon, PasswordIcon, UserIcon } from '../shared/ui/extras/Icons';
import { LoadingModal } from '../shared/ui/loading/LoadingModal';
import { firestore } from '@lib/firebase';
import { uploadFileToStorage } from '../../services/storage';
import { clearUserArrayField, deleteUserDocument, updateUserArrayField } from '../../services/function-calls/users';
import { transferVenueOwnership } from '../../services/function-calls/venues';
import { deleteReview } from '../../services/function-calls/reviews';
import { deleteGigsBatch } from '../../services/client-side/gigs';
import { deleteConversation } from '../../services/function-calls/conversations';

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
    const [eventLoading, setEventLoading] = useState(false);
    const [transferLoading, setTransferLoading] = useState(false);
    const [showEventLoadingModal, setShowEventLoadingModal] = useState(false);

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
        setEventLoading(true);
        try {
            if (auth.currentUser) {
                await updateUserDocument(auth.currentUser.uid, {
                    name: newName,
                });
                if (user.venueProfiles && user.venueProfiles.length > 0) {
                    await updateVenueProfileAccountNames(auth.currentUser.uid, user.venueProfiles, newName);
                }
                toast.success('Name Changed')
                setShowNameModal(false);
                setNewName('');
            }
        } catch (error) {
            console.error('Error updating account name:', error);
            toast.error('Failed to update account name.');
        } finally {
            setEventLoading(false);
        }
    };

    const handleEmailUpdate = async () => {
        if (!newEmail) {
            toast('Please enter a new email address.')
            return;
        }
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(newEmail)) {
            toast('Please enter a valid email address.');
            return;
        }
        setEventLoading(true);
        try {
            if (auth.currentUser) {
                await updateEmail(auth.currentUser, newEmail);
                const userId = auth.currentUser.uid;
                const batch = firestore.batch();
                const venueProfiles = await getVenueProfilesByUserId(userId);
                venueProfiles.forEach(profile => {
                    batch.update(profile.ref, { email: newEmail });
                });
                const musicianProfile = await getMusicianProfileByUserId(userId);
                if (musicianProfile) {
                    batch.update(musicianProfile.ref, { email: newEmail });
                }
                await batch.commit();
                toast.success('Email updated successfully');
                setShowEmailModal(false);
                setNewEmail('');
            }
        } catch (error) {
            console.error('Error updating email:', error);
            toast.error('Failed to update email');
        } finally {
            setEventLoading(false);
        }
    };

    const handlePasswordUpdate = async () => {
        if (!newPassword || !confirmPassword) {
            toast('Please fill in both password fields.');
            return;
        }
        if (newPassword !== confirmPassword) {
            toast('Passwords do not match. Please try again.');
            return;
        }
        const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,}$/;
        if (!passwordRegex.test(newPassword)) {
            toast('Password must be at least 8 characters long and include at least one uppercase letter, one lowercase letter, and one number.');
            return;
        }
        setEventLoading(true);
        if (!(await reauthenticateUser())) {
            setEventLoading(false);
            return;
        };
        try {
            await updatePassword(auth.currentUser, newPassword);
            toast.success('Password updated successfully');
            setShowPasswordModal(false);
            setNewPassword('');
            setConfirmPassword('');
        } catch (error) {
            console.error('Error updating password:', error);
            toast.error('Failed to update password.');
        } finally {
            setEventLoading(false);
        }
    };

    const deleteAssociatedData = async () => {
        const userId = auth.currentUser.uid;
        setEventLoading(true);
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
            await deleteGigsBatch(venueGigs.map(gig => gig.id));
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
            const conversations = await getConversationsByParticipantId(userId);
            for (const { id } of conversations) {
                await deleteConversation(id);
            }
            for (const venueId of venueIds) {
                await deleteFolderFromStorage(`venues/${venueId}`);
              }
            if (musicianId) {
                await deleteFolderFromStorage(`musicians/${musicianId}`);
            }
            await deleteUserDocument();
            await deleteUser(auth.currentUser);
            toast.success('Account and all associated data deleted successfully.');
            navigate('/');
        } catch (error) {
            console.error('Error deleting associated data:', error);
            toast.error('Failed to delete account.');
        } finally {
            setEventLoading(false);
        }
    };
    
    const confirmAccountDeletion = async () => {
        setEventLoading(true);
        if (!(await reauthenticateUser())) {
            setEventLoading(false);
            return;
        };
        if (window.confirm('Are you sure you want to delete your account? This action cannot be undone.')) {
            await deleteAssociatedData();
            setShowDeleteModal(false);
        } else {
            setEventLoading(false);
        }
    };

    const handleDeleteMusicianProfile = async (musicianId) => {
        setEventLoading(true);
        try {   
            if (window.confirm('Are you sure you want to delete your musician profile? This action cannot be undone.')) {
                setShowEventLoadingModal(true);
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
                const conversations = await getConversationsByParticipantId(musicianProfile.userId);
                for (const { id } of conversations) {
                    await deleteConversation(id);
                }
                await deleteFolderFromStorage(`musicians/${musicianId}`);
                await clearUserArrayField('musicianProfile');
                toast.success('Musician profile deleted successfully.');
                setShowEventLoadingModal(false);
            } else {
                setEventLoading(false);
            }
        } catch (error) {
            console.error('Error deleting musician profile:', error);
            toast.error('Failed to delete musician profile');
        } finally {
            setEventLoading(false)
        }
    };

    const handleDeleteVenueProfile = async (venueId) => {
        setEventLoading(true)
        try {   
            if (window.confirm('Are you sure you want to delete this venue profile? This action cannot be undone.')) {
                setShowEventLoadingModal(true);
                await deleteVenueProfile(venueId);
                const gigs = await getGigsByVenueId(venueId);
                await deleteGigsBatch(gigs.map(gig => gig.id));
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
                await updateUserArrayField('venueProfiles', 'remove', venueId);
                toast.success('Venue profile deleted successfully.');
                setShowEventLoadingModal(false);
            } else {
                setEventLoading(false);
            }
        } catch (error) {
            console.error('Error deleting venue profile:', error);
            toast.error('Failed to delete venue profile');
        } finally {
            setEventLoading(false);
        }
    };

    const [preview, setPreview] = useState(user?.picture || user?.photoURL || '');
    const [uploading, setUploading] = useState(false);
    const [error, setError] = useState('');
    const currentObjectUrlRef = useRef(null); // track local object URLs to revoke later
    const lastSelectedFileRef = useRef(null);  // track last file to avoid double-upload
  
    // keep preview in sync if user doc updates elsewhere
    useEffect(() => {
      if (user?.picture || user?.photoURL) {
        setPreview(user.picture || user.photoURL);
      }
    }, [user?.picture, user?.photoURL]);
  
    // utility: clean up an existing object URL
    const revokePreviewUrl = () => {
      if (currentObjectUrlRef.current) {
        URL.revokeObjectURL(currentObjectUrlRef.current);
        currentObjectUrlRef.current = null;
      }
    };
  
    // validate before upload
    const validateImage = (file) => {
      if (!file) return 'No file selected.';
      if (!file.type.startsWith('image/')) return 'Please choose an image file.';
      const MAX_MB = 8;
      if (file.size > MAX_MB * 1024 * 1024) return `Image must be smaller than ${MAX_MB}MB.`;
      return null;
    };
  
    // upload + save + swap preview to CDN URL
    const uploadAndSave = async (file) => {
      try {
        setUploading(true);
        setError('');
  
        // Choose a path. If you prefer the bands path, replace the next line with:
        // const path = `bands/${formData.bandId}/profileImg/${file.name}`;
        const path = `users/${user.uid}/profile/${file.name}`;
  
        const pictureUrl = await uploadFileToStorage(file, path);
  
        // persist on the user document
        await updateUserDocument(user.uid, {
          picture: pictureUrl,
          lastUpdatedAt: Date.now() // optional: useful for cache-busting
        });
  
        // swap preview to the final hosted URL (and revoke any temp object URL)
        revokePreviewUrl();
        setPreview(pictureUrl);
  
        // toast.success('Profile photo updated.'); // uncomment if you use toast
      } catch (e) {
        console.error('Profile photo upload failed:', e);
        setError('Failed to upload your image. Please try again.');
        // toast.error('Failed to upload your image.');
      } finally {
        setUploading(false);
      }
    };
  
    const handleFileChange = (e) => {
      const file = e.target.files?.[0];
      const validation = validateImage(file);
      if (validation) {
        setError(validation);
        return;
      }
      setError('');
  
      // Avoid re-uploading the identical File object
      if (file === lastSelectedFileRef.current) return;
      lastSelectedFileRef.current = file;
  
      // show local preview immediately
      revokePreviewUrl();
      const localUrl = URL.createObjectURL(file);
      currentObjectUrlRef.current = localUrl;
      setPreview(localUrl);
  
      // kick off upload
      uploadAndSave(file);
    };
  
    // cleanup on unmount
    useEffect(() => revokePreviewUrl, []);

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
                    <div className="img-settings">
                        <h3>Profile Picture:</h3>

                        <div className="image-container data-highlight">
                            <div
                                className={`image-preview ${!preview ? 'placeholder' : ''}`}
                                style={{ backgroundImage: preview ? `url(${preview})` : undefined }}
                                aria-busy={uploading}
                            >
                            {!preview && <CameraIcon />}
                            </div>
                            <label className="upload-btn btn secondary">
                                {uploading ? 'Uploading…' : 'Choose Photo'}
                                <input
                                    className="input photo"
                                    type="file"
                                    accept="image/*"
                                    onChange={handleFileChange}
                                    disabled={uploading}
                                    style={{ display: 'none' }}
                                />
                            </label>
                        </div>

                        {error && <p className="error-text">{error}</p>}
                    </div>
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
                    eventLoading ? (
                        <Portal>
                            <LoadingModal title={'Saving Changes...'} />
                        </Portal>
                    ) : (
                        <Portal>
                            <div className='modal account-page' onClick={() => setShowNameModal(false)}>
                                <div className='modal-content' onClick={(e) => e.stopPropagation()}>
                                    <div className="modal-header">
                                        <UserIcon />
                                        <h2>Change Your Account Name</h2>
                                    </div>
                                    <div className="modal-body">
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
                                            <button className='btn tertiary' onClick={() => setShowNameModal(false)}>Cancel</button>
                                            <button className='btn primary' onClick={handleNameUpdate}>Save</button>
                                        </div>
                                    </div>
                                    <div className='btn close tertiary' onClick={() => setShowNameModal(false)}>
                                        Close
                                    </div>
                                </div>
                            </div>
                        </Portal>
                    )
                )}
                {showEmailModal && (
                    eventLoading ? (
                        <Portal>
                            <LoadingModal title={'Saving Changes...'} />
                        </Portal>
                    ) : (
                        <Portal>
                            <div className='modal account-page' onClick={() => setShowEmailModal(false)}>
                                <div className='modal-content' onClick={(e) => e.stopPropagation()}>
                                    <div className="modal-header">
                                        <InviteIconSolid />
                                        <h2>Change Your Email Address</h2>
                                    </div>
                                    <div className="modal-body">
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
                                            <button className='btn tertiary' onClick={() => setShowEmailModal(false)}>Cancel</button>
                                            <button className='btn primary' onClick={handleEmailUpdate}>Submit</button>
                                        </div>
                                    </div>
                                    <div className='btn close tertiary' onClick={() => setShowEmailModal(false)}>
                                        Close
                                    </div>
                                </div>
                            </div>
                        </Portal>
                    )
                )}
                {showPasswordModal && (
                    eventLoading ? (
                        <Portal>
                            <LoadingModal title={'Saving Changes...'} />
                        </Portal>
                    ) : (
                        <Portal>
                            <div className='modal account-page' onClick={() => setShowPasswordModal(false)}>
                                <div className='modal-content' onClick={(e) => e.stopPropagation()}>
                                    <div className="modal-header">
                                        <PasswordIcon />
                                        <h2>Change Your Password</h2>
                                    </div>
                                    <div className="modal-body">
                                        <div className="input-container">
                                            <input
                                                type='password'
                                                className='input'
                                                placeholder='Enter Current Password'
                                                value={currentPassword}
                                                onChange={(e) => setCurrentPassword(e.target.value)}
                                            />
                                        </div>
                                        <div className="input-container">
                                            <input
                                                type='password'
                                                className='input'
                                                placeholder='Enter New Password'
                                                value={newPassword}
                                                onChange={(e) => setNewPassword(e.target.value)}
                                            />
                                        </div>
                                        <div className="input-container">
                                            <input
                                                type='password'
                                                className='input'
                                                placeholder='Confirm New Password'
                                                value={confirmPassword}
                                                onChange={(e) => setConfirmPassword(e.target.value)}
                                            />
                                        </div>
                                        <div className="two-buttons">
                                            <button className='btn tertiary' onClick={() => setShowPasswordModal(false)}>Cancel</button>
                                            <button className='btn primary' onClick={handlePasswordUpdate}>Submit</button>
                                        </div>
                                    </div>
                                    <div className='btn close tertiary' onClick={() => setShowPasswordModal(false)}>
                                        Close
                                    </div>
                                </div>
                            </div>
                        </Portal>
                    )
                )}
                {showDeleteModal && (
                    eventLoading ? (
                        <Portal>
                            <LoadingModal title={'Deleting Your Account...'} />
                        </Portal>
                    ) : (
                        <Portal>
                            <div className='modal account-page' onClick={() => setShowDeleteModal(false)}>
                                <div className='modal-content'onClick={(e) => e.stopPropagation()}>
                                    <div className="modal-header">
                                        <DeleteGigIcon />
                                        <h2>Delete Account</h2>
                                        <p>Are you sure? This action cannot be undone.</p>
                                    </div>
                                    <div className="modal-body">
                                        <div className="input-container">
                                            <input
                                                type='password'
                                                className='input'
                                                placeholder='Enter Your Password to Confirm'
                                                value={currentPassword}
                                                onChange={(e) => setCurrentPassword(e.target.value)}
                                            />
                                        </div>
                                        <div className="two-buttons">
                                            <button className='btn tertiary' onClick={() => setShowDeleteModal(false)}>Cancel</button>
                                            <button className='btn danger' onClick={confirmAccountDeletion}>Confirm Account Deletion</button>
                                        </div>
                                    </div>
                                    <div className='btn close tertiary' onClick={() => setShowDeleteModal(false)}>
                                        Close
                                    </div>
                                </div>
                            </div>
                        </Portal>
                    )
                )}
                {showTransferModal && (
                    transferLoading ? (
                        <Portal>
                            <LoadingModal title={'Saving Changes...'} />
                        </Portal>
                    ) : (
                        <Portal>
                            <div className="modal account-page transfer" onClick={() => !transferLoading && setShowTransferModal(false)}>
                                <div className="modal-content" onClick={(e) => e.stopPropagation()}>
                                    <div className="modal-header">
                                        <LogOutIcon />
                                        <h2>Transfer Venue Ownership</h2>
                                        <p>
                                            You’re transferring <strong>{venueToTransfer?.name}</strong> to another Gigin account.
                                            The recipient will become the new owner and you’ll lose access to this venue.
                                        </p>
                                    </div>
                                    <div className="modal-body">
                                        <div className="input-container" style={{ marginTop: 10 }}>
                                            <label htmlFor="recipientEmail" className='label'>Recipient’s email</label>
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
                                            <p style={{ color: 'red' }}>
                                                Make sure the recipient has already created a Gigin account with this email.
                                            </p>
                                        </div>

                                        <div className="two-buttons" style={{ marginTop: 16 }}>
                                        <button
                                                className="btn secondary"
                                                disabled={transferLoading}
                                                onClick={() => setShowTransferModal(false)}
                                            >
                                                Cancel
                                            </button>
                                            <button
                                            className="btn danger"
                                            disabled={transferLoading || !recipientEmail}
                                            onClick={async () => {
                                                if (!recipientEmail) return toast('Please enter a valid email.');
                                                if (!venueToTransfer) return;
                                                const ok = window.confirm(
                                                    `Transfer "${venueToTransfer.name}" to ${recipientEmail}? You will lose access.`
                                                );
                                                if (!ok) return;
                                                setTransferLoading(true);
                                                try {
                                                    await transferVenueOwnership(venueToTransfer, recipientEmail);
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
                                            Confirm Transfer
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
                        </Portal>
                    )
                )}
                {showEventLoadingModal && (
                    <Portal>
                        <LoadingModal />
                    </Portal>
                )}
            </div>
        );
    }
};