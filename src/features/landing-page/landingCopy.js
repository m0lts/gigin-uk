export const VENUE_HEADLINE = 'Level up your live music';

export function landingSections({ venuePage, venueHome, discovery, artistPage }) {
  return {
    profile: Boolean(venuePage),
    dashboard: Boolean(venueHome),
    findArtists: Boolean(discovery),
    artistPages: Boolean(artistPage),
    network: false,
    prices: false,
    logos: false,
    testimonials: false,
  };
}
