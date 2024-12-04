import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import { BrowserRouter } from 'react-router-dom'
import { GigsProvider } from './context/GigsContext.jsx'
import { loadStripe } from '@stripe/stripe-js';
import { Elements } from '@stripe/react-stripe-js';

const stripePromise = loadStripe('pk_test_51Py8lOHI8M50kHhR49I0lIAR8gMId69DubgtmTEPQfHJV9JQSBVbflPSq0J8AT1kZUMqDHncMP0xdfvy3pGyQEOG002PN3x3dT');

ReactDOM.createRoot(document.getElementById('root')).render(
    <BrowserRouter>
      <GigsProvider>
        <Elements stripe={stripePromise}>
          <App />
        </Elements>
      </GigsProvider>
    </BrowserRouter>,
)
