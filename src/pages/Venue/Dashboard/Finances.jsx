import React, { useState } from 'react';
import { useStripeConnect } from "../../../hooks/useStripeConnect";
import {
  ConnectAccountOnboarding,
  ConnectComponentsProvider,
} from "@stripe/react-connect-js";

export const Finances = () => {
  const [loading, setLoading] = useState(false);

  const [accountCreatePending, setAccountCreatePending] = useState(false);
  const [onboardingExited, setOnboardingExited] = useState(false);
  const [error, setError] = useState(false);
  const [connectedAccountId, setConnectedAccountId] = useState();
  const stripeConnectInstance = useStripeConnect(connectedAccountId);

  // Function to handle test account creation
  const handleCreateTestAccount = async () => {
    setAccountCreatePending(true);
    setError(false);
    fetch("/account", {
      method: "POST",
    })
      .then((response) => response.json())
      .then((json) => {
        setAccountCreatePending(false);
        const { account, error } = json;

        if (account) {
          setConnectedAccountId(account);
        }

        if (error) {
          setError(true);
        }
      });
  }

  return (
    <div className="finances">
      <h1>Finances</h1>
      
      <button className='btn primary' onClick={handleCreateTestAccount} disabled={loading}>
        {loading ? 'Creating Account...' : 'Create Test Stripe Account'}
      </button>
        {stripeConnectInstance && (
          <ConnectComponentsProvider connectInstance={stripeConnectInstance}>
            <ConnectAccountOnboarding
              onExit={() => setOnboardingExited(true)}
            />
          </ConnectComponentsProvider>
        )}
        {error && <p className="error">Something went wrong!</p>}
        {(connectedAccountId || accountCreatePending || onboardingExited) && (
          <div className="dev-callout">
            {connectedAccountId && <p>Your connected account ID is: <code className="bold">{connectedAccountId}</code></p>}
            {accountCreatePending && <p>Creating a connected account...</p>}
            {onboardingExited && <p>The Account Onboarding component has exited</p>}
          </div>
        )}

      {error && (
        <p>Error: {error}</p>
      )}
    </div>
  );
};