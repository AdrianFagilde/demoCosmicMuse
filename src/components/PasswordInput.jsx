import React, { useState } from 'react'
import { CFormInput, CFormLabel, CInputGroup, CProgress } from '@coreui/react'

// CoreUI no incluye un ojo "abierto" en su set libre, asi que usamos SVG en
// linea para el par mostrar/ocultar clasico.
const EyeIcon = () => (
  <svg
    viewBox="0 0 24 24"
    width="1em"
    height="1em"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.6"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
    focusable="false"
  >
    <path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12Z" />
    <circle cx="12" cy="12" r="3" />
  </svg>
)

const EyeOffIcon = () => (
  <svg
    viewBox="0 0 24 24"
    width="1em"
    height="1em"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.6"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
    focusable="false"
  >
    <path d="M3 3l18 18" />
    <path d="M10.6 5.1A11 11 0 0 1 12 5c6 0 9.5 7 9.5 7a17.7 17.7 0 0 1-3.2 4.1" />
    <path d="M6.3 6.3A17.6 17.6 0 0 0 2.5 12S6 18.5 12 18.5a10.6 10.6 0 0 0 4.2-.86" />
    <path d="M9.9 9.9a3 3 0 0 0 4.2 4.2" />
  </svg>
)

/**
 * Input de contraseña con toggle show/hide y medidor de fortaleza.
 *
 * Fortaleza simple (sin dependencias):
 * - Muy débil: < 6 chars
 * - Débil: 6-7 chars, solo minúsculas
 * - Media: 8+ chars, minúsculas + mayúsculas O números
 * - Fuerte: 10+ chars, minúsculas + mayúsculas + números + símbolos
 * - Muy fuerte: 12+ chars, todos los tipos + longitud
 */
const PasswordInput = ({
  label = 'Contraseña',
  value = '',
  onChange,
  onBlur,
  required = false,
  disabled = false,
  error,
  hint,
  id = 'password',
  autoComplete = 'new-password',
  showStrength = true,
  minLength = 6,
  ...rest
}) => {
  const [show, setShow] = useState(false)

  // Calcular fortaleza durante render (evita setState en effect)
  const calculateStrength = (pwd) => {
    if (!pwd || pwd.length < minLength) return 0
    let score = 1
    if (pwd.length >= 8) score++
    if (pwd.length >= 10) score++
    if (/[a-z]/.test(pwd) && /[A-Z]/.test(pwd)) score++
    if (/\d/.test(pwd)) score++
    if (/[^a-zA-Z0-9]/.test(pwd)) score++
    return Math.min(score, 4)
  }

  const strength = showStrength ? calculateStrength(value) : 0
  const strengthLabels = ['Muy débil', 'Débil', 'Media', 'Fuerte', 'Muy fuerte']
  const strengthColors = ['danger', 'warning', 'info', 'primary', 'success']
  const currentLabel = strengthLabels[strength] || ''
  const currentColor = strengthColors[strength] || 'secondary'

  return (
    <div className="mb-3">
      <CFormLabel htmlFor={id}>
        {label} {required && <span className="text-danger">*</span>}
      </CFormLabel>
      <CInputGroup>
        <CFormInput
          id={id}
          type={show ? 'text' : 'password'}
          autoComplete={autoComplete}
          value={value}
          onChange={(e) => onChange?.(e.target.value)}
          onBlur={(e) => onBlur?.(e.target.value)}
          required={required}
          disabled={disabled}
          invalid={!!error}
          minLength={minLength}
          aria-describedby={error ? `${id}-error` : hint ? `${id}-hint` : undefined}
          {...rest}
        />
        <button
          type="button"
          className="input-group-text cursor-pointer"
          onClick={() => setShow(!show)}
          aria-label={show ? 'Ocultar contraseña' : 'Mostrar contraseña'}
          aria-pressed={show}
          disabled={disabled}
        >
          {show ? <EyeOffIcon /> : <EyeIcon />}
        </button>
      </CInputGroup>
      {showStrength && value && (
        <div className="mt-2">
          <div className="d-flex justify-content-between mb-1">
            <small className="text-body-secondary">
              Fortaleza: <strong>{currentLabel}</strong>
            </small>
            <small className={`text-${currentColor}`}>{value.length} caracteres</small>
          </div>
          <CProgress
            className="progress-sm"
            value={(strength / 4) * 100}
            color={currentColor}
            max={100}
            animated={false}
            aria-label={`Fortaleza de contraseña: ${currentLabel}`}
          />
        </div>
      )}
      {error && (
        <div id={`${id}-error`} className="form-text text-danger mt-1">
          {error}
        </div>
      )}
      {hint && !error && (
        <div id={`${id}-hint`} className="form-text text-body-secondary mt-1">
          {hint}
        </div>
      )}
    </div>
  )
}

export default PasswordInput
