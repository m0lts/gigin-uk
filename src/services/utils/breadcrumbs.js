/**
 * Builds breadcrumb navigation structure based on the pathname.
 * 
 * @param {string} pathname - The current URL path.
 * @param {'musician' | 'venue'} userType - The type of user to determine the base path.
 * @returns {Array<{ label: string, path: string }>} - The breadcrumbs array.
 */
export const getBreadcrumbs = (pathname, userType = 'venue') => {
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
        label = part.charAt(0).toUpperCase() + part.slice(1);
    }

    breadcrumbs.push({ label, path: accumulatedPath });
  });

  return breadcrumbs;
};