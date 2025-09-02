/**
 * Builds breadcrumb navigation structure based on the pathname.
 * 
 * @param {string} pathname - The current URL path.
 * @param {'musician' | 'venue'} userType - The type of user to determine the base path.
 * @returns {Array<{ label: string, path: string }>} - The breadcrumbs array.
 */
export const getBreadcrumbs = (pathname, userType = 'venue', bandProfiles = []) => {
  const base = userType === 'musician' ? '/dashboard' : '/venues/dashboard';

  const breadcrumbs = [
    { label: 'Overview', path: base },
  ];

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
        label = 'Find Musicians';
        break;
      case 'finances':
        label = 'Finances';
        break;
      default:
        const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(part);
        if (isUUID) {
          const matchedBand = bandProfiles.find(band => band.id === part);
          label = matchedBand?.name || part;
        } else {
          label = part.charAt(0).toUpperCase() + part.slice(1);
        }
    }

    breadcrumbs.push({ label, path: accumulatedPath });
  });

  return breadcrumbs;
};