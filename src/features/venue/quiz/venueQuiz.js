export const QUIZ_OPENING = 'Let\'s see if Gigin is the right fit for you';

export function quizResult({ booksLive, nights, roomHire }) {
  if (roomHire && !booksLive) return 'waitlist';
  if (booksLive && nights === 'often') return 'fit';
  if (booksLive) return 'gaps';
  return 'waitlist';
}

export function waitlistRequest({ name, email, city, note }) {
  return {
    name: String(name || '').trim(),
    venueName: 'Room hire waitlist',
    city: String(city || 'Unknown').trim() || 'Unknown',
    email: String(email || '').trim(),
    nightsPerMonth: 1,
    message: `Room hire waitlist. ${String(note || '').trim()}`,
    company: '',
  };
}
