import React, { useState } from 'react'
import { CFormInput, CFormLabel, CInputGroup, CInputGroupText, CProgress } from '@coreui/react'
import CIcon from '@coreui/icons-react'
import { cilToggleOn, cilToggleOff } from '@coreui/icons'

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
        <CInputGroupText>
          <CIcon icon={show ? cilToggleOff : cilToggleOn} aria-hidden="true" />
        </CInputGroupText>
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
          <CIcon icon={show ? cilToggleOff : cilToggleOn} aria-hidden="true" />
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
