import React from 'react'
import { CCard, CCardBody, CCardHeader, CRow, CCol, CButton } from '@coreui/react'
import {
  cilLockLocked,
  cilInfo,
  cilUser,
  cilShieldAlt,
  cilGlobeAlt,
  cilEnvelopeClosed,
} from '@coreui/icons'
import CIcon from '@coreui/icons-react'
import { Link, useNavigate } from 'react-router-dom'

const lastUpdated = '27 de septiembre de 2026'
const version = '1.0'

const sections = [
  {
    icon: cilInfo,
    title: '1. Información General',
    content: [
      'Esta Política de Privacidad describe cómo Cosmic Muse ("nosotros", "nuestro", "la plataforma") recopila, utiliza y protege su información personal cuando utiliza nuestros servicios educativos de música.',
      'Al utilizar nuestros servicios, usted acepta las prácticas descritas en esta política.',
    ],
  },
  {
    icon: cilUser,
    title: '2. Información que Recopilamos',
    content: [
      'Datos de identidad: nombre completo, correo electrónico, nombre de usuario, fecha de nacimiento.',
      'Datos de contacto: dirección de correo electrónico, número de teléfono, dirección postal.',
      'Datos académicos: instrumento, nivel, profesor asignado, progreso, asistencia, historial de clases y tareas.',
      'Datos de pago: información de facturación, historial de pagos, comprobantes.',
      'Datos técnicos: dirección IP, tipo de navegador, sistema operativo, logs de acceso, identificadores de dispositivo.',
      'Comunicaciones: mensajes enviados a través de la plataforma, notificaciones, formularios enviados.',
    ],
  },
  {
    icon: cilLockLocked,
    title: '3. Cómo Usamos su Información',
    content: [
      'Proveer y mejorar nuestros servicios educativos de música.',
      'Gestionar inscripciones, horarios de clases, tareas y progreso académico.',
      'Procesar pagos, emitir comprobantes y gestionar recordatorios de pago.',
      'Enviar notificaciones sobre clases, tareas, pagos y comunicaciones importantes.',
      'Personalizar la experiencia del usuario y mejorar la plataforma.',
      'Cumplir obligaciones legales y responder a solicitudes de autoridades competentes.',
      'Proteger la seguridad e integridad de la plataforma y sus usuarios.',
    ],
  },
  {
    icon: cilShieldAlt,
    title: '4. Protección y Seguridad de Datos',
    content: [
      'Implementamos medidas técnicas y organizativas apropiadas para proteger sus datos personales.',
      'El acceso a datos personales está restringido al personal autorizado según el principio de mínimo privilegio.',
      'Utilizamos cifrado en tránsito (TLS) y en reposo para datos sensibles.',
      'Los pagos se procesan a través de proveedores certificados (PCI DSS).',
      'Realizamos copias de seguridad periódicas y planes de recuperación ante desastres.',
    ],
  },
  {
    icon: cilGlobeAlt,
    title: '5. Compartir Información con Terceros',
    content: [
      'No vendemos ni alquilamos sus datos personales a terceros.',
      'Podemos compartir datos con:',
      '  • Proveedores de servicios esenciales (pagos, notificaciones, hosting) bajo contratos de procesamiento de datos.',
      '  • Autoridades competentes cuando lo exija la ley.',
      '  • Profesores y administradores de la academia para fines académicos y administrativos.',
    ],
  },
  {
    icon: cilEnvelopeClosed,
    title: '6. Sus Derechos',
    content: [
      'Acceso: Solicitar copia de sus datos personales.',
      'Rectificación: Corregir datos inexactos o incompletos.',
      'Supresión: Solicitar eliminación de sus datos (sujeto a obligaciones legales).',
      'Limitación: Restringir el tratamiento de sus datos.',
      'Portabilidad: Recibir sus datos en formato estructurado.',
      'Oposición: Oponerse al tratamiento para fines de marketing.',
      'Para ejercer sus derechos, contacte a: privacidad@cosmicmuse.com',
    ],
  },
  {
    icon: cilInfo,
    title: '7. Retención de Datos',
    content: [
      'Datos académicos y de perfil: mientras la cuenta esté activa y 5 años después de su cierre.',
      'Datos de facturación y pagos: 10 años (obligación fiscal).',
      'Logs de acceso y seguridad: 12 meses.',
      'Comunicaciones y notificaciones: 3 años.',
    ],
  },
  {
    icon: cilInfo,
    title: '8. Cookies y Tecnologías Similares',
    content: [
      'Utilizamos cookies esenciales para el funcionamiento de la plataforma (sesión, autenticación, seguridad).',
      'No utilizamos cookies de publicidad ni seguimiento entre sitios.',
      'Puede gestionar las cookies desde la configuración de su navegador.',
    ],
  },
  {
    icon: cilInfo,
    title: '9. Transferencias Internacionales',
    content: [
      'Sus datos pueden ser procesados en servidores ubicados en la Unión Europea y Estados Unidos.',
      'Las transferencias se realizan bajo cláusulas contractuales tipo aprobadas por la Comisión Europea.',
    ],
  },
  {
    icon: cilInfo,
    title: '10. Cambios a esta Política',
    content: [
      'Podemos actualizar esta política para reflejar cambios legales o en nuestros servicios.',
      'Le notificaremos cambios materiales por correo electrónico o mediante notificación en la plataforma.',
      'El uso continuado de los servicios implica aceptación de la política actualizada.',
    ],
  },
  {
    icon: cilInfo,
    title: '11. Contacto',
    content: [
      'Responsable del tratamiento: Cosmic Muse',
      'Correo: privacidad@cosmicmuse.com',
      'Dirección: [Dirección de la academia]',
      'Delegado de Protección de Datos: dpo@cosmicmuse.com',
    ],
  },
]

const PrivacyPolicy = () => {
  const navigate = useNavigate()

  return (
    <div className="container-fluid py-4">
      <CRow className="mb-4">
        <CCol>
          <div className="d-flex justify-content-between align-items-center">
            <h2 className="mb-0">Política de Privacidad</h2>
            <CButton color="secondary" variant="outline" onClick={() => navigate(-1)}>
              Volver
            </CButton>
          </div>
        </CCol>
      </CRow>

      <CCard className="app-card">
        <CCardHeader>
          <div className="d-flex justify-content-between align-items-center">
            <h4 className="mb-0">Política de Privacidad</h4>
            <div className="text-end">
              <small className="text-medium-emphasis d-block">Versión {version}</small>
              <small className="text-medium-emphasis">Actualizada: {lastUpdated}</small>
            </div>
          </div>
        </CCardHeader>
        <CCardBody>
          {sections.map((section, index) => (
            <div key={index} className="mb-4 pb-4 border-bottom last:border-0 last:pb-0">
              <div className="d-flex gap-3 mb-2">
                <CIcon
                  icon={section.icon}
                  className="text-primary"
                  style={{ fontSize: '1.25rem', flexShrink: 0 }}
                />
                <h4 className="mb-0 fw-semibold">{section.title}</h4>
              </div>
              <div className="ms-5">
                {section.content.map((paragraph, pIndex) => (
                  <p key={pIndex} className="mb-2 text-body-secondary">
                    {paragraph}
                  </p>
                ))}
              </div>
            </div>
          ))}
        </CCardBody>
      </CCard>
    </div>
  )
}

export default PrivacyPolicy
