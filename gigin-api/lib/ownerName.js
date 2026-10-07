/** First word of a person's name, for a greeting. */
export function ownerFirstName(name) {
  return String(name || "").trim().split(/\s+/)[0] || "";
}

/**
 * Name an act sees for the person booking the night.
 * The venue owner's first name, then the venue's name.
 */
export function ownerName(venue, gig) {
  const owner = ownerFirstName(venue?.accountName);
  if (owner) return owner;
  const venueName = String(
    venue?.name || venue?.venueName || gig?.venue?.venueName || gig?.venueName || "",
  ).trim();
  return venueName || "the venue";
}
