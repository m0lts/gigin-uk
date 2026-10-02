import { createContext, useContext, useMemo, useState } from 'react';
import { ShareApplicationLinkPanel } from './ShareApplicationLinkPanel';

const ShareLinkContext = createContext({ openShare: () => {} });

export function ShareLinkProvider({ children }) {
  const [request, setRequest] = useState(null);
  const value = useMemo(() => ({
    openShare: (night) => setRequest(night),
  }), []);

  return (
    <ShareLinkContext.Provider value={value}>
      {children}
      {request && (
        <ShareApplicationLinkPanel
          slots={request.slots}
          venueName={request.venueName}
          onClose={() => setRequest(null)}
        />
      )}
    </ShareLinkContext.Provider>
  );
}

export function useShareLink() {
  return useContext(ShareLinkContext);
}
