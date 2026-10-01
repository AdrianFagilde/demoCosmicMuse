import React from 'react'
import { CFormInput, CFormLabel, CInputGroup, CInputGroupText } from '@coreui/react'
import CIcon from '@coreui/icons-react'
import { cilPhone } from '@coreui/icons'

/**
 * Input de teléfono con máscara E.164 flexible (internacional).
 *
 * - Acepta: +34 600 123 456, 0034 600 123 456, 34600123456, 600 123 456, etc.
 * - Normaliza internamente a E.164: +CCXXXXXXXXX (sin espacios)
 * - Muestra máscara visual con espacios cada 3-4 dígitos para legibilidad
 * - Props passthrough: value, onChange, required, disabled, error, hint, label
 */
const PhoneInput = ({
  label = 'Teléfono',
  value = '',
  onChange,
  required = false,
  disabled = false,
  error,
  hint,
  id = 'phone',
  autoComplete = 'tel',
  ...rest
}) => {
  // Normaliza a E.164: elimina todo lo que no sea dígito o + inicial
  const normalize = (raw) => {
    if (!raw) return ''
    // Conserva + inicial si existe, elimina resto de no-dígitos
    const hasPlus = raw.trim().startsWith('+')
    const digits = raw.replace(/[^\d]/g, '')
    return hasPlus ? `+${digits}` : digits
  }

  // Formato visual: grupos de 3-4 dígitos para lectura
  const formatVisual = (raw) => {
    const normalized = normalize(raw)
    if (!normalized) return ''
    // +CC XXX XXX XXX o +CC XXXX XXXX etc.
    const plus = normalized.startsWith('+') ? '+' : ''
    const digits = normalized.replace(/^\+/, '')
    // Agrupa: código país (1-3) + resto en bloques de 3-4
    if (digits.length <= 3) return `${plus}${digits}`
    const country = digits.slice(0, 3)
    const rest =
      digits
        .slice(3)
        .match(/.{1,4}/g)
        ?.join(' ') || ''
    return `${plus}${country} ${rest}`.trim()
  }

  const handleChange = (e) => {
    const visual = formatVisual(e.target.value)
    const normalized = normalize(e.target.value)
    // Actualiza input con versión visual, pero pasa normalizado al padre
    e.target.value = visual
    onChange?.(normalized)
  }

  const handleBlur = (e) => {
    // Al perder foco, deja el valor normalizado (E.164) en el input real
    // pero el usuario ve el formateado mientras edita
    const normalized = normalize(e.target.value)
    e.target.value = formatVisual(normalized)
    onChange?.(normalized)
  }

  const handleFocus = (e) => {
    // Al enfocar, muestra versión editable sin formato estricto
    const normalized = normalize(e.target.value)
    e.target.value = normalized || ''
  }

  return (
    <div className="mb-3">
      <CFormLabel htmlFor={id}>
        {label} {required && <span className="text-danger">*</span>}
      </CFormLabel>
      <CInputGroup>
        <CInputGroupText>
          <CIcon icon={cilPhone} aria-hidden="true" />
        </CInputGroupText>
        <CFormInput
          id={id}
          type="tel"
          autoComplete={autoComplete}
          value={value ? formatVisual(value) : ''}
          onChange={handleChange}
          onBlur={handleBlur}
          onFocus={handleFocus}
          required={required}
          disabled={disabled}
          invalid={!!error}
          placeholder="+34 600 123 456"
          aria-describedby={error ? `${id}-error` : hint ? `${id}-hint` : undefined}
          {...rest}
        />
      </CInputGroup>
      {error && (
        <div id={`${id}-error`} className="form-text text-danger">
          {error}
        </div>
      )}
      {hint && !error && (
        <div id={`${id}-hint`} className="form-text text-body-secondary">
          {hint}
        </div>
      )}
    </div>
  )
}

export default PhoneInput
