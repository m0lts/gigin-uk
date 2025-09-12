import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import '@assets/global.styles.css'
import { BrowserRouter } from 'react-router-dom'
import { loadStripe } from '@stripe/stripe-js';
import { Elements } from '@stripe/react-stripe-js';
import { Toaster } from 'sonner';
import { ErrorBoundary } from './features/shared/components/ErrorBoundary.jsx'
import { AppCrashFallback } from './features/shared/components/AppCrashFallback.jsx'

const stripePromise = loadStripe(import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY);


ReactDOM.createRoot(document.getElementById('root')).render(
    <ErrorBoundary Fallback={AppCrashFallback}>
      <BrowserRouter>
          <Elements stripe={stripePromise} options={{
      fonts: [
        {
          cssSrc: 'https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&display=swap',
        },
      ],
    }}>
            <App />
            <Toaster richColors position="bottom-right" />
          </Elements>
      </BrowserRouter>
    </ErrorBoundary>,
)
