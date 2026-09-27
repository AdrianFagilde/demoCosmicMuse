import React from 'react'
import {
  CButton,
  CCard,
  CCardBody,
  CCardHeader,
  CCol,
  CFormCheck,
  CFormInput,
  CRow,
  CSpinner,
} from '@coreui/react'

/**
 * Tarjeta de inscripción del curso: buscador + rejilla de checks + guardar.
 *
 * No recibe setters: todo el estado vive en useCourseEnrollments, y este
 * componente solo pinta. Así el guardado y el cálculo de "who está marcado"
 * se pueden probar sin montar la tarjeta.
 */
const CourseEnrollmentManager = ({
  search,
  onSearchChange,
  students,
  isChecked,
  onToggle,
  onSave,
  saving,
}) => (
  <CCard className="mb-4">
    <CCardHeader>Inscripción de estudiantes</CCardHeader>
    <CCardBody>
      <CFormInput
        placeholder="Buscar estudiante..."
        value={search}
        onChange={(e) => onSearchChange(e.target.value)}
        className="mb-3"
      />
      {students.length === 0 ? (
        <p className="text-medium-emphasis mb-0">Sin resultados.</p>
      ) : (
        <CRow xs={{ cols: 'auto' }} className="g-2 mb-3">
          {students.map((student) => (
            <CCol key={student.id}>
              <CFormCheck
                id={`enroll-${student.id}`}
                label={student.full_name}
                checked={isChecked(student.id)}
                onChange={(e) => onToggle(student.id, e.target.checked)}
              />
            </CCol>
          ))}
        </CRow>
      )}
      <CButton color="primary" onClick={onSave} disabled={saving}>
        {saving ? <CSpinner size="sm" /> : 'Guardar inscripción'}
      </CButton>
    </CCardBody>
  </CCard>
)

export default CourseEnrollmentManager
