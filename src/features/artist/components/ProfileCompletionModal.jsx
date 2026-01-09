import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { NoTextLogo } from '@features/shared/ui/logos/Logos';
import { GuitarsIcon, CopyIcon } from '../../shared/ui/extras/Icons';

/**
 * ProfileCompletionModal
 * 
 * A modal that appears once when an artist completes their profile creation.
 * Uses localStorage to ensure it only shows once per profile.
 * 
 * @param {Object} props - Component props
 * @param {Function} props.onClose - Function to close the modal
 * @param {String} props.profileId - The profile ID to track if modal has been shown
 * @param {Boolean} props.shouldShow - Whether the modal should be shown (triggers the check)
 */
export const ProfileCompletionModal = ({ onClose, profileId, shouldShow = false }) => {
  const [isVisible, setIsVisible] = useState(false);
  const navigate = useNavigate();
  
  // Construct the profile link
  const profileLink = profileId ? `${window.location.origin}/artist/${profileId}` : '';
  
  // Handle copying link to clipboard
  const handleCopyLink = async () => {
    if (!profileLink) {
      toast.error('Profile link not available');
      return;
    }
    
    try {
      await navigator.clipboard.writeText(profileLink);
      toast.success('Link copied to clipboard');
    } catch (err) {
      console.error('Failed to copy link:', err);
      toast.error('Failed to copy link. Please try again.');
    }
  };

  useEffect(() => {
    if (!profileId || !shouldShow) {
      setIsVisible(false);
      return;
    }
    const storageKey = `profile-completion-modal-shown-${profileId}`;
    const hasBeenShown = localStorage.getItem(storageKey);
    
    if (!hasBeenShown) {
      // Show the modal
      setIsVisible(true);
      // Mark as shown in localStorage
      localStorage.setItem(storageKey, 'true');
    } else {
      // Already shown, don't show again
      setIsVisible(false);
    }
  }, [profileId, shouldShow]);

  if (!isVisible) return null;

  return (
    <div className='modal profile-completion' onClick={onClose}>
      <div className='modal-content profile-completion' onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <GuitarsIcon />
          <h2>Profile Complete!</h2>
        </div>
        <button className='btn close tertiary' onClick={onClose}>
          Close
        </button>
        <div className="modal-body">
          <div style={{ 
            display: 'flex', 
            flexDirection: 'column', 
            gap: '1rem',
            textAlign: 'center',
            padding: '1rem 0'
          }}>
            <p style={{ fontSize: '1rem', color: 'var(--gn-grey-700)' }}>
              We recommend putting this link in your instagram bio so bookers can find all the information you have added here. 
            </p>
            
            {/* Profile Link */}
            {profileLink && (
              <div style={{ 
                display: 'flex', 
                flexDirection: 'column', 
                gap: '0.75rem',
                alignItems: 'center',
                marginTop: '0.5rem'
              }}>
                <p style={{ 
                  fontSize: '0.9rem', 
                  color: 'var(--gn-grey-600)',
                  wordBreak: 'break-all',
                  textAlign: 'center',
                  padding: '0.75rem',
                  backgroundColor: 'var(--gn-grey-100)',
                  borderRadius: '0.5rem',
                  width: '100%',
                  maxWidth: '400px'
                }}>
                  {profileLink}
                </p>
                <button 
                  className='btn secondary' 
                  onClick={handleCopyLink}
                  style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}
                >
                  <CopyIcon />
                  Copy Link
                </button>
              </div>
            )}

          </div>
        </div>

        <div style={{ 
          display: 'flex', 
          flexDirection: 'column',
          alignItems: 'center',
          gap: '1rem',
          marginTop: '1.5rem' 
        }}>
          <p style={{ fontSize: '1rem', color: 'var(--gn-grey-700)', textAlign: 'center' }}>
            Get in touch with venues now to book a gig
          </p>
          <button 
            className='btn primary' 
            onClick={() => {
              navigate('/find-venues');
              onClose();
            }}
            style={{ minWidth: '200px' }}
          >
            Find a Venue
          </button>
        </div>
      </div>
    </div>
  );
};

