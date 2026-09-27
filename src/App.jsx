import React, { Suspense } from 'react'
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'

import { CSpinner } from '@coreui/react'
import './scss/style.scss'

import { AuthProvider, useAuth } from './context/AuthContext'
import ErrorBoundary from './components/ErrorBoundary'

const DefaultLayout = React.lazy(() => import('./layout/DefaultLayout'))
const Login = React.lazy(() => import('./views/pages/login/Login'))
const Register = React.lazy(() => import('./views/pages/register/Register'))

// Las legales van FUERA de RequireAuth a proposito: el consentimiento de
// Register y el pie/login enlazan a ellas, y con la sesion cerrada el
// RequireAuth las rebotaba a /login. Un visitante sin cuenta no puede
// leer la politica que dice aceptar.
const PrivacyPolicy = React.lazy(() => import('./views/legal/PrivacyPolicy'))
const TermsAndConditions = React.lazy(() => import('./views/legal/TermsAndConditions'))
const CookiePolicy = React.lazy(() => import('./views/legal/CookiePolicy'))
const RefundPolicy = React.lazy(() => import('./views/legal/RefundPolicy'))

const RequireAuth = ({ children }) => {
  const { isAuthenticated, loading } = useAuth()
  if (loading) {
    return (
      <div className="pt-3 text-center">
        <CSpinner color="primary" variant="grow" />
      </div>
    )
  }
  if (!isAuthenticated) {
    return <Navigate to="/login" replace />
  }
  return children
}

const App = () => {
  return (
    <ErrorBoundary>
      <AuthProvider>
        <BrowserRouter>
          <Suspense
            fallback={
              <div className="pt-3 text-center">
                <CSpinner color="primary" variant="grow" />
              </div>
            }
          >
            <Routes>
              <Route path="/login" element={<Login />} />
              <Route path="/register" element={<Register />} />
              <Route path="/privacy-policy" element={<PrivacyPolicy />} />
              <Route path="/terms-conditions" element={<TermsAndConditions />} />
              <Route path="/cookie-policy" element={<CookiePolicy />} />
              <Route path="/refund-policy" element={<RefundPolicy />} />
              <Route
                path="/*"
                element={
                  <RequireAuth>
                    <DefaultLayout />
                  </RequireAuth>
                }
              />
            </Routes>
          </Suspense>
        </BrowserRouter>
      </AuthProvider>
    </ErrorBoundary>
  )
}

export default App
