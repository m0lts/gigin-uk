/**
 * Checks if the user is authenticated and the given musician profile is valid and complete.
 *
 * @param {object} params
 * @param {object} params.user - The current user object.
 * @param {function} params.setAuthModal
 * @param {function} params.setAuthType
 * @param {function} params.setNoProfileModal
 * @param {function} params.setIncompleteMusicianProfile
 * @param {object} [params.profile] - Optional: a specific musician or band profile to validate.
 * @returns {{ valid: boolean, musicianProfile?: object }}
 */
export const validateMusicianUser = ({
  user,
  setAuthModal,
  setAuthType,
  setNoProfileModal,
  setIncompleteMusicianProfile,
  profile, // optional override
}) => {
  if (!user) {
    setAuthModal(true);
    setAuthType('login');
    return { valid: false };
  }

  const musicianProfile = profile || user.musicianProfile;
  if (!musicianProfile) {
    setNoProfileModal(true);
    return { valid: false };
  }

  if (!musicianProfile.completed) {
    setNoProfileModal(true);
    setIncompleteMusicianProfile?.(musicianProfile);
    return { valid: false };
  }

  return { valid: true, musicianProfile };
};

/**
 * Checks if the user is authenticated and has at least one venue profile.
 * Triggers UI setters appropriately.
 *
 * @param {object} user - The current user object.
 * @param {function} setAuthModal - Function to open the auth modal.
 * @param {function} setAuthType - Function to set the auth modal type.
 * @param {function} showAlert - Optional function or callback to display an alert or message.
 * @returns {{ valid: boolean, venueProfiles?: object[] }} - Result of validation and venue profiles if valid.
 */
export const validateVenueUser = ({
  user,
  setAuthModal,
  setAuthType,
  showAlert,
}) => {
  if (!user) {
    setAuthModal(true);
    setAuthType('login');
    return { valid: false };
  }

  if (!user.venueProfiles || user.venueProfiles.length === 0) {
    showAlert?.('You must create a venue profile and post a gig before inviting a musician to one.');
    return { valid: false };
  }

  return { valid: true, venueProfiles: user.venueProfiles };
};

const adjectives = ['brave', 'silly', 'quiet', 'noisy', 'happy', 'grumpy', 'eager', 'gentle', 'swift', 'bold'];
const nouns = ['elephant', 'rocket', 'banana', 'violin', 'book', 'storm', 'piano', 'zebra', 'camera', 'island', 'light', 'desk', 'coffee', 'speaker'];

export const generateBandPassword = () => {
  const random = (arr) => arr[Math.floor(Math.random() * arr.length)];
  return `${random(adjectives)}-${random(nouns)}-${random(nouns)}`;
};