/* eslint-disable react/prop-types */
import { useEffect } from 'react';
import { Navigate } from 'react-router-dom';

function isLoggedInVenueUser(user) {
  return Array.isArray(user?.venueProfiles) && user.venueProfiles.length > 0;
}

/** Opens the existing login modal for visitors who are not a logged-in venue user. */
export function LoginScreen({ setAuthModal, setAuthType, setAuthClosable }) {
  useEffect(() => {
    setAuthType?.('login');
    setAuthClosable?.(true);
    setAuthModal?.(true);
  }, [setAuthModal, setAuthType, setAuthClosable]);
  return null;
}

/** Logged-in venue users go to the gigs dashboard. Everyone else gets the login modal. */
export function FeatureRedirect({ user, setAuthModal, setAuthType, setAuthClosable }) {
  if (isLoggedInVenueUser(user)) {
    return <Navigate to="/venues/dashboard/gigs" replace />;
  }
  return (
    <LoginScreen
      setAuthModal={setAuthModal}
      setAuthType={setAuthType}
      setAuthClosable={setAuthClosable}
    />
  );
}
