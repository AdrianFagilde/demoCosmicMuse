import React, { Suspense } from 'react'
import { Navigate, Route, Routes } from 'react-router-dom'
import { CContainer, CSpinner } from '@coreui/react'

import { useAuth } from '../context/AuthContext'
import { routes } from '../routes'

const AppContent = () => {
  const { profile, loading, isAuthenticated } = useAuth()

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
                exact={route.exact}
                name={route.name}
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
