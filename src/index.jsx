import React from 'react'
import { createRoot } from 'react-dom/client'
import { AuthProvider } from './context/AuthContext'
import { AppProvider } from './context/AppContext'

import App from './App'

createRoot(document.getElementById('root')).render(
  <AppProvider>
    <AuthProvider>
      <App />
    </AuthProvider>
  </AppProvider>,
)
