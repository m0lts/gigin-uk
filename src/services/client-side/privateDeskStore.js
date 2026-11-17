import { doc, getDoc, setDoc } from 'firebase/firestore';
import { firestore } from '@lib/firebase';

function refFor(scope, id, kind) {
  if (scope === 'venue') return doc(firestore, 'venueProfiles', id, 'privateDesk', kind);
  return doc(firestore, 'users', id, 'privateDesk', kind);
}

export async function readOwnedDesk(scope, id, kind) {
  const snap = await getDoc(refFor(scope, id, kind));
  if (!snap.exists()) return null;
  return snap.data()?.value ?? null;
}

export async function writeOwnedDesk(scope, id, kind, value) {
  await setDoc(refFor(scope, id, kind), { value, updatedAt: Date.now() });
}
