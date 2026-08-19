import React from 'react'
import { createRoot } from 'react-dom/client'
import { AppProvider } from './context/AppContext'

import App from './App'

createRoot(document.getElementById('root')).render(
  <AppProvider>
    <App />
  </AppProvider>,
)
