import React from 'react'
import { CFormCheck, CFormLabel } from '@coreui/react'

const ConsentCheckboxes = ({
  requiredConsents = ['privacy', 'terms'],
  optionalConsents = ['marketing', 'analytics'],
  values = {},
  onChange,
  className = '',
  requiredMessage = 'Debe aceptar para continuar',
}) => {
  const allConsents = [
    ...requiredConsents.map((key) => ({ key, required: true, label: getLabel(key) })),
    ...optionalConsents.map((key) => ({ key, required: false, label: getLabel(key) })),
  ]

  const handleChange = (key, checked) => {
    onChange?.(key, checked)
  }

  return (
    <div className={className}>
      {allConsents.map(({ key, required, label }) => (
        <>
          <div className="mb-3">
            <CFormCheck
              type="checkbox"
              id={`consent-${key}`}
              value={values[key] || false}
              onChange={(e) => onChange(key, e.target.checked)}
              required={required}
              invalid={required && !values[key]}
            >
              <CFormLabel htmlFor={`consent-${key}`} className="fw-normal">
                {label} {required && <span className="text-danger">*</span>}
              </CFormLabel>
              <div className="form-text">{getDescription(key)}</div>
            </CFormCheck>
          </div>
        </>
      ))}
      {requiredConsents.some((key) => requiredConsents.includes(key) && !values[key]) && (
        <div className="text-danger small mt-2">{requiredMessage}</div>
      )}
    </div>
  )
}

const getLabel = (key) => {
  const labels = {
    privacy: 'He leído y acepto la Política de Privacidad',
    terms: 'Acepto los Términos y Condiciones',
    marketing: 'Acepto recibir comunicaciones comerciales y promociones',
    analytics: 'Permito el uso de cookies analíticas para mejorar la plataforma',
    refund: 'He leído y acepto la Política de Reembolso',
    cookies: 'Acepto el uso de cookies según la Política de Cookies',
  }
  return labels[key] || key
}

const getDescription = (key) => {
  const descriptions = {
    privacy: 'Cómo recopilamos, usamos y protegemos sus datos personales.',
    terms: 'Reglas de uso de la plataforma, pagos, clases y conducta.',
    marketing: 'Recibirá ofertas, novedades y promociones por email.',
    analytics: 'Nos ayuda a mejorar la plataforma (anónimo, sin datos personales).',
    refund: 'Condiciones para solicitar devoluciones y reembolsos.',
    cookies: 'Uso de cookies esenciales, funcionales y de preferencias.',
  }
  return descriptions[key] || ''
}

const ConsentForm = ({
  children,
  requiredConsents = ['privacy', 'terms'],
  optionalConsents = [],
  onSubmit,
  submitLabel = 'Continuar',
  className = '',
  ...props
}) => {
  const [consents, setConsents] = React.useState({})
  const [errors, setErrors] = React.useState({})

  const handleConsentChange = (key, checked) => {
    setConsents((prev) => ({ ...prev, [key]: checked }))
    if (!checked) {
      setErrors((prev) => ({ ...prev, [key]: 'Este consentimiento es obligatorio' }))
    } else {
      setErrors((prev) => ({ ...prev, [key]: null }))
    }
  }

  const validate = () => {
    const newErrors = {}
    let isValid = true

    const required = ['privacy', 'terms']
    required.forEach((key) => {
      if (!consents[key]) {
        setErrors((prev) => ({ ...prev, [key]: 'Este consentimiento es obligatorio' }))
        isValid = false
      }
    })

    return isValid
  }

  const handleSubmit = (e) => {
    e.preventDefault()
    if (validate()) {
      onSubmit?.(consents)
    }
  }

  return (
    <form onSubmit={handleSubmit} className={className}>
      {children}
      <div className="mb-3">
        <fieldset className="border p-3 rounded bg-light">
          <legend className="fw-semibold small">Consentimientos</legend>
          <div className="mt-3">
            <div className="form-check mb-3">
              <input
                type="checkbox"
                className={`form-check-input ${!consents.privacy ? 'is-invalid' : ''}`}
                id="consent-privacy"
                checked={consents.privacy || false}
                onChange={(e) => setConsents((prev) => ({ ...prev, privacy: e.target.checked }))}
                required
              />
              <label className="form-check-label fw-normal" htmlFor="consent-privacy">
                He leído y acepto la{' '}
                <a href="/privacy-policy" target="_blank" rel="noopener noreferrer">
                  Política de Privacidad
                </a>{' '}
                <span className="text-danger">*</span>
              </label>
              <div className="form-text">
                Cómo recopilamos, usamos y protegemos sus datos personales.
              </div>
            </div>

            <div className="form-check mb-3">
              <input
                type="checkbox"
                className={`form-check-input ${!consents.terms ? 'is-invalid' : ''}`}
                id="consent-terms"
                checked={consents.terms || false}
                onChange={(e) => setConsents((prev) => ({ ...prev, terms: e.target.checked }))}
                required
              />
              <label className="form-check-label" htmlFor="consent-terms">
                Acepto los{' '}
                <a href="/terms-conditions" target="_blank" rel="noopener noreferrer">
                  Términos y Condiciones
                </a>{' '}
                <span className="text-danger">*</span>
              </label>
              <div className="form-text">
                Reglas de uso de la plataforma, pagos, clases y conducta.
              </div>
            </div>

            <div className="form-check mb-3">
              <input
                type="checkbox"
                className="form-check-input"
                id="consent-marketing"
                checked={consents.marketing || false}
                onChange={(e) => setConsents((prev) => ({ ...prev, marketing: e.target.checked }))}
              />
              <label className="form-check-label" htmlFor="consent-marketing">
                Acepto recibir comunicaciones comerciales y promociones
              </label>
              <div className="form-text">
                Recibirá ofertas, novedades y promociones por email. Opcional.
              </div>
            </div>

            <div className="form-check mb-3">
              <input
                type="checkbox"
                className="form-check-input"
                id="consent-cookies"
                checked={consents.cookies || false}
                onChange={(e) => setConsents((prev) => ({ ...prev, cookies: e.target.checked }))}
              />
              <label className="form-check-label" htmlFor="consent-cookies">
                Acepto el uso de cookies según la{' '}
                <a href="/cookie-policy" target="_blank" rel="noopener noreferrer">
                  Política de Cookies
                </a>
              </label>
              <div className="form-text">
                Uso de cookies esenciales, funcionales y de preferencias.
              </div>
            </div>
          </div>
        </fieldset>
      </div>
    </form>
  )
}

export { ConsentCheckboxes, ConsentForm }
