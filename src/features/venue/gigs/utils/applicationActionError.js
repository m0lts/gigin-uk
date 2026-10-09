/**
 * Accept and assign already surface the server message. A 409 means the night
 * on screen is stale, so the venue page also reloads that night.
 */
export function reportApplicationActionError(error, { notify, refresh, refreshOnConflict = false } = {}) {
  const conflict = error?.status === 409;
  const message = conflict
    ? (error?.message || 'This act has withdrawn.')
    : (error?.message || 'Something went wrong.');
  notify?.(message);
  if (conflict && refreshOnConflict) return Promise.resolve(refresh?.());
  return Promise.resolve();
}
