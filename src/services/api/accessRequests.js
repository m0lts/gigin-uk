import { post } from '../http';

export function submitAccessRequest(body) {
  return post('/api/access-requests', { body, auth: false });
}
