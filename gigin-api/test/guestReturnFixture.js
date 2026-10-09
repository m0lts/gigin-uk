import crypto from "crypto";

function hashToken(token) {
  return crypto.createHash("sha256").update(String(token)).digest("hex");
}

export const MANAGER_TOKEN = "ab".repeat(32);

function memoryDb(initial) {
  const saved = new Map(Object.entries(initial).map(([path, value]) => [path, structuredClone(value)]));
  let seq = 0;
  function apply(path, data, merge) {
    const current = merge && saved.has(path) ? structuredClone(saved.get(path)) : {};
    for (const [key, value] of Object.entries(data || {})) {
      if (value && typeof value === "object" && value.delete === true) delete current[key];
      else current[key] = value;
    }
    saved.set(path, current);
  }
  function makeRef(path) {
    return {
      path,
      id: path.split("/").pop(),
      get parent() {
        const cut = path.lastIndexOf("/");
        return cut > 0 ? makeRef(path.slice(0, cut)) : null;
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
  function snap(path, data) {
    return {
      id: path.split("/").pop(),
      ref: makeRef(path),
      data: () => structuredClone(data),
    };
  }
  function query(paths) {
    return {
      limit(max) {
        return query(paths.slice(0, max));
      },
      async get() {
        const docs = paths.map(([path, data]) => snap(path, data));
        return {
          docs,
          empty: docs.length === 0,
          forEach(fn) { docs.forEach(fn); },
        };
      },
    };
  }
  return {
    get(path) {
      return saved.has(path) ? structuredClone(saved.get(path)) : undefined;
    },
    set(path, data) {
      saved.set(path, structuredClone(data));
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
            const key = id || `auto-${++seq}`;
            return makeRef(`${name}/${key}`);
          },
          async add(data) {
            const id = `mail-${++seq}`;
            const path = `${name}/${id}`;
            apply(path, data, false);
            return makeRef(path);
          },
          async get() {
            const prefix = `${name}/`;
            const docs = [...saved.entries()]
              .filter(([path]) => path.startsWith(prefix) && !path.slice(prefix.length).includes("/"))
              .map(([path, data]) => snap(path, data));
            return { docs, empty: docs.length === 0, forEach(fn) { docs.forEach(fn); } };
          },
        };
      },
      collectionGroup(name) {
        return {
          where(field, op, value) {
            const paths = [...saved.entries()].filter(([path, data]) => (
              path.includes(`/${name}/`) && op === "==" && data?.[field] === value
            ));
            return query(paths);
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
      batch() {
        const ops = [];
        return {
          set: (ref, data, options) => ops.push(() => apply(ref.path, data, Boolean(options?.merge))),
          update: (ref, data) => ops.push(() => apply(ref.path, data, true)),
          async commit() { for (const op of ops) op(); },
        };
      },
    },
  };
}

function gig(id, name) {
  return {
    venueId: "venue-1",
    gigName: name,
    date: "2026-11-14T19:00:00.000Z",
    startTime: "20:00",
    duration: 45,
    status: "open",
    applicationsOpen: true,
    applicationsRootGigId: id,
    gigSlots: [id],
    applicants: [],
  };
}

const previous = {
  id: "old-act",
  type: "guest",
  guest: true,
  name: "The Cellar Band",
  status: "accepted",
  appliedAt: "2026-10-01T18:00:00.000Z",
  setLabel: "The late set",
  dateLabel: "Friday 14 November",
  preferredSlotGigIds: ["gig-old"],
};

export const store = memoryDb({
  "venueProfiles/venue-1": {
    venueId: "venue-1",
    name: "Jesus College Bar",
    accountName: "Sam Hart",
    createdBy: "owner-1",
  },
  "gigs/gig-old": gig("gig-old", "Cellar Night"),
  "gigs/gig-new": gig("gig-new", "Library Night"),
  "gigs/gig-same": gig("gig-same", "Formal Hall"),
  "gigs/gig-phone": gig("gig-phone", "Phone Night"),
  "gigs/gig-old/private/applications": {
    gigId: "gig-old",
    applicants: [
      previous,
      {
        id: "limit-act",
        type: "guest",
        guest: true,
        name: "Limit Band",
        status: "accepted",
        appliedAt: "2026-09-01T18:00:00.000Z",
      },
    ],
  },
  "gigs/gig-old/guestApplicants/old-act": {
    email: "known@guest.test",
    contactName: "Ada Guest",
    phone: "07700900111",
    instagram: "@cellar",
    gigId: "gig-old",
    applicantId: "old-act",
    links: { spotify: "https://open.spotify.com/cellar", youtube: "", instagram: "", website: "" },
    members: [{ name: "Ada", instruments: ["voice"] }],
    needs: ["pa"],
    bringOwn: ["guitar"],
    note: "We play early.",
    photo: { path: "guest-applications/old-act/photo-secret.jpg" },
    manageTokenHash: hashToken("ff".repeat(32)),
  },
  "gigs/gig-old/guestApplicants/limit-act": {
    email: "limit@guest.test",
    contactName: "Lee Limit",
    gigId: "gig-old",
    applicantId: "limit-act",
  },
  "gigs/gig-same/private/applications": {
    gigId: "gig-same",
    applicants: [{
      id: "same-act",
      type: "guest",
      guest: true,
      name: "First Act",
      status: "pending",
      appliedAt: "2026-10-02T18:00:00.000Z",
      setLabel: "Set 1",
      dateLabel: "Saturday 15 November",
    }],
  },
  "gigs/gig-same/guestApplicants/same-act": {
    email: "same@guest.test",
    contactName: "Morgan Manager",
    phone: "07700900222",
    gigId: "gig-same",
    applicantId: "same-act",
    note: "First band.",
    links: { spotify: "https://open.spotify.com/first" },
    photo: { path: "guest-applications/same-act/photo-secret.jpg" },
    manageTokenHash: hashToken(MANAGER_TOKEN),
  },
  "gigs/gig-phone/private/applications": {
    gigId: "gig-phone",
    applicants: [{
      id: "phone-act",
      type: "guest",
      guest: true,
      name: "Phone Act",
      status: "pending",
      appliedAt: "2026-10-03T18:00:00.000Z",
      setLabel: "The hidden set",
      dateLabel: "Sunday 16 November",
    }],
  },
  "gigs/gig-phone/guestApplicants/phone-act": {
    email: "phone@guest.test",
    phone: "07700900333",
    contactName: "Pat Phone",
    gigId: "gig-phone",
    applicantId: "phone-act",
  },
});

export const db = store.db;
export const admin = { apps: [] };
export const FieldValue = { delete() { return { delete: true }; } };
export const Timestamp = { fromDate(date) { return date; } };
export class GeoPoint {}
