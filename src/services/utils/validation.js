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
  profile,
}) => {
  if (!user) {
    setAuthModal?.(true);
    setAuthType?.('login');
    return { valid: false };
  }
  const p =
  profile ||
  user?.musicianProfile ||
  null;
  const { canApply, reasons } = getMusicianEligibility(p);
  if (!canApply) {
    setNoProfileModal?.(true);
    setIncompleteMusicianProfile?.(p || null);
    return { valid: false, reasons };
  }
  return { valid: true, musicianProfile: p };
};


/**
 * Business rule: what makes a musician eligible to apply to gigs?
 * Keep this pure and framework-agnostic.
 * Extend later with moderation/bans/verifications without touching UI.
 *
 * @param {object|null} profile
 * @returns {{ canApply: boolean, reasons: string[] }}
 */
export function getMusicianEligibility(profile) {
  if (!profile) {
    return { canApply: false, reasons: ['No musician profile found'] };
  }
  const reasons = [];
  const hasName = typeof profile.name === 'string' && profile.name.trim().length >= 2;
  const hasPhoto = !!profile.picture;
  if (!hasName) reasons.push('Add a stage name');
  if (!hasPhoto) reasons.push('Add a profile photo');
  if (profile.status === 'banned') reasons.push('Your account is restricted');
  if (profile.photoModeration === 'rejected') reasons.push('Upload a new profile photo');
  return { canApply: reasons.length === 0, reasons };
}


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



const adjectives = [
  'brave', 'silly', 'quiet', 'noisy', 'happy', 'grumpy', 'eager', 'gentle', 'swift', 'bold',
  'clever', 'fuzzy', 'witty', 'curious', 'bubbly', 'zany', 'sleepy', 'fiery', 'mellow', 'quirky',
  'stormy', 'shiny', 'fierce', 'jolly', 'whimsical', 'frosty', 'spicy', 'dizzy', 'cranky', 'fancy',
  'feathered', 'graceful', 'dusty', 'fluffy', 'prickly', 'cheeky', 'drowsy', 'lively', 'jazzy', 'rowdy',
  'frozen', 'bashful', 'twinkly', 'sunny', 'moody', 'sassy', 'crafty', 'vivid', 'mystic', 'daring'
];

const nouns = [
  'elephant', 'rocket', 'banana', 'violin', 'book', 'storm', 'piano', 'zebra', 'camera', 'island',
  'light', 'desk', 'coffee', 'speaker', 'panther', 'comet', 'drum', 'jungle', 'owl', 'lantern',
  'castle', 'tulip', 'marble', 'bison', 'mango', 'canyon', 'pebble', 'helmet', 'wagon', 'dragon',
  'hammock', 'glacier', 'cookie', 'feather', 'tornado', 'pumpkin', 'skater', 'sunset', 'scooter', 'pirate',
  'cloud', 'bongo', 'robot', 'cactus', 'wizard', 'anvil', 'guitar', 'meteor', 'waffle', 'flamingo'
];

export const generateBandPassword = () => {
  const random = (arr) => arr[Math.floor(Math.random() * arr.length)];
  return `${random(adjectives)}-${random(nouns)}-${random(nouns)}`;
};

