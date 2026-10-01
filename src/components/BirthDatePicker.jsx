import React, { useId } from 'react'
import { CFormLabel, CFormInput } from '@coreui/react'

/**
 * Input de fecha de nacimiento accesible con label visible + datepicker nativo.
 *
 * Props:
 * - label: string
 * - value: string (YYYY-MM-DD) o ''
 * - onChange: (value: string) => void
 * - required: boolean
 * - disabled: boolean
 * - error: string
 * - hint: string
 * - maxDate: Date (por defecto: hoy)
 * - minDate: Date (por defecto: 1900-01-01)
 * - id: string (auto-generado si no se pasa)
 *
 * Devuelve fecha como ISO string (YYYY-MM-DD) en onChange para compatibilidad
 * con el formulario existente.
 */
const BirthDatePicker = ({
  label = 'Fecha de nacimiento',
  value = '',
  onChange,
  required = false,
  disabled = false,
  error,
  hint,
  maxDate = new Date(),
  minDate = new Date(1900, 0, 1),
  id,
  ...rest
}) => {
  const generatedId = useId()
  const inputId = id || generatedId
  const describedBy =
    [error ? `${inputId}-error` : null, hint ? `${inputId}-hint` : null]
      .filter(Boolean)
      .join(' ') || undefined

  const max = maxDate.toISOString().split('T')[0]
  const min = minDate.toISOString().split('T')[0]

  return (
    <div className="mb-3">
      <CFormLabel htmlFor={inputId}>
        {label} {required && <span className="text-danger">*</span>}
      </CFormLabel>
      <CFormInput
        id={inputId}
        type="date"
        autoComplete="bday"
        value={value}
        onChange={(e) => onChange?.(e.target.value)}
        required={required}
        disabled={disabled}
        invalid={!!error}
        max={max}
        min={min}
        placeholder="DD/MM/AAAA"
        aria-describedby={describedBy}
        aria-invalid={!!error}
        {...rest}
      />
      {error && (
        <div id={`${inputId}-error`} className="form-text text-danger mt-1">
          {error}
        </div>
      )}
      {hint && !error && (
        <div id={`${inputId}-hint`} className="form-text text-body-secondary mt-1">
          {hint}
        </div>
      )}
    </div>
  )
}

export default BirthDatePicker
