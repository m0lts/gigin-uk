import React, { useState } from 'react';
import { loadStripe } from '@stripe/stripe-js';
import {
    Elements
} from '@stripe/react-stripe-js';
import { CardForm } from '../../../components/common/CardDetails'

const stripePromise = loadStripe('pk_test_51Py8lOHI8M50kHhR49I0lIAR8gMId69DubgtmTEPQfHJV9JQSBVbflPSq0J8AT1kZUMqDHncMP0xdfvy3pGyQEOG002PN3x3dT');

export const Finances = () => {
  return (
    <div className="finances">
      <h1>Finances</h1>
      <h2>Save Payment Details</h2>
      <Elements stripe={stripePromise}>
          <CardForm />
      </Elements>
    </div>
  );
};