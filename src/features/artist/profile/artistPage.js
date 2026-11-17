export function publicProfile(profile) {
  if (!profile) return null;
  return {
    name: profile.name || '',
    city: profile.city || '',
    bio: profile.bio || '',
    genres: Array.isArray(profile.genres) ? profile.genres : [],
    link: profile.links?.spotify || profile.links?.website || '',
  };
}

export function profilePatch(draft) {
  return {
    name: String(draft.name || '').trim(),
    city: String(draft.city || '').trim(),
    bio: String(draft.bio || '').trim(),
    genres: String(draft.genres || '').split(',').map((item) => item.trim()).filter(Boolean),
  };
}

export function bookingPackLines(profile, gigs) {
  const page = publicProfile(profile) || { name: '', city: '', bio: '', genres: [], link: '' };
  const lines = [
    page.name,
    [page.genres.join(', '), page.city].filter(Boolean).join(' · '),
    page.bio,
    page.link,
  ];
  for (const gig of (gigs || []).slice(0, 6)) {
    lines.push([gig.venueName, gig.gigName || gig.name].filter(Boolean).join(' · '));
  }
  return lines.filter(Boolean);
}
