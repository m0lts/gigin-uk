import { useEffect, useRef, useState } from 'react';
import { useNavigate, useSearchParams, useLocation } from 'react-router-dom';
import { useAuth } from '@hooks/useAuth';
import { LoadingScreen } from '@features/shared/ui/loading/LoadingScreen';
import { EditIcon } from '@features/shared/ui/extras/Icons';
import { updateEmail, updatePassword, deleteUser, reauthenticateWithCredential, EmailAuthProvider } from 'firebase/auth';
import { auth } from '@lib/firebase';
import '@styles/shared/account-page.styles.css';
import { removeGigApplicant } from '@services/api/gigs';
import { getVenueProfilesByUserId } from '@services/client-side/venues';
import { getMusicianProfileByUserId } from '@services/client-side/artists';
import { getGigsByVenueId, getGigsByVenueIds } from '@services/client-side/gigs';
import { getReviewsByMusicianId, getReviewsByVenueId, getReviewsByVenueIds } from '@services/client-side/reviews';
import { getConversationsByParticipantId, getConversationsByParticipants } from '@services/client-side/conversations';
import { deleteMusicianProfile, getMusicianProfileByMusicianId, updateUserPayoutsEnabledAcrossAllProfiles } from '@services/client-side/artists';
import { deleteFolderFromStorage } from '@services/storage';
import { deleteTemplatesByVenueId, deleteVenueProfile } from '@services/client-side/venues';
import { updateUserDocument } from '../../services/client-side/users';
import { updateVenueProfileAccountNames } from '../../services/client-side/venues';
import { getConnectAccountStatus, deleteStripeConnectAccount, getStripeBalance, payoutToBankAccount } from '@services/api/payments';
import { updateStripeConnectId } from '@services/api/users';
import { useStripeConnect } from '@hooks/useStripeConnect';
import { toast } from 'sonner';
import Portal from '../shared/components/Portal';
import {
  CameraIcon,
  DeleteGigIcon,
  InviteIconSolid,
  LogOutIcon,
  PasswordIcon,
  UserIcon,
  BankAccountIcon,
  CoinsIconSolid,
  StripeIcon,
  MoreInformationIcon,
  SuccessIcon,
  ExclamationIconSolid,
  WarningIcon,
  PaymentSystemIcon,
  CopyIcon,
  GuitarsIcon,
} from '../shared/ui/extras/Icons';
import { LoadingModal } from '../shared/ui/loading/LoadingModal';
import { firestore } from '@lib/firebase';
import { uploadFileToStorage } from '../../services/storage';
import { clearUserArrayField, deleteUserDocument, updateUserArrayField, setPrimaryArtistProfile } from '@services/api/users';
import { transferVenueOwnership } from '@services/api/venues';
import { deleteReview } from '@services/api/reviews';
import { deleteGigsBatch } from '../../services/client-side/gigs';
import { deleteConversation } from '@services/api/conversations';
import { useBreakpoint } from '../../hooks/useBreakpoint';
import {
  ConnectAccountOnboarding,
  ConnectComponentsProvider,
  ConnectAccountManagement,
} from '@stripe/react-connect-js';
import { LoadingSpinner } from '../shared/ui/loading/Loading';

export const Account = () => {
    const { user,  } = useAuth();
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const location = useLocation();
    const { isMdUp } = useBreakpoint();
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
    const [settingPrimary, setSettingPrimary] = useState(false);
    const [profileToSetPrimary, setProfileToSetPrimary] = useState(null);
    const [showSetPrimaryModal, setShowSetPrimaryModal] = useState(false);

    // Stripe / payouts state (user-level)
    const [connectedAccountId, setConnectedAccountId] = useState(user?.stripeConnectId || null);
    const stripeConnectInstance = useStripeConnect(connectedAccountId);
    const [acctStatus, setAcctStatus] = useState(null);
    const [acctStatusLoading, setAcctStatusLoading] = useState(false);
    const [showStripeManageModal, setShowStripeManageModal] = useState(false);
    const [stripeCreatingAccount, setStripeCreatingAccount] = useState(false);
    const [stripeError, setStripeError] = useState(false);
    const [paymentSystemModal, setPaymentSystemModal] = useState(false);
    const [stripeSystemModal, setStripeSystemModal] = useState(false);
    const [showDeleteStripeModal, setShowDeleteStripeModal] = useState(false);
    const [deletingStripe, setDeletingStripe] = useState(false);
    const [stripeBalance, setStripeBalance] = useState(null);
    const [loadingStripeBalance, setLoadingStripeBalance] = useState(false);
    const [payingOut, setPayingOut] = useState(false);
    // const useEmulator = import.meta.env.VITE_USE_EMULATOR === 'true';
    // const stripeAccountUrl = useEmulator
    //     ? import.meta.env.VITE_STRIPE_ACCOUNT_URL_EMULATOR
    //     : import.meta.env.VITE_STRIPE_ACCOUNT_URL;
    const stripeAccountUrl = import.meta.env.VITE_STRIPE_ACCOUNT_URL;
    const payoutsRef = useRef(null);

    const [showPayoutHelp, setShowPayoutHelp] = useState(false);
    const [emailMessagesEnabled, setEmailMessagesEnabled] = useState(user?.emailMessages !== false);
    const [updatingEmailMessages, setUpdatingEmailMessages] = useState(false);

    const handleCopy = async (value) => {
        try {
            await navigator.clipboard.writeText(value);
            toast.success('Copied to clipboard.');
        } catch (e) {
            console.error('Copy failed', e);
        }
    };

    useEffect(() => {
        if (isMdUp) {
            setWidth('80%');
        } else {
            setWidth('95%');
        }
    }, [isMdUp]);

    useEffect(() => {
        setVenueList(user?.venueProfiles || []);
    }, [user]);

    useEffect(() => {
        setEmailMessagesEnabled(user?.emailMessages !== false);
    }, [user?.emailMessages]);

    // Keep connectedAccountId in sync with user doc
    useEffect(() => {
        if (user?.stripeConnectId && !connectedAccountId) {
            setConnectedAccountId(user.stripeConnectId);
        }
    }, [user?.stripeConnectId, connectedAccountId]);

    // Fetch Stripe balance when user has Stripe Connect account
    useEffect(() => {
        if (user?.stripeConnectId) {
            const fetchBalance = async () => {
                setLoadingStripeBalance(true);
                try {
                    const result = await getStripeBalance();
                    setStripeBalance(result?.withdrawableEarnings || 0);
                } catch (e) {
                    console.error('Failed to fetch Stripe balance:', e);
                    // Fallback to user document value
                    setStripeBalance(user?.withdrawableEarnings || 0);
                } finally {
                    setLoadingStripeBalance(false);
                }
            };
            fetchBalance();
        } else {
            // If no Stripe account, use user document value
            setStripeBalance(user?.withdrawableEarnings || 0);
        }
    }, [user?.stripeConnectId, user?.withdrawableEarnings]);

    const handleWithdrawFunds = async () => {
        setPayingOut(true);
        // Use Stripe balance if available, otherwise use user document value
        const amountToWithdraw = user?.stripeConnectId
            ? (stripeBalance !== null ? stripeBalance : 0)
            : (user?.withdrawableEarnings || 0);
        
        if (!amountToWithdraw || amountToWithdraw <= 0) {
            toast.error('No funds available to withdraw.');
            setPayingOut(false);
            return;
        }
        
        try {
            // Pass user.uid as musicianId for backward compatibility (backend uses req.auth.uid anyway)
            const result = await payoutToBankAccount({ musicianId: user.uid, amount: amountToWithdraw });
            const success = result?.success;
            if (success) {
                toast.success('Payout successful!');
                // Refresh balance after payout
                if (user?.stripeConnectId) {
                    const balanceResult = await getStripeBalance();
                    setStripeBalance(balanceResult?.withdrawableEarnings || 0);
                }
            } else {
                const errorMessage = result?.message || 'Payout failed. Please try again.';
                toast.error(errorMessage);
            }
        } catch (error) {
            console.error('Error processing payout:', error);
            const errorMessage = error?.payload?.error?.message || error?.message || 'An error occurred while processing the payout. Please try again later.';
            toast.error(errorMessage);
        } finally {
            setPayingOut(false);
        }
    };

    // Load Stripe Connect account status when we have a connected account
    useEffect(() => {
        let ignore = false;
        const load = async () => {
            if (!connectedAccountId) return;
            setAcctStatusLoading(true);
            try {
                const data = await getConnectAccountStatus();
                if (!ignore) setAcctStatus(data);
            } catch (e) {
                console.error('Failed to load Stripe account status', e);
            } finally {
                if (!ignore) setAcctStatusLoading(false);
            }
        };
        load();
        return () => {
            ignore = true;
        };
    }, [connectedAccountId]);

    // Auto-scroll to payouts section when arriving with intent flag or hash
    useEffect(() => {
        const intentFlag = searchParams.get('show') === 'payouts';
        const hasHash = location.hash === '#payouts';
        // inline recomputation to avoid temporal dead zone on showPayoutSection
        const hasArtistProfiles = Array.isArray(user?.artistProfiles) && user.artistProfiles.length > 0;
        const hasStripeAccount = !!user?.stripeConnectId;
        const shouldShowPayoutSection = hasArtistProfiles || hasStripeAccount || intentFlag;
        if (!shouldShowPayoutSection) return;
        if ((intentFlag || hasHash) && payoutsRef.current) {
            // small timeout to ensure layout has rendered
            setTimeout(() => {
                payoutsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
            }, 250);
        }
    }, [searchParams, location.hash, user?.artistProfiles, user?.stripeConnectId]);

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

    // const handleEmailUpdate = async () => {
    //     if (!newEmail) {
    //         toast('Please enter a new email address.')
    //         return;
    //     }
    //     const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    //     if (!emailRegex.test(newEmail)) {
    //         toast('Please enter a valid email address.');
    //         return;
    //     }
    //     setEventLoading(true);
    //     try {
    //         if (auth.currentUser) {
    //             await updateEmail(auth.currentUser, newEmail);
    //             const userId = auth.currentUser.uid;
    //             const batch = firestore.batch();
    //             const venueProfiles = await getVenueProfilesByUserId(userId);
    //             venueProfiles.forEach(profile => {
    //                 batch.update(profile.ref, { email: newEmail });
    //             });
    //             const musicianProfile = await getMusicianProfileByUserId(userId);
    //             if (musicianProfile) {
    //                 batch.update(musicianProfile.ref, { email: newEmail });
    //             }
    //             await batch.commit();
    //             toast.success('Email updated successfully');
    //             setShowEmailModal(false);
    //             setNewEmail('');
    //         }
    //     } catch (error) {
    //         console.error('Error updating email:', error);
    //         toast.error('Failed to update email');
    //     } finally {
    //         setEventLoading(false);
    //     }
    // };

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

    const handleEmailMessagesToggle = async () => {
        setUpdatingEmailMessages(true);
        try {
            const newValue = !emailMessagesEnabled;
            await updateUserDocument(auth.currentUser.uid, {
                emailMessages: newValue,
            });
            setEmailMessagesEnabled(newValue);
            toast.success(newValue ? 'Email notifications enabled' : 'Email notifications disabled');
        } catch (error) {
            console.error('Error updating email notifications:', error);
            toast.error('Failed to update email notification settings.');
        } finally {
            setUpdatingEmailMessages(false);
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
                await deleteReview({ reviewId: id });
            }
            if (musicianId) {
                const musicianReviews = await getReviewsByMusicianId(musicianId);
                for (const { id } of musicianReviews) {
                  await deleteReview({ reviewId: id });
                }
            }
            if (musicianProfile?.gigApplications?.length) {
                for (const application of musicianProfile.gigApplications) {
                    await removeGigApplicant({ gigId: application.gigId, musicianId: musicianProfile.musicianId });
                }
            }
            const conversations = await getConversationsByParticipantId(userId);
            for (const { id } of conversations) {
                await deleteConversation({ conversationId: id });
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

    // const handleDeleteMusicianProfile = async (musicianId) => {
    //     setEventLoading(true);
    //     try {   
    //         if (window.confirm('Are you sure you want to delete your musician profile? This action cannot be undone.')) {
    //             setShowEventLoadingModal(true);
    //             const musicianProfile = await getMusicianProfileByMusicianId(musicianId);
    //             if (musicianProfile?.gigApplications?.length) {
    //                 for (const application of musicianProfile.gigApplications) {
    //                     await removeGigApplicant(application.gigId, musicianId);
    //                 }
    //             }
    //             await deleteMusicianProfile(musicianId);
    //             const musicianReviews = await getReviewsByMusicianId(musicianId);
    //             for (const { id } of musicianReviews) {
    //               await deleteReview({ reviewId: id });
    //             }
    //             const conversations = await getConversationsByParticipantId(musicianProfile.userId);
    //             for (const { id } of conversations) {
    //                 await deleteConversation(id);
    //             }
    //             await deleteFolderFromStorage(`musicians/${musicianId}`);
    //             await clearUserArrayField('musicianProfile');
    //             toast.success('Musician profile deleted successfully.');
    //             setShowEventLoadingModal(false);
    //         } else {
    //             setEventLoading(false);
    //         }
    //     } catch (error) {
    //         console.error('Error deleting musician profile:', error);
    //         toast.error('Failed to delete musician profile');
    //     } finally {
    //         setEventLoading(false)
    //     }
    // };

    // const handleDeleteVenueProfile = async (venueId) => {
    //     setEventLoading(true)
    //     try {   
    //         if (window.confirm('Are you sure you want to delete this venue profile? This action cannot be undone.')) {
    //             setShowEventLoadingModal(true);
    //             await deleteTemplatesByVenueId(venueId);
    //             await deleteVenueProfile(venueId);
    //             const gigs = await getGigsByVenueId(venueId);
    //             await deleteGigsBatch(gigs.map(gig => gig.id));
    //             const reviews = await getReviewsByVenueId(venueId);
    //             for (const { id } of reviews) {
    //                 await deleteReview({ reviewId: id });
    //             }
    //             const conversations = await getConversationsByParticipantId(user.uid);
    //             for (const { id } of conversations) {
    //                 await deleteConversation({ conversationId: id });
    //             }
    //             await deleteFolderFromStorage(`venues/${venueId}`);
    //             await updateUserArrayField('venueProfiles', 'remove', venueId);
    //             toast.success('Venue profile deleted successfully.');
    //             setShowEventLoadingModal(false);
    //         } else {
    //             setEventLoading(false);
    //         }
    //     } catch (error) {
    //         console.error('Error deleting venue profile:', error);
    //         toast.error('Failed to delete venue profile');
    //     } finally {
    //         setEventLoading(false);
    //     }
    // };

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
  
        toast.success('Profile photo updated.');
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

    // Determine whether to show payouts / Stripe section
    const hasArtistProfiles = Array.isArray(user?.artistProfiles) && user.artistProfiles.length > 0;
    const hasStripeAccount = !!user?.stripeConnectId;
    const intentFlag = searchParams.get('show') === 'payouts';
    const showPayoutSection = hasArtistProfiles || hasStripeAccount || intentFlag;

    const renderStripeStatusBox = () => {
        if (acctStatusLoading) {
            return (
                <div className="status-box loading">
                    <span>Checking account status…</span>
                </div>
            );
        }
        if (!acctStatus?.exists) return null;

        const { status, actions } = acctStatus;
        const classes =
            status === 'all_good' ? 'ok' : status === 'warning' ? 'warn' : 'urgent';

        const label =
            status === 'all_good'
                ? 'No Actions Required'
                : status === 'warning' && actions.includes('individual.verification.document')
                ? 'ID Verification Required Soon'
                : status === 'warning'
                ? `${actions.length} Action${actions.length === 1 ? '' : 's'} Required`
                : status === 'urgent' && actions.includes('individual.verification.document')
                ? 'ID Verification Required'
                : status === 'urgent'
                ? 'Action Required'
                : 'Account Status';

        const icon =
            status === 'all_good'
                ? <SuccessIcon />
                : status === 'warning'
                ? <ExclamationIconSolid />
                : <WarningIcon />;

        return (
            status !== 'all_good' ? (
                <div
                    className={`status-box ${classes} clickable`}
                    onClick={() => setShowStripeManageModal(true)}
                >
                    {icon}
                    <span>{label}</span>
                </div>
            ) : (
                <div className={`status-box ${classes}`}>
                    {icon}
                    <span>{label}</span>
                </div>
            )
        );
    };

    const handleDeleteStripeAccount = async () => {
        if (!user?.uid || !user?.stripeConnectId) return;
        setDeletingStripe(true);
        try {
            // Pass userId as musicianId for backward compatibility (backend uses req.auth.uid anyway)
            const res = await deleteStripeConnectAccount({ musicianId: user.uid });
            if (res?.success) {
                setConnectedAccountId(null);
                // Clear stripeConnectId and disable payouts via server endpoint
                await updateStripeConnectId({ 
                    stripeConnectId: null,
                    enablePayouts: false 
                });
                toast.success('Stripe account deleted.');
                // Refresh balance after deletion
                setStripeBalance(0);
                window.location.reload();
            } else {
                const errorMessage = res?.message || 'Could not delete Stripe account.';
                toast.error(errorMessage);
            }
        } catch (e) {
            console.error('Error deleting Stripe account:', e);
            const errorMessage = e?.payload?.error?.message || e?.message || 'Failed to delete Stripe account.';
            toast.error(errorMessage);
        } finally {
            setDeletingStripe(false);
        }
    };

    const handleAccountManagementClose = async () => {
        setAcctStatusLoading(true);
        setShowStripeManageModal(false);
        try {
            const fresh = await getConnectAccountStatus();
            setAcctStatus(fresh);
        } catch (e) {
            console.error('Refresh Stripe account status failed', e);
        } finally {
            setAcctStatusLoading(false);
        }
    };

    const handleSetPrimary = async () => {
        setSettingPrimary(true);
        try {
            await setPrimaryArtistProfile({ artistProfileId: profileToSetPrimary.id });
            toast.success(`${profileToSetPrimary.name} set as primary profile`);
            window.location.reload();
        } catch (error) {
            console.error('Failed to set primary profile:', error);
            const errorMessage = error?.payload?.error?.message || 
                                 error?.message || 
                                 'Failed to set primary profile. Please try again.';
            toast.error(errorMessage);
        } finally {
            setSettingPrimary(false);
            setShowSetPrimaryModal(false);
        }
    };

    if (!user) {
        return <LoadingScreen />;
    } else {
        return (
            <div className='account-page' style={{ width: width, marginTop: user.artistProfiles?.length > 0 ? '6rem' : '0' }}>
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
                            {/* <button className='btn primary' onClick={() => setShowEmailModal(true)}>
                                Change Email Address
                            </button> */}
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
                    <div className='password-settings'>
                        <h3>Email Notifications:</h3>
                        <div className='data-highlight'>
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
                                <h4>Receive email notifications when you receive messages</h4>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                                    <label className="gigs-toggle-switch" style={{ cursor: updatingEmailMessages ? 'not-allowed' : 'pointer' }}>
                                        <input
                                            type="checkbox"
                                            checked={emailMessagesEnabled}
                                            onChange={handleEmailMessagesToggle}
                                            disabled={updatingEmailMessages}
                                        />
                                        <span className="gigs-toggle-slider"></span>
                                    </label>
                                    <span style={{ fontSize: '0.875rem', fontWeight: 500, color: 'var(--gn-off-black)' }}>
                                        {emailMessagesEnabled ? 'Enabled' : 'Disabled'}
                                    </span>
                                </div>
                            </div>
                        </div>
                    </div>
                    <div className='delete-settings'>
                        <h3>Account Deletion:</h3>
                        <div className='data-highlight'>
                            <h4>Please get in touch with us if you'd like to delete your account.</h4>
                            <button
                                className='btn danger'
                                onClick={() => window.location.href = 'mailto:toby@giginmusic.com?subject=Account%20Deletion%20Request'}
                            >
                                Contact Us
                            </button>
                        </div>
                    </div>
                </div>

                {showPayoutSection && (
                    <div className='payout-settings' ref={payoutsRef}>
                        <div className='payout-header-section'>
                            <h2>Payouts &amp; Stripe</h2>
                        </div>
                        <div className='data-highlight'>
                            <div className='payout-header'>
                                <div className="text">
                                    <BankAccountIcon />
                                    <h3>Payout Account</h3>
                                </div>
                                <div className="payout-header-actions">
                                    {user?.stripeConnectId && (
                                        <div className="account-status">
                                            <h6>Account Status:</h6>
                                            {renderStripeStatusBox()}
                                        </div>
                                    )}
                                    {!connectedAccountId && !stripeConnectInstance && (
                                        <button
                                            className="btn secondary"
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                setShowPayoutHelp((prev) => !prev);
                                            }}
                                        >
                                            <MoreInformationIcon />
                                            <h4>Help</h4>
                                        </button>
                                    )}
                                    {showPayoutHelp && (
                                        <div
                                            className="payout-help-popover"
                                            onClick={() => setShowPayoutHelp(false)}
                                        >
                                            <div className="text-information">
                                                <p>
                                                    Unless you are registered as a business, select{' '}
                                                    <strong>Individual / Sole Trader</strong>.
                                                </p>
                                                <p>
                                                    If Stripe asks for a website link, enter your artist profile
                                                    link:
                                                </p>
                                                {user?.artistProfileIds?.length > 0 && (
                                                    <p
                                                        className="link"
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            handleCopy(
                                                                `https://giginmusic.com/${user.artistProfileIds[0]}`
                                                            );
                                                        }}
                                                    >
                                                        {`https://giginmusic.com/${user.artistProfileIds[0]}`}{' '}
                                                        <CopyIcon />
                                                    </p>
                                                )}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>
                            {!connectedAccountId && !stripeConnectInstance && (
                                <div className="payout-onboarding-intro">
                                    <h4>
                                        Connect a payout account so you can receive money for gigs you perform as an artist or band.
                                        This payout account is linked to your Gigin account (not a single artist profile).
                                    </h4>
                                    <button
                                        className='btn primary'
                                        disabled={stripeCreatingAccount}
                                        onClick={async () => {
                                            if (!user?.uid || !stripeAccountUrl) return;
                                            setStripeCreatingAccount(true);
                                            setStripeError(false);
                                            try {
                                                const res = await fetch(stripeAccountUrl, {
                                                    method: 'POST',
                                                    headers: { 'Content-Type': 'application/json' },
                                                    body: JSON.stringify({ userId: user.uid }),
                                                });
                                                
                                                if (!res.ok) {
                                                    const errorData = await res.json().catch(() => ({ error: `Server error: ${res.status} ${res.statusText}` }));
                                                    console.error('Stripe account creation failed:', errorData);
                                                    setStripeError(true);
                                                    return;
                                                }
                                                
                                                const data = await res.json();
                                                const { account, error } = data;
                                                if (account) {
                                                    setConnectedAccountId(account);
                                                    // Don't save to user doc yet - wait until onboarding completes
                                                    // This ensures the onboarding UI shows up
                                                } else if (error) {
                                                    console.error('Stripe account creation error:', error);
                                                    setStripeError(true);
                                                }
                                            } catch (e) {
                                                console.error('Error creating Stripe account', e);
                                                setStripeError(true);
                                            } finally {
                                                setStripeCreatingAccount(false);
                                            }
                                        }}
                                    >
                                        {stripeCreatingAccount ? 'Connecting…' : 'Connect payout account'}
                                    </button>
                                    {stripeError && (
                                        <p className='error-text'>Something went wrong while creating your Stripe account. Please try again.</p>
                                    )}
                                </div>
                            )}

                            {stripeConnectInstance && connectedAccountId && !user?.stripeConnectId && (
                                <div className="stripe-onboarding-container">
                                    <ConnectComponentsProvider connectInstance={stripeConnectInstance}>
                                        <ConnectAccountOnboarding
                                            onExit={async () => {
                                                try {
                                                    if (user?.uid && connectedAccountId) {
                                                        // Update user document with Stripe Connect ID via server endpoint
                                                        // This also enables payouts across all artist profiles
                                                        await updateStripeConnectId({ 
                                                            stripeConnectId: connectedAccountId,
                                                            enablePayouts: true 
                                                        });
                                                    }
                                                    toast.success('Payout account connected!');
                                                } catch (error) {
                                                    console.error('Error updating user with Stripe account ID:', error);
                                                    const errorMessage = error?.payload?.error?.message || error?.message || 'Error connecting payout account. Please try again.';
                                                    toast.error(errorMessage);
                                                }
                                            }}
                                        />
                                    </ConnectComponentsProvider>
                                </div>
                            )}

                            {user?.stripeConnectId && isMdUp && (
                                <div className="information-grid">
                                    <div className="information-item box" onClick={() => setPaymentSystemModal(true)}>
                                        <PaymentSystemIcon />
                                        <h3>How The Gigin Payment System Works</h3>
                                        <p>Learn how the Gigin payment system works and how to withdraw your gig earnings!</p>
                                    </div>
                                    <div className="information-item box" onClick={() => setStripeSystemModal(true)}>
                                        <StripeIcon />
                                        <h3>How Stripe Securely Manages Your Funds</h3>
                                        <p>Learn how Gigin uses Stripe to handle your gig payments and how your information is securely stored.</p>
                                    </div>
                                    <div className="information-item actions">
                                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
                                            <h6>Available to Withdraw</h6>
                                            {loadingStripeBalance ? (
                                                <LoadingSpinner />
                                            ) : (
                                                <h3 style={{ margin: 0, fontSize: '1.5rem', fontWeight: 'bold' }}>
                                                    £{(() => {
                                                        const amount = user?.stripeConnectId
                                                            ? (stripeBalance !== null ? parseFloat(stripeBalance) : 0)
                                                            : (user?.withdrawableEarnings ? parseFloat(user.withdrawableEarnings) : 0);
                                                        return amount.toFixed(2);
                                                    })()}
                                                </h3>
                                            )}
                                        </div>
                                        <button 
                                            className="btn primary" 
                                            onClick={handleWithdrawFunds}
                                            disabled={payingOut || (() => {
                                                const withdrawableAmount = user?.stripeConnectId
                                                    ? (stripeBalance !== null ? stripeBalance : 0)
                                                    : (user?.withdrawableEarnings || 0);
                                                return withdrawableAmount <= 0;
                                            })()}
                                        >
                                            {payingOut ? 'Processing...' : 'Withdraw Funds'}
                                        </button>
                                        {user.stripeConnectId && stripeConnectInstance && (
                                            <button className="btn secondary" onClick={() => setShowStripeManageModal(true)}>
                                                Edit Stripe Details
                                            </button>
                                        )}
                                        <button
                                            className="btn danger"
                                            onClick={() => setShowDeleteStripeModal(true)}
                                            disabled={deletingStripe || (() => {
                                                const withdrawableAmount = user?.stripeConnectId
                                                    ? (stripeBalance !== null ? stripeBalance : 0)
                                                    : (user?.withdrawableEarnings || 0);
                                                return withdrawableAmount > 0;
                                            })()}
                                        >
                                            Delete Stripe Account
                                        </button>
                                    </div>
                                </div>
                            )}

                            {user?.stripeConnectId && !isMdUp && (
                                <div className="information-item actions">
                                    <div style={{ marginBottom: '1rem', width: '100%' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
                                            <CoinsIconSolid />
                                            <h4 style={{ margin: 0 }}>Available to Withdraw</h4>
                                        </div>
                                        {loadingStripeBalance ? (
                                            <p>Loading...</p>
                                        ) : (
                                            <h3 style={{ margin: 0, fontSize: '1.5rem', fontWeight: 'bold' }}>
                                                £{(() => {
                                                    const amount = user?.stripeConnectId
                                                        ? (stripeBalance !== null ? parseFloat(stripeBalance) : 0)
                                                        : (user?.withdrawableEarnings ? parseFloat(user.withdrawableEarnings) : 0);
                                                    return amount.toFixed(2);
                                                })()}
                                            </h3>
                                        )}
                                    </div>
                                    <button 
                                        className="btn tertiary information-button" 
                                        onClick={handleWithdrawFunds}
                                        disabled={payingOut || (() => {
                                            const withdrawableAmount = user?.stripeConnectId
                                                ? (stripeBalance !== null ? stripeBalance : 0)
                                                : (user?.withdrawableEarnings || 0);
                                            return withdrawableAmount <= 0;
                                        })()}
                                    >
                                        {payingOut ? 'Processing...' : 'Withdraw Funds'}
                                    </button>
                                    {user.stripeConnectId && stripeConnectInstance && (
                                        <button className="btn tertiary information-button" onClick={() => setShowStripeManageModal(true)}>
                                            Edit Stripe Details
                                        </button>
                                    )}
                                    <button
                                        className="btn tertiary information-button"
                                        onClick={() => setShowDeleteStripeModal(true)}
                                        disabled={deletingStripe || (() => {
                                            const withdrawableAmount = user?.stripeConnectId
                                                ? (stripeBalance !== null ? stripeBalance : 0)
                                                : (user?.withdrawableEarnings || 0);
                                            return withdrawableAmount > 0;
                                        })()}
                                    >
                                        Delete Stripe Account
                                    </button>
                                </div>
                            )}
                        </div>
                    </div>
                )}

                {isMdUp && (
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
                                                        navigate('/venues/add-venue', { state: { venue } })
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
                                                {/* <button
                                                    className='btn danger'
                                                    onClick={() => handleDeleteVenueProfile(venue.id)}
                                                >
                                                    Delete Profile
                                                </button> */}
                                            </div>
                                        </li>
                                    ))}
                                </ul>
                            </>
                        )}

                        {/* Musician Profile Section */}
                        {user.artistProfiles?.length > 0 && (
                            <>
                                <h2>Artist Profile{user.artistProfiles.length > 1 ? 's' : ''}</h2>
                                {user.artistProfiles.map((artistProfile) => {
                                    const profileId = artistProfile.id || artistProfile.profileId;
                                    const isPrimary = user.primaryArtistProfileId === profileId;
                                    const canSetPrimary = user.artistProfiles.length > 1 && !user.primaryProfileSet;
                                    const showPrimaryButton = canSetPrimary && !isPrimary;
                                    
                                    return (
                                        <div key={profileId} className='account-profile'>
                                            <div className='account-profile-data'>
                                                <figure className='account-profile-img'>
                                                    <img src={artistProfile.heroMedia?.url} alt={artistProfile.name} />
                                                </figure>
                                                <div>
                                                    <h3>
                                                        {artistProfile.name}
                                                        {isPrimary && (
                                                            <span style={{ 
                                                                marginLeft: '0.5rem', 
                                                                fontSize: '0.875rem', 
                                                                color: 'var(--gn-primary)', 
                                                                fontWeight: 500 
                                                            }}>
                                                                (Primary)
                                                            </span>
                                                        )}
                                                    </h3>
                                                </div>
                                            </div>
                                            <div className='account-profile-actions'>
                                                <button
                                                    className='btn tertiary'
                                                    onClick={() =>
                                                        navigate(`/artist-profile/${profileId}`)
                                                    }
                                                >
                                                    <EditIcon />
                                                </button>
                                                {showPrimaryButton && (
                                                    <button
                                                        className='btn secondary'
                                                        disabled={settingPrimary}
                                                        onClick={async () => {
                                                            if (!profileId) return;
                                                            setShowSetPrimaryModal(true);
                                                            setProfileToSetPrimary(artistProfile);
                                                        }}
                                                    >
                                                        Set as Primary
                                                    </button>
                                                )}
                                                {/* <button
                                                    className='btn danger'
                                                    onClick={() => handleDeleteMusicianProfile(user.musicianProfile.musicianId)}
                                                >
                                                    Delete Profile
                                                </button> */}
                                            </div>
                                        </div>
                                    );
                                })}
                            </>
                        )}
                    </div>
                )}
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
                                                    await transferVenueOwnership({ venueId: venueToTransfer.id, recipientEmail });
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
                {showStripeManageModal && stripeConnectInstance && (
                    <Portal>
                        <div className="modal stripe-account" onClick={() => handleAccountManagementClose()}>
                            <div className="modal-content scrollable" onClick={(e) => e.stopPropagation()}>
                                <div className="modal-header">
                                    <CoinsIconSolid />
                                    <h2>Edit payout details</h2>
                                    <p>Change your Stripe connect account details here.</p>
                                    <div className="more-information">
                                        <p><MoreInformationIcon /> If you require ID verification, click the edit text under the "Personal Details" title. Then click the 'Upload Document' button to upload an ID document.</p>
                                    </div>
                                    <button className="btn close tertiary" onClick={() => handleAccountManagementClose()}>Close</button>
                                </div>
                                <div className="modal-body">
                                    <ConnectComponentsProvider connectInstance={stripeConnectInstance}>
                                        <ConnectAccountManagement
                                            onExit={async () => {
                                                await handleAccountManagementClose();
                                            }}
                                        />
                                    </ConnectComponentsProvider>
                                </div>
                            </div>
                        </div>
                    </Portal>
                )}

                {paymentSystemModal && (
                    <Portal>
                        <div className="modal more-information" onClick={() => setPaymentSystemModal(false)}>
                            <div className="modal-content" onClick={(e) => e.stopPropagation()}>
                                <div className="modal-header">
                                    <PaymentSystemIcon />
                                    <h2>How The Gigin Payment System Works</h2>
                                    <button className="btn close tertiary" onClick={() => setPaymentSystemModal(false)}>Close</button>
                                </div>
                                <div className="modal-body">
                                    <p>
                                        <strong>Note:</strong> The Gigin payment system applies only to gigs where a venue
                                        is paying a fee to the musician or band. Open mic nights, charity events, and
                                        ticketed gigs where payment comes from ticket sales do not use this process.
                                    </p>
                                    <hr />
                                    <p>
                                        Our goal is to make sure that musicians get paid fairly, on time, and securely —
                                        and that venues have the peace of mind that funds are only released when the gig
                                        has been performed as agreed. This is why all gig payments go through our
                                        partnership with Stripe, one of the world's most trusted payment providers.
                                    </p>
                                    <hr />
                                    <ol>
                                        <li>
                                            <strong>1. Gig Application Accepted</strong><br />
                                            Once a venue accepts your gig application, we automatically prepare the secure
                                            payment process in the background.
                                            <br />
                                            This ensures that as soon as both parties
                                            agree to the gig, the financial side is ready to go.
                                        </li>

                                        <li>
                                            <strong>2. Venue Pays the Gig Fee</strong><br />
                                            The venue pays the agreed gig fee through Gigin. This payment is made before
                                            the performance date, so you can be confident that the money is already set
                                            aside and ready for release after the event.
                                        </li>

                                        <li>
                                            <strong>3. Funds Held in Secure Escrow</strong><br />
                                            Once the venue pays, the funds don't go straight to the musician immediately.
                                            Instead, Stripe securely holds the payment in what's effectively an "escrow"
                                            account. This protects both sides — the venue knows they won't pay for a gig
                                            that doesn't happen, and the musician knows the money can't be pulled back once
                                            the gig is complete.
                                        </li>

                                        <li>
                                            <strong>4. Post-Gig Release</strong><br />
                                            After the gig takes place, there's a 48-hour window where either the musician
                                            or the venue can raise a dispute if something didn't go to plan (for example,
                                            if the gig was cancelled last-minute or there was a serious issue with the
                                            performance). If no dispute is raised during this period, Stripe automatically
                                            releases the funds to your connected Stripe account.
                                        </li>

                                        <li>
                                            <strong>5. Withdrawable Funds</strong><br />
                                            Once Stripe releases the funds, they will appear in your Gigin finances under
                                            <em>"Withdrawable Funds"</em>. This means the money is now yours to withdraw at
                                            any time — you're not required to withdraw it immediately, so you can let
                                            payments build up if you prefer.
                                        </li>

                                        <li>
                                            <strong>6. Transfer to Your Bank</strong><br />
                                            When you choose to withdraw your balance, Stripe transfers the funds directly
                                            to the bank account you've set up in your Stripe Connect account. Bank
                                            transfers usually arrive within 1–2 working days, depending on your bank.
                                        </li>
                                    </ol>
                                    <hr />
                                    <p>
                                        This process has been designed to keep things fair, transparent, and secure for
                                        both musicians and venues. With Stripe's trusted infrastructure handling all
                                        transactions, you can focus on the music while we take care of the payments.
                                    </p>
                                </div>
                            </div>
                        </div>
                    </Portal>
                )}

                {stripeSystemModal && (
                    <Portal>
                        <div className="modal more-information" onClick={() => setStripeSystemModal(false)}>
                            <div className="modal-content" onClick={(e) => e.stopPropagation()}>
                                <div className="modal-header">
                                    <StripeIcon />
                                    <h2>How Stripe Securely Manages Your Funds</h2>
                                    <button className="btn close tertiary" onClick={() => setStripeSystemModal(false)}>Close</button>
                                </div>
                                <div className="modal-body">
                                    <p>
                                        Your Gigin payments are processed and held by <strong>Stripe</strong>, one of the
                                        world's most trusted online payment providers. Stripe handles payments for
                                        millions of businesses — from small creators to large companies like Amazon,
                                        Booking.com, and Shopify — and is authorised and regulated as a licensed payment
                                        institution.
                                    </p>
                                    <br />
                                    <p>
                                        When you connect your bank account to Gigin, you're actually creating a{" "}
                                        <strong>Stripe Connect account</strong> in your name.
                                        This account is completely separate from Gigin's own finances and is owned and
                                        controlled by you.
                                    </p>
                                    <hr />
                                    <h3>How Stripe Protects Your Money</h3>
                                    <ul>
                                        <li>
                                            <strong>Funds are ring-fenced:</strong> Money paid for your gigs never touches
                                            Gigin's bank accounts. It is held securely by Stripe until it's ready to be
                                            released to you.
                                        </li>
                                        <li>
                                            <strong>Regulated & compliant:</strong> Stripe is regulated by the Financial
                                            Conduct Authority (FCA) in the UK and must follow strict security and compliance
                                            requirements.
                                        </li>
                                        <li>
                                            <strong>Bank-level security:</strong> All data — including your personal details
                                            and bank account — is encrypted. Stripe uses the same security protocols as
                                            major banks.
                                        </li>
                                    </ul>
                                    <hr />
                                    <h3>How Your Funds Move</h3>
                                    <ol>
                                        <li>
                                            <strong>1. </strong>
                                            Gig payment is made by the venue and held in your Stripe Connect account balance.
                                        </li>
                                        <li>
                                            <strong>2. </strong>
                                            Funds are only released once the gig has been performed and the dispute period
                                            has passed.
                                        </li>
                                        <li>
                                            <strong>3. </strong>
                                            Once released, you can withdraw your funds to your bank account at any time.
                                        </li>
                                    </ol>

                                    <p>
                                        This means you're always in control — Gigin never has the ability to block or
                                        take your money. Stripe acts as the secure middle-man, ensuring that both sides
                                        are protected.
                                    </p>

                                    <hr />

                                    <h3>More About Stripe</h3>
                                    <ul className='no-padding'>
                                        <li>
                                            Learn more about{" "}
                                            <a
                                                href="https://stripe.com/gb/connect"
                                                target="_blank"
                                                rel="noopener noreferrer"
                                            >
                                                Stripe Connect
                                            </a>
                                        </li>
                                        <li>
                                            Read Stripe's{" "}
                                            <a
                                                href="https://stripe.com/docs/security/stripe"
                                                target="_blank"
                                                rel="noopener noreferrer"
                                            >
                                                Security Overview
                                            </a>
                                        </li>
                                        <li>
                                            View Stripe's{" "}
                                            <a
                                                href="https://stripe.com/gb/privacy"
                                                target="_blank"
                                                rel="noopener noreferrer"
                                            >
                                                Privacy Policy
                                            </a>
                                        </li>
                                    </ul>

                                    <p>
                                        With Stripe managing your funds, you get bank-level security, global compliance,
                                        and the peace of mind that your money is safe from the moment it's paid until it
                                        arrives in your bank account.
                                    </p>
                                </div>
                            </div>
                        </div>
                    </Portal>
                )}

                {showDeleteStripeModal && (
                    <Portal>
                        {!deletingStripe ? (
                            <div className='modal confirm' onClick={() => setShowDeleteStripeModal(false)}>
                                <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '300px'}}>
                                    <div className="modal-header">
                                        <DeleteGigIcon />
                                        <h2>Are you sure you want to delete your stripe account?</h2>
                                    </div>
                                    <div className='two-buttons'>
                                        <button className="btn tertiary" onClick={() => setShowDeleteStripeModal(false)}>Cancel</button>
                                        <button className="btn danger" onClick={handleDeleteStripeAccount}>Delete</button>
                                    </div>
                                </div>
                            </div>
                        ) : (
                            <LoadingModal title={'Deleting Stripe Account'} text={"Please don't close this window or refresh the page"} />
                        )}
                    </Portal>
                )}

                {showEventLoadingModal && (
                    <Portal>
                        <LoadingModal />
                    </Portal>
                )}

                {showSetPrimaryModal && (
                    <Portal>
                        {settingPrimary ? (
                            <LoadingModal title={'Setting Primary Profile'} text={"Please don't close this window or refresh the page"} />
                        ) : (
                            <div className="modal stripe-account" onClick={() => setShowSetPrimaryModal(false)}>
                                <div className="modal-content" onClick={(e) => e.stopPropagation()}>
                                    <div className="modal-header">
                                        <GuitarsIcon />
                                        <h2>Set "{profileToSetPrimary.name}" as your primary profile?</h2>
                                        <div className="more-information">
                                            <p><MoreInformationIcon /> Are you sure you want to set "{profileToSetPrimary.name}" as your primary profile? You can only set your primary profile once.</p>
                                        </div>
                                        <button className="btn close tertiary" onClick={() => setShowSetPrimaryModal(false)}>Close</button>
                                    </div>
                                    <div className="modal-body">
                                        <div className="two-buttons">
                                            <button className="btn tertiary" onClick={() => setShowSetPrimaryModal(false)}>Cancel</button>
                                            <button className="btn primary" onClick={() => handleSetPrimary()}>Confirm</button>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}
                    </Portal>
                )}
            </div>
        );
    }
};