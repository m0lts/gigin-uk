import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import { BrowserRouter } from 'react-router-dom'
import { Auth0Provider } from '@auth0/auth0-react'

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <Auth0Provider
      domain="dev-ytks0ppfdt68pqzc.us.auth0.com"
      clientId="mzROKr9gHqs6FDpikLZIklNp5AMFQS6j"
      authorizationParams={{
        redirect_uri: window.location.origin
      }}
    >
    <BrowserRouter>
      <App />
    </BrowserRouter>
    </Auth0Provider>
  </React.StrictMode>,
)
