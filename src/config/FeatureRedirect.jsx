/* eslint-disable react/prop-types */
import { useEffect } from 'react';
import { Navigate } from 'react-router-dom';
import { auth } from '@lib/firebase';
import { LaunchHeader } from '@features/shared/components/LaunchHeader';
import { FEATURES } from './features';
import { featureRedirectTarget } from './loginDestination';

/** Opens sign-in, or the confirm-email card, for a visitor who cannot stay on this page. */
export function LoginScreen({ setAuthModal, setAuthType, setAuthClosable, authType = 'login' }) {
  useEffect(() => {
    setAuthType?.(authType);
    setAuthClosable?.(true);
    setAuthModal?.(true);
  }, [setAuthModal, setAuthType, setAuthClosable, authType]);
  return null;
}

/** Signed-in people go to the same place as sign-in. Everyone else gets the matching card. */
export function FeatureRedirect({ user, setAuthModal, setAuthType, setAuthClosable }) {
  const emailVerified = !auth.currentUser || auth.currentUser.emailVerified !== false;
  const target = featureRedirectTarget(user, FEATURES, { emailVerified });
  if (target.stay) {
    return (
      <LaunchHeader
        setAuthModal={setAuthModal}
        setAuthType={setAuthType}
        setAuthClosable={setAuthClosable}
      />
    );
  }
  if (target.path) return <Navigate to={target.path} replace />;
  return (
    <LoginScreen
      setAuthModal={setAuthModal}
      setAuthType={setAuthType}
      setAuthClosable={setAuthClosable}
      authType={target.authType}
    />
  );
}
