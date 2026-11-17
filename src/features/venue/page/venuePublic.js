function gigDate(gig) {
  const value = gig?.date?.toDate?.() || gig?.date;
  const date = value instanceof Date ? value : new Date(value || '');
  return Number.isNaN(date.getTime()) ? null : date;
}

export function openGigRows(gigs, now = new Date()) {
  return (gigs || []).map((gig) => {
    const date = gigDate(gig);
    return {
      id: gig.gigId || gig.id,
      name: gig.gigName || gig.name || 'Gig',
      date,
      time: gig.startTime || '',
      fee: gig.budget || gig.fee || '',
      open: gig.applicationsOpen !== false,
    };
  }).filter((row) => row.id && row.open && row.date && row.date.getTime() >= now.getTime()).slice(0, 8);
}

export function pageDraft(venue) {
  const know = venue?.actsShouldKnow || {};
  const tech = venue?.pageTech || {};
  return {
    tagline: venue?.tagline || '',
    about: know.about || venue?.description || '',
    pa: tech.pa || know.pa || '',
    vocalMics: tech.vocalMics || '',
    diBoxes: tech.diBoxes || '',
    micStands: tech.micStands || '',
    backline: tech.backline || know.backline || '',
    soundEngineer: tech.soundEngineer || know.soundEngineer || '',
    capacity: venue?.capacity != null ? String(venue.capacity) : '',
    parking: venue?.parking || '',
    address: venue?.address || venue?.formattedAddress || '',
    website: venue?.website || '',
    instagram: venue?.instagram || '',
    facebook: venue?.facebook || '',
    tiktok: venue?.tiktok || '',
  };
}

export function pagePatch(draft, current = {}) {
  const text = (value) => String(value || '').trim();
  return {
    tagline: text(draft.tagline),
    description: text(draft.about),
    capacity: text(draft.capacity),
    parking: text(draft.parking),
    address: text(draft.address),
    website: text(draft.website),
    instagram: text(draft.instagram),
    facebook: text(draft.facebook),
    tiktok: text(draft.tiktok),
    pageTech: {
      pa: text(draft.pa),
      vocalMics: text(draft.vocalMics),
      diBoxes: text(draft.diBoxes),
      micStands: text(draft.micStands),
      backline: text(draft.backline),
      soundEngineer: text(draft.soundEngineer),
    },
    actsShouldKnow: {
      ...(current.actsShouldKnow || {}),
      about: text(draft.about),
      pa: text(draft.pa),
      backline: text(draft.backline),
      soundEngineer: text(draft.soundEngineer),
    },
  };
}

export function techLines(venue) {
  const tech = venue?.pageTech || {};
  const know = venue?.actsShouldKnow || {};
  return [
    tech.pa || know.pa,
    tech.vocalMics && `${tech.vocalMics} vocal mics`,
    tech.diBoxes && `${tech.diBoxes} DI boxes`,
    tech.micStands && `${tech.micStands} mic stands`,
    tech.backline || know.backline,
    tech.soundEngineer || know.soundEngineer,
  ].filter(Boolean);
}
