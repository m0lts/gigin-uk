export function hasDeskData(value) {
  if (Array.isArray(value)) return value.length > 0;
  if (value && typeof value === 'object') return Object.keys(value).length > 0;
  return false;
}

// A missing remote document imports local storage once. An existing document,
// even an empty one, stays as the signed-in copy.
export function chooseDeskValue(remote, local, empty) {
  if (remote !== null && remote !== undefined) return { value: remote, write: false };
  if (hasDeskData(local)) return { value: local, write: true };
  return { value: empty, write: false };
}
