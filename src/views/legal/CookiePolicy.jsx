import React from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { CCard, CCardBody, CCardHeader, CRow, CCol, CButton } from '@coreui/react'

const lastUpdated = '27 de septiembre de 2026'
const version = '1.0'

// Inventario real, verificado contra el codigo. La version 1.0 de esta
// politica listaba seis cookies (session_id, csrf_token, auth_token,
// csrf_refresh, preferences, cookie_consent) que la aplicacion nunca
// escribio: supabase-js guarda la sesion en localStorage y `document.cookie`
// no aparece en ningun archivo de src/. Decirlo aqui evita que el inventario
// se vuelva a inventar: si se anaden cookies o almacenamiento, se anaden
// aqui.
const storageTable = [
  {
    name: 'sb-<referencia-del-proyecto>-auth-token',
    medium: 'localStorage',
    type: 'Esencial',
    duration: 'Hasta cerrar sesión',
    purpose: 'Mantener la sesión autenticada entre recargas',
    category: 'Esencial',
  },
  {
    name: 'cosmo-music-theme',
    medium: 'localStorage',
    type: 'Funcional',
    duration: 'Persistente',
    purpose: 'Recordar el tema claro u oscuro elegido',
    category: 'Funcional',
  },
  {
    name: 'pwa-install-dismissed',
    medium: 'localStorage',
    type: 'Funcional',
    duration: 'Persistente',
    purpose:
      'Recordar que el aviso de instalación de la app se descartó, para no volver a mostrarlo',
    category: 'Funcional',
  },
  {
    name: 'welcome-modal-<correo>',
    medium: 'sessionStorage',
    type: 'Funcional',
    duration: 'Hasta cerrar la pestaña',
    purpose: 'Mostrar el mensaje de bienvenida una sola vez por sesión',
    category: 'Funcional',
  },
]

const CookiePolicy = () => {
  const navigate = useNavigate()

  return (
    <div className="legal-page py-4">
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
              <small className="text-medium-emphasis d-block">Versión {version}</small>
              <small className="text-medium-emphasis">Actualizada: {lastUpdated}</small>
            </div>
          </div>
        </CCardHeader>
        <CCardBody>
          <div className="mb-4 pb-4 border-bottom last:border-0 last:pb-0">
            <h4 className="mb-2 fw-semibold">1. Resumen</h4>
            <p>
              <strong>No utilizamos cookies.</strong> La aplicación no escribe ninguna cookie ni lee
              ninguna, y no incrusta servicios de terceros que puedan establecerlas. La
              autenticación, el tema y el resto de preferencias se guardan en el{' '}
              <code>localStorage</code> y el <code>sessionStorage</code> de su navegador, que no se
              envían al servidor con cada petición ni se comparten con ningún otro sitio.
            </p>
            <p>
              Esta política se publica igualmente porque es la forma honesta de explicar qué
              almacenamiento se usa y por qué: si en el futuro se incorporan cookies o servicios de
              terceros, esta página se actualiza antes de que existan.
            </p>
          </div>

          <div className="mb-4 pb-4 border-bottom last:border-0 last:pb-0">
            <h4 className="mb-2 fw-semibold">2. Almacenamiento local que sí utilizamos</h4>
            <div className="table-responsive">
              <table className="table table-sm table-hover">
                <thead>
                  <tr>
                    <th>Clave</th>
                    <th>Almacenamiento</th>
                    <th>Tipo</th>
                    <th>Duración</th>
                    <th>Finalidad</th>
                    <th>Categoría</th>
                  </tr>
                </thead>
                <tbody>
                  {storageTable.map((item, index) => (
                    <tr key={index}>
                      <td>
                        <code>{item.name}</code>
                      </td>
                      <td>{item.medium}</td>
                      <td>{item.type}</td>
                      <td>{item.duration}</td>
                      <td>{item.purpose}</td>
                      <td>
                        <span
                          className={`badge ${item.category === 'Esencial' ? 'bg-primary' : 'bg-secondary'}`}
                        >
                          {item.category}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="mt-2">
              <strong>Nota:</strong> esta tabla es el inventario real. Si alguna vez se añade una
              cookie o un tercero que guarde datos en su navegador, debe aparecer aquí con su nombre
              y su finalidad.
            </p>
          </div>

          <div className="mb-4 pb-4 border-bottom last:border-0 last:pb-0">
            <h4 className="mb-2 fw-semibold">3. Categorías</h4>
            <ul>
              <li>
                <strong>Esenciales:</strong> necesarias para el funcionamiento básico de la
                plataforma (mantener la sesión iniciada). No se pueden desactivar.
              </li>
              <li>
                <strong>Funcionales:</strong> recuerdan preferencias de uso (tema, aviso de
                instalación ya descartado, mensaje de bienvenida). Se pueden eliminar en cualquier
                momento sin perder la sesión.
              </li>
              <li>
                <strong>Analíticas:</strong> no utilizamos ninguna. No hay medición de audiencia ni
                herramientas de analítica en la aplicación.
              </li>
              <li>
                <strong>Publicitarias:</strong> no utilizamos ninguna.
              </li>
            </ul>
          </div>

          <div className="mb-4 pb-4 border-bottom last:border-0 last:pb-0">
            <h4 className="mb-2 fw-semibold">4. Servicios de terceros</h4>
            <p>
              La aplicación no carga recursos de terceros: ni fuentes de tipografía desde servidores
              externos (se sirven desde el propio dominio), ni analítica, ni publicidad. Los iconos
              y las tipografías se incluyen en el propio paquete de la aplicación.
            </p>
            <p>
              El único servicio externo es la base de datos y la autenticación, que comunican con
              nuestra infraestructura y se rigen por nuestra{' '}
              <Link to="/privacy-policy">Política de Privacidad</Link>. Los pagos se registran en la
              plataforma; si se incorporan pasarelas de pago, sus políticas se publicarán aquí.
            </p>
          </div>

          <div className="mb-4 pb-4 border-bottom last:border-0 last:pb-0">
            <h4 className="mb-2 fw-semibold">5. Cómo desactivarlo o eliminarlo</h4>
            <p>
              Puede borrar el almacenamiento local desde la configuración de su navegador. Tenga en
              cuenta que <strong>eliminar el almacenamiento esencial cierra la sesión</strong> y
              tendrá que volver a iniciar sesión:
            </p>
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
              La aplicación también ofrece cerrar sesión explícitamente desde el menú de usuario, lo
              que elimina la sesión almacenada en su dispositivo.
            </p>
          </div>

          <div className="mb-4 pb-4 border-bottom last:border-0 last:pb-0">
            <h4 className="mb-2 fw-semibold">6. Consentimiento</h4>
            <p>
              No hay cookies publicitarias ni de analítica, así que{' '}
              <strong>no necesitamos un banner de consentimiento</strong> ni mecanismos para
              aceptarlas: no se recoja ningún dato de navegación con fines de perfilado. El único
              almacenamiento no esencial (tema y avisos descartados) es necesario para el
              funcionamiento descrito en el punto 2 y puede borrarse en cualquier momento como se
              indica en el punto 5.
            </p>
          </div>

          <div className="mb-4 pb-4 border-bottom last:border-0 last:pb-0">
            <h4 className="mb-2 fw-semibold">7. Actualizaciones</h4>
            <p>
              Podemos actualizar esta política para reflejar cambios en el uso de almacenamiento
              local. Le notificaremos cambios materiales mediante notificación en la plataforma o
              correo electrónico.
            </p>
          </div>

          <div className="mb-4 pb-4 border-bottom last:border-0 last:pb-0">
            <h4 className="mb-2 fw-semibold">8. Contacto</h4>
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
