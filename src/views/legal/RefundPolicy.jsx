import React from 'react'
import { useNavigate } from 'react-router-dom'
import { CCard, CCardBody, CCardHeader, CRow, CCol, CButton } from '@coreui/react'
import { cilInfo, cilCalendar, cilBan, cilCheckCircle } from '@coreui/icons'
import CIcon from '@coreui/icons-react'

const lastUpdated = '27 de septiembre de 2026'
const version = '1.0'

const sections = [
  {
    icon: cilInfo,
    title: '1. Ámbito de Aplicación',
    content: [
      'Esta Política de Reembolso se aplica a todos los pagos realizados a través de la plataforma Cosmic Muse para servicios educativos de música (clases, cursos, materiales, inscripciones).',
      'Se aplica a estudiantes, padres/tutores y administradores que realicen pagos a través de la plataforma.',
    ],
  },
  {
    icon: cilCalendar,
    title: '2. Plazos de Solicitud de Reembolso',
    content: [
      'Clases individuales: Solicitud hasta 24 horas antes de la clase programada para reembolso completo.',
      'Cursos completos: Solicitud hasta 7 días naturales antes del inicio del curso para reembolso completo.',
      'Materiales digitales: No reembolsables una vez descargados o accedidos (salvo defecto).',
    ],
  },
  {
    icon: cilCheckCircle,
    title: '3. Casos de Reembolso Completo (100%)',
    content: [
      'Cancelación por parte de la academia (profesor no disponible, fuerza mayor, cierre de curso).',
      'Cancelación por el usuario dentro de los plazos establecidos (ver sección 2).',
      'Error de facturación comprobado (cobro duplicado, monto incorrecto).',
      'Servicio no prestado por causas imputables a la academia.',
      'Enfermedad grave o fuerza mayor acreditada documentalmente (certificado médico, etc.).',
    ],
  },
  {
    icon: cilInfo,
    title: '4. Reembolso Parcial (50%)',
    content: [
      'Cancelación de curso entre 1-6 días antes del inicio: 50% del importe.',
      'Cancelación de clase individual entre 2-24 horas antes: 50% del importe.',
      'Baja voluntaria de curso en curso (primeras 2 semanas): 50% de las clases restantes.',
    ],
  },
  {
    icon: cilBan,
    title: '5. Casos Sin Derecho a Reembolso',
    content: [
      'Cancelación fuera de plazo (fuera de los plazos de la sección 2).',
      'Inasistencia a clases sin aviso previo (no-show).',
      'Materiales digitales ya descargados o accedidos (salvo defecto de fabricación).',
      'Suspensión o expulsión por violación de Términos y Condiciones.',
      'Cambio de opinión sin causa justificada fuera de plazo.',
    ],
  },
  {
    icon: cilCalendar,
    title: '6. Proceso de Solicitud',
    content: [
      'La solicitud debe realizarse por escrito a reembolsos@cosmicmuse.com o desde el panel de usuario > Historial de pagos > Solicitar reembolso.',
      'Debe incluir: número de pedido/factura, motivo, fecha del servicio, comprobantes adjuntos (certificado médico, etc.).',
      'Plazo de respuesta: 5 días hábiles para confirmar recepción, 15 días hábiles para resolución.',
      'El reembolso se realiza por el mismo medio de pago original (tarjeta, transferencia, saldo en plataforma).',
    ],
  },
  {
    icon: cilCalendar,
    title: '7. Plazos de Ejecución',
    content: [
      'Tarjeta de crédito/débito: 5-10 días hábiles (según entidad emisora).',
      'Transferencia bancaria: 3-5 días hábiles.',
      'Saldo en plataforma (crédito): Inmediato tras aprobación.',
      'Efectivo/otros: Según acuerdo bilateral.',
    ],
  },
  {
    icon: cilBan,
    title: '8. Casos Especiales',
    content: [
      'Paquetes de clases: Reembolso proporcional a clases no realizadas (descontadas las realizadas).',
      'Regalos/vales: Reembolso al comprador original, no al beneficiario, salvo acuerdo expreso.',
    ],
  },
  {
    icon: cilInfo,
    title: '9. Disputas y Reclamaciones',
    content: [
      'Si no está de acuerdo con la resolución, puede solicitar revisión en un plazo de 10 días hábiles.',
      'Si persiste el desacuerdo, se aplicará lo dispuesto en la cláusula de resolución de disputas de los Términos y Condiciones.',
    ],
  },
  {
    icon: cilInfo,
    title: '10. Contacto',
    content: [
      'Para solicitudes de reembolso: reembolsos@cosmicmuse.com',
      'Para consultas generales: pagos@cosmicmuse.com',
      'Teléfono: [Teléfono de atención al cliente]',
    ],
  },
]

const RefundPolicy = () => {
  const navigate = useNavigate()

  return (
    <div className="legal-page py-4">
      <CRow className="mb-4">
        <CCol>
          <div className="d-flex justify-content-between align-items-center">
            <h2 className="mb-0">Política de Reembolso</h2>
            <CButton color="secondary" variant="outline" onClick={() => navigate(-1)}>
              Volver
            </CButton>
          </div>
        </CCol>
      </CRow>

      <CCard className="app-card">
        <CCardHeader>
          <div className="d-flex justify-content-between align-items-center">
            <h4 className="mb-0">Política de Reembolso</h4>
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
                  aria-hidden="true"
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

export default RefundPolicy
