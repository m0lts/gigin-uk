function memoryDb(initial) {
  const saved = new Map(Object.entries(initial).map(([path, value]) => [path, structuredClone(value)]));
  let seq = 0;
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
        apply(path, data, Boolean(options?.merge));
      },
      async update(data) {
        apply(path, data, true);
      },
      async delete() {
        saved.delete(path);
      },
    };
  }
  return {
    get(path) {
      return saved.has(path) ? structuredClone(saved.get(path)) : undefined;
    },
    mail() {
      return [...saved.entries()]
        .filter(([path]) => path.startsWith("mail/"))
        .map(([, data]) => structuredClone(data));
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
        return fn({
          get: (ref) => ref.get(),
          update: (ref, data) => apply(ref.path, data, true),
          set: (ref, data, options) => apply(ref.path, data, Boolean(options?.merge)),
          delete: (ref) => saved.delete(ref.path),
        });
      },
    },
  };
}

function guest(id, name) {
  return {
    id,
    type: "guest",
    guest: true,
    name,
    artistName: name,
    status: "pending",
    preferredSlotGigIds: [],
  };
}

function gig(id, { name, start, slots }) {
  return {
    venueId: "venue-1",
    gigName: name,
    date: "2026-11-14T19:00:00.000Z",
    startTime: start,
    duration: 60,
    status: "open",
    applicationsOpen: true,
    ...(slots ? { gigSlots: slots } : {}),
    applicants: [],
  };
}

export const store = memoryDb({
  "venueProfiles/venue-1": {
    venueId: "venue-1",
    name: "Jesus College Bar",
    accountName: "Sam Hart",
    createdBy: "owner-1",
    userId: "owner-1",
  },
  "gigs/gig-a": gig("gig-a", { name: "Cellar Night", start: "20:00", slots: ["gig-b"] }),
  "gigs/gig-b": gig("gig-b", { name: "Cellar Night (Set 2)", start: "21:00", slots: ["gig-a"] }),
  "gigs/gig-a/private/applications": {
    gigId: "gig-a",
    applicants: [guest("booked-act", "Booked Act"), guest("later-act", "Later Act")],
  },
  "gigs/gig-a/guestApplicants/booked-act": { email: "booked@guest.test", manageToken: "token-booked" },
  "gigs/gig-c": gig("gig-c", { name: "Cellar Night", start: "20:00", slots: ["gig-d"] }),
  "gigs/gig-d": gig("gig-d", { name: "Cellar Night (Set 2)", start: "21:00", slots: ["gig-c"] }),
  "gigs/gig-c/private/applications": {
    gigId: "gig-c",
    applicants: [guest("later-act", "Later Act")],
  },
  "gigs/gig-c/guestApplicants/later-act": { email: "later@guest.test", manageToken: "token-later" },
  "gigs/gig-one": gig("gig-one", { name: "One Set Night", start: "20:00", slots: ["gig-one"] }),
  "gigs/gig-one/private/applications": {
    gigId: "gig-one",
    applicants: [guest("solo-act", "Solo Act")],
  },
  "gigs/gig-one/guestApplicants/solo-act": { email: "solo@guest.test", manageToken: "token-solo" },
});

export const db = store.db;
export const admin = { apps: [] };
export const FieldValue = { delete() { return { delete: true }; } };
export const Timestamp = { fromDate(date) { return date; } };
export class GeoPoint {}
