import { post } from '../http';

export function submitAccessRequest(body) {
  return post('/access-requests', { body, auth: false });
}
