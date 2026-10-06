const WINDOW_MS = 60 * 60 * 1000;

export function planRecipientWindow({now, window, applicantIds, viewedIds}) {
  const fresh = [];
  for (const id of applicantIds || []) {
    if (!id || viewedIds?.has(id) || fresh.includes(id)) continue;
    fresh.push(id);
  }
  if (!fresh.length) {
    return {window: window || null, sends: []};
  }
  const until = Number(window?.until) || 0;
  const active = until > now;
  if (!active) {
    const [first, ...rest] = fresh;
    return {
      window: {until: now + WINDOW_MS, queued: rest},
      sends: [{kind: "single", applicantIds: [first]}],
    };
  }
  const queued = [...(window.queued || [])];
  for (const id of fresh) {
    if (!queued.includes(id)) queued.push(id);
  }
  return {window: {until, queued}, sends: []};
}

export function planFlush({now, window, viewedIds}) {
  if (!window) return {window: null, sends: []};
  const until = Number(window.until) || 0;
  if (until > now) return {window, sends: []};
  const queued = (window.queued || []).filter((id) => {
    return id && !viewedIds?.has(id);
  });
  if (!queued.length) return {window: null, sends: []};
  if (queued.length === 1) {
    return {window: null, sends: [{kind: "single", applicantIds: queued}]};
  }
  return {window: null, sends: [{kind: "batch", applicantIds: queued}]};
}

export function earliestFlush(windows) {
  let earliest = null;
  for (const entry of Object.values(windows || {})) {
    if (!entry || !Array.isArray(entry.queued)) continue;
    if (entry.queued.length === 0) continue;
    const until = Number(entry.until) || 0;
    if (!until) continue;
    if (earliest == null || until < earliest) earliest = until;
  }
  return earliest;
}

export {WINDOW_MS};
