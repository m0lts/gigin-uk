import { useEffect, useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { EditIcon, NewTabIcon, InviteIconSolid, OptionsIcon, PlusIcon, TickIcon, CloseIcon, DeleteGigsIcon, DeleteGigIcon, SavedIcon, CopyIcon, LeftArrowIcon } from '../../shared/ui/extras/Icons';
import { 
  getArtistCRMEntries, 
  createArtistCRMEntry, 
  updateArtistCRMEntry, 
  deleteArtistCRMEntry,
  migrateSavedArtistsToCRM 
} from '@services/client-side/artistCRM';
import { getArtistProfileById } from '@services/client-side/artists';
import { openInNewTab } from '@services/utils/misc';
import { inviteToGig } from '@services/api/gigs';
import { getGigsByIds } from '@services/client-side/gigs';
import { getOrCreateConversation } from '@services/api/conversations';
import { sendGigInvitationMessage } from '@services/client-side/messages';
import { formatDate } from '@services/utils/dates';
import { getVenueProfileById, fetchMyVenueMembership } from '@services/client-side/venues';
import { sendGigInviteEmail } from '@services/client-side/emails';
import { useVenueDashboard } from '@context/VenueDashboardContext';
import { hasVenuePerm } from '@services/utils/permissions';
import { filterInvitableGigsForMusician } from '@services/utils/filtering';
import Portal from '../../shared/components/Portal';
import { LoadingSpinner } from '../../shared/ui/loading/Loading';
import { useBreakpoint } from '../../../hooks/useBreakpoint';
import DatePicker from 'react-datepicker';
import 'react-datepicker/dist/react-datepicker.css';
import { createGigInvite } from '@services/api/gigInvites';

const InviteToGigModal = ({ artist, onClose, venues, user }) => {
  const [usersGigs, setUsersGigs] = useState([]);
  const [loading, setLoading] = useState(false);
  const [inviting, setInviting] = useState(false);
  const [step, setStep] = useState('gig-selection'); // 'gig-selection', 'invite-config', or 'contact-method'
  const [selectedGig, setSelectedGig] = useState(null);
  const [selectedContactMethod, setSelectedContactMethod] = useState(null);
  const [copiedLink, setCopiedLink] = useState(false);
  const [inviteExpiryDate, setInviteExpiryDate] = useState(null);
  const [creatingInvite, setCreatingInvite] = useState(false);
  const navigate = useNavigate();
  useEffect(() => {
    const fetchGigs = async () => {
      if (!venues?.length) return;
      
      setLoading(true);
      try {
        const venueProfiles = venues || [];
        const gigIds = venueProfiles.flatMap(venueProfile => venueProfile.gigs || []);
        
        if (gigIds.length === 0) {
          toast.error('You have no upcoming gigs to invite this artist to.');
          setLoading(false);
          return;
        }

        const fetchedGigs = await getGigsByIds(gigIds);
        
        // Filter gigs based on whether artist has a profile
        let availableGigs;
        if (artist?.artistId) {
          availableGigs = filterInvitableGigsForMusician(fetchedGigs, artist.artistId);
        } else {
          // For artists without profiles, show all future open gigs
          const now = new Date();
          availableGigs = fetchedGigs.filter(gig => {
            const gigDate = gig.date?.toDate ? gig.date.toDate() : new Date(gig.date);
            return gigDate > now && gig.status === 'open';
          });
        }

        // Add membership info for permission checking
        const venuesWithMembership = await Promise.all(
          (venueProfiles || []).map(v => fetchMyVenueMembership(v, user.uid))
        );
        const membershipByVenueId = Object.fromEntries(
          venuesWithMembership
            .filter(Boolean)
            .map(v => [v.venueId, v.myMembership || null])
        );
        const gigsWithMembership = availableGigs.map(gig => ({
          ...gig,
          myMembership: membershipByVenueId[gig.venueId] || null,
        }));

        setUsersGigs(gigsWithMembership);
      } catch (error) {
        console.error('Error fetching gigs:', error);
        toast.error('Error loading gigs. Please try again.');
      } finally {
        setLoading(false);
      }
    };

    fetchGigs();
  }, [artist, venues, user?.uid]);

  const handleGigSelection = (gigData) => {
    if (!gigData || !artist) return;
    
    // Check if artist has a Gigin profile
    if (artist.artistId) {
      // Artist has a profile - go directly to invite
      handleInviteToGig(gigData);
    } else {
      // Artist doesn't have a profile
      setSelectedGig(gigData);
      // If gig is private, show invite config step first
      if (gigData.private) {
        setStep('invite-config');
      } else {
        // Public gig - go directly to contact method selection
        setStep('contact-method');
      }
    }
  };

  const handleGenerateInvite = async () => {
    if (!selectedGig || !artist) return;

    setCreatingInvite(true);
    try {
      // Set time to end of day (23:59:59) if date is selected
      let expiresAt = null;
      if (inviteExpiryDate) {
        const date = new Date(inviteExpiryDate);
        date.setHours(23, 59, 59, 999);
        expiresAt = date;
      }

      // Create the invite document with crmEntryId and artistName
      await createGigInvite({
        gigId: selectedGig.gigId,
        expiresAt: expiresAt?.toISOString() || null,
        crmEntryId: artist.id, // Use CRM entry ID for artists without Gigin profile
        artistName: artist.name || null
      });

      toast.success('Invite created successfully');
      // Proceed to contact method selection
      setStep('contact-method');
    } catch (error) {
      console.error('Error creating invite:', error);
      toast.error('Failed to create invite. Please try again.');
    } finally {
      setCreatingInvite(false);
    }
  };

  const handleInviteToGig = async (gigData, contactMethod = null) => {
    if (!gigData || !artist) return;

    try {
      setInviting(true);
      const venueToSend = venues.find(v => v.venueId === gigData.venueId);
      if (!venueToSend) {
        toast.error('Venue not found.');
        return;
      }

      // Check if artist has a Gigin profile
      if (artist.artistId) {
        // Artist has a profile - use existing flow
        const artistProfile = await getArtistProfileById(artist.artistId);
        if (!artistProfile) {
          toast.error('Artist profile not found.');
          return;
        }

        const musicianProfilePayload = {
          musicianId: artistProfile.id,
          id: artistProfile.id,
          name: artistProfile.name,
          genres: artistProfile.genres || [],
          musicianType: 'Musician/Band',
          musicType: artistProfile.genres || [],
          bandProfile: false,
          userId: artistProfile.userId,
        };

        const res = await inviteToGig({ gigId: gigData.gigId, musicianProfile: musicianProfilePayload });
        if (!res.success) {
          if (res.code === 'permission-denied') {
            toast.error('You don\'t have permission to invite artists for this venue.');
          } else if (res.code === 'failed-precondition') {
            toast.error('This gig is missing required venue info.');
          } else {
            toast.error('Error inviting artist. Please try again.');
          }
          return;
        }

        const { conversationId } = await getOrCreateConversation({
          musicianProfile: musicianProfilePayload,
          gigData: gigData,
          venueProfile: venueToSend,
          type: 'invitation',
        });

        if (gigData.kind === 'Ticketed Gig' || gigData.kind === 'Open Mic') {
          await sendGigInvitationMessage(conversationId, {
            senderId: user.uid,
            text: `${venueToSend.accountName} invited ${artistProfile.name} to play at their gig at ${gigData.venue?.venueName} on the ${formatDate(
              gigData.date
            )}.`,
          });
        } else {
          await sendGigInvitationMessage(conversationId, {
            senderId: user.uid,
            text: `${venueToSend.accountName} invited ${artistProfile.name} to play at their gig at ${gigData.venue?.venueName} on the ${formatDate(
              gigData.date
            )} for ${gigData.budget}.`,
          });
        }

        toast.success(`Invite sent to ${artistProfile.name}`);
        onClose();
      } else {
        // Artist doesn't have a profile
        if (contactMethod === 'email') {
          // Send email invitation
          const artistEmail = artist.email;
          
          if (!artistEmail || !artistEmail.trim()) {
            toast.error('Please enter an email address for this artist to send an invitation.');
            return;
          }

          const gigLink = `${window.location.origin}/gig/${gigData.gigId}`;
          const formattedDate = formatDate(gigData.date, 'short');
          
          await sendGigInviteEmail({
            to: artistEmail.trim(),
            userName: user.name || venueToSend.accountName,
            venueName: gigData.venue?.venueName || venueToSend.name,
            date: formattedDate,
            gigLink: gigLink,
          });

          toast.success(`Invitation email sent to ${artist.name}`);
          onClose();
        } else {
          // For other contact methods, we'll show the link to copy
          // This is handled in the UI below
        }
      }
    } catch (error) {
      console.error('Error inviting artist to gig:', error);
      toast.error('Error inviting artist. Please try again.');
    } finally {
      setInviting(false);
    }
  };

  const generateGigLink = (gigData) => {
    return `${window.location.origin}/gig/${gigData.gigId}`;
  };

  const generateInviteMessage = (gigData, venueToSend) => {
    const formattedDate = formatDate(gigData.date, 'short');
    const gigLink = generateGigLink(gigData);
    const venueName = gigData.venue?.venueName || venueToSend.name;
    const userName = user.name || venueToSend.accountName;
    
    return `${userName} has invited you to play at their gig at ${venueName} on ${formattedDate}. Check it out on Gigin: ${gigLink}`;
  };

  const getPlatformLink = (contactMethod, gigData) => {
    const venueToSend = venues.find(v => v.venueId === gigData.venueId);
    const message = generateInviteMessage(gigData, venueToSend);
    const encodedMessage = encodeURIComponent(message);
    
    switch(contactMethod) {
      case 'phone':
        // SMS link - clean phone number (remove spaces, dashes, parentheses, plus signs at start)
        let phoneNumber = artist.phone?.replace(/[\s\-\(\)]/g, '') || '';
        // Ensure it starts with + for international format, or add country code if missing
        if (phoneNumber && !phoneNumber.startsWith('+')) {
          // If UK number (starts with 0), replace with +44
          if (phoneNumber.startsWith('0')) {
            phoneNumber = '+44' + phoneNumber.substring(1);
          } else {
            // Assume UK number and add +44
            phoneNumber = '+44' + phoneNumber;
          }
        }
        return phoneNumber ? `sms:${phoneNumber}?body=${encodedMessage}` : null;
      case 'instagram':
        // Instagram doesn't support direct DM links, but we can open their profile
        // User will need to manually send the message
        if (!artist.instagram) return null;
        // Extract username from various formats: @username, username, instagram.com/username, etc.
        let instagramHandle = artist.instagram.trim();
        // Remove @ if present
        instagramHandle = instagramHandle.replace(/^@/, '');
        // Remove protocol if present
        instagramHandle = instagramHandle.replace(/^https?:\/\//, '');
        // Remove all instances of instagram.com/ or www.instagram.com/ (handles nested URLs)
        instagramHandle = instagramHandle.replace(/(www\.)?instagram\.com\//g, '');
        // Get just the username part (before any / or ?)
        instagramHandle = instagramHandle.split('/')[0].split('?')[0];
        // Remove any remaining @ symbols and whitespace
        instagramHandle = instagramHandle.replace(/@/g, '').trim();
        return instagramHandle ? `https://www.instagram.com/${instagramHandle}` : null;
      case 'facebook':
        // Facebook Messenger link - try to extract username from URL or use as-is
        const facebookUrl = artist.facebook || '';
        if (facebookUrl.includes('facebook.com') || facebookUrl.includes('m.me')) {
          return facebookUrl.startsWith('http') ? facebookUrl : `https://${facebookUrl}`;
        }
        // If it's just a username, try messenger link
        return facebookUrl ? `https://m.me/${facebookUrl.replace(/^@/, '')}` : null;
      case 'other':
        // For other methods, just return null - user will copy manually
        return null;
      default:
        return null;
    }
  };

  const handleCopyLink = async (gigData) => {
    const link = generateGigLink(gigData);
    try {
      await navigator.clipboard.writeText(link);
      setCopiedLink(true);
      toast.success('Gig link copied to clipboard!');
      setTimeout(() => setCopiedLink(false), 2000);
    } catch (error) {
      console.error('Failed to copy link:', error);
      toast.error('Failed to copy link. Please try again.');
    }
  };

  const handleCopyMessage = async (gigData) => {
    const venueToSend = venues.find(v => v.venueId === gigData.venueId);
    const message = generateInviteMessage(gigData, venueToSend);
    try {
      await navigator.clipboard.writeText(message);
      toast.success('Message copied to clipboard!');
    } catch (error) {
      console.error('Failed to copy message:', error);
      toast.error('Failed to copy message. Please try again.');
    }
  };

  const handleContactMethodSelect = (method) => {
    setSelectedContactMethod(method);
    if (method === 'email') {
      handleInviteToGig(selectedGig, 'email');
    }
  };

  const handleOpenPlatform = (contactMethod, gigData) => {
    const platformLink = getPlatformLink(contactMethod, gigData);
    if (platformLink) {
      window.open(platformLink, '_blank');
    }
  };

  const canInviteForGig = (gig) => {
    if (!gig?.myMembership) return false;
    const role = gig.myMembership.role || 'member';
    const perms = gig.myMembership.permissions || {};
    return role === 'owner' || perms['gigs.invite'] === true;
  };


  const getAvailableContactMethods = () => {
    const methods = [];
    if (artist.email) methods.push({ type: 'email', label: 'Email', available: true });
    if (artist.phone) methods.push({ type: 'phone', label: 'Phone', available: true });
    if (artist.instagram) methods.push({ type: 'instagram', label: 'Instagram', available: true });
    if (artist.facebook) methods.push({ type: 'facebook', label: 'Facebook', available: true });
    if (artist.other) methods.push({ type: 'other', label: 'Other', available: true });
    return methods;
  };

  return (
    <Portal>
      <style>{`
        @keyframes slideInFromRight {
          from {
            opacity: 0;
            transform: translateX(20px);
          }
          to {
            opacity: 1;
            transform: translateX(0);
          }
        }
        @keyframes slideOutToLeft {
          from {
            opacity: 1;
            transform: translateX(0);
          }
          to {
            opacity: 0;
            transform: translateX(-20px);
          }
        }
      `}</style>
      <div className={`modal ${step === 'invite-config' ? 'gig-invites' : 'invite-musician'}`} onClick={onClose}>
        <div className="modal-content" onClick={(e) => e.stopPropagation()}>
          <div className="modal-header">
            <div className="modal-header-text" style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start' }}>
              {step === 'invite-config' && selectedGig ? (
                  <button
                    className="btn tertiary back-button"
                    style={{ marginBottom: '1rem' }}
                    onClick={() => {
                      setStep('gig-selection');
                      setSelectedGig(null);
                      setInviteExpiryDate(null);
                    }}
                    disabled={creatingInvite}
                  >
                    <LeftArrowIcon />
                    Back
                  </button>
              ) : step === 'contact-method' && selectedGig ? (
                <button
                  className="btn tertiary back-button"
                  style={{ marginBottom: '1rem' }}
                  onClick={() => {
                    // If gig is private, go back to invite-config, otherwise go to gig-selection
                    if (selectedGig?.private) {
                      setStep('invite-config');
                    } else {
                      setStep('gig-selection');
                      setSelectedGig(null);
                    }
                    setSelectedContactMethod(null);
                  }}
                  disabled={inviting}
                >
                  <LeftArrowIcon />
                  Back
                </button>
              ) : null}
              <InviteIconSolid />
              <h2>
                {step === 'gig-selection' 
                  ? `Invite ${artist?.name} to one of your available gigs.`
                  : step === 'invite-config'
                  ? `Configure Invite`
                  : `How would you like to send the invite to ${artist?.name}?`
                }
              </h2>
            </div>
            {step === 'gig-selection' && (
              <>
                <div className="or-separator">
                  <span />
                  <h6>or</h6>
                  <span />
                </div>
                <button
                  className="btn secondary"
                  onClick={() => {
                    onClose();
                    navigate('/venues/dashboard/gigs', {
                      state: {
                        musicianData: {
                          id: artist?.artistId || artist?.id, // Use artistId if it exists (Gigin profile), otherwise use CRM entry id
                          name: artist?.name,
                          genres: artist?.genres || [],
                          type: artist?.artistType || 'Musician/Band',
                          bandProfile: false,
                          userId: artist?.userId,
                          // Include CRM contact data for non-Gigin artists
                          email: artist?.email,
                          phone: artist?.phone,
                          instagram: artist?.instagram,
                          facebook: artist?.facebook,
                          other: artist?.other,
                          crmEntryId: !artist?.artistId ? artist?.id : null, // Store CRM entry ID if no Gigin profile
                        },
                        buildingForMusician: true,
                        showGigPostModal: true,
                      },
                    });
                  }}
                >
                  Build New Gig For Artist
                </button>
              </>
            )}
          </div>
          
          <div className="modal-steps-container" style={{ position: 'relative', minHeight: '300px', maxHeight: '70vh', height: '40vh', overflowY: 'auto' }}>
            {/* Gig Selection Step */}
            <div 
              className={`modal-step ${step === 'gig-selection' ? 'active' : 'inactive'}`}
              style={{
                position: step === 'gig-selection' ? 'relative' : 'absolute',
                width: '100%',
                opacity: step === 'gig-selection' ? 1 : 0,
                transform: step === 'gig-selection' ? 'translateX(0)' : 'translateX(-20px)',
                pointerEvents: step === 'gig-selection' ? 'auto' : 'none',
                transition: 'opacity 0.3s ease, transform 0.3s ease',
              }}
            >
              {loading ? (
                <LoadingSpinner />
              ) : usersGigs.length === 0 ? (
                <p>You have no upcoming gigs available.</p>
              ) : (
                <>
                  <div className="gig-selection">
                    {usersGigs.map((gig, index) => {
                      const canInvite = canInviteForGig(gig);
                      if (canInvite) {
                        return (
                          <div
                            className="card"
                            key={index}
                            onClick={() => handleGigSelection(gig)}
                            style={{ cursor: inviting ? 'not-allowed' : 'pointer', opacity: inviting ? 0.6 : 1 }}
                          >
                            <div className="gig-details">
                              <h4 className="text">{gig.gigName}</h4>
                              <h5>{gig.venue?.venueName}</h5>
                            </div>
                            <p className="sub-text">
                              {formatDate(gig.date, 'short')} - {gig.startTime}
                            </p>
                          </div>
                        );
                      }
                      return (
                        <div className="card disabled" key={index}>
                          <div className="gig-details">
                            <h4 className="text">{gig.gigName}</h4>
                            <h5 className="details-text">
                              You don't have permission to invite artists to gigs at this venue.
                            </h5>
                          </div>
                          <p className="sub-text">
                            {formatDate(gig.date, 'short')} - {gig.startTime}
                          </p>
                        </div>
                      );
                    })}
                  </div>
                  <div className="two-buttons">
                    <button 
                      className="btn tertiary" 
                      onClick={onClose}
                      disabled={inviting}
                    >
                      Cancel
                    </button>
                  </div>
                </>
              )}
            </div>

            {/* Invite Configuration Step (for private gigs with no profile) */}
            {step === 'invite-config' && selectedGig && (
              <div 
                className="modal-step active"
                style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  width: '100%',
                  height: '100%',
                  opacity: 0,
                  transform: 'translateX(20px)',
                  animation: 'slideInFromRight 0.3s ease forwards',
                  display: 'flex',
                  flexDirection: 'column',
                  overflowY: 'auto',
                }}
              >
                <div className="modal-body" style={{ flex: 1, display: 'flex', flexDirection: 'column', overflowY: 'auto' }}>
                  <div className="stage" style={{ flex: 1 }}>
                    <div className="body date">
                      <p style={{ marginBottom: '1rem' }}>
                        Select a date if you want the invite to expire at a certain time.
                      </p>
                      <div className="calendar">
                        {selectedGig?.date && (() => {
                          const gigDate = selectedGig.date.toDate ? selectedGig.date.toDate() : new Date(selectedGig.date);
                          return (
                            <DatePicker
                              selected={inviteExpiryDate}
                              onChange={(date) => setInviteExpiryDate(date)}
                              inline
                              minDate={new Date()}
                              maxDate={gigDate}
                              dayClassName={(date) => {
                                const today = new Date().setHours(0, 0, 0, 0);
                                const dateTime = date.getTime();
                                if (dateTime < today) return 'past-date';
                                if (gigDate && dateTime > gigDate.getTime()) return 'past-date';
                                return undefined;
                              }}
                            />
                          );
                        })()}
                      </div>
                    </div>
                  </div>
                  <div className="two-buttons" style={{ marginTop: 'auto', paddingTop: '1rem' }}>
                    <button
                      className="btn secondary"
                      onClick={() => {
                        setStep('gig-selection');
                        setSelectedGig(null);
                        setInviteExpiryDate(null);
                      }}
                      disabled={creatingInvite}
                    >
                      Cancel
                    </button>
                    <button
                      className="btn primary"
                      onClick={handleGenerateInvite}
                      disabled={creatingInvite}
                    >
                      {creatingInvite ? 'Creating...' : 'Generate Invite'}
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Contact Method Selection Step */}
            {step === 'contact-method' && selectedGig && (
              <div 
                className="modal-step active"
                style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  width: '100%',
                  opacity: 0,
                  transform: 'translateX(20px)',
                  animation: 'slideInFromRight 0.3s ease forwards',
                }}
              >


                <div className="contact-method-selection" style={{ marginBottom: '1.5rem' }}>
                  <h3 style={{ marginBottom: '1rem', fontSize: '1rem', fontWeight: 600 }}>Select contact method:</h3>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                    {getAvailableContactMethods().map((method) => (
                      <button
                        key={method.type}
                        className={`btn ${selectedContactMethod === method.type ? 'primary' : 'secondary'}`}
                        onClick={() => handleContactMethodSelect(method.type)}
                        disabled={inviting}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          padding: '0.75rem 1rem',
                        }}
                      >
                        <span>{method.label}</span>
                        {selectedContactMethod === method.type && <TickIcon />}
                      </button>
                    ))}
                  </div>
                  
                  {getAvailableContactMethods().length === 0 && (
                    <p style={{ color: 'var(--gn-grey-600)', fontSize: '0.9rem' }}>
                      No contact information available for this artist. Please add contact details in the CRM.
                    </p>
                  )}
                </div>

                {/* Show link/message copy interface for non-email methods */}
                {selectedContactMethod && selectedContactMethod !== 'email' && (
                  <div className="contact-method-actions" style={{ 
                    padding: '1rem', 
                    backgroundColor: 'var(--gn-grey-250)', 
                    borderRadius: '0.5rem',
                    marginBottom: '1rem'
                  }}>
                    <div style={{ marginBottom: '1rem' }}>
                      <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.9rem', fontWeight: 600 }}>
                        Gig Link:
                      </label>
                      <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                        <input
                          type="text"
                          className="input"
                          value={generateGigLink(selectedGig)}
                          readOnly
                          style={{ flex: 1, fontFamily: 'monospace', fontSize: '0.85rem' }}
                        />
                        <button
                          className="btn secondary"
                          onClick={() => handleCopyLink(selectedGig)}
                          style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}
                        >
                          <CopyIcon />
                          {copiedLink ? 'Copied!' : 'Copy'}
                        </button>
                      </div>
                    </div>
                    
                    <div style={{ marginBottom: '1rem' }}>
                      <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.9rem', fontWeight: 600 }}>
                        Message to send:
                      </label>
                      <textarea
                        className="input"
                        value={generateInviteMessage(selectedGig, venues.find(v => v.venueId === selectedGig.venueId))}
                        readOnly
                        rows={3}
                        style={{ width: '100%', fontSize: '0.85rem', marginBottom: '0.5rem', resize: 'none' }}
                      />
                      <button
                        className="btn secondary"
                        onClick={() => handleCopyMessage(selectedGig)}
                        style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}
                      >
                        <CopyIcon />
                        Copy Message
                      </button>
                    </div>

                    {/* Platform-specific actions */}
                    {selectedContactMethod === 'phone' && artist.phone && (
                      <button
                        className="btn primary"
                        onClick={() => handleOpenPlatform('phone', selectedGig)}
                        style={{ width: '100%', marginTop: '0.5rem' }}
                      >
                        Open SMS App
                      </button>
                    )}
                    
                    {selectedContactMethod === 'instagram' && artist.instagram && (
                      <button
                        className="btn primary"
                        onClick={() => handleOpenPlatform('instagram', selectedGig)}
                        style={{ width: '100%', marginTop: '0.5rem' }}
                      >
                        Open Instagram Profile
                      </button>
                    )}
                    
                    {selectedContactMethod === 'facebook' && artist.facebook && (
                      <p style={{ fontSize: '0.85rem', color: 'var(--gn-grey-600)', marginTop: '0.5rem' }}>
                        Copy the message above and send it via Facebook Messenger.
                      </p>
                    )}
                    
                    {selectedContactMethod === 'other' && (
                      <p style={{ fontSize: '0.85rem', color: 'var(--gn-grey-600)', marginTop: '0.5rem' }}>
                        Copy the link and message above and send them via your preferred method.
                      </p>
                    )}
                  </div>
                )}

                <div className="two-buttons">
                  <button 
                    className="btn tertiary" 
                    onClick={() => {
                      setStep('gig-selection');
                      setSelectedGig(null);
                      setSelectedContactMethod(null);
                    }}
                    disabled={inviting}
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </Portal>
  );
};



export const ArtistCRM = ({ user, venues }) => {
  const navigate = useNavigate();
  const { isMdUp } = useBreakpoint();
  const [crmEntries, setCrmEntries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editingNotes, setEditingNotes] = useState(null);
  const [notesValue, setNotesValue] = useState('');
  const [notesPosition, setNotesPosition] = useState({ top: 0, left: 0 });
  const [editingName, setEditingName] = useState(null);
  const [nameValue, setNameValue] = useState('');
  const [namePosition, setNamePosition] = useState({ top: 0, left: 0 });
  const [editingContact, setEditingContact] = useState(null);
  const [contactValue, setContactValue] = useState({ email: '', phone: '', instagram: '', facebook: '', other: '' });
  const [contactPosition, setContactPosition] = useState({ top: 0, left: 0 });
  const [showInviteGigModal, setShowInviteGigModal] = useState(false);
  const [selectedArtist, setSelectedArtist] = useState(null);
  const [openOptionsId, setOpenOptionsId] = useState(null);
  const [artistProfiles, setArtistProfiles] = useState({});
  const [isAddingNew, setIsAddingNew] = useState(false);
    const [newEntryData, setNewEntryData] = useState({
    name: '',
    email: '',
    phone: '',
    instagram: '',
    facebook: '',
    other: '',
    notes: '',
  });
  const [savingNew, setSavingNew] = useState(false);
  const [addArtistPosition, setAddArtistPosition] = useState({ top: 0, left: 0 });
  const [profileFilter, setProfileFilter] = useState('all'); // 'all', 'withProfile', 'withoutProfile'

  // Filter entries based on profile filter
  const filteredEntries = useMemo(() => {
    if (profileFilter === 'all') return crmEntries;
    if (profileFilter === 'withProfile') return crmEntries.filter(entry => entry.artistId);
    if (profileFilter === 'withoutProfile') return crmEntries.filter(entry => !entry.artistId);
    return crmEntries;
  }, [crmEntries, profileFilter]);

  useEffect(() => {
    const fetchCRMData = async () => {
      if (!user?.uid) return;

      setLoading(true);
      try {
        // First, migrate any existing saved artists
        const savedIds = user?.savedArtists || [];
        if (Array.isArray(savedIds) && savedIds.length > 0) {
          try {
            await migrateSavedArtistsToCRM(user.uid, savedIds, getArtistProfileById);
          } catch (error) {
            console.error('Error migrating saved artists:', error);
          }
        }

        // Fetch CRM entries
        const entries = await getArtistCRMEntries(user.uid);
        setCrmEntries(entries);

        // Fetch artist profiles for entries that have artistId
        const profilePromises = entries
          .filter(entry => entry.artistId)
          .map(async (entry) => {
            try {
              const profile = await getArtistProfileById(entry.artistId);
              return { entryId: entry.id, profile };
            } catch (error) {
              console.error(`Error fetching profile for ${entry.artistId}:`, error);
              return { entryId: entry.id, profile: null };
            }
          });

        const profiles = await Promise.all(profilePromises);
        const profileMap = {};
        profiles.forEach(({ entryId, profile }) => {
          profileMap[entryId] = profile;
        });
        setArtistProfiles(profileMap);
      } catch (error) {
        console.error('Error fetching CRM data:', error);
        toast.error('Error loading artists. Please try again.');
      } finally {
        setLoading(false);
      }
    };

    fetchCRMData();
  }, [user]);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (!e.target.closest('.options-cell') && !e.target.closest('.notes-cell') && !e.target.closest('.name-cell') && !e.target.closest('.contact-cell')) {
        setOpenOptionsId(null);
      }
      // Close add artist popup if clicking outside
      if (isAddingNew && !e.target.closest('[data-notes-editor]') && !e.target.closest('.notes-container')) {
        handleCancelNewRow();
      }
      // Close name editor if clicking outside
      if (editingName && !e.target.closest('[data-name-editor]') && !e.target.closest('.name-cell')) {
        setEditingName(null);
        setNameValue('');
      }
      // Close contact editor if clicking outside
      if (editingContact && !e.target.closest('[data-contact-editor]') && !e.target.closest('.contact-cell')) {
        setEditingContact(null);
        setContactValue({ email: '', phone: '', instagram: '', facebook: '', other: '' });
      }
    };
    window.addEventListener('click', handleClickOutside);
    return () => window.removeEventListener('click', handleClickOutside);
  }, [isAddingNew, editingName, editingContact]);

  const handleSaveNotes = async (entryId) => {
    if (!user?.uid) return;
    try {
      await updateArtistCRMEntry(user.uid, entryId, { notes: notesValue.trim() });
      setCrmEntries(prev => prev.map(entry => 
        entry.id === entryId 
          ? { ...entry, notes: notesValue.trim() }
          : entry
      ));
      toast.success('Notes updated');
      setEditingNotes(null);
      setNotesValue('');
    } catch (error) {
      console.error('Error updating notes:', error);
      toast.error('Failed to update notes. Please try again.');
    }
  };

  const handleSaveName = async (entryId) => {
    if (!user?.uid || !nameValue.trim()) {
      toast.error('Please enter an artist name.');
      return;
    }
    try {
      await updateArtistCRMEntry(user.uid, entryId, { name: nameValue.trim() });
      setCrmEntries(prev => prev.map(entry => 
        entry.id === entryId 
          ? { ...entry, name: nameValue.trim() }
          : entry
      ));
      toast.success('Artist name updated');
      setEditingName(null);
      setNameValue('');
    } catch (error) {
      console.error('Error updating name:', error);
      toast.error('Failed to update artist name. Please try again.');
    }
  };

  const handleSaveContact = async (entryId) => {
    if (!user?.uid) return;
    try {
      await updateArtistCRMEntry(user.uid, entryId, { 
        email: contactValue.email.trim() || null,
        phone: contactValue.phone.trim() || null,
        instagram: contactValue.instagram.trim() || null,
        facebook: contactValue.facebook.trim() || null,
        other: contactValue.other.trim() || null,
      });
      setCrmEntries(prev => prev.map(entry => 
        entry.id === entryId 
          ? { 
              ...entry, 
              email: contactValue.email.trim() || null, 
              phone: contactValue.phone.trim() || null,
              instagram: contactValue.instagram.trim() || null,
              facebook: contactValue.facebook.trim() || null,
              other: contactValue.other.trim() || null,
            }
          : entry
      ));
      toast.success('Contact info updated');
      setEditingContact(null);
      setContactValue({ email: '', phone: '', instagram: '', facebook: '', other: '' });
    } catch (error) {
      console.error('Error updating contact:', error);
      toast.error('Failed to update contact info. Please try again.');
    }
  };

  const handleDeleteEntry = async (entryId) => {
    if (!user?.uid) return;
    try {
      const entry = crmEntries.find(e => e.id === entryId);
      await deleteArtistCRMEntry(user.uid, entryId);
      
      // Note: We no longer maintain the savedArtists array - CRM is the source of truth

      setCrmEntries(prev => prev.filter(e => e.id !== entryId));
      toast.success('Artist removed from CRM');
    } catch (error) {
      console.error('Error deleting entry:', error);
      toast.error('Failed to remove artist. Please try again.');
    }
  };

  const handleRefresh = async () => {
    if (!user?.uid) return;
    setLoading(true);
    try {
      const entries = await getArtistCRMEntries(user.uid);
      setCrmEntries(entries);
    } catch (error) {
      console.error('Error refreshing CRM data:', error);
      toast.error('Error refreshing data. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleAddNewRow = (e) => {
    const rect = e.currentTarget.getBoundingClientRect();
    setAddArtistPosition({ top: rect.bottom + 10, left: rect.left });
    setIsAddingNew(true);
    setNewEntryData({
      name: '',
      email: '',
      phone: '',
      instagram: '',
      facebook: '',
      other: '',
      notes: '',
    });
  };

  const handleCancelNewRow = () => {
    setIsAddingNew(false);
    setNewEntryData({
      name: '',
      email: '',
      phone: '',
      instagram: '',
      facebook: '',
      other: '',
      notes: '',
    });
  };

  const handleSaveNewRow = async () => {
    if (!newEntryData.name.trim()) {
      toast.error('Please enter an artist name.');
      return;
    }

    if (!user?.uid) return;

    try {
      setSavingNew(true);
      await createArtistCRMEntry(user.uid, {
        name: newEntryData.name.trim(),
        notes: newEntryData.notes.trim(),
        email: newEntryData.email.trim() || null,
        phone: newEntryData.phone.trim() || null,
        instagram: newEntryData.instagram.trim() || null,
        facebook: newEntryData.facebook.trim() || null,
        other: newEntryData.other.trim() || null,
      });
      toast.success('Artist added to CRM');
      setIsAddingNew(false);
      setNewEntryData({
        name: '',
        email: '',
        phone: '',
        instagram: '',
        facebook: '',
        other: '',
        notes: '',
      });
      // Refresh the list
      const entries = await getArtistCRMEntries(user.uid);
      setCrmEntries(entries);
    } catch (error) {
      console.error('Error adding artist:', error);
      toast.error('Failed to add artist. Please try again.');
    } finally {
      setSavingNew(false);
    }
  };

  return (
    <>
      <div className='head'>
        <h1 className='title'>My Artists</h1>
        <button 
          className='btn primary' 
          onClick={() => navigate('/venues/dashboard/artists/find')}
        >
          Find Artists
        </button>
      </div>
      <div className='body gigs'>
        {loading ? (
          <div style={{ padding: '2rem', textAlign: 'center' }}>
            <LoadingSpinner />
          </div>
        ) : (
          <>
            <div className='filters'>
              <div className="status-buttons">
                <button 
                  className={`btn ${profileFilter === 'all' ? 'active' : ''}`} 
                  onClick={() => setProfileFilter('all')}
                >
                  All
                </button>
                <button 
                  className={`btn ${profileFilter === 'withProfile' ? 'active' : ''}`} 
                  onClick={() => setProfileFilter('withProfile')}
                >
                  With Gigin Profile
                </button>
                <button 
                  className={`btn ${profileFilter === 'withoutProfile' ? 'active' : ''}`} 
                  onClick={() => setProfileFilter('withoutProfile')}
                >
                  Without Gigin Profile
                </button>
              </div>
            </div>
            <table>
            <thead>
              <tr>
                <th id='name' style={{ width: isMdUp ? '18%' : '25%' }}>Artist Name</th>
                <th className='centre' style={{ width: isMdUp ? '22%' : '35%' }}>View Profile/Contact</th>
                <th className='centre' style={{ width: isMdUp ? '12%' : '20%' }}>Invite to Gig</th>
                {isMdUp && <th className='centre' style={{ width: '35%' }}>Notes</th>}
                <th id='options' style={{ width: '5%' }}></th>
              </tr>
            </thead>
            <tbody>
              {filteredEntries.map((entry) => {
                const artistProfile = artistProfiles[entry.id];
                const hasProfile = !!entry.artistId && !!artistProfile;
                
                return (
                  <tr key={entry.id}>
                    <td className='name-cell' onClick={(e) => e.stopPropagation()}>
                      {hasProfile ? (
                        // Artist with Gigin profile - not editable
                        <span style={{ fontSize: '0.9rem' }}>
                          {entry.name || ''}
                        </span>
                      ) : (
                        // Artist without profile - editable
                        <div 
                          className="notes-container"
                          onClick={(e) => {
                            e.stopPropagation();
                            const rect = e.currentTarget.getBoundingClientRect();
                            setNamePosition({ top: rect.top - 120, left: rect.left });
                            setEditingName(entry.id);
                            setNameValue(entry.name || '');
                          }}
                        >
                          <div className="notes-content">
                            <span className="notes-text" style={{ fontSize: '0.9rem' }}>
                              {entry.name || ''}
                            </span>
                            <button
                              className="btn icon notes-edit-btn"
                              onClick={(e) => {
                                e.stopPropagation();
                              }}
                            >
                              <EditIcon />
                            </button>
                          </div>
                          {editingName === entry.id && (
                            <div
                              data-name-editor
                              className="notes-editor"
                              style={{
                                top: `${namePosition.top}px`,
                                left: `${namePosition.left}px`,
                              }}
                              onClick={(e) => e.stopPropagation()}
                            >
                              <h4>Artist Name</h4>
                              <input
                                type="text"
                                className="input"
                                value={nameValue}
                                onChange={(e) => setNameValue(e.target.value)}
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') {
                                    e.preventDefault();
                                    handleSaveName(entry.id);
                                  }
                                  if (e.key === 'Escape') {
                                    setEditingName(null);
                                    setNameValue('');
                                  }
                                }}
                                onBlur={(e) => {
                                  setTimeout(() => {
                                    if (editingName === entry.id) {
                                      handleSaveName(entry.id);
                                    }
                                  }, 200);
                                }}
                                autoFocus
                              />
                              <div className="notes-editor-actions">
                                <button
                                  className="btn tertiary"
                                  onClick={() => {
                                    setEditingName(null);
                                    setNameValue('');
                                  }}
                                >
                                  Cancel
                                </button>
                                <button
                                  className="btn primary"
                                  onClick={() => handleSaveName(entry.id)}
                                >
                                  Save
                                </button>
                              </div>
                            </div>
                          )}
                        </div>
                      )}
                    </td>
                    <td className='centre contact-cell' onClick={(e) => e.stopPropagation()}>
                      {hasProfile ? (
                        <button
                          className="btn tertiary"
                          onClick={(e) => {
                            e.stopPropagation();
                            openInNewTab(`/artist/${encodeURIComponent(entry.artistId)}`, e);
                          }}
                        >
                          View Artist
                        </button>
                      ) : (
                        <div 
                          className="notes-container"
                          onClick={(e) => {
                            e.stopPropagation();
                            const rect = e.currentTarget.getBoundingClientRect();
                            setContactPosition({ top: rect.top - 120, left: rect.left });
                            setEditingContact(entry.id);
                            setContactValue({ 
                              email: entry.email || '', 
                              phone: entry.phone || '',
                              instagram: entry.instagram || '',
                              facebook: entry.facebook || '',
                              other: entry.other || '',
                            });
                          }}
                          style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}
                        >
                          <div style={{ display: 'flex', flexDirection: 'row', flexWrap: 'wrap', gap: '2px', alignItems: 'center', justifyContent: 'center' }}>
                            {(() => {
                              const contactTypes = [];
                              if (entry.email) contactTypes.push({ type: 'email', value: entry.email });
                              if (entry.phone) contactTypes.push({ type: 'phone', value: entry.phone });
                              if (entry.instagram) contactTypes.push({ type: 'instagram', value: entry.instagram });
                              if (entry.facebook) contactTypes.push({ type: 'facebook', value: entry.facebook });
                              if (entry.other) contactTypes.push({ type: 'other', value: entry.other });
                              
                              if (contactTypes.length === 0) {
                                return (
                                  <span className="notes-text" style={{ fontSize: '0.9rem', color: '#666' }}>
                                    No contact info
                                  </span>
                                );
                              }
                              
                              return contactTypes.map((contact, idx) => {
                                const getContactStyle = (type) => {
                                  switch(type) {
                                    case 'email':
                                      return { backgroundColor: 'rgba(42, 217, 33, 0.1)', color: 'var(--gn-green)' };
                                    case 'phone':
                                      return { backgroundColor: 'rgba(59, 130, 246, 0.1)', color: '#3b82f6' };
                                    case 'instagram':
                                      return { backgroundColor: 'var(--gn-instagram-orange-offset)', color: 'var(--gn-instagram-orange)' };
                                    case 'facebook':
                                      return { backgroundColor: 'rgba(24, 119, 242, 0.1)', color: '#1877F2' };
                                    case 'other':
                                      return { backgroundColor: 'var(--gn-grey-250)', color: 'var(--gn-grey-700)' };
                                    default:
                                      return {};
                                  }
                                };
                                
                                return (
                                  <span
                                    key={idx}
                                    className="status"
                                    style={{
                                      fontSize: '0.75rem',
                                      display: 'inline-flex',
                                      alignItems: 'center',
                                      justifyContent: 'center',
                                      padding: '5px 10px',
                                      borderRadius: '5px',
                                      textTransform: 'capitalize',
                                      whiteSpace: 'nowrap',
                                      flexShrink: 0,
                                      ...getContactStyle(contact.type)
                                    }}
                                  >
                                    {contact.type}
                                  </span>
                                );
                              });
                            })()}
                          </div>
                          <button
                            className="btn icon notes-edit-btn"
                            onClick={(e) => {
                              e.stopPropagation();
                            }}
                            style={{ marginLeft: '0.5rem', flexShrink: 0 }}
                          >
                            <EditIcon />
                          </button>
                          {editingContact === entry.id && (
                            <div
                              data-contact-editor
                              className="notes-editor"
                              style={{
                                top: `${contactPosition.top}px`,
                                left: `${contactPosition.left}px`,
                              }}
                              onClick={(e) => e.stopPropagation()}
                            >
                              <h4>Contact Information</h4>
                              <div style={{ marginBottom: '1rem' }}>
                                <label className="label" style={{ marginBottom: '0.5rem', display: 'block' }}>Email</label>
                                <input
                                  type="email"
                                  className="input"
                                  placeholder="artist@example.com"
                                  value={contactValue.email}
                                  onChange={(e) => setContactValue(prev => ({ ...prev, email: e.target.value }))}
                                />
                              </div>
                              <div style={{ marginBottom: '1rem' }}>
                                <label className="label" style={{ marginBottom: '0.5rem', display: 'block' }}>Phone</label>
                                <input
                                  type="tel"
                                  className="input"
                                  placeholder="+44 123 456 7890"
                                  value={contactValue.phone}
                                  onChange={(e) => setContactValue(prev => ({ ...prev, phone: e.target.value }))}
                                />
                              </div>
                              <div style={{ marginBottom: '1rem' }}>
                                <label className="label" style={{ marginBottom: '0.5rem', display: 'block' }}>Instagram</label>
                                <input
                                  type="text"
                                  className="input"
                                  placeholder="@username or URL"
                                  value={contactValue.instagram}
                                  onChange={(e) => setContactValue(prev => ({ ...prev, instagram: e.target.value }))}
                                />
                              </div>
                              <div style={{ marginBottom: '1rem' }}>
                                <label className="label" style={{ marginBottom: '0.5rem', display: 'block' }}>Facebook</label>
                                <input
                                  type="text"
                                  className="input"
                                  placeholder="URL or username"
                                  value={contactValue.facebook}
                                  onChange={(e) => setContactValue(prev => ({ ...prev, facebook: e.target.value }))}
                                />
                              </div>
                              <div style={{ marginBottom: '1rem' }}>
                                <label className="label" style={{ marginBottom: '0.5rem', display: 'block' }}>Other</label>
                                <input
                                  type="text"
                                  className="input"
                                  placeholder="Other contact method"
                                  value={contactValue.other}
                                  onChange={(e) => setContactValue(prev => ({ ...prev, other: e.target.value }))}
                                />
                              </div>
                              <div className="notes-editor-actions">
                                <button
                                  className="btn tertiary"
                                  onClick={() => {
                                    setEditingContact(null);
                                    setContactValue({ email: '', phone: '', instagram: '', facebook: '', other: '' });
                                  }}
                                >
                                  Cancel
                                </button>
                                <button
                                  className="btn primary"
                                  onClick={() => handleSaveContact(entry.id)}
                                >
                                  Save
                                </button>
                              </div>
                            </div>
                          )}
                        </div>
                      )}
                    </td>
                    <td className="centre" onClick={(e) => e.stopPropagation()}>
                        <button
                          className="btn tertiary"
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedArtist(entry);
                            setShowInviteGigModal(true);
                          }}
                        >
                          Invite
                        </button>
                    </td>
                      {isMdUp && (
                      <td className='centre notes-cell' onClick={(e) => e.stopPropagation()}>
                        <div 
                          className="notes-container"
                          onClick={(e) => {
                            e.stopPropagation();
                            const rect = e.currentTarget.getBoundingClientRect();
                            setNotesPosition({ top: rect.top - 120, left: rect.left });
                            setEditingNotes(entry.id);
                            setNotesValue(entry.notes || '');
                          }}
                        >
                          <div className="notes-content">
                            <span className="notes-text" style={{ fontSize: '0.9rem' }}>
                              {entry.notes || ''}
                            </span>
                            <button
                              className="btn icon notes-edit-btn"
                              onClick={(e) => {
                                e.stopPropagation();
                              }}
                            >
                              <EditIcon />
                            </button>
                          </div>
                          {editingNotes === entry.id && (
                            <div
                              data-notes-editor
                              className="notes-editor"
                              style={{
                                top: `${notesPosition.top}px`,
                                left: `${notesPosition.left}px`,
                              }}
                              onClick={(e) => e.stopPropagation()}
                            >
                              <h4>Notes</h4>
                              <textarea
                                className="notes-textarea"
                                value={notesValue}
                                onChange={(e) => setNotesValue(e.target.value)}
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter' && !e.shiftKey) {
                                    e.preventDefault();
                                    handleSaveNotes(entry.id);
                                  }
                                  if (e.key === 'Escape') {
                                    setEditingNotes(null);
                                    setNotesValue('');
                                  }
                                }}
                                onBlur={(e) => {
                                  setTimeout(() => {
                                    if (editingNotes === entry.id) {
                                      handleSaveNotes(entry.id);
                                    }
                                  }, 200);
                                }}
                                autoFocus
                              />
                              <div className="notes-editor-actions">
                                <button
                                  className="btn tertiary"
                                  onClick={() => {
                                    setEditingNotes(null);
                                    setNotesValue('');
                                  }}
                                >
                                  Cancel
                                </button>
                                <button
                                  className="btn primary"
                                  onClick={() => handleSaveNotes(entry.id)}
                                >
                                  Save
                                </button>
                              </div>
                            </div>
                          )}
                        </div>
                      </td>
                    )}
                    <td className="options-cell" onClick={(e) => e.stopPropagation()} style={{ position: 'relative' }}>
                      <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                        <button 
                          className={`btn icon ${openOptionsId === entry.id ? 'active' : ''}`} 
                          onClick={(e) => {
                            e.stopPropagation();
                            setOpenOptionsId(openOptionsId === entry.id ? null : entry.id);
                          }}
                        >
                          <OptionsIcon />
                        </button>
                      </div>
                      {openOptionsId === entry.id && (
                        <div className="options-dropdown crm" onClick={(e) => e.stopPropagation()}>
                          <button onClick={() => {
                            setOpenOptionsId(null);
                            handleDeleteEntry(entry.id);
                          }}>
                            {hasProfile ? 'Unsave' : 'Delete'}
                            {hasProfile ? <SavedIcon /> : <DeleteGigIcon />}
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                  );
                })}

              {/* Add Artist Row - Always at bottom */}
              <tr className="add-artist-row">
                <td className='name-cell' onClick={(e) => e.stopPropagation()}>
                  <div 
                    className="notes-container"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleAddNewRow(e);
                    }}
                    style={{ cursor: 'pointer' }}
                  >
                    <div className="notes-content">
                      <span className="notes-text" style={{ fontSize: '0.9rem', color: '#999' }}>
                        Add New Artist
                      </span>
                      <button
                        className="btn icon notes-edit-btn"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleAddNewRow(e);
                        }}
                      >
                        <PlusIcon />
                      </button>
                    </div>
                    {isAddingNew && (
                      <div
                        data-notes-editor
                        className="notes-editor"
                        style={{
                          top: `${addArtistPosition.top}px`,
                          left: `${addArtistPosition.left}px`,
                        }}
                        onClick={(e) => e.stopPropagation()}
                      >
                        <h4>Add Artist</h4>
                        <div style={{ marginBottom: '1rem' }}>
                          <label className="label" style={{ marginBottom: '0.5rem', display: 'block' }}>Artist Name *</label>
                          <input
                            type="text"
                            className="input"
                            placeholder="Enter artist name"
                            value={newEntryData.name}
                            onChange={(e) => setNewEntryData(prev => ({ ...prev, name: e.target.value }))}
                            autoFocus
                          />
                        </div>
                        <div style={{ marginBottom: '1rem' }}>
                          <label className="label" style={{ marginBottom: '0.5rem', display: 'block' }}>Email</label>
                          <input
                            type="email"
                            className="input"
                            placeholder="artist@example.com"
                            value={newEntryData.email}
                            onChange={(e) => setNewEntryData(prev => ({ ...prev, email: e.target.value }))}
                          />
                        </div>
                        <div style={{ marginBottom: '1rem' }}>
                          <label className="label" style={{ marginBottom: '0.5rem', display: 'block' }}>Phone</label>
                          <input
                            type="tel"
                            className="input"
                            placeholder="+44 123 456 7890"
                            value={newEntryData.phone}
                            onChange={(e) => setNewEntryData(prev => ({ ...prev, phone: e.target.value }))}
                          />
                        </div>
                        <div style={{ marginBottom: '1rem' }}>
                          <label className="label" style={{ marginBottom: '0.5rem', display: 'block' }}>Instagram</label>
                          <input
                            type="text"
                            className="input"
                            placeholder="@username or URL"
                            value={newEntryData.instagram}
                            onChange={(e) => setNewEntryData(prev => ({ ...prev, instagram: e.target.value }))}
                          />
                        </div>
                        <div style={{ marginBottom: '1rem' }}>
                          <label className="label" style={{ marginBottom: '0.5rem', display: 'block' }}>Facebook</label>
                          <input
                            type="text"
                            className="input"
                            placeholder="URL or username"
                            value={newEntryData.facebook}
                            onChange={(e) => setNewEntryData(prev => ({ ...prev, facebook: e.target.value }))}
                          />
                        </div>
                        <div style={{ marginBottom: '1rem' }}>
                          <label className="label" style={{ marginBottom: '0.5rem', display: 'block' }}>Other</label>
                          <input
                            type="text"
                            className="input"
                            placeholder="Other contact method"
                            value={newEntryData.other}
                            onChange={(e) => setNewEntryData(prev => ({ ...prev, other: e.target.value }))}
                          />
                        </div>
                        <div style={{ marginBottom: '1rem' }}>
                          <label className="label" style={{ marginBottom: '0.5rem', display: 'block' }}>Notes</label>
                          <textarea
                            className="notes-textarea"
                            placeholder="Add notes about this artist..."
                            value={newEntryData.notes}
                            onChange={(e) => setNewEntryData(prev => ({ ...prev, notes: e.target.value }))}
                            rows={4}
                          />
                        </div>
                        <div className="notes-editor-actions">
                          <button
                            className="btn tertiary"
                            onClick={handleCancelNewRow}
                            disabled={savingNew}
                          >
                            Cancel
                          </button>
                          <button
                            className="btn primary"
                            onClick={handleSaveNewRow}
                            disabled={!newEntryData.name.trim() || savingNew}
                          >
                            {savingNew ? 'Adding...' : 'Add Artist'}
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                </td>
                <td className='centre'></td>
                <td className="centre"></td>
                {isMdUp && (
                  <td className='centre'></td>
                )}
                <td className="options-cell"></td>
              </tr>
            </tbody>
            </table>
          </>
        )}
      </div>

      {showInviteGigModal && selectedArtist && (
        <InviteToGigModal
          artist={selectedArtist}
          onClose={() => {
            setShowInviteGigModal(false);
            setSelectedArtist(null);
          }}
          venues={venues}
          user={user}
          crmEntries={crmEntries}
        />
      )}

    </>
  );
};
