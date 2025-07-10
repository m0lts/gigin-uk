export const getBreadcrumbs = (pathname) => {
    const breadcrumbs = [
      { label: 'Overview', path: '/venues/dashboard' },
    ];
  
    // Remove `/venues/dashboard` prefix from path
    const base = '/venues/dashboard';
    const subPath = pathname.startsWith(base) ? pathname.slice(base.length) : '';
  
    const parts = subPath.split('/').filter(Boolean);
    let accumulatedPath = base;
  
    parts.forEach((part) => {
      accumulatedPath += `/${part}`;
  
      let label = part;
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