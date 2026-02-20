import { useState } from 'react';
import { toast } from 'sonner';
import { InviteIconSolid, TickIcon, CopyIcon } from '../../shared/ui/extras/Icons';
import { formatDate } from '@services/utils/dates';
import { sendGigInviteEmail } from '@services/client-side/emails';
import Portal from '../../shared/components/Portal';

export const InviteMethodsModal = ({ artist, gigData, venue, user, onClose, onEmailSent }) => {
  const [selectedContactMethod, setSelectedContactMethod] = useState(null);
  const [copiedLink, setCopiedLink] = useState(false);
  const [sendingEmail, setSendingEmail] = useState(false);

  const getAvailableContactMethods = () => {
    const methods = [];
    if (artist.email) methods.push({ type: 'email', label: 'Email', available: true });
    if (artist.phone) methods.push({ type: 'phone', label: 'Phone', available: true });
    if (artist.instagram) methods.push({ type: 'instagram', label: 'Instagram', available: true });
    if (artist.facebook) methods.push({ type: 'facebook', label: 'Facebook', available: true });
    if (artist.other) methods.push({ type: 'other', label: 'Other', available: true });
    return methods;
  };

  const generateGigLink = () => {
    const base = `${window.location.origin}/gig/${gigData.gigId}`;
    if (artist?.email?.trim()) {
      return `${base}?email=${encodeURIComponent(artist.email.trim())}`;
    }
    return base;
  };

  const generateInviteMessage = () => {
    const formattedDate = formatDate(gigData.date, 'short');
    const gigLink = generateGigLink();
    const venueName = gigData.venue?.venueName || venue?.name || '';
    const userName = user.name || venue?.accountName || '';
    
    return `${userName} has invited you to play at their gig at ${venueName} on ${formattedDate}. Check it out on Gigin: ${gigLink}`;
  };

  const getPlatformLink = (contactMethod) => {
    const message = generateInviteMessage();
    const encodedMessage = encodeURIComponent(message);
    
    switch(contactMethod) {
      case 'phone':
        // SMS link - clean phone number
        let phoneNumber = artist.phone?.replace(/[\s\-\(\)]/g, '') || '';
        if (phoneNumber && !phoneNumber.startsWith('+')) {
          if (phoneNumber.startsWith('0')) {
            phoneNumber = '+44' + phoneNumber.substring(1);
          } else {
            phoneNumber = '+44' + phoneNumber;
          }
        }
        return phoneNumber ? `sms:${phoneNumber}?body=${encodedMessage}` : null;
      case 'instagram':
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
        const facebookUrl = artist.facebook || '';
        if (facebookUrl.includes('facebook.com') || facebookUrl.includes('m.me')) {
          return facebookUrl.startsWith('http') ? facebookUrl : `https://${facebookUrl}`;
        }
        return facebookUrl ? `https://m.me/${facebookUrl.replace(/^@/, '')}` : null;
      case 'other':
        return null;
      default:
        return null;
    }
  };

  const handleCopyLink = async () => {
    const link = generateGigLink();
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

  const handleCopyMessage = async () => {
    const message = generateInviteMessage();
    try {
      await navigator.clipboard.writeText(message);
      toast.success('Message copied to clipboard!');
    } catch (error) {
      console.error('Failed to copy message:', error);
      toast.error('Failed to copy message. Please try again.');
    }
  };

  const handleContactMethodSelect = async (method) => {
    setSelectedContactMethod(method);
    if (method === 'email') {
      await handleSendEmail();
    }
  };

  const handleSendEmail = async () => {
    if (!artist.email || !artist.email.trim()) {
      toast.error('Please enter an email address for this artist to send an invitation.');
      return;
    }

    try {
      setSendingEmail(true);
      const gigLink = generateGigLink();
      const formattedDate = formatDate(gigData.date, 'short');
      
      await sendGigInviteEmail({
        to: artist.email.trim(),
        userName: user.name || venue?.accountName || '',
        venueName: gigData.venue?.venueName || venue?.name || '',
        date: formattedDate,
        gigLink: gigLink,
      });

      toast.success(`Invitation email sent to ${artist.name}`);
      if (onEmailSent) {
        onEmailSent();
      }
      onClose();
    } catch (error) {
      console.error('Error sending email:', error);
      toast.error('Failed to send email. Please try again.');
    } finally {
      setSendingEmail(false);
    }
  };

  const handleOpenPlatform = (contactMethod) => {
    const platformLink = getPlatformLink(contactMethod);
    if (platformLink) {
      window.open(platformLink, '_blank');
    }
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
      `}</style>
      <div className="modal invite-musician" onClick={onClose}>
        <div className="modal-content" onClick={(e) => e.stopPropagation()}>
          <div className="modal-header">
            <div className="modal-header-text">
              <InviteIconSolid />
              <h2>How would you like to send the invite to {artist?.name}?</h2>
            </div>
          </div>
          
          <div className="contact-method-selection" style={{ marginBottom: '1.5rem' }}>
            <h3 style={{ marginBottom: '1rem', fontSize: '1rem', fontWeight: 600 }}>Select contact method:</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              {getAvailableContactMethods().map((method) => (
                <button
                  key={method.type}
                  className={`btn ${selectedContactMethod === method.type ? 'primary' : 'secondary'}`}
                  onClick={() => handleContactMethodSelect(method.type)}
                  disabled={sendingEmail}
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
                    value={generateGigLink()}
                    readOnly
                    style={{ flex: 1, fontFamily: 'monospace', fontSize: '0.85rem' }}
                  />
                  <button
                    className="btn secondary"
                    onClick={handleCopyLink}
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
                  value={generateInviteMessage()}
                  readOnly
                  rows={3}
                  style={{ width: '100%', fontSize: '0.85rem', marginBottom: '0.5rem', resize: 'none' }}
                />
                <button
                  className="btn secondary"
                  onClick={handleCopyMessage}
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
                  onClick={() => handleOpenPlatform('phone')}
                  style={{ width: '100%', marginTop: '0.5rem' }}
                >
                  Open SMS App
                </button>
              )}
              
              {selectedContactMethod === 'instagram' && artist.instagram && (
                <button
                  className="btn primary"
                  onClick={() => handleOpenPlatform('instagram')}
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
              onClick={onClose}
              disabled={sendingEmail}
            >
              {selectedContactMethod === 'email' ? 'Close' : 'Cancel'}
            </button>
          </div>
        </div>
      </div>
    </Portal>
  );
};
