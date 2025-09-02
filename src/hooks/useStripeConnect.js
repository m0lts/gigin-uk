import { useState, useEffect } from 'react';
import { loadConnectAndInitialize } from '@stripe/connect-js';

export const useStripeConnect = (connectedAccountId) => {
  const [stripeConnectInstance, setStripeConnectInstance] = useState();
  const accountSessionUrl = import.meta.env.VITE_STRIPE_ACCOUNT_SESSION_URL;

  useEffect(() => {
    if (connectedAccountId) {
      const fetchClientSecret = async () => {
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
          const { error } = await response.json();
          throw ('An error occurred: ', error);
        } else {
          const { client_secret: clientSecret } = await response.json();
          return clientSecret;
        }
      };

      setStripeConnectInstance(
        loadConnectAndInitialize({
          publishableKey: import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY,
          fetchClientSecret,
          appearance: {
            overlays: 'dialog',
            variables: {
              colorPrimary: '#000',
            },
          },
        })
      );
    }
  }, [connectedAccountId]);

  return stripeConnectInstance;
};
