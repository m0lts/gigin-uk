function memoryDb(initial) {
  const saved = new Map(Object.entries(initial).map(([path, value]) => [path, structuredClone(value)]));
  const writes = [];
  const touch = (op, path) => writes.push(`${op} ${path}`);
  function makeRef(path) {
    return {
      path,
      id: path.split("/").pop(),
      async get() {
        const data = saved.has(path) ? saved.get(path) : undefined;
        return {
          exists: data !== undefined,
          id: path.split("/").pop(),
          ref: makeRef(path),
          data: () => (data === undefined ? undefined : structuredClone(data)),
        };
      },
      async set() { touch("set", path); },
      async update() { touch("update", path); },
      async delete() { touch("delete", path); },
    };
  }
  return {
    writes,
    snapshot() {
      return JSON.stringify([...saved.entries()].sort(([a], [b]) => a.localeCompare(b)));
    },
    db: {
      doc(path) { return makeRef(path); },
      collection(name) {
        return {
          doc(id) { return makeRef(`${name}/${id || "auto"}`); },
          async add() { touch("add", name); },
        };
      },
      async runTransaction(fn) {
        touch("transaction", "");
        return fn({
          get: (ref) => ref.get(),
          update: (ref) => touch("tx.update", ref.path),
          set: (ref) => touch("tx.set", ref.path),
          delete: (ref) => touch("tx.delete", ref.path),
        });
      },
      batch() {
        return {
          set: (ref) => touch("batch.set", ref.path),
          update: (ref) => touch("batch.update", ref.path),
          async commit() { touch("batch.commit", ""); },
        };
      },
    },
  };
}

const withdrawnAct = {
  id: "withdrawn-act",
  name: "Withdrawn Act",
  status: "withdrawn",
  type: "guest",
  email: "test+withdrawn@example.com",
  assignedSlotGigId: "gig-w",
  undo: {
    until: new Date(Date.now() + 60 * 1000).toISOString(),
    mailIds: ["mail-pending"],
    status: "accepted",
    assignedSlotGigId: "gig-w",
  },
};

export const store = memoryDb({
  "gigs/gig-w": {
    venueId: "venue-1",
    gigName: "Friday",
    startTime: "20:00",
    duration: 45,
    applicants: [],
    bookedApplicantId: "withdrawn-act",
  },
  "gigs/gig-w/private/applications": {
    gigId: "gig-w",
    applicants: [withdrawnAct],
  },
  "gigs/gig-d": {
    venueId: "venue-1",
    gigName: "Saturday",
    startTime: "20:00",
    duration: 45,
    applicants: [],
  },
  "gigs/gig-d/private/applications": {
    gigId: "gig-d",
    applicants: [{
      id: "declined-act",
      name: "Declined Act",
      status: "declined",
      type: "guest",
      email: "test+declined@example.com",
    }],
  },
});

export const db = store.db;
export const admin = { apps: [] };
export const FieldValue = { delete() { return { delete: true }; } };
export const Timestamp = { fromDate(date) { return date; } };
export class GeoPoint {}
