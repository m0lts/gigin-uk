import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { NoTextLogo } from '@features/shared/ui/logos/Logos';
import { GuitarsIcon, CopyIcon, CelebrateIcon, RightArrowIcon } from '../../shared/ui/extras/Icons';

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
    <>
      <div className='modal profile-completion' onClick={onClose}>
        <div className='modal-content' onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <CelebrateIcon />
          <h2>Artist Profile Complete!</h2>
        </div>
        <button className='btn close tertiary' onClick={onClose}>
          Close
        </button>
        <div className="modal-body">
          <h4>Let's get sharing this awesome profile with the world!</h4>
          <br />
          <p>Here's the link to your artist profile. We recommend putting this link in your Instagram bio, Linktree, or any other social media profile so bookers can find all the information you have added here.</p>
          <br />
          {/* Profile Link */}
          {profileLink && (
            <div>
              <p className='artist-profile-link'>
                {profileLink}
              </p>
              <button 
                className='btn artist-profile' 
                onClick={handleCopyLink}
              >
                <CopyIcon />
                Copy Link
              </button>
            </div>
          )}
          <div className="or-separator">
            <span />
            <h6>or</h6>
            <span />
          </div>
          <button className='btn tertiary' onClick={() => {
            navigate('/find-venues');
            onClose();
          }}>
            Search for Venues Now <RightArrowIcon />
          </button>
        </div>
        </div>
      </div>
    </>
  );
};

