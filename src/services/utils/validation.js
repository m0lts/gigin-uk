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
  setNoProfileModalClosable,
  profile,
}) => {
  if (!user) {
    setAuthModal?.(true);
    setAuthType?.('login');
    setNoProfileModalClosable(true);
    sessionStorage.setItem('redirect', 'do-not-redirect');
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
    setNoProfileModalClosable(true);
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
  console.log('getMusicianEligibility profile=', profile);
  if (!profile) {
    return { canApply: false, reasons: ['No musician profile found'] };
  }
  const reasons = [];
  const hasName = typeof profile.name === 'string' && profile.name.trim().length >= 0;
  const completedSignup = profile.onboarded;
  if (!hasName) reasons.push('Add a stage name');
  if (!completedSignup) reasons.push('Complete signup');
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


/**
 * Validates all gig timing slots.
 *
 * @param {Object} formData - The main form data object.
 * @param {Array} extraSlots - Array of extra slot objects with { startTime, duration }.
 * @returns {{ valid: boolean, error?: string }}
 */
export const validateGigTimings = (formData, extraSlots) => {
  const allSlots = [
    { startTime: formData.startTime, duration: formData.duration },
    ...extraSlots,
  ];

  for (let i = 0; i < allSlots.length; i++) {
    const { startTime, duration } = allSlots[i];

    if (allSlots.length === 1 && (!startTime || duration === 0)) {
      return {
        valid: false,
        error: `Gig must have a valid start time and duration.`,
      };
    }

    if (!startTime || duration === 0) {
      return {
        valid: false,
        error: `Slot ${i + 1} must have a valid start time and duration.`,
      };
    }

    if (duration < 15) {
      return {
        valid: false,
        error: `Slot ${i + 1} duration is too short. Must be at least 15 minutes.`,
      };
    }
  }

  for (let i = 1; i < allSlots.length; i++) {
    const prev = allSlots[i - 1];
    const curr = allSlots[i];

    const [prevH, prevM] = prev.startTime.split(':').map(Number);
    const [currH, currM] = curr.startTime.split(':').map(Number);

    const prevEndInMins = prevH * 60 + prevM + prev.duration;
    const currStartInMins = currH * 60 + currM;

    if (currStartInMins < prevEndInMins) {
      return {
        valid: false,
        error: `Slot ${i + 1} overlaps with the previous slot.`,
      };
    }

    if (currStartInMins > 1440) {
      return {
        valid: false,
        error: `Slot ${i + 1} starts after midnight, which is not allowed.`,
      };
    }
  }

  return { valid: true };
};


const BLOCKED_EMAIL_DOMAINS = ['cam.ac.uk'];


/**
 * Checks if the given email address is blocked due to its domain.
 *
 * @param {string} email - The email address to check.
 * @returns {boolean} True if the email address is blocked, false otherwise.
 * @example
 * isBlockedEmail('user@cam.ac.uk') // true
 * isBlockedEmail('user@example.com') // false
 */
export const isBlockedEmail = (email) => {
  const m = String(email || '').toLowerCase().trim().match(/@([^@\s>]+)$/);
  if (!m) return false;
  const domain = m[1]; // e.g. "cam.ac.uk"
  return BLOCKED_EMAIL_DOMAINS.some(d => domain === d || domain.endsWith(`.${d}`));
};
