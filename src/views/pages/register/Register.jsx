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
  CFormSelect,
  CInputGroup,
  CInputGroupText,
  CRow,
} from '@coreui/react'
import CIcon from '@coreui/icons-react'
import { cilLockLocked, cilUser, cilEnvelopeClosed, cilEducation } from '@coreui/icons'
import supabase from '../../../lib/supabase'

const Register = () => {
  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [instrument, setInstrument] = useState('')
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [loading, setLoading] = useState(false)
  const navigate = useNavigate()

  const handleSubmit = async (event) => {
    event.preventDefault()
    setLoading(true)
    setError('')
    setSuccess('')

    const username = fullName
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/\s+/g, '.')
      .replace(/[^a-z0-9.]/g, '')

    const { data, error: signUpError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          full_name: fullName,
          username,
          role: 'student',
          instrument: instrument || undefined,
        },
      },
    })

    if (signUpError) {
      setError(signUpError.message || 'Error al crear la cuenta')
      setLoading(false)
      return
    }

    if (data.user?.identities?.length === 0) {
      setError('Este correo ya está registrado')
      setLoading(false)
      return
    }

    if (data.session) {
      navigate('/dashboard')
    } else {
      setSuccess('Cuenta creada. Ya puedes iniciar sesión.')
      setTimeout(() => navigate('/login'), 2000)
    }
    setLoading(false)
  }

  return (
    <div className="bg-body-tertiary min-vh-100 d-flex flex-row align-items-center">
      <CContainer>
        <CRow className="justify-content-center">
          <CCol md={9}>
            <CCardGroup>
              <CCard className="p-4">
                <CCardBody>
                  <CForm onSubmit={handleSubmit}>
                    <h1>Registrarse</h1>
                    <p className="text-body-secondary">Crea tu cuenta en Cosmo Music Academy</p>
                    {error && <CAlert color="danger">{error}</CAlert>}
                    {success && <CAlert color="success">{success}</CAlert>}
                    <CInputGroup className="mb-3">
                      <CInputGroupText>
                        <CIcon icon={cilUser} />
                      </CInputGroupText>
                      <CFormInput
                        type="text"
                        placeholder="Nombre completo"
                        autoComplete="name"
                        value={fullName}
                        onChange={(e) => setFullName(e.target.value)}
                        required
                      />
                    </CInputGroup>
                    <CInputGroup className="mb-3">
                      <CInputGroupText>
                        <CIcon icon={cilEnvelopeClosed} />
                      </CInputGroupText>
                      <CFormInput
                        type="email"
                        placeholder="Correo electrónico"
                        autoComplete="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        required
                      />
                    </CInputGroup>
                    <CInputGroup className="mb-3">
                      <CInputGroupText>
                        <CIcon icon={cilLockLocked} />
                      </CInputGroupText>
                      <CFormInput
                        type="password"
                        placeholder="Contraseña (mínimo 6 caracteres)"
                        autoComplete="new-password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        required
                        minLength={6}
                      />
                    </CInputGroup>
                    <CInputGroup className="mb-4">
                      <CInputGroupText>
                        <CIcon icon={cilEducation} />
                      </CInputGroupText>
                      <CFormSelect
                        value={instrument}
                        onChange={(e) => setInstrument(e.target.value)}
                      >
                        <option value="">Selecciona un instrumento (opcional)</option>
                        <option value="Piano">Piano</option>
                        <option value="Guitarra">Guitarra</option>
                        <option value="Violín">Violín</option>
                        <option value="Saxofón">Saxofón</option>
                        <option value="Batería">Batería</option>
                        <option value="Otro">Otro</option>
                      </CFormSelect>
                    </CInputGroup>
                    <CRow>
                      <CCol xs={6}>
                        <Link to="/login">
                          <CButton color="link" className="px-0">
                            ¿Ya tienes cuenta? Inicia sesión
                          </CButton>
                        </Link>
                      </CCol>
                      <CCol xs={6} className="text-end">
                        <CButton color="primary" className="px-4" type="submit" disabled={loading}>
                          {loading ? 'Creando cuenta...' : 'Registrarse'}
                        </CButton>
                      </CCol>
                    </CRow>
                  </CForm>
                </CCardBody>
              </CCard>
              <CCard className="text-white bg-primary py-5" style={{ width: '44%' }}>
                <CCardBody className="text-center">
                  <div>
                    <h2>¿Por qué registrarte?</h2>
                    <p className="text-start">
                      ✅ Accede a tus tareas y lecciones
                      <br />
                      <br />
                      ✅ Consulta tu progreso y perfil
                      <br />
                      <br />
                      ✅ Recibe recordatorios de pago
                      <br />
                      <br />
                      ✅ Mantente al día con tu instrumento
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

export default Register
