export const MAIN_HEADLINE = 'Where the booking happens';

export function musicianSteps(flags) {
  const steps = [];
  if (flags.venueMap) {
    steps.push({
      title: 'Find venues and get in touch',
      body: 'See who books music near you, apply to their gigs, or enquire straight from your own email.',
    });
  }
  if (flags.artistPage) {
    steps.push({
      title: 'A profile you keep using',
      body: 'Your music, photos and where you have played, kept up to date as you gig. Send it anywhere.',
    });
  }
  if (flags.artistGigs || flags.artistInvoices) {
    steps.push({
      title: 'Your gigs and invoices sorted',
      body: 'Including the gigs you book yourself.',
    });
  }
  return steps;
}

export function artistJourney(flags) {
  const sections = [];
  if (flags.artistPage) {
    sections.push({
      id: 'link',
      kicker: 'One link',
      title: 'One link. Everything a booker needs.',
      body: 'Music, photos, where you have played, and a way to enquire. One page instead of a thread of emails.',
      action: 'Preview an artist page',
      popup: 'preview',
    });
  }
  if (flags.venueMap) {
    sections.push({
      id: 'find',
      kicker: 'Find venues',
      title: 'Or go and find them.',
      body: 'The venues already on Gigin, on a map you can search. Open one and send a pitch from your own email.',
      action: 'Explore the venue map',
      popup: 'map',
    });
  }
  if (flags.artistPage) {
    sections.push({
      id: 'profile',
      kicker: 'Your page',
      title: 'Your profile does the talking.',
      body: 'A booker opens your page and hears the music, sees the photos, and can ask you to play.',
      action: 'Preview an artist page',
      popup: 'preview',
    });
  }
  if (flags.actNight) {
    sections.push({
      id: 'night',
      kicker: 'The night',
      title: 'Booked, with everything for the night.',
      body: 'Once you are booked, the gig handbook has the time, the room, and who to call.',
    });
  }
  if (flags.artistInvoices) {
    sections.push({
      id: 'invoice',
      kicker: 'Invoice',
      title: 'Generate the invoice.',
      body: 'Write the invoice and email it to the venue. Gigin does not take the payment.',
    });
  }
  if (flags.reviews) {
    sections.push({
      id: 'reputation',
      kicker: 'After the gig',
      title: 'Build your reputation.',
      body: 'Venues confirm you played. That history stays on the page bookers see next time.',
    });
  }
  if (flags.artistHome) {
    sections.push({
      id: 'live',
      kicker: 'Two minutes',
      title: 'Your page, live in two minutes.',
      body: 'Add your music, a photo and a short bio. The page is ready to send.',
      steps: ['Add your music', 'A photo and a few words', 'Share it'],
    });
  }
  return sections;
}

export const ARTIST_FAQ = [
  { q: 'How long does it take?', a: 'The page itself takes about two minutes. You can send the link the same day.' },
  { q: 'Do I need an account before a venue books me?', a: 'A venue can open your page and enquire. You sign in when you want to change the page.' },
  { q: 'What does a booker see?', a: 'Your music, photos, and the gigs you choose to show. Your email stays off the public page.' },
];
