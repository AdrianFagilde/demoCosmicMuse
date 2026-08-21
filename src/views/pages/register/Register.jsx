import React, { useState, useMemo } from 'react'
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
import { cilLockLocked, cilUser, cilEnvelopeClosed, cilEducation, cilPhone } from '@coreui/icons'
import supabase from '../../../lib/supabase'

const Register = () => {
  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [instrument, setInstrument] = useState('')
  const [birthDate, setBirthDate] = useState('')
  const [guardianFirstName, setGuardianFirstName] = useState('')
  const [guardianLastName, setGuardianLastName] = useState('')
  const [guardianPhone, setGuardianPhone] = useState('')
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [loading, setLoading] = useState(false)
  const navigate = useNavigate()

  const isMinor = useMemo(() => {
    if (!birthDate) return false
    const today = new Date()
    const birth = new Date(birthDate)
    let age = today.getFullYear() - birth.getFullYear()
    const monthDiff = today.getMonth() - birth.getMonth()
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
      age--
    }
    return age < 18
  }, [birthDate])

  const handleSubmit = async (event) => {
    event.preventDefault()
    setLoading(true)
    setError('')
    setSuccess('')

    if (isMinor && (!guardianFirstName || !guardianLastName || !guardianPhone)) {
      setError('Como eres menor de edad, los datos del representante son obligatorios')
      setLoading(false)
      return
    }

    const username = fullName
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/\s+/g, '.')
      .replace(/[^a-z0-9.]/g, '')

    const metaData = {
      full_name: fullName,
      username,
      role: 'student',
      instrument: instrument || undefined,
      birth_date: birthDate || undefined,
    }

    if (isMinor) {
      metaData.guardian_name = `${guardianFirstName} ${guardianLastName}`
      metaData.guardian_phone = guardianPhone
    }

    const { data, error: signUpError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: metaData,
      },
    })

    if (signUpError) {
      setError(signUpError.message || 'Error al crear la cuenta')
      setLoading(false)
      return
    }

    if (data.user?.identities?.length === 0) {
      setError('Este correo ya esta registrado')
      setLoading(false)
      return
    }

    if (data.user) {
      const profileData = {
        id: data.user.id,
        full_name: fullName,
        username,
        email,
        role: 'student',
        instrument: instrument || null,
        birth_date: birthDate || null,
        guardian_name: isMinor ? `${guardianFirstName} ${guardianLastName}` : null,
        guardian_phone: isMinor ? guardianPhone : null,
      }
      const { error: upsertError } = await supabase
        .from('profiles')
        .upsert(profileData, { onConflict: 'id' })
      if (upsertError) {
        console.error('[Register] Upsert error:', upsertError.message)
      }
    }

    if (data.session) {
      navigate('/dashboard')
    } else {
      setSuccess('Cuenta creada. Ya puedes iniciar sesion.')
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
                    <p className="text-body-secondary">Crea tu cuenta en Cosmic Muse</p>
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
                        <CIcon icon={cilUser} />
                      </CInputGroupText>
                      <CFormInput
                        type="date"
                        placeholder="Fecha de nacimiento"
                        value={birthDate}
                        onChange={(e) => setBirthDate(e.target.value)}
                        required
                      />
                    </CInputGroup>
                    <CInputGroup className="mb-3">
                      <CInputGroupText>
                        <CIcon icon={cilEnvelopeClosed} />
                      </CInputGroupText>
                      <CFormInput
                        type="email"
                        placeholder="Correo electronico"
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
                        placeholder="Contrasena (minimo 6 caracteres)"
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
                        <option value="Violin">Violin</option>
                        <option value="Saxofon">Saxofon</option>
                        <option value="Bateria">Bateria</option>
                        <option value="Otro">Otro</option>
                      </CFormSelect>
                    </CInputGroup>

                    {isMinor && (
                      <>
                        <hr className="my-4" />
                        <h6 className="mb-3 fw-semibold">
                          Datos del representante (menor de edad)
                        </h6>
                        <CInputGroup className="mb-3">
                          <CInputGroupText>
                            <CIcon icon={cilUser} />
                          </CInputGroupText>
                          <CFormInput
                            type="text"
                            placeholder="Nombre del representante"
                            value={guardianFirstName}
                            onChange={(e) => setGuardianFirstName(e.target.value)}
                            required
                          />
                        </CInputGroup>
                        <CInputGroup className="mb-3">
                          <CInputGroupText>
                            <CIcon icon={cilUser} />
                          </CInputGroupText>
                          <CFormInput
                            type="text"
                            placeholder="Apellido del representante"
                            value={guardianLastName}
                            onChange={(e) => setGuardianLastName(e.target.value)}
                            required
                          />
                        </CInputGroup>
                        <CInputGroup className="mb-4">
                          <CInputGroupText>
                            <CIcon icon={cilPhone} />
                          </CInputGroupText>
                          <CFormInput
                            type="tel"
                            placeholder="Telefono del representante"
                            value={guardianPhone}
                            onChange={(e) => setGuardianPhone(e.target.value)}
                            required
                          />
                        </CInputGroup>
                      </>
                    )}

                    <CRow>
                      <CCol xs={6}>
                        <Link to="/login">
                          <CButton color="link" className="px-0">
                            Ya tienes cuenta? Inicia sesion
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
                    <h2>Por que registrarte?</h2>
                    <p className="text-start">
                      Accede a tus tareas y lecciones
                      <br />
                      <br />
                      Consulta tu progreso y perfil
                      <br />
                      <br />
                      Recibe recordatorios de pago
                      <br />
                      <br />
                      Mantente al dia con tu instrumento
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
