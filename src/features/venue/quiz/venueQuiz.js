export const QUIZ_OPENING = 'Let\'s see if Gigin is the right fit for you';

export const QUIZ_STEPS = [
  {
    id: 'how',
    title: 'How do you put on live music?',
    lede: QUIZ_OPENING,
    options: [
      ['own', 'We book acts for our own venue', 'A bar, cafe, pub, club or arts space with its own nights'],
      ['promoter', 'I run a night at someone else\'s venue', 'A promoter or series curator'],
      ['hire', 'We hire our space out to promoters', 'Room hire, private events, promoters bringing their own line-up'],
      ['artist', 'I\'m an artist', 'You want gigs, not acts'],
    ],
  },
  {
    id: 'often',
    title: 'How often do you have live music?',
    options: [
      ['week', 'Every week'],
      ['month', 'A few times a month'],
      ['sometimes', 'Now and then'],
      ['first', 'Planning our first nights'],
    ],
  },
  {
    id: 'pay',
    title: 'How do acts usually get paid?',
    lede: 'Gigin does not move money, so this tells us what you still handle yourself.',
    options: [
      ['fee', 'A set fee, paid by us', 'Cash or bank transfer on the night'],
      ['door', 'A share of the door or tickets'],
      ['free', 'Free or tips only'],
      ['varies', 'It varies'],
    ],
  },
  {
    id: 'help',
    title: 'What would help most?',
    lede: 'Pick as many as you like.',
    multiple: true,
    options: [
      ['find', 'Finding new acts', 'Acts apply to your gigs with their music'],
      ['applications', 'Handling applications in one place', 'Listen, book into a set, decline kindly'],
      ['promo', 'Getting promo without chasing', 'Bio, photos and a track before the night'],
      ['night', 'Organising the night', 'Running order, set times, staff can see it'],
      ['tickets', 'Selling tickets', 'Not built yet'],
      ['pay', 'Paying acts through Gigin', 'Not built yet'],
    ],
  },
  {
    id: 'who',
    title: 'Who does the booking?',
    options: [
      ['me', 'Just me'],
      ['team', 'Me and a small team', 'Staff can see the night without changing it'],
      ['else', 'Someone else books for us', 'An agent or promoter'],
    ],
  },
];

export const HIRE_WANTS = [
  ['enquiries', 'Take hire enquiries and hold dates'],
  ['contracts', 'Send contracts and take deposits'],
  ['free', 'Show promoters when the room is free'],
];

export function quizResult(answers) {
  if (answers.how === 'artist') return 'artist';
  if (answers.how === 'hire') return 'waitlist';
  const help = answers.help || [];
  const unfinished = help.includes('tickets') || help.includes('pay') || answers.who === 'else';
  const occasional = answers.often === 'sometimes' || answers.often === 'first';
  if (unfinished || occasional) return 'gaps';
  return 'fit';
}

export function waitlistRequest({ name, email, city, note }) {
  return {
    name: String(name || email || 'Waitlist').trim(),
    venueName: 'Room hire waitlist',
    city: String(city || 'Unknown').trim() || 'Unknown',
    email: String(email || '').trim(),
    nightsPerMonth: 1,
    message: `Room hire waitlist. ${String(note || '').trim()}`,
    company: '',
  };
}
