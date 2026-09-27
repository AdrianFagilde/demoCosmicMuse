import React, { useState, useMemo, useEffect, useRef } from 'react'
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
import {
  cilLockLocked,
  cilUser,
  cilEnvelopeClosed,
  cilEducation,
  cilPhone,
  cilStar,
} from '@coreui/icons'
import supabase from '../../../lib/supabase'
import { INSTRUMENT_OPTIONS, normalizeUsername } from '../../../utils/students'
import { StaffDivider, TrebleClef, Vinyl } from '../../../components/MusicDecor'

const Register = () => {
  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [level, setLevel] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
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

  const maxBirthDate = useMemo(() => {
    const d = new Date()
    const year = d.getFullYear()
    const month = String(d.getMonth() + 1).padStart(2, '0')
    const day = String(d.getDate()).padStart(2, '0')
    return `${year}-${month}-${day}`
  }, [])

  const navigateTimeoutRef = useRef(null)

  useEffect(() => {
    return () => {
      if (navigateTimeoutRef.current) {
        clearTimeout(navigateTimeoutRef.current)
      }
    }
  }, [])

  const handleSubmit = async (event) => {
    event.preventDefault()
    setLoading(true)
    setError('')
    setSuccess('')

    if (password !== confirmPassword) {
      setError('Las contrasenas no coinciden')
      setLoading(false)
      return
    }

    if (isMinor && (!guardianFirstName || !guardianLastName || !guardianPhone)) {
      setError('Como eres menor de edad, los datos del representante son obligatorios')
      setLoading(false)
      return
    }

    if (!phone) {
      setError('El telefono es obligatorio')
      setLoading(false)
      return
    }

    const username = normalizeUsername(fullName)

    const metaData = {
      full_name: fullName,
      username,
      role: 'student',
      instrument: instrument || undefined,
      birth_date: birthDate || undefined,
      phone: phone || undefined,
      level: level || undefined,
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
        phone: phone || null,
        level: level || null,
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

    sessionStorage.setItem(`cosmic_muse_welcome_pending_${email}`, '1')

    if (data.session) {
      navigate('/dashboard')
    } else {
      setSuccess('Cuenta creada. Ya puedes iniciar sesion.')
      navigateTimeoutRef.current = setTimeout(() => navigate('/login'), 2000)
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
                        max={maxBirthDate}
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
                        <CIcon icon={cilPhone} />
                      </CInputGroupText>
                      <CFormInput
                        type="tel"
                        placeholder="Telefono"
                        autoComplete="tel"
                        value={phone}
                        onChange={(e) => setPhone(e.target.value)}
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
                    <CInputGroup className="mb-3">
                      <CInputGroupText>
                        <CIcon icon={cilLockLocked} />
                      </CInputGroupText>
                      <CFormInput
                        type="password"
                        placeholder="Confirmar contrasena"
                        autoComplete="new-password"
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
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
                        {INSTRUMENT_OPTIONS.map((option) => (
                          <option key={option} value={option}>
                            {option}
                          </option>
                        ))}
                      </CFormSelect>
                    </CInputGroup>
                    <CInputGroup className="mb-4">
                      <CInputGroupText>
                        <CIcon icon={cilStar} />
                      </CInputGroupText>
                      <CFormSelect value={level} onChange={(e) => setLevel(e.target.value)}>
                        <option value="">Nivel (opcional)</option>
                        <option value="Principiante">Principiante</option>
                        <option value="Intermedio">Intermedio</option>
                        <option value="Avanzado">Avanzado</option>
                      </CFormSelect>
                    </CInputGroup>

                    <CInputGroup className="mb-4">
                      <CInputGroupText>
                        <CIcon icon={cilStar} />
                      </CInputGroupText>
                      <CFormSelect value={level} onChange={(e) => setLevel(e.target.value)}>
                        <option value="">Nivel (opcional)</option>
                        <option value="Principiante">Principiante</option>
                        <option value="Intermedio">Intermedio</option>
                        <option value="Avanzado">Avanzado</option>
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

                    <fieldset
                      className="border p-3 rounded bg-light mb-4"
                      aria-labelledby="consent-legend"
                    >
                      <legend id="consent-legend" className="fw-semibold small">
                        Consentimientos
                      </legend>
                      <div className="mt-3">
                        <div className="form-check mb-3">
                          <input
                            type="checkbox"
                            className={`form-check-input ${!consents.privacy ? 'is-invalid' : ''}`}
                            id="consent-privacy"
                            checked={consents.privacy || false}
                            onChange={(e) =>
                              setConsents((prev) => ({ ...prev, privacy: e.target.checked }))
                            }
                            required
                            aria-describedby="consent-privacy-desc"
                          />
                          <label className="form-check-label fw-normal" htmlFor="consent-privacy">
                            He leido y acepto la{' '}
                            <a href="/privacy-policy" target="_blank" rel="noopener noreferrer">
                              Politica de Privacidad
                            </a>{' '}
                            <span className="text-danger">*</span>
                          </label>
                          <div id="consent-privacy-desc" className="form-text">
                            Como recopilamos, usamos y protegemos sus datos personales.
                          </div>
                        </div>

                        <div className="form-check mb-3">
                          <input
                            type="checkbox"
                            className={`form-check-input ${!consents.terms ? 'is-invalid' : ''}`}
                            id="consent-terms"
                            checked={consents.terms || false}
                            onChange={(e) =>
                              setConsents((prev) => ({ ...prev, terms: e.target.checked }))
                            }
                            required
                            aria-describedby="consent-terms-desc"
                          />
                          <label className="form-check-label" htmlFor="consent-terms">
                            Acepto los{' '}
                            <a href="/terms-conditions" target="_blank" rel="noopener noreferrer">
                              Terminos y Condiciones
                            </a>{' '}
                            <span className="text-danger">*</span>
                          </label>
                          <div id="consent-terms-desc" className="form-text">
                            Reglas de uso de la plataforma, pagos, clases y conducta.
                          </div>
                        </div>

                        <div className="form-check mb-3">
                          <input
                            type="checkbox"
                            className="form-check-input"
                            id="consent-cookies"
                            checked={consents.cookies || false}
                            onChange={(e) =>
                              setConsents((prev) => ({ ...prev, cookies: e.target.checked }))
                            }
                            aria-describedby="consent-cookies-desc"
                          />
                          <label className="form-check-label" htmlFor="consent-cookies">
                            Acepto el uso de cookies segun la{' '}
                            <a href="/cookie-policy" target="_blank" rel="noopener noreferrer">
                              Politica de Cookies
                            </a>
                          </label>
                          <div id="consent-cookies-desc" className="form-text">
                            Uso de cookies esenciales, funcionales y de preferencias.
                          </div>
                        </div>
                      </div>
                    </fieldset>

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
              <CCard
                className="text-white bg-primary py-5 login-side-panel"
                style={{ width: '44%' }}
              >
                <CCardBody className="text-center">
                  <TrebleClef size={210} color="#ffffff" className="treble-watermark" />
                  <Vinyl size={180} color="#ffffff" className="vinyl-watermark" />
                  <StaffDivider caption="tu musica empieza aca" className="mt-2 mb-4" />
                  <div className="position-relative">
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
