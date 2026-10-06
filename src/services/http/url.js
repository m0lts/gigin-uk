export function normalizeBaseUrl(raw) {
  if (!raw) return '';
  let base = String(raw).trim();
  if (!/^https?:\/\//i.test(base)) base = `http://${base}`;
  return base.replace(/\/+$/, '');
}

/** Join an API base (already ending in /api) with a service path such as /venues. */
export function joinApiUrl(base, path) {
  const normalized = normalizeBaseUrl(base);
  if (/^https?:\/\//i.test(path)) return path;
  const suffix = path.startsWith('/') ? path : `/${path}`;
  return new URL(`${normalized}${suffix}`).toString();
}
