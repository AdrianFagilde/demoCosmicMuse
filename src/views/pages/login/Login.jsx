import React, { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import {
  CAlert,
  CButton,
  CCard,
  CCardBody,
  CCardGroup,
  CCol,
  CContainer,
  CForm,
  CFormInput,
  CInputGroup,
  CInputGroupText,
  CRow,
} from '@coreui/react'
import CIcon from '@coreui/icons-react'
import { cilLockLocked, cilUser } from '@coreui/icons'

import { useAuth } from '../../../context/AuthContext'
import { Equalizer, StaffDivider, TrebleClef, Vinyl } from '../../../components/MusicDecor'

const Login = () => {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const navigate = useNavigate()
  const { login } = useAuth()

  const handleSubmit = async (event) => {
    event.preventDefault()
    setLoading(true)
    setError('')
    try {
      await login(email, password)
      navigate('/dashboard')
    } catch (err) {
      setError(err.message || 'Correo o contraseña incorrectos')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="bg-body-tertiary min-vh-100 d-flex flex-row align-items-center">
      <CContainer>
        <CRow className="justify-content-center">
          <CCol md={8}>
            <CCardGroup className="flex-column-reverse flex-lg-row d-flex">
              <CCard className="p-4">
                <CCardBody>
                  <CForm onSubmit={handleSubmit}>
                    <h1 className="text-center text-lg-start">Login</h1>
                    <p className="text-body-secondary text-center text-lg-start">
                      Bienvenido a Cosmic Muse
                    </p>
                    <StaffDivider caption="empieza a componer" className="mt-2 mb-4" />
                    {error && (
                      <CAlert color="danger" role="alert" id="login-error">
                        {error}
                      </CAlert>
                    )}
                    <CInputGroup className="mb-3">
                      <CInputGroupText>
                        <CIcon icon={cilUser} aria-hidden="true" />
                      </CInputGroupText>
                      <CFormInput
                        type="email"
                        placeholder="Correo electrónico"
                        autoComplete="email"
                        value={email}
                        onChange={(event) => setEmail(event.target.value)}
                        aria-describedby={error ? 'login-error' : undefined}
                        aria-invalid={!!error}
                      />
                    </CInputGroup>
                    <CInputGroup className="mb-4">
                      <CInputGroupText>
                        <CIcon icon={cilLockLocked} aria-hidden="true" />
                      </CInputGroupText>
                      <CFormInput
                        type="password"
                        placeholder="Contraseña"
                        autoComplete="current-password"
                        value={password}
                        onChange={(event) => setPassword(event.target.value)}
                        aria-describedby={error ? 'login-error' : undefined}
                        aria-invalid={!!error}
                      />
                    </CInputGroup>
                    <CRow className="align-items-center">
                      <CCol xs={6}>
                        <Link to="/register">
                          <CButton color="link" className="px-0 text-start">
                            ¿No tienes cuenta? Regístrate
                          </CButton>
                        </Link>
                      </CCol>
                      <CCol xs={6} className="text-end">
                        <CButton color="primary" className="px-4" type="submit" disabled={loading}>
                          {loading ? (
                            <span className="d-inline-flex align-items-center gap-2">
                              <Equalizer color="#fff" size={14} /> Ingresando…
                            </span>
                          ) : (
                            'Entrar'
                          )}
                        </CButton>
                      </CCol>
                    </CRow>
                  </CForm>
                </CCardBody>
              </CCard>
              <CCard className="auth-side-panel login-side-panel text-white bg-primary py-3 py-lg-5 d-flex mb-0">
                <CCardBody className="text-center">
                  <TrebleClef
                    size={210}
                    color="#ffffff"
                    className="treble-watermark"
                    aria-hidden="true"
                  />
                  <Vinyl
                    size={180}
                    color="#ffffff"
                    className="vinyl-watermark"
                    aria-hidden="true"
                  />
                  <div>
                    <h2>Cosmic Muse</h2>
                    <p className="text-center text-lg-start mb-0">
                      Plataforma de gestión para estudiantes de música.
                      <br />
                      <br />
                      Accede a tus tareas, lecciones y perfil.
                    </p>
                  </div>
                </CCardBody>
              </CCard>
            </CCardGroup>
          </CCol>
        </CRow>
      </CContainer>
    </div>
  )
}

export default Login
