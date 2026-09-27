import React from 'react'
import { useNavigate } from 'react-router-dom'
import { CCard, CCardBody, CCardHeader, CRow, CCol, CButton } from '@coreui/react'
import { cilLockLocked, cilInfo, cilBan, cilCheckCircle, cilX } from '@coreui/icons'

const lastUpdated = '27 de septiembre de 2026'
const version = '1.0'

const cookieTable = [
  {
    name: 'session_id',
    type: 'Esencial',
    duration: 'Sesión',
    purpose: 'Mantiene la sesión de usuario autenticado',
    category: 'Esencial',
  },
  {
    name: 'csrf_token',
    type: 'Esencial',
    duration: 'Sesión',
    purpose: 'Protección contra ataques CSRF',
    category: 'Esencial',
  },
  {
    name: 'auth_token',
    type: 'Esencial',
    duration: '30 días',
    purpose: 'Recordar sesión ("Recordarme")',
    category: 'Esencial',
  },
  {
    name: 'csrf_refresh',
    type: 'Esencial',
    duration: '1 año',
    purpose: 'Renovación segura de tokens CSRF',
    category: 'Esencial',
  },
  {
    name: 'preferences',
    type: 'Funcional',
    duration: '1 año',
    purpose: 'Preferencias de UI (tema, idioma, sidebar)',
    category: 'Funcional',
  },
  {
    name: 'cookie_consent',
    type: 'Funcional',
    duration: '1 año',
    purpose: 'Recordar preferencias de consentimiento de cookies',
    category: 'Funcional',
  },
]

const CookiePolicy = () => {
  const navigate = useNavigate()

  return (
    <div className="container-fluid py-4">
      <CRow className="mb-4">
        <CCol>
          <div className="d-flex justify-content-between align-items-center">
            <h2 className="mb-0">Política de Cookies</h2>
            <CButton color="secondary" variant="outline" onClick={() => navigate(-1)}>
              Volver
            </CButton>
          </div>
        </CCol>
      </CRow>

      <CCard className="app-card">
        <CCardHeader>
          <div className="d-flex justify-content-between align-items-center">
            <h4 className="mb-0">Política de Cookies</h4>
            <div className="text-end">
              <small className="text-medium-emphasis d-block">Versión 1.0</small>
              <small className="text-medium-emphasis">Actualizada: 27 de septiembre de 2026</small>
            </div>
          </div>
        </CCardHeader>
        <CCardBody>
          <div className="mb-4">
            <h4>1. ¿Qué son las cookies?</h4>
            <p>
              Las cookies son pequeños archivos de texto que los sitios web almacenan en su
              dispositivo (ordenador, tablet, móvil) cuando los visita. Permiten que el sitio web
              recuerde sus acciones y preferencias (inicio de sesión, idioma, preferencias de
              visualización) durante un período de tiempo, para que no tenga que volver a
              configurarlas cada vez que vuelve al sitio o navega entre páginas.
            </p>
          </div>

          <div className="mb-4">
            <h4>2. Tipos de cookies que utilizamos</h4>
            <div className="table-responsive">
              <table className="table table-sm table-hover">
                <thead>
                  <tr>
                    <th>Nombre</th>
                    <th>Tipo</th>
                    <th>Duración</th>
                    <th>Finalidad</th>
                    <th>Categoría</th>
                  </tr>
                </thead>
                <tbody>
                  {cookieTable.map((cookie, index) => (
                    <tr key={index}>
                      <td>
                        <code>{cookie.name}</code>
                      </td>
                      <td>{cookie.type}</td>
                      <td>{cookie.duration}</td>
                      <td>{cookie.purpose}</td>
                      <td>
                        <span
                          className={`badge ${cookie.category === 'Esencial' ? 'bg-primary' : 'bg-secondary'}`}
                        >
                          {cookie.category}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="mb-4">
            <h4>3. Categorías de cookies</h4>
            <ul>
              <li>
                <strong>Esenciales:</strong> Necesarias para el funcionamiento básico de la
                plataforma (autenticación, seguridad, sesión). No se pueden desactivar.
              </li>
              <li>
                <strong>Funcionales:</strong> Mejoran la experiencia de usuario recordando
                preferencias. Se pueden desactivar.
              </li>
              <li>
                <strong>Analíticas:</strong> Nos ayudan a entender cómo se usa la plataforma (no
                usamos actualmente).
              </li>
              <li>
                <strong>Publicitarias:</strong> Para publicidad personalizada.{' '}
                <strong>No utilizamos.</strong>
              </li>
            </ul>
          </div>

          <div className="mb-4">
            <h4>3. Cookies de terceros</h4>
            <p>
              No utilizamos cookies de terceros para publicidad ni seguimiento entre sitios. Las
              únicas cookies de terceros provienen de servicios esenciales integrados (ej.
              proveedores de pago certificados) y están sujetas a sus propias políticas de
              privacidad.
            </p>
          </div>

          <div className="mb-4">
            <h4>4. Gestión de cookies</h4>
            <p>Puede controlar y eliminar cookies desde la configuración de su navegador:</p>
            <ul>
              <li>
                <strong>Chrome:</strong>{' '}
                {'Configuración > Privacidad y seguridad > Cookies y otros datos de sitios'}
              </li>
              <li>
                <strong>Firefox:</strong>{' '}
                {'Opciones > Privacidad y seguridad > Cookies y datos del sitio'}
              </li>
              <li>
                <strong>Safari:</strong>{' '}
                {'Preferencias > Privacidad > Gestionar datos de sitios web'}
              </li>
              <li>
                <strong>Edge:</strong> {'Configuración > Cookies y permisos de sitio'}
              </li>
            </ul>
            <p className="mt-2">
              <strong>Nota:</strong> Desactivar cookies esenciales impedirá el funcionamiento
              correcto de la plataforma (no podrá iniciar sesión, usar formularios, etc.).
            </p>
          </div>

          <div className="mb-4">
            <h4>5. Consentimiento</h4>
            <p>
              Al utilizar nuestra plataforma, acepta el uso de cookies esenciales y funcionales
              según esta política. Las cookies no esenciales requieren su consentimiento explícito,
              que puede gestionar desde el banner de cookies o la configuración de su cuenta.
            </p>
          </div>

          <div className="mb-4">
            <h4>6. Actualizaciones</h4>
            <p>
              Podemos actualizar esta política para reflejar cambios en el uso de cookies. Le
              notificaremos cambios materiales mediante notificación en la plataforma o correo
              electrónico.
            </p>
          </div>

          <div className="mb-4">
            <h4>7. Contacto</h4>
            <p>
              Para consultas sobre esta política:{' '}
              <a href="mailto:privacidad@cosmicmuse.com">privacidad@cosmicmuse.com</a>
            </p>
          </div>
        </CCardBody>
      </CCard>
    </div>
  )
}

export default CookiePolicy
