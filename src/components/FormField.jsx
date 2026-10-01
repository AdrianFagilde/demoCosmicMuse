import React, { useId } from 'react'
import { CFormLabel, CFormInput, CFormSelect, CFormTextarea } from '@coreui/react'

/**
 * Wrapper unificado para campos de formulario: label + control + error + hint.
 *
 * Soporta: input (text, email, date, number, etc.), select, textarea.
 * Uso:
 *   <FormField label="Nombre" required error={nameError} hint="Tu nombre completo">
 *     <CFormInput value={name} onChange={...} />
 *   </FormField>
 *
 * El children debe ser un componente CoreUI (CFormInput, CFormSelect, CFormTextarea)
 * o cualquier input que acepte ref y props estándar.
 */
const FormField = ({
  label,
  required = false,
  error,
  hint,
  id,
  children,
  className = 'mb-3',
  labelClassName = '',
}) => {
  const generatedId = useId()
  const child = React.Children.only(children)
  const childId = id || child.props.id || generatedId
  const describedBy =
    [error ? `${childId}-error` : null, hint ? `${childId}-hint` : null]
      .filter(Boolean)
      .join(' ') || undefined

  // Clona el child inyectando id, aria-describedby, aria-invalid
  const enhancedChild = React.cloneElement(child, {
    id: childId,
    'aria-describedby': describedBy,
    'aria-invalid': !!error,
    invalid: !!error,
  })

  return (
    <div className={className}>
      <CFormLabel htmlFor={childId} className={labelClassName}>
        {label}{' '}
        {required && (
          <span className="text-danger" aria-hidden="true">
            *
          </span>
        )}
      </CFormLabel>
      {enhancedChild}
      {error && (
        <div id={`${childId}-error`} className="form-text text-danger mt-1">
          {error}
        </div>
      )}
      {hint && !error && (
        <div id={`${childId}-hint`} className="form-text text-body-secondary mt-1">
          {hint}
        </div>
      )}
    </div>
  )
}

export default FormField
