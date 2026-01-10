/**
 * Builds breadcrumb navigation structure based on the pathname.
 *
 * If a segment matches a UUID, it will attempt to resolve it to a band profile name
 * or a venue profile name (in that priority order).
 *
 * @param {string} pathname - The current URL path.
 * @param {'musician' | 'venue'} userType - The type of user to determine the base path.
 * @param {Array<{ id: string, name: string }>} bandProfiles - Array of band profiles for lookup.
 * @param {Array<{ id: string, name: string }>} venueProfiles - Array of venue profiles for lookup.
 * @returns {Array<{ label: string, path: string }>} - The breadcrumbs array.
 */
export const getBreadcrumbs = (
  pathname,
  userType = 'venue',
  bandProfiles = [],
  venueProfiles = []
) => {
  const base = userType === 'musician' ? '/dashboard' : '/venues/dashboard';

  const breadcrumbs = [{ label: 'Overview', path: base }];

  const subPath = pathname.startsWith(base) ? pathname.slice(base.length) : '';
  const parts = subPath.split('/').filter(Boolean);

  let accumulatedPath = base;

  parts.forEach((part) => {
    accumulatedPath += `/${part}`;

    let label;
    switch (part) {
      case 'gigs':
        label = 'Gigs';
        break;
      case 'gig-applications':
        label = 'Gig Applications';
        break;
      case 'my-venues':
        label = 'My Venues';
        break;
      case 'musicians':
        label = 'Musicians';
        break;
      case 'find':
        label = 'Find Artists';
        break;
      case 'finances':
        label = 'Finances';
        break;
      default:
        // UUID regex
        const isUUID =
          /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
            part
          );

        if (isUUID) {
          const matchedBand = bandProfiles.find((band) => band.id === part);
          const matchedVenue = venueProfiles.find((venue) => venue.id === part);
          label = matchedBand?.name || matchedVenue?.name || part;
        } else {
          label = part.charAt(0).toUpperCase() + part.slice(1);
        }
    }

    breadcrumbs.push({ label, path: accumulatedPath });
  });

  return breadcrumbs;
};