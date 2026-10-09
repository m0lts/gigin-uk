function memoryDb(initial) {
  const saved = new Map(Object.entries(initial).map(([path, value]) => [path, structuredClone(value)]));
  const writes = [];
  let seq = 0;
  const touch = (op, path) => writes.push(`${op} ${path}`);
  const isDelete = (value) => Boolean(value && typeof value === "object" && value.delete === true);
  function apply(path, data, merge) {
    const current = merge && saved.has(path) ? structuredClone(saved.get(path)) : {};
    for (const [key, value] of Object.entries(data || {})) {
      if (isDelete(value)) delete current[key];
      else current[key] = value;
    }
    saved.set(path, current);
  }
  function makeRef(path) {
    return {
      path,
      id: path.split("/").pop(),
      collection(name) {
        return {
          doc(id) { return makeRef(`${path}/${name}/${id}`); },
        };
      },
      async get() {
        const data = saved.has(path) ? saved.get(path) : undefined;
        return {
          exists: data !== undefined,
          id: path.split("/").pop(),
          ref: makeRef(path),
          data: () => (data === undefined ? undefined : structuredClone(data)),
        };
      },
      async set(data, options) {
        touch("set", path);
        apply(path, data, Boolean(options?.merge));
      },
      async update(data) {
        touch("update", path);
        apply(path, data, true);
      },
      async delete() {
        touch("delete", path);
        saved.delete(path);
      },
    };
  }
  return {
    writes,
    get(path) {
      return saved.has(path) ? structuredClone(saved.get(path)) : undefined;
    },
    mail() {
      return [...saved.entries()]
        .filter(([path]) => path.startsWith("mail/"))
        .map(([path, data]) => ({ path, ...structuredClone(data) }));
    },
    db: {
      doc(path) { return makeRef(path); },
      collection(name) {
        return {
          doc(id) {
            const key = id || `mail-${++seq}`;
            return makeRef(`${name}/${key}`);
          },
          async add(data) {
            const ref = makeRef(`${name}/mail-${++seq}`);
            await ref.set(data);
            return ref;
          },
        };
      },
      async runTransaction(fn) {
        touch("transaction", "");
        return fn({
          get: (ref) => ref.get(),
          update: (ref, data) => {
            touch("tx.update", ref.path);
            apply(ref.path, data, true);
          },
          set: (ref, data, options) => {
            touch("tx.set", ref.path);
            apply(ref.path, data, Boolean(options?.merge));
          },
          delete: (ref) => {
            touch("tx.delete", ref.path);
            saved.delete(ref.path);
          },
        });
      },
      batch() {
        const ops = [];
        return {
          set: (ref, data, options) => ops.push(() => apply(ref.path, data, Boolean(options?.merge))),
          update: (ref, data) => ops.push(() => apply(ref.path, data, true)),
          async commit() {
            touch("batch.commit", "");
            for (const op of ops) op();
          },
        };
      },
    },
  };
}

function guest(id, status, extra = {}) {
  return {
    id,
    type: "guest",
    guest: true,
    name: id,
    status,
    ...extra,
  };
}

const nightSlots = ["gig-night", "gig-set2"];

export const store = memoryDb({
  "venueProfiles/venue-1": {
    venueId: "venue-1",
    name: "Jesus College Bar",
    accountName: "Sam Hart",
    createdBy: "owner-1",
    userId: "owner-1",
  },
  "venueProfiles/venue-pending": {
    venueId: "venue-pending",
    name: "Pending Bar",
    accountName: "Sam Hart",
    createdBy: "owner-1",
    userId: "owner-1",
    approvalStatus: "pending",
  },
  "gigs/gig-night": {
    venueId: "venue-1",
    gigName: "Cellar Night",
    date: "2026-11-14T19:00:00.000Z",
    startTime: "20:00",
    duration: 45,
    status: "open",
    applicationsOpen: true,
    applicationsRootGigId: "gig-night",
    gigSlots: nightSlots,
    applicants: [],
  },
  "gigs/gig-set2": {
    venueId: "venue-1",
    gigName: "Cellar Night (Set 2)",
    date: "2026-11-14T19:00:00.000Z",
    startTime: "21:00",
    duration: 45,
    status: "open",
    applicationsOpen: true,
    applicationsRootGigId: "gig-night",
    gigSlots: nightSlots,
    applicants: [],
  },
  "gigs/gig-night/private/applications": {
    gigId: "gig-night",
    applicants: [
      guest("accepted-act", "accepted", { assignedSlotGigId: "gig-set2" }),
      guest("waiting-act", "pending"),
      guest("declined-act", "declined"),
      guest("withdrawn-act", "withdrawn"),
    ],
  },
  "gigs/gig-night/guestApplicants/accepted-act": {
    email: "accepted@guest.test",
    manageToken: "token-accepted",
    contactName: "Ada Accepted",
  },
  "gigs/gig-night/guestApplicants/waiting-act": {
    email: "waiting@guest.test",
    manageToken: "token-waiting",
    contactName: "Wes Waiting",
  },
  "gigs/gig-night/guestApplicants/declined-act": {
    email: "declined@guest.test",
    manageToken: "token-declined",
  },
  "gigs/gig-night/guestApplicants/withdrawn-act": {
    email: "withdrawn@guest.test",
    manageToken: "token-withdrawn",
  },
  "gigs/gig-locked": {
    venueId: "venue-1",
    gigName: "Locked Night",
    date: "2026-11-15T19:00:00.000Z",
    startTime: "20:00",
    duration: 45,
    status: "open",
    applicationsOpen: true,
    applicationsRootGigId: "gig-locked",
    gigSlots: ["gig-locked"],
    applicants: [],
  },
  "gigs/gig-locked/private/applications": {
    gigId: "gig-locked",
    applicants: [guest("locked-act", "accepted", { assignedSlotGigId: "gig-locked" })],
  },
  "gigs/gig-locked/guestApplicants/locked-act": {
    email: "locked@guest.test",
    manageToken: "token-locked",
  },
  "gigs/gig-pending": {
    venueId: "venue-pending",
    gigName: "Pending Night",
    date: "2026-11-16T19:00:00.000Z",
    startTime: "20:00",
    duration: 45,
    status: "open",
    applicationsOpen: true,
    applicationsRootGigId: "gig-pending",
    gigSlots: ["gig-pending"],
    applicants: [],
  },
  "gigs/gig-pending/private/applications": {
    gigId: "gig-pending",
    applicants: [guest("pending-act", "pending")],
  },
  "gigs/gig-pending/guestApplicants/pending-act": {
    email: "pending-venue@guest.test",
    manageToken: "token-pending",
  },
});

export const db = store.db;
export const admin = { apps: [] };
export const FieldValue = { delete() { return { delete: true }; } };
export const Timestamp = { fromDate(date) { return date; } };
export class GeoPoint {}
