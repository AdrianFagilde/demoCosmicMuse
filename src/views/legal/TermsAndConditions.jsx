import React from 'react'
import { useNavigate } from 'react-router-dom'
import { CCard, CCardBody, CCardHeader, CButton, CRow, CCol } from '@coreui/react'
import CIcon from '@coreui/icons-react'
import { cilInfo, cilUser, cilCreditCard, cilCalendar, cilBan, cilDescription } from '@coreui/icons'

const lastUpdated = '27 de septiembre de 2026'
const version = '1.0'

const sections = [
  {
    icon: cilInfo,
    title: '1. Aceptación de los Términos',
    content: [
      'Al acceder y utilizar los servicios de Cosmic Muse ("la plataforma", "nosotros", "nuestro"), usted ("el usuario", "el estudiante", "el padre/tutor") acepta cumplir y estar legalmente obligado por estos Términos y Condiciones.',
      'Si no está de acuerdo con alguna parte de estos términos, no debe utilizar nuestros servicios.',
      'Nos reservamos el derecho de modificar estos términos en cualquier momento. Le notificaremos cambios materiales con antelación razonable.',
    ],
  },
  {
    icon: cilUser,
    title: '2. Definiciones',
    content: [
      'Estudiante: Persona inscrita en cursos de la academia.',
      'Padre/Tutor: Representante legal del estudiante menor de edad.',
      'Profesor: Instructor autorizado por la academia.',
      'Administrador: Personal con permisos de gestión de la plataforma.',
      'Servicios: Plataforma web, clases, materiales, tareas, evaluaciones y servicios relacionados.',
      'Contenido: Materiales didácticos, videos, documentos, tareas, evaluaciones, software.',
    ],
  },
  {
    icon: cilDescription,
    title: '3. Registro y Cuentas',
    content: [
      'El registro requiere información veraz, actual y completa.',
      'Los menores de 18 años requieren autorización de padre/tutor.',
      'El usuario es responsable de mantener la confidencialidad de sus credenciales.',
      'Debe notificarnos inmediatamente cualquier uso no autorizado de su cuenta.',
      'Nos reservamos el derecho de suspender o eliminar cuentas por violaciones a estos términos.',
    ],
  },
  {
    icon: cilCreditCard,
    title: '4. Pagos y Facturación',
    content: [
      'Las tarifas se publican en la plataforma y pueden actualizarse con notificación previa.',
      'Los pagos deben realizarse por los medios habilitados en la plataforma.',
      'Los comprobantes de pago se generan automáticamente y están disponibles en el historial.',
      'Los retrasos en el pago pueden resultar en suspensión de servicios hasta regularización.',
      'Los reembolsos se rigen por la Política de Reembolso (documento separado).',
      'Los precios incluyen impuestos aplicables según la legislación vigente.',
    ],
  },
  {
    icon: cilCalendar,
    title: '5. Clases y Horarios',
    content: [
      'Los horarios de clases se acuerdan entre estudiante/profesor y se confirman en la plataforma.',
      'Cancelaciones: Se requieren 24 horas de aviso para reprogramar sin cargo.',
      'Inasistencias sin aviso: Se considera clase realizada y se cobra normalmente.',
      'La academia puede reprogramar clases por fuerza mayor o indisponibilidad del profesor.',
      'Los cambios de horario requieren acuerdo mutuo y confirmación en la plataforma.',
    ],
  },
  {
    icon: cilBan,
    title: '6. Conducta y Uso Aceptable',
    content: [
      'Uso respetuoso y profesional en todas las interacciones dentro de la plataforma.',
      'Prohibido: contenido ilegal, ofensivo, discriminatorio, acoso, spam, ingeniería inversa, acceso no autorizado.',
      'El contenido compartido en la plataforma (tareas y materiales del curso) debe ser propio o debidamente licenciado.',
      'Violaciones pueden resultar en suspensión inmediata y acciones legales correspondientes.',
    ],
  },
  {
    icon: cilDescription,
    title: '7. Propiedad Intelectual',
    content: [
      'Todo el contenido de la plataforma (diseño, código, materiales didácticos, videos, documentos) es propiedad de Cosmic Muse o sus licenciantes.',
      'El estudiante conserva los derechos sobre sus propios trabajos y entregas.',
      'Al enviar contenido a la plataforma, otorga licencia no exclusiva para uso educativo y administrativo.',
      'Queda prohibida la reproducción, distribución o modificación no autorizada del contenido de la plataforma.',
    ],
  },
  {
    icon: cilInfo,
    title: '8. Limitación de Responsabilidad',
    content: [
      'La plataforma se proporciona "tal cual" y "según disponibilidad".',
      'No garantizamos disponibilidad ininterrumpida, libre de errores o ausencia de virus.',
      'Nuestra responsabilidad se limita al monto pagado por el usuario en los últimos 12 meses.',
      'No somos responsables por daños indirectos, incidentales, consecuentes o punitivos.',
    ],
  },
  {
    icon: cilBan,
    title: '9. Suspensión y Terminación',
    content: [
      'Podemos suspender o terminar el acceso por violaciones a estos términos, impago, inactividad prolongada (12+ meses) o por orden judicial.',
      'El usuario puede solicitar el cierre de su cuenta en cualquier momento.',
      'Tras la terminación, cesan todos los derechos de acceso, pero las obligaciones de pago pendientes permanecen.',
      'Los datos se manejan según la Política de Privacidad y la Política de Retención.',
    ],
  },
  {
    icon: cilInfo,
    title: '10. Ley Aplicable y Jurisdicción',
    content: [
      'Estos términos se rigen por las leyes de [País/Jurisdicción].',
      'Cualquier disputa se resolverá preferiblemente mediante mediación.',
      'De no resolverse, se someterá a los tribunales competentes de [Ciudad/Jurisdicción].',
    ],
  },
  {
    icon: cilInfo,
    title: '11. Disposiciones Generales',
    content: [
      'Si alguna disposición resulta inválida, las demás permanecen en vigor.',
      'El no ejercicio de un derecho no constituye renuncia al mismo.',
      'Estos términos constituyen el acuerdo completo entre las partes.',
      'Las notificaciones se realizarán por correo electrónico registrado o notificación en plataforma.',
    ],
  },
  {
    icon: cilInfo,
    title: '12. Contacto',
    content: [
      'Para consultas sobre estos términos: legal@cosmicmuse.com',
      'Dirección: [Dirección de la academia]',
      'Teléfono: [Teléfono de contacto]',
    ],
  },
]

const TermsAndConditions = () => {
  const navigate = useNavigate()

  return (
    <div className="container-fluid py-4">
      <CRow className="mb-4">
        <CCol>
          <div className="d-flex justify-content-between align-items-center">
            <h2 className="mb-0">Términos y Condiciones</h2>
            <CButton color="secondary" variant="outline" onClick={() => navigate(-1)}>
              Volver
            </CButton>
          </div>
        </CCol>
      </CRow>

      <CCard className="app-card">
        <CCardHeader>
          <div className="d-flex justify-content-between align-items-center">
            <h4 className="mb-0">Términos y Condiciones</h4>
            <div className="text-end">
              <small className="text-medium-emphasis d-block">Versión 1.0</small>
              <small className="text-medium-emphasis">Actualizada: 27 de septiembre de 2026</small>
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

export default TermsAndConditions
