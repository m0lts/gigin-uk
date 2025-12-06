import { auth } from '../../lib/firebase';

const DEFAULT_TIMEOUT_MS = 20000;

function normalizeBaseUrl(raw) {
  if (!raw) return '';
  let base = String(raw).trim();
  if (!/^https?:\/\//i.test(base)) base = `http://${base}`; // add scheme for localhost:PORT
  base = base.replace(/\/+$/, ''); // trim trailing slashes
  return base;
}

const getBaseUrl = () => {
  const raw = import.meta.env.VITE_API_BASE_URL || import.meta.env.VITE_API_URL;
  const base = normalizeBaseUrl(raw);
  if (!base) {
    // Intentionally not throwing to avoid hard crashes in dev; server will reject if misconfigured
    // eslint-disable-next-line no-console
    console.warn('API base URL is not set (VITE_API_BASE_URL or VITE_API_URL)');
  }
  return base;
};

async function getAuthToken() {
  try {
    // In browser contexts only
    if (typeof window === 'undefined') return null;
    const user = auth.currentUser;
    if (!user) return null;
    return await user.getIdToken();
  } catch {
    return null;
  }
}

function buildUrl(path, query) {
  const base = getBaseUrl();
  const isAbsolute = /^https?:\/\//i.test(path);
  const joined = isAbsolute
    ? path
    : `${base}${path.startsWith('/') ? '' : '/'}${path}`;
  const url = new URL(joined);
  if (query && typeof query === 'object') {
    Object.entries(query).forEach(([key, value]) => {
      if (value === undefined || value === null) return;
      url.searchParams.set(key, String(value));
    });
  }
  return url.toString();
}

export async function request(method, path, options = {}) {
  const { body, query, auth: withAuth = true, timeoutMs = DEFAULT_TIMEOUT_MS, headers: extraHeaders } = options;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const headers = new Headers({ 'Content-Type': 'application/json', ...extraHeaders });
    if (withAuth) {
      const token = await getAuthToken();
      if (token) headers.set('Authorization', `Bearer ${token}`);
    }
    const res = await fetch(buildUrl(path, query), {
      method: method.toUpperCase(),
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
      signal: controller.signal,
      credentials: 'include',
    });

    const isJson = res.headers.get('content-type')?.includes('application/json');
    const payload = isJson ? await res.json().catch(() => null) : await res.text();

    if (!res.ok) {
      const message = (payload && (payload.error || payload.message)) || res.statusText;
      const error = new Error(message || 'Request failed');
      error.status = res.status;
      error.payload = payload;
      throw error;
    }

    // Accept either { data } envelope or raw payload
    if (payload && typeof payload === 'object' && 'data' in payload) return payload.data;
    return payload;
  } finally {
    clearTimeout(timeout);
  }
}

export const httpClient = {
  get: (path, options) => request('GET', path, options),
  post: (path, options) => request('POST', path, options),
  put: (path, options) => request('PUT', path, options),
  patch: (path, options) => request('PATCH', path, options),
  delete: (path, options) => request('DELETE', path, options),
};

export default httpClient;


