import { post, del } from '../http';

export async function getEmailAddress({ email }) {
  const result = await post('/users/getUserEmail', { body: { email } });
  return result?.user || null;
}

export async function getUserEmailById({ userId }) {
  const result = await post('/users/getUserEmailById', { body: { userId } });
  return result?.email || null;
}

export function getPhoneExistsBoolean({ phoneNumber }) {
  return post('/users/getPhoneExistsBoolean', { body: { phoneNumber } });
}

export function sendVerificationEmail({ actionUrl }) {
  return post('/users/sendVerificationEmail', { body: { actionUrl } });
}

export function updateUserArrayField({ field, op, value }) {
  return post('/users/updateUserArrayField', { body: { field, op, value } });
}

export function clearUserArrayField({ field }) {
  return post('/users/clearUserArrayField', { body: { field } });
}

export function deleteUserDocument(options = {}) {
  const confirm = options.confirm ?? true;
  return del('/users/deleteUserDocument', { body: { confirm } });
}

export function setPrimaryArtistProfile({ artistProfileId }) {
  return post('/users/setPrimaryArtistProfile', { body: { artistProfileId } });
}


