import React, { Suspense } from 'react'
import { Navigate, Route, Routes } from 'react-router-dom'
import { CButton, CContainer } from '@coreui/react'

import { useAuth } from '../context/AuthContext'
import { routes } from '../routes'
import { Equalizer } from './MusicDecor'

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
        <Equalizer size={26} />
      </CContainer>
    )
  }

  return (
    <CContainer className="px-4" lg>
      <Suspense fallback={<Equalizer size={26} className="d-block mx-auto" />}>
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
          {/* Sin esta ruta, cualquier URL no declarada (un typo, un bookmark
              viejo, un atajo del manifest retirado) renderizaba el layout con
              el cuerpo vacio y sin explicacion. */}
          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Routes>
      </Suspense>
    </CContainer>
  )
}

export default React.memo(AppContent)
