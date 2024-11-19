import React, { useState } from 'react';
import { loadStripe } from '@stripe/stripe-js';
import {
    Elements
} from '@stripe/react-stripe-js';
import {CardForm} from '../../../components/common/CardDetails'

const stripePromise = loadStripe('pk_test_51Py8lOHI8M50kHhR49I0lIAR8gMId69DubgtmTEPQfHJV9JQSBVbflPSq0J8AT1kZUMqDHncMP0xdfvy3pGyQEOG002PN3x3dT');


export const Overview = () => {
    return (
        <div className="overview">
            <div className="grid-tile">
                <h2>Upcoming Gigs</h2>

            </div>
            <div className="grid-tile">
                <h2>Invoices</h2>

            </div>
            <div className="grid-tile">
                <h2>Save Payment Details</h2>
                <Elements stripe={stripePromise}>
                    <CardForm />
                </Elements>
            </div>
            <div className="grid-tile">
                <h2>Saved Musicians</h2>

            </div>
            <div className="grid-tile">
                <h2>Finances</h2>


            </div>
            <div className="grid-tile">
                <h2>Settings</h2>


            </div>
            <div className="grid-tile">
                <h2>Your Venues</h2>

            </div>
            <div className="grid-tile">
                <h2>Recent Gigs</h2>

            </div>
        </div>
    );
};