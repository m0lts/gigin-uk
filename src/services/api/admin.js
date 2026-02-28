import { get, post, del } from '../http';

export function verifyAdminPassword(password) {
  return post('/admin/verifyPassword', { body: { password } });
}

export function getAdminSignups() {
  return get('/admin/signups');
}

export function getAdminActivity() {
  return get('/admin/activity');
}

export function getAdminGigs() {
  return get('/admin/gigs');
}

export function getAdminSpaceHire() {
  return get('/admin/spaceHire');
}

export function getAdminArtists() {
  return get('/admin/artists');
}

export function getAdminVenues() {
  return get('/admin/venues');
}

export function getAdminOverview() {
  return get('/admin/overview');
}

export function getAdminErrors() {
  return get('/admin/errors');
}

export function deleteAdminErrors(ids) {
  return del('/admin/errors', { body: Array.isArray(ids) ? { ids } : { id: ids } });
}
