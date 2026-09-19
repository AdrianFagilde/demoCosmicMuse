import React, { Suspense } from 'react'
import { Navigate, Route, Routes } from 'react-router-dom'
import { CButton, CContainer, CSpinner } from '@coreui/react'

import { useAuth } from '../context/AuthContext'
import { routes } from '../routes'

const AppContent = () => {
  const { profile, loading, isAuthenticated, authError, retry } = useAuth()

  if (authError) {
    return (
      <CContainer className="px-4 pt-4" lg>
        <div className="alert alert-danger d-flex flex-wrap justify-content-between align-items-center gap-2">
          <span>{authError}</span>
          <CButton color="danger" variant="outline" size="sm" onClick={retry}>
            Reintentar
          </CButton>
        </div>
      </CContainer>
    )
  }

  if (loading || (isAuthenticated && !profile)) {
    return (
      <CContainer className="px-4 d-flex justify-content-center pt-4" lg>
        <CSpinner color="primary" variant="grow" />
      </CContainer>
    )
  }

  return (
    <CContainer className="px-4" lg>
      <Suspense fallback={<CSpinner color="primary" />}>
        <Routes>
          {routes.map((route, idx) => {
            if (!route.element) {
              return null
            }
            const allowed = !route.roles || route.roles.includes(profile?.role)
            return (
              <Route
                key={idx}
                path={route.path}
                element={allowed ? <route.element /> : <Navigate to="/dashboard" replace />}
              />
            )
          })}
          <Route path="/" element={<Navigate to="dashboard" replace />} />
        </Routes>
      </Suspense>
    </CContainer>
  )
}

export default React.memo(AppContent)
