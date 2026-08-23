import React, { useMemo, useState } from 'react'
import {
  CBadge,
  CButton,
  CCard,
  CCardBody,
  CCardHeader,
  CCol,
  CFormInput,
  CFormSelect,
  CModal,
  CModalBody,
  CModalFooter,
  CModalHeader,
  CRow,
  CSpinner,
  CTable,
  CTableBody,
  CTableDataCell,
  CTableHead,
  CTableHeaderCell,
  CTableRow,
} from '@coreui/react'
import { cilPlus, cilTrash, cilPencil } from '@coreui/icons'
import CIcon from '@coreui/icons-react'
import { useAuth } from '../../context/AuthContext'
import useSupabaseLessons from '../../hooks/useSupabaseLessons'
import useSupabaseStudents from '../../hooks/useSupabaseStudents'
import RestrictedAccess from '../../components/RestrictedAccess'

const emptyForm = {
  studentId: '',
  instrument: '',
  lessonDate: '',
  lessonTime: '',
  duration: '60',
  teacher: '',
}

const Lessons = () => {
  const { profile } = useAuth()
  const { lessons, loading, addLesson, updateLesson, deleteLesson } = useSupabaseLessons()
  const { students } = useSupabaseStudents()

  const [modalVisible, setModalVisible] = useState(false)
  const [editingId, setEditingId] = useState(null)
  const [form, setForm] = useState(emptyForm)
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState('')
  const [search, setSearch] = useState('')

  const filtered = useMemo(() => {
    const term = search.toLowerCase()
    return lessons.filter((l) => {
      if (!term) return true
      const studentName = l.profiles?.full_name?.toLowerCase() || ''
      return (
        studentName.includes(term) ||
        l.instrument?.toLowerCase().includes(term) ||
        l.teacher?.toLowerCase().includes(term)
      )
    })
  }, [lessons, search])

  if (!profile || profile.role !== 'admin') {
    return <RestrictedAccess message="Solo los administradores pueden gestionar las clases." />
  }

  if (loading) {
    return (
      <div className="text-center pt-4">
        <CSpinner color="primary" />
      </div>
    )
  }

  const openCreate = () => {
    setEditingId(null)
    setForm(emptyForm)
    setFormError('')
    setModalVisible(true)
  }

  const openEdit = (lesson) => {
    setEditingId(lesson.id)
    setForm({
      studentId: lesson.student_id || '',
      instrument: lesson.instrument || '',
      lessonDate: lesson.lesson_date || '',
      lessonTime: lesson.lesson_time || '',
      duration: lesson.duration || '60',
      teacher: lesson.teacher || '',
    })
    setFormError('')
    setModalVisible(true)
  }

  const handleSave = async () => {
    if (
      !form.studentId ||
      !form.instrument ||
      !form.lessonDate ||
      !form.lessonTime ||
      !form.teacher
    ) {
      setFormError('Completa estudiante, instrumento, fecha, hora y profesor.')
      return
    }
    setSaving(true)
    setFormError('')
    let ok
    if (editingId) {
      ok = await updateLesson(editingId, {
        student_id: form.studentId,
        instrument: form.instrument,
        lesson_date: form.lessonDate,
        lesson_time: form.lessonTime,
        duration: form.duration,
        teacher: form.teacher,
      })
    } else {
      ok = await addLesson({ ...form, createdBy: profile.id })
    }
    if (!ok) {
      setFormError('No se pudo guardar la clase. Intenta de nuevo.')
      setSaving(false)
      return
    }
    setSaving(false)
    setModalVisible(false)
  }

  const handleDelete = async (id) => {
    if (!window.confirm('¿Eliminar esta clase?')) return
    await deleteLesson(id)
  }

  return (
    <>
      <CRow className="mb-4">
        <CCol md={3} sm={6}>
          <CCard className="h-100">
            <CCardBody>
              <div className="text-medium-emphasis small">Total clases</div>
              <div className="fs-3 fw-semibold">{lessons.length}</div>
            </CCardBody>
          </CCard>
        </CCol>
      </CRow>
      <CCard>
        <CCardHeader className="d-flex justify-content-between align-items-center">
          <span>Clases programadas</span>
          <CButton color="primary" size="sm" onClick={openCreate}>
            <CIcon icon={cilPlus} className="me-1" /> Nueva clase
          </CButton>
        </CCardHeader>
        <CCardBody>
          <CFormInput
            type="text"
            placeholder="Buscar por estudiante, instrumento o profesor..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="mb-3"
          />
          <CTable align="middle" className="mb-0 border" hover responsive>
            <CTableHead>
              <CTableRow>
                <CTableHeaderCell>Estudiante</CTableHeaderCell>
                <CTableHeaderCell>Instrumento</CTableHeaderCell>
                <CTableHeaderCell>Fecha</CTableHeaderCell>
                <CTableHeaderCell>Hora</CTableHeaderCell>
                <CTableHeaderCell>Duración</CTableHeaderCell>
                <CTableHeaderCell>Profesor</CTableHeaderCell>
                <CTableHeaderCell className="text-center">Acciones</CTableHeaderCell>
              </CTableRow>
            </CTableHead>
            <CTableBody>
              {filtered.map((lesson) => (
                <CTableRow key={lesson.id}>
                  <CTableDataCell>{lesson.profiles?.full_name || '—'}</CTableDataCell>
                  <CTableDataCell>
                    <CBadge color="info">{lesson.instrument}</CBadge>
                  </CTableDataCell>
                  <CTableDataCell>
                    {new Date(lesson.lesson_date + 'T00:00:00').toLocaleDateString('es-ES')}
                  </CTableDataCell>
                  <CTableDataCell>{lesson.lesson_time?.slice(0, 5)}</CTableDataCell>
                  <CTableDataCell>{lesson.duration} min</CTableDataCell>
                  <CTableDataCell>{lesson.teacher}</CTableDataCell>
                  <CTableDataCell className="text-center">
                    <CButton
                      color="primary"
                      variant="ghost"
                      size="sm"
                      onClick={() => openEdit(lesson)}
                    >
                      <CIcon icon={cilPencil} />
                    </CButton>
                    <CButton
                      color="danger"
                      variant="ghost"
                      size="sm"
                      onClick={() => handleDelete(lesson.id)}
                    >
                      <CIcon icon={cilTrash} />
                    </CButton>
                  </CTableDataCell>
                </CTableRow>
              ))}
              {filtered.length === 0 && (
                <CTableRow>
                  <CTableDataCell colSpan={7} className="text-center text-medium-emphasis">
                    No se encontraron clases.
                  </CTableDataCell>
                </CTableRow>
              )}
            </CTableBody>
          </CTable>
        </CCardBody>
      </CCard>

      <CModal visible={modalVisible} onClose={() => setModalVisible(false)}>
        <CModalHeader>{editingId ? 'Editar clase' : 'Nueva clase'}</CModalHeader>
        <CModalBody>
          {formError && <div className="alert alert-danger">{formError}</div>}
          <CFormSelect
            label="Estudiante"
            className="mb-3"
            value={form.studentId}
            onChange={(e) => setForm((f) => ({ ...f, studentId: e.target.value }))}
          >
            <option value="">Seleccionar estudiante...</option>
            {students.map((s) => (
              <option key={s.id} value={s.id}>
                {s.full_name}
              </option>
            ))}
          </CFormSelect>
          <CFormInput
            label="Instrumento"
            className="mb-3"
            value={form.instrument}
            onChange={(e) => setForm((f) => ({ ...f, instrument: e.target.value }))}
          />
          <CRow className="mb-3">
            <CCol sm={6}>
              <CFormInput
                label="Fecha"
                type="date"
                value={form.lessonDate}
                onChange={(e) => setForm((f) => ({ ...f, lessonDate: e.target.value }))}
              />
            </CCol>
            <CCol sm={6}>
              <CFormInput
                label="Hora"
                type="time"
                value={form.lessonTime}
                onChange={(e) => setForm((f) => ({ ...f, lessonTime: e.target.value }))}
              />
            </CCol>
          </CRow>
          <CFormSelect
            label="Duración (minutos)"
            className="mb-3"
            value={form.duration}
            onChange={(e) => setForm((f) => ({ ...f, duration: e.target.value }))}
          >
            <option value="30">30 min</option>
            <option value="45">45 min</option>
            <option value="60">60 min</option>
            <option value="90">90 min</option>
          </CFormSelect>
          <CFormInput
            label="Profesor"
            value={form.teacher}
            onChange={(e) => setForm((f) => ({ ...f, teacher: e.target.value }))}
          />
        </CModalBody>
        <CModalFooter>
          <CButton color="secondary" onClick={() => setModalVisible(false)}>
            Cancelar
          </CButton>
          <CButton color="primary" onClick={handleSave} disabled={saving}>
            {saving ? 'Guardando...' : editingId ? 'Guardar cambios' : 'Crear clase'}
          </CButton>
        </CModalFooter>
      </CModal>
    </>
  )
}

export default Lessons
