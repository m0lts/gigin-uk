import { useEffect, useState } from 'react';

export function useMediaQuery(query) {
  const [matches, setMatches] = useState(() => {
    if (typeof window === 'undefined') return false;
    return window.matchMedia(query).matches;
  });
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const mql = window.matchMedia(query);
    const onChange = (e) => setMatches(e.matches);
    mql.addEventListener?.('change', onChange);
    mql.addListener?.(onChange);
    setMatches(mql.matches);
    return () => {
      mql.removeEventListener?.('change', onChange);
      mql.removeListener?.(onChange);
    };
  }, [query]);
  return matches;
}