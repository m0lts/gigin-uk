import React, { useState } from 'react';
import { loadStripe } from '@stripe/stripe-js';
import {
    Elements
} from '@stripe/react-stripe-js';
import { CardForm } from '../../../components/common/CardDetails'

const stripePromise = loadStripe('pk_test_51Py8lOHI8M50kHhR49I0lIAR8gMId69DubgtmTEPQfHJV9JQSBVbflPSq0J8AT1kZUMqDHncMP0xdfvy3pGyQEOG002PN3x3dT');

export const Finances = () => {
  return (
    <>
    <div className="head">
        <h1 className="title">Finances</h1>
    </div>
    <div className="body finances">
      <div className="tile">
        <h2>Save Payment Method</h2>
        <CardForm />
      </div>
    </div>
  </>
  );
};