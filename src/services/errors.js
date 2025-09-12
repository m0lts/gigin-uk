import { addDoc, collection, serverTimestamp } from 'firebase/firestore';
import { firestore } from '@lib/firebase';

// simple in-memory LRU-ish cache of recent error keys
const __recentErrors = new Map(); // key -> ts
const DEDUPE_WINDOW_MS = 60_000;  // don't log same error again within 60s
const MAX_RECENT = 200;           // cap memory

function pruneOld() {
  const now = Date.now();
  for (const [k, ts] of __recentErrors) {
    if (now - ts > DEDUPE_WINDOW_MS) __recentErrors.delete(k);
  }
  // cap size
  if (__recentErrors.size > MAX_RECENT) {
    const excess = __recentErrors.size - MAX_RECENT;
    let i = 0;
    for (const k of __recentErrors.keys()) {
      __recentErrors.delete(k);
      if (++i >= excess) break;
    }
  }
}

function buildKey(payload) {
  const { message, stack, path, componentStack } = payload || {};
  return [
    (message || '').slice(0, 300),
    (stack || '').slice(0, 300),
    (componentStack || '').slice(0, 300),
    path || ''
  ].join('::');
}

/**
 * Logs client-side errors to Firestore with de-duplication.
 * Will not log the same (message+stack+componentStack+path) within DEDUPE_WINDOW_MS.
 */
export async function logClientError(payload) {
  try {
    const key = buildKey(payload);
    pruneOld();
    const last = __recentErrors.get(key);
    const now = Date.now();
    if (last && now - last < DEDUPE_WINDOW_MS) {
      // skip duplicate
      return;
    }
    __recentErrors.set(key, now);

    await addDoc(collection(firestore, 'clientErrors'), {
      ...payload,
      ts: serverTimestamp(),
    });
  } catch (e) {
    console.error('Failed to log error', e, payload);
  }
}