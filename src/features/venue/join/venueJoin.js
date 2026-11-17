export const JOIN_ROLES = ['I book the music', 'I run the room', 'I help out'];
export const HOW_OFTEN = [
  { id: '1', label: 'About once a month', nights: 1 },
  { id: '4', label: 'Most weeks', nights: 4 },
  { id: '8', label: 'A few times a week', nights: 8 },
];

export function claimRequest({ venueName, role, howOften, name, email, city, fromGig }) {
  const often = HOW_OFTEN.find((item) => item.id === howOften) || HOW_OFTEN[0];
  const message = [
    `Role: ${role || JOIN_ROLES[0]}`,
    'This is a claim request for an existing room, waiting for approval.',
    fromGig ? `Came from an artist gig: ${fromGig}` : '',
  ].filter(Boolean).join(' ');
  return {
    name: String(name || '').trim(),
    venueName: String(venueName || '').trim(),
    city: String(city || '').trim(),
    email: String(email || '').trim(),
    nightsPerMonth: often.nights,
    message,
    company: '',
  };
}
