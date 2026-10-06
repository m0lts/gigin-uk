import { post } from '../http';

export function requestManageLinks(email) {
  return post('/guest-applications/manage-links', { body: { email }, auth: false });
}
