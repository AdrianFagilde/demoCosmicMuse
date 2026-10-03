import React, { useState, useMemo, useEffect, useRef, useCallback } from 'react'
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
import { INSTRUMENT_OPTIONS, formatInstrument, normalizeUsername } from '../../../utils/students'
import { StaffDivider, TrebleClef, Vinyl } from '../../../components/MusicDecor'
import PhoneInput from '../../../components/PhoneInput'
import PasswordInput from '../../../components/PasswordInput'
import BirthDatePicker from '../../../components/BirthDatePicker'
import FormField from '../../../components/FormField'
import useUsernameAvailability from '../../../hooks/useUsernameAvailability'

const Register = () => {
  const [formData, setFormData] = useState({
    fullName: '',
    birthDate: '',
    email: '',
    phone: '',
    password: '',
    confirmPassword: '',
    instrument: '',
    guardianFirstName: '',
    guardianLastName: '',
    guardianPhone: '',
  })

  const [errors, setErrors] = useState({})
  const [touched, setTouched] = useState({})
  const [consents, setConsents] = useState({ privacy: false, terms: false })
  const [consentsTouched, setConsentsTouched] = useState(false)
  const [submitError, setSubmitError] = useState('')
  const [submitSuccess, setSubmitSuccess] = useState('')
  const [loading, setLoading] = useState(false)

  const {
    available: usernameAvailable,
    checking: usernameChecking,
    check: checkUsername,
    reset: resetUsernameCheck,
  } = useUsernameAvailability(300)

  const nameInputRef = useRef(null)
  const navigateTimeoutRef = useRef(null)
  const navigate = useNavigate()

  // Helper para formatear fecha como YYYY-MM-DD (definido antes de useMemo que lo usa)
  const formatDateForInput = (date) => {
    const year = date.getFullYear()
    const month = String(date.getMonth() + 1).padStart(2, '0')
    const day = String(date.getDate()).padStart(2, '0')
    return `${year}-${month}-${day}`
  }

  // Auto-focus en primer campo al montar
  useEffect(() => {
    nameInputRef.current?.focus()
  }, [])

  // Cleanup timeouts
  useEffect(
    () => () => {
      if (navigateTimeoutRef.current) clearTimeout(navigateTimeoutRef.current)
    },
    [],
  )

  // Validación en tiempo real (blur + change)
  const validateField = useCallback(
    (name, value) => {
      let error = ''
      switch (name) {
        case 'fullName':
          if (!value.trim()) error = 'El nombre completo es obligatorio'
          else if (value.trim().length < 2) error = 'El nombre debe tener al menos 2 caracteres'
          break
        case 'birthDate':
          if (!value) error = 'La fecha de nacimiento es obligatoria'
          else {
            const today = new Date()
            const birth = new Date(value)
            if (birth > today) error = 'La fecha no puede ser futura'
            else {
              let age = today.getFullYear() - birth.getFullYear()
              const monthDiff = today.getMonth() - birth.getMonth()
              if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) age--
              if (age > 120) error = 'Fecha no válida'
            }
          }
          break
        case 'email':
          if (!value.trim()) error = 'El correo es obligatorio'
          else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) error = 'Formato de correo inválido'
          break
        case 'phone':
          if (!value.trim()) error = 'El teléfono es obligatorio'
          else {
            const digits = value.replace(/[^\d+]/g, '')
            if (digits.length < 7) error = 'Teléfono demasiado corto'
            else if (digits.length > 15) error = 'Teléfono demasiado largo'
          }
          break
        case 'password':
          if (!value) error = 'La contraseña es obligatoria'
          else if (value.length < 6) error = 'Mínimo 6 caracteres'
          break
        case 'confirmPassword':
          if (!value) error = 'Confirma tu contraseña'
          else if (value !== formData.password) error = 'Las contraseñas no coinciden'
          break
        case 'guardianFirstName':
        case 'guardianLastName':
        case 'guardianPhone':
          // Se validan solo si es menor (en handleSubmit)
          break
        default:
          break
      }
      setErrors((prev) => ({ ...prev, [name]: error }))
    },
    [formData.password],
  )

  const handleChange = (name, value) => {
    setFormData((prev) => ({ ...prev, [name]: value }))
    // Validar al cambiar (después de tocar)
    if (touched[name]) validateField(name, value)
  }

  const handleBlur = (name, value) => {
    setTouched((prev) => ({ ...prev, [name]: true }))
    validateField(name, value)
  }

  const handleConsentChange = (key, checked) => {
    setConsentsTouched(true)
    setConsents((prev) => ({ ...prev, [key]: checked }))
  }

  // Derivados
  const isMinor = useMemo(() => {
    if (!formData.birthDate) return false
    const today = new Date()
    const birth = new Date(formData.birthDate)
    let age = today.getFullYear() - birth.getFullYear()
    const monthDiff = today.getMonth() - birth.getMonth()
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) age--
    return age < 18
  }, [formData.birthDate])

  const maxBirthDate = useMemo(() => {
    const d = new Date()
    return formatDateForInput(d)
  }, [])

  const handleSubmit = async (event) => {
    event.preventDefault()
    setLoading(true)
    setSubmitError('')
    setSubmitSuccess('')

    // Marcar todo como tocado para mostrar errores
    const allTouched = Object.keys(formData).reduce((acc, key) => ({ ...acc, [key]: true }), {})
    setTouched(allTouched)
    setConsentsTouched(true)

    // Validar todos
    Object.entries(formData).forEach(([key, value]) => validateField(key, value))

    // Validaciones cruzadas
    if (formData.password !== formData.confirmPassword) {
      setErrors((prev) => ({ ...prev, confirmPassword: 'Las contraseñas no coinciden' }))
    }
    if (
      isMinor &&
      (!formData.guardianFirstName.trim() ||
        !formData.guardianLastName.trim() ||
        !formData.guardianPhone.trim())
    ) {
      setErrors((prev) => ({
        ...prev,
        guardianFirstName: formData.guardianFirstName.trim() ? '' : 'Requerido',
        guardianLastName: formData.guardianLastName.trim() ? '' : 'Requerido',
        guardianPhone: formData.guardianPhone.trim() ? '' : 'Requerido',
      }))
    }
    if (!consents.privacy || !consents.terms) {
      setConsentsTouched(true)
    }

    // Verificar si hay errores
    const hasErrors =
      Object.values(errors).some((e) => e) ||
      Object.values(formData).some((v, i) => {
        const key = Object.keys(formData)[i]
        return touched[key] && errors[key]
      }) ||
      (isMinor &&
        (!formData.guardianFirstName.trim() ||
          !formData.guardianLastName.trim() ||
          !formData.guardianPhone.trim())) ||
      !consents.privacy ||
      !consents.terms

    // Recalcular errores después de validaciones cruzadas
    const currentErrors = { ...errors }
    if (formData.password !== formData.confirmPassword)
      currentErrors.confirmPassword = 'Las contraseñas no coinciden'
    if (isMinor) {
      if (!formData.guardianFirstName.trim()) currentErrors.guardianFirstName = 'Requerido'
      if (!formData.guardianLastName.trim()) currentErrors.guardianLastName = 'Requerido'
      if (!formData.guardianPhone.trim()) currentErrors.guardianPhone = 'Requerido'
    }
    if (!consents.privacy) currentErrors.privacy = 'Debes aceptar la política de privacidad'
    if (!consents.terms) currentErrors.terms = 'Debes aceptar los términos y condiciones'

    if (Object.values(currentErrors).some((e) => e)) {
      setErrors(currentErrors)
      setSubmitError('Revisa los campos marcados en rojo')
      setLoading(false)
      return
    }

    // Username availability check final
    const username = normalizeUsername(formData.fullName)
    if (usernameAvailable === false) {
      setErrors((prev) => ({
        ...prev,
        fullName: 'Este nombre genera un usuario ya existente. Prueba con una variación.',
      }))
      setSubmitError('El nombre de usuario ya existe')
      setLoading(false)
      return
    }

    // Construir metadata para Supabase Auth
    const metaData = {
      full_name: formData.fullName,
      username,
      role: 'student',
      instrument: formData.instrument || undefined,
      birth_date: formData.birthDate || undefined,
      phone: formData.phone || undefined,
      consents: {
        privacy: consents.privacy,
        terms: consents.terms,
      },
    }

    if (isMinor) {
      metaData.guardian_name = `${formData.guardianFirstName} ${formData.guardianLastName}`
      metaData.guardian_phone = formData.guardianPhone
    }

    try {
      const { data, error: signUpError } = await supabase.auth.signUp({
        email: formData.email,
        password: formData.password,
        options: { data: metaData },
      })

      if (signUpError) {
        setSubmitError(signUpError.message || 'Error al crear la cuenta')
        setLoading(false)
        return
      }

      if (data.user?.identities?.length === 0) {
        setSubmitError('Este correo ya está registrado')
        setLoading(false)
        return
      }

      sessionStorage.setItem(`cosmic_muse_welcome_pending_${formData.email}`, '1')

      if (data.session) {
        navigate('/dashboard')
      } else {
        setSubmitSuccess('Cuenta creada. Ya puedes iniciar sesión.')
        navigateTimeoutRef.current = setTimeout(() => navigate('/login'), 2000)
      }
    } catch (err) {
      console.error('[Register] Unexpected error:', err)
      setSubmitError('Error inesperado. Inténtalo de nuevo.')
    } finally {
      setLoading(false)
    }
  }

  // Disparar check de username mientras escribe (debounced por hook)
  useEffect(() => {
    if (formData.fullName.trim().length >= 3) {
      checkUsername(normalizeUsername(formData.fullName))
    } else {
      resetUsernameCheck()
    }
  }, [formData.fullName, checkUsername, resetUsernameCheck])

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

                    {submitError && (
                      <CAlert color="danger" className="mb-3">
                        {submitError}
                      </CAlert>
                    )}
                    {submitSuccess && (
                      <CAlert color="success" className="mb-3">
                        {submitSuccess}
                      </CAlert>
                    )}

                    <FormField
                      label="Nombre completo"
                      required
                      error={errors.fullName}
                      hint={
                        usernameChecking
                          ? 'Comprobando disponibilidad…'
                          : usernameAvailable === false
                            ? 'Nombre no disponible'
                            : usernameAvailable === true
                              ? 'Nombre disponible'
                              : undefined
                      }
                    >
                      <CInputGroup>
                        <CInputGroupText>
                          <CIcon icon={cilUser} aria-hidden="true" />
                        </CInputGroupText>
                        <CFormInput
                          ref={nameInputRef}
                          type="text"
                          autoComplete="name"
                          value={formData.fullName}
                          onChange={(e) => handleChange('fullName', e.target.value)}
                          onBlur={(e) => handleBlur('fullName', e.target.value)}
                          required
                          invalid={!!errors.fullName}
                          aria-describedby={
                            errors.fullName
                              ? 'fullName-error'
                              : usernameChecking
                                ? 'fullName-hint'
                                : undefined
                          }
                        />
                      </CInputGroup>
                    </FormField>

                    <BirthDatePicker
                      label="Fecha de nacimiento"
                      value={formData.birthDate || undefined}
                      onChange={(val) => handleChange('birthDate', val)}
                      required
                      disabled={loading}
                      error={errors.birthDate}
                      maxDate={new Date()}
                    />

                    <FormField label="Correo electrónico" required error={errors.email}>
                      <CInputGroup>
                        <CInputGroupText>
                          <CIcon icon={cilEnvelopeClosed} aria-hidden="true" />
                        </CInputGroupText>
                        <CFormInput
                          type="email"
                          autoComplete="email"
                          value={formData.email}
                          onChange={(e) => handleChange('email', e.target.value)}
                          onBlur={(e) => handleBlur('email', e.target.value)}
                          required
                          invalid={!!errors.email}
                        />
                      </CInputGroup>
                    </FormField>

                    <PhoneInput
                      label="Teléfono"
                      value={formData.phone}
                      onChange={(val) => handleChange('phone', val)}
                      onBlur={(val) => handleBlur('phone', val)}
                      required
                      error={errors.phone}
                      disabled={loading}
                      hint="Formato internacional: +34 600 123 456"
                    />

                    <PasswordInput
                      label="Contraseña"
                      value={formData.password}
                      onChange={(val) => handleChange('password', val)}
                      onBlur={(val) => handleBlur('password', val)}
                      required
                      error={errors.password}
                      disabled={loading}
                      showStrength
                      minLength={6}
                      autoComplete="new-password"
                      id="password"
                      hint="Mínimo 6 caracteres"
                    />

                    <PasswordInput
                      label="Confirmar contraseña"
                      value={formData.confirmPassword}
                      onChange={(val) => handleChange('confirmPassword', val)}
                      onBlur={(val) => handleBlur('confirmPassword', val)}
                      required
                      error={errors.confirmPassword}
                      disabled={loading}
                      showStrength={false}
                      autoComplete="new-password"
                      id="confirmPassword"
                    />

                    <FormField label="Instrumento" error={errors.instrument}>
                      <CInputGroup>
                        <CInputGroupText>
                          <CIcon icon={cilEducation} aria-hidden="true" />
                        </CInputGroupText>
                        <CFormSelect
                          value={formData.instrument}
                          onChange={(e) => handleChange('instrument', e.target.value)}
                          onBlur={(e) => handleBlur('instrument', e.target.value)}
                          invalid={!!errors.instrument}
                        >
                          <option value="">Selecciona un instrumento (opcional)</option>
                          {INSTRUMENT_OPTIONS.map((option) => (
                            <option key={option} value={option}>
                              {formatInstrument(option)}
                            </option>
                          ))}
                        </CFormSelect>
                      </CInputGroup>
                    </FormField>

                    {isMinor && (
                      <>
                        <hr className="my-4" />
                        <h6 className="mb-3 fw-semibold">
                          Datos del representante (menor de edad)
                        </h6>
                        <FormField
                          label="Nombre del representante"
                          required
                          error={errors.guardianFirstName}
                        >
                          <CInputGroup>
                            <CInputGroupText>
                              <CIcon icon={cilUser} aria-hidden="true" />
                            </CInputGroupText>
                            <CFormInput
                              type="text"
                              value={formData.guardianFirstName}
                              onChange={(e) => handleChange('guardianFirstName', e.target.value)}
                              onBlur={(e) => handleBlur('guardianFirstName', e.target.value)}
                              required={isMinor}
                              invalid={!!errors.guardianFirstName}
                            />
                          </CInputGroup>
                        </FormField>
                        <FormField
                          label="Apellido del representante"
                          required
                          error={errors.guardianLastName}
                        >
                          <CInputGroup>
                            <CInputGroupText>
                              <CIcon icon={cilUser} aria-hidden="true" />
                            </CInputGroupText>
                            <CFormInput
                              type="text"
                              value={formData.guardianLastName}
                              onChange={(e) => handleChange('guardianLastName', e.target.value)}
                              onBlur={(e) => handleBlur('guardianLastName', e.target.value)}
                              required={isMinor}
                              invalid={!!errors.guardianLastName}
                            />
                          </CInputGroup>
                        </FormField>
                        <FormField
                          label="Teléfono del representante"
                          required
                          error={errors.guardianPhone}
                          hint="Formato internacional: +34 600 123 456"
                        >
                          <PhoneInput
                            value={formData.guardianPhone}
                            onChange={(val) => handleChange('guardianPhone', val)}
                            onBlur={(val) => handleBlur('guardianPhone', val)}
                            required={isMinor}
                            error={errors.guardianPhone}
                            disabled={loading}
                            id="guardianPhone"
                          />
                        </FormField>
                      </>
                    )}

                    <fieldset className="form-block mb-4" aria-labelledby="consent-legend">
                      <legend id="consent-legend">Consentimientos</legend>
                      <div className="consent-row">
                        <div className="form-check">
                          <input
                            type="checkbox"
                            className={`form-check-input ${consentsTouched && !consents.privacy ? 'is-invalid' : ''}`}
                            id="consent-privacy"
                            checked={consents.privacy}
                            onChange={(e) => handleConsentChange('privacy', e.target.checked)}
                            required
                            aria-describedby="consent-privacy-desc"
                            disabled={loading}
                          />
                          <label className="form-check-label" htmlFor="consent-privacy">
                            He leído y acepto la{' '}
                            <a href="/privacy-policy" target="_blank" rel="noopener noreferrer">
                              Política de Privacidad
                            </a>{' '}
                            <span className="text-danger" aria-hidden="true">
                              *
                            </span>
                          </label>
                          <span id="consent-privacy-desc" className="form-check-desc">
                            Cómo recopilamos, usamos y protegemos sus datos personales.
                          </span>
                          {consentsTouched && !consents.privacy && (
                            <div className="form-text text-danger">
                              Debes aceptar la política de privacidad
                            </div>
                          )}
                        </div>

                        <div className="form-check">
                          <input
                            type="checkbox"
                            className={`form-check-input ${consentsTouched && !consents.terms ? 'is-invalid' : ''}`}
                            id="consent-terms"
                            checked={consents.terms}
                            onChange={(e) => handleConsentChange('terms', e.target.checked)}
                            required
                            aria-describedby="consent-terms-desc"
                            disabled={loading}
                          />
                          <label className="form-check-label" htmlFor="consent-terms">
                            Acepto los{' '}
                            <a href="/terms-conditions" target="_blank" rel="noopener noreferrer">
                              Términos y Condiciones
                            </a>{' '}
                            <span className="text-danger" aria-hidden="true">
                              *
                            </span>
                          </label>
                          <span id="consent-terms-desc" className="form-check-desc">
                            Reglas de uso de la plataforma, pagos, clases y conducta.
                          </span>
                          {consentsTouched && !consents.terms && (
                            <div className="form-text text-danger">
                              Debes aceptar los términos y condiciones
                            </div>
                          )}
                        </div>
                      </div>
                    </fieldset>

                    <CRow>
                      <CCol xs={6}>
                        <Link to="/login">
                          <CButton color="link" className="px-0" disabled={loading}>
                            ¿Ya tienes cuenta? Inicia sesión
                          </CButton>
                        </Link>
                      </CCol>
                      <CCol xs={6} className="text-end">
                        <CButton color="primary" className="px-4" type="submit" disabled={loading}>
                          {loading ? 'Creando cuenta…' : 'Registrarse'}
                        </CButton>
                      </CCol>
                    </CRow>
                  </CForm>
                </CCardBody>
              </CCard>
              <CCard
                className="text-white bg-primary py-5 login-side-panel d-none d-lg-flex"
                style={{ width: '44%' }}
              >
                <CCardBody className="text-center">
                  <TrebleClef size={210} color="#ffffff" className="treble-watermark" />
                  <Vinyl size={180} color="#ffffff" className="vinyl-watermark" />
                  <StaffDivider caption="tu música empieza aquí" className="mt-2 mb-4" />
                  <div className="position-relative">
                    <h2>¿Por qué registrarte?</h2>
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
                      Mantente al día con tu instrumento
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
