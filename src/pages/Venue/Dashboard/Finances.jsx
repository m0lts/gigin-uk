import React, { useState } from 'react';
import { functions } from '../../../firebase'; // Adjust the path to your firebase.js
import { httpsCallable } from 'firebase/functions';

export const Finances = () => {
  const [loading, setLoading] = useState(false);
  const [accountId, setAccountId] = useState(null);
  const [error, setError] = useState(null);

  console.log(accountId);

  // Function to handle test account creation
  const handleCreateTestAccount = async () => {
    setLoading(true);
    setError(null);

    try {
      const createAccount = functions.httpsCallable('createTestConnectedAccount');
      const result = await createAccount({ email: 'test@example.com' });
      
      if (result.data.error) {
        setError(result.data.error);
      } else {
        setAccountId(result.data.accountId);
      }
    } catch (error) {
      setError(error.message);
      console.error(error)
    }

    setLoading(false);
  };

  return (
    <div className="finances">
      <h1>Finances</h1>
      
      <button className='btn primary' onClick={handleCreateTestAccount} disabled={loading}>
        {loading ? 'Creating Account...' : 'Create Test Stripe Account'}
      </button>

      {accountId && (
        <p>Test Account Created: {accountId}</p>
      )}

      {error && (
        <p>Error: {error}</p>
      )}
    </div>
  );
};