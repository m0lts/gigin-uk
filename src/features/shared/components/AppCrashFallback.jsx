import { useEffect, useState } from 'react';
import { onAuthStateChanged } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { auth, firestore } from '../../../lib/firebase';
import { FEATURES } from '../../../config/features';
import { crashHomeAction } from '../../../config/crashHome';

export const AppCrashFallback = () => {
  const [action, setAction] = useState(() => crashHomeAction(null));

  useEffect(() => {
    let cancelled = false;
    const unsub = onAuthStateChanged(auth, async (current) => {
      if (!current) {
        if (!cancelled) setAction(crashHomeAction(null));
        return;
      }
      try {
        const snap = await getDoc(doc(firestore, 'users', current.uid));
        const user = snap.exists() ? { uid: current.uid, ...snap.data() } : { uid: current.uid };
        if (!cancelled) setAction(crashHomeAction(user, FEATURES));
      } catch {
        if (!cancelled) setAction(crashHomeAction({ uid: current.uid }, FEATURES));
      }
    });
    return () => {
      cancelled = true;
      unsub();
    };
  }, []);

  return (
    <div className="crash-screen">
      <div className="crash-card">
        <h1>Something went wrong</h1>
        <p>Reload the page. If it keeps happening, head back and try again.</p>
        <button type="button" className="crash-card__reload" onClick={() => window.location.reload()}>Reload</button>
        <a href={action.href}>{action.label}</a>
      </div>
    </div>
  );
};
