import { useState, useEffect } from 'react';
import { loadConnectAndInitialize } from '@stripe/connect-js';

export const useStripeConnect = (connectedAccountId) => {
  const [stripeConnectInstance, setStripeConnectInstance] = useState();
  const useEmulator = import.meta.env.VITE_USE_EMULATOR === 'true';
  const accountSessionUrl = useEmulator
      ? import.meta.env.VITE_STRIPE_ACCOUNT_SESSION_URL_EMULATOR
      : import.meta.env.VITE_STRIPE_ACCOUNT_SESSION_URL;

  useEffect(() => {
    if (!connectedAccountId) {
      setStripeConnectInstance(null);
      return;
    }

    if (!accountSessionUrl) {
      console.error('Stripe Account Session URL is not configured. Check VITE_STRIPE_ACCOUNT_SESSION_URL environment variable.');
      return;
    }

    const fetchClientSecret = async () => {
      try {
        const response = await fetch(accountSessionUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            account: connectedAccountId,
          }),
        });

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
          console.error('Failed to fetch Stripe account session:', response.status, errorData);
          throw new Error(errorData.error || 'Failed to create account session');
        }

        const { client_secret: clientSecret } = await response.json();
        if (!clientSecret) {
          throw new Error('No client secret returned from account session endpoint');
        }
        return clientSecret;
      } catch (error) {
        console.error('Error fetching Stripe account session client secret:', error);
        throw error;
      }
    };

    try {
      const instance = loadConnectAndInitialize({
        publishableKey: import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY,
        fetchClientSecret,
        appearance: {
          overlays: 'dialog',
          variables: {
            colorPrimary: '#000',
          },
        },
      });
      setStripeConnectInstance(instance);
    } catch (error) {
      console.error('Error initializing Stripe Connect:', error);
      setStripeConnectInstance(null);
    }
  }, [connectedAccountId, accountSessionUrl]);

  return stripeConnectInstance;
};
