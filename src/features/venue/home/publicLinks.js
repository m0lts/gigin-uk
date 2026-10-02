export const PUBLIC_SITE = 'https://giginmusic.com';

export function gigApplyUrl(gigId) {
  return `${PUBLIC_SITE}/gig/${gigId}`;
}

export function venuePageUrl(venueId) {
  return `${PUBLIC_SITE}/venues/${venueId}`;
}

export function displayUrl(url) {
  return String(url || '').replace(/^https?:\/\//, '');
}

export function applicationsUrl({ gigId, applicantId, filter } = {}) {
  const params = new URLSearchParams();
  if (gigId) params.set('gigId', gigId);
  if (applicantId) params.set('applicant', applicantId);
  if (filter) params.set('filter', filter);
  const search = params.toString();
  return `${PUBLIC_SITE}/venues/dashboard/gigs/gig-applications${search ? `?${search}` : ''}`;
}

export async function copyText(value) {
  if (!value) return false;
  try {
    await navigator.clipboard.writeText(value);
    return true;
  } catch {
    try {
      const input = document.createElement('textarea');
      input.value = value;
      input.setAttribute('readonly', '');
      input.style.position = 'fixed';
      input.style.left = '-9999px';
      document.body.appendChild(input);
      input.select();
      const ok = document.execCommand('copy');
      input.remove();
      return ok;
    } catch {
      return false;
    }
  }
}
