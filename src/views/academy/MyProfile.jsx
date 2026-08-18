import React, { useEffect, useState } from 'react'
import {
  CAvatar,
  CBadge,
  CButton,
  CCard,
  CCardBody,
  CCardHeader,
  CCol,
  CFormInput,
  CFormSelect,
  CRow,
  CSpinner,
  CTable,
  CTableBody,
  CTableDataCell,
  CTableHead,
  CTableHeaderCell,
  CTableRow,
} from '@coreui/react'
import { useAuth } from '../../context/AuthContext'
import useSupabaseLessons from '../../hooks/useSupabaseLessons'
import supabase from '../../lib/supabase'

const MyProfile = () => {
  const { user, profile } = useAuth()
  const { lessons, loading } = useSupabaseLessons(user?.id)
  const [form, setForm] = useState({ phone: '', instrument: '', level: '' })
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState({ type: '', text: '' })

  useEffect(() => {
    if (profile) {
      setForm({
        phone: profile.phone || '',
        instrument: profile.instrument || '',
        level: profile.level || 'Principiante',
      })
    }
  }, [profile])

  if (!profile || profile.role !== 'student') {
    return (
      <CCard className="mb-4">
        <CCardBody>
          <h4>Acceso restringido</h4>
          <p>Esta sección solo está disponible para los estudiantes de Cosmo Music.</p>
        </CCardBody>
      </CCard>
    )
  }

  const handleSave = async () => {
    setSaving(true)
    setMessage({ type: '', text: '' })

    const { error } = await supabase
      .from('profiles')
      .update({
        phone: form.phone || null,
        instrument: form.instrument || null,
        level: form.level,
        updated_at: new Date().toISOString(),
      })
      .eq('id', user.id)

    if (error) {
      setMessage({ type: 'danger', text: 'Error al guardar los cambios.' })
    } else {
      setMessage({ type: 'success', text: 'Perfil actualizado correctamente.' })
    }
    setSaving(false)
  }

  return (
    <>
      {message.text && (
        <CRow className="mb-3">
          <CCol>
            <div className={`alert alert-${message.type}`}>{message.text}</div>
          </CCol>
        </CRow>
      )}
      <CRow className="mb-4">
        <CCol md={4} className="mb-3">
          <CCard>
            <CCardHeader>Mi información</CCardHeader>
            <CCardBody>
              <div className="d-flex align-items-center gap-3 mb-3">
                <CAvatar color="primary" size="xl">
                  {profile.full_name
                    .split(' ')
                    .map((word) => word[0])
                    .join('')}
                </CAvatar>
                <div>
                  <h4 className="mb-1">{profile.full_name}</h4>
                  <div className="text-medium-emphasis">Estudiante</div>
                </div>
              </div>
              <div className="mb-3">
                <strong>Email:</strong> {profile.email}
              </div>
              <div className="mb-3">
                <strong>Profesor:</strong> {profile.teacher || '—'}
              </div>
              <div className="mb-3">
                <strong>Progreso:</strong>{' '}
                <CBadge color="success">{profile.progress}%</CBadge>
              </div>
              <div className="mb-3">
                <strong>Asistencia:</strong> {profile.attendance}%
              </div>
            </CCardBody>
          </CCard>
        </CCol>
        <CCol md={8} className="mb-3">
          <CCard>
            <CCardHeader>Editar perfil</CCardHeader>
            <CCardBody>
              <CFormInput
                label="Teléfono"
                placeholder="Ej: +58 412 1234567"
                className="mb-3"
                value={form.phone}
                onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
              />
              <CFormSelect
                label="Instrumento"
                className="mb-3"
                value={form.instrument}
                onChange={(e) => setForm((f) => ({ ...f, instrument: e.target.value }))}
              >
                <option value="">Seleccionar...</option>
                <option value="Piano">Piano</option>
                <option value="Guitarra">Guitarra</option>
                <option value="Violín">Violín</option>
                <option value="Saxofón">Saxofón</option>
                <option value="Batería">Batería</option>
                <option value="Otro">Otro</option>
              </CFormSelect>
              <CFormSelect
                label="Nivel"
                className="mb-3"
                value={form.level}
                onChange={(e) => setForm((f) => ({ ...f, level: e.target.value }))}
              >
                <option value="Principiante">Principiante</option>
                <option value="Intermedio">Intermedio</option>
                <option value="Avanzado">Avanzado</option>
              </CFormSelect>
              <CButton color="primary" onClick={handleSave} disabled={saving}>
                {saving ? 'Guardando...' : 'Guardar cambios'}
              </CButton>
            </CCardBody>
          </CCard>
          <CCard className="mt-3">
            <CCardHeader>Próximas clases</CCardHeader>
            <CCardBody>
              {loading ? (
                <CSpinner color="primary" />
              ) : (
                <CTable hover responsive>
                  <CTableHead>
                    <CTableRow>
                      <CTableHeaderCell>Fecha</CTableHeaderCell>
                      <CTableHeaderCell>Hora</CTableHeaderCell>
                      <CTableHeaderCell>Instrumento</CTableHeaderCell>
                      <CTableHeaderCell>Profesor</CTableHeaderCell>
                      <CTableHeaderCell>Duración</CTableHeaderCell>
                    </CTableRow>
                  </CTableHead>
                  <CTableBody>
                    {lessons.length > 0 ? (
                      lessons.map((lesson) => (
                        <CTableRow key={lesson.id}>
                          <CTableDataCell>{lesson.lesson_date}</CTableDataCell>
                          <CTableDataCell>{lesson.lesson_time}</CTableDataCell>
                          <CTableDataCell>{lesson.instrument}</CTableDataCell>
                          <CTableDataCell>{lesson.teacher}</CTableDataCell>
                          <CTableDataCell>{lesson.duration}</CTableDataCell>
                        </CTableRow>
                      ))
                    ) : (
                      <CTableRow>
                        <CTableDataCell colSpan={5}>No hay clases programadas.</CTableDataCell>
                      </CTableRow>
                    )}
                  </CTableBody>
                </CTable>
              )}
            </CCardBody>
          </CCard>
        </CCol>
      </CRow>
    </>
  )
}

export default MyProfile
