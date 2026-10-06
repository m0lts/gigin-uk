function readFlag(value) {
  return value === 'true';
}

/** Product surfaces that can be turned back on with Vite env vars. Default off. */
export const FEATURES = {
  payments: readFlag(import.meta.env.VITE_FEATURE_PAYMENTS),
  ticketing: readFlag(import.meta.env.VITE_FEATURE_TICKETING),
  chat: readFlag(import.meta.env.VITE_FEATURE_CHAT),
  discovery: readFlag(import.meta.env.VITE_FEATURE_DISCOVERY),
  venueHire: readFlag(import.meta.env.VITE_FEATURE_VENUE_HIRE),
  bands: readFlag(import.meta.env.VITE_FEATURE_BANDS),
  reviews: readFlag(import.meta.env.VITE_FEATURE_REVIEWS),
  marketingPages: readFlag(import.meta.env.VITE_FEATURE_MARKETING_PAGES),
  finances: readFlag(import.meta.env.VITE_FEATURE_FINANCES),
  keepProfile: readFlag(import.meta.env.VITE_FEATURE_KEEP_PROFILE),
  publicProfile: readFlag(import.meta.env.VITE_FEATURE_PUBLIC_PROFILE),
  legacyArtist: readFlag(import.meta.env.VITE_FEATURE_LEGACY_ARTIST),
  venueFinder: readFlag(import.meta.env.VITE_FEATURE_VENUE_FINDER),
  pressKit: readFlag(import.meta.env.VITE_FEATURE_PRESS_KIT),
  landingProof: readFlag(import.meta.env.VITE_FEATURE_LANDING_PROOF),
  // Venue self-signup. Off unless the build sets this to true. A new venue stays pending until the founder approves it.
  venueSignup: readFlag(import.meta.env.VITE_FEATURE_VENUE_SIGNUP),
};
