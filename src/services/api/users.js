import { post, del } from '../http';

// Users API module (Cloud Run)
// Routes will be mounted under /api/users on the server

export function getUserEmail({ email }) {
  return post('/users/getUserEmail', { body: { email } });
}

// Convenience wrapper matching old name/signature used in resetPassword flow
export async function getEmailAddress(email) {
  const result = await getUserEmail({ email });
  return result?.user || null;
}

export function getPhoneExistsBoolean({ phoneNumber }) {
  return post('/users/getPhoneExistsBoolean', { body: { phoneNumber } });
}

export function sendVerificationEmail({ actionUrl }) {
  return post('/users/sendVerificationEmail', { body: { actionUrl } });
}

export function updateUserArrayField(arg1, arg2, arg3) {
  // Support both object form and legacy positional form
  const payload =
    typeof arg1 === 'object' && arg1 !== null
      ? arg1
      : { field: arg1, op: arg2, value: arg3 };
  return post('/users/updateUserArrayField', { body: payload });
}

export function clearUserArrayField(arg) {
  const field = typeof arg === 'string' ? arg : arg?.field;
  return post('/users/clearUserArrayField', { body: { field } });
}

export function deleteUserDocument(options) {
  const confirm = options?.confirm ?? true;
  return del('/users/deleteUserDocument', { body: { confirm } });
}


