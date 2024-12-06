import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import { BrowserRouter } from 'react-router-dom'
import { GigsProvider } from './context/GigsContext.jsx'
import { loadStripe } from '@stripe/stripe-js';
import { Elements } from '@stripe/react-stripe-js';

const stripePromise = loadStripe('pk_live_51Py8lOHI8M50kHhRvjzq6CjfiliJkeME3oaFpOhWLkIcx750xKeR68QwEgoanKf2GpH9ynizyl5RA1E1mBs5z9HQ00YNyhYnat');

ReactDOM.createRoot(document.getElementById('root')).render(
    <BrowserRouter>
      <GigsProvider>
        <Elements stripe={stripePromise}>
          <App />
        </Elements>
      </GigsProvider>
    </BrowserRouter>,
)
