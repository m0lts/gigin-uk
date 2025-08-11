export function EligibilityGate({ can, fallback = null, children }) {
    if (!can) return fallback;
    return children;
  }