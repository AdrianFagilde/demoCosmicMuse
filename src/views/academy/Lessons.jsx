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
import EmptyState from '../../components/EmptyState'
import { TableSkeletonRows } from '../../components/Skeleton'

const emptyForm = {
  studentId: '',
  instrument: '',
  lessonStart: '',
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

  const openCreate = () => {
    setEditingId(null)
    setForm(emptyForm)
    setFormError('')
    setModalVisible(true)
  }

  const openEdit = (lesson) => {
    setEditingId(lesson.id)
    // lesson_start es ISO string (ej. '2026-01-15T15:30:00Z')
    // Para datetime-local necesitamos formato local sin zona: '2026-01-15T15:30'
    const localStart = lesson.lesson_start
      ? new Date(lesson.lesson_start).toISOString().slice(0, 16)
      : ''
    setForm({
      studentId: lesson.student_id || '',
      instrument: lesson.instrument || '',
      lessonStart: localStart,
      duration: lesson.duration || '60',
      teacher: lesson.teacher || '',
    })
    setFormError('')
    setModalVisible(true)
  }

  const handleSave = async () => {
    if (!form.studentId || !form.instrument || !form.lessonStart || !form.teacher) {
      setFormError('Completa estudiante, instrumento, fecha/hora y profesor.')
      return
    }
    setSaving(true)
    setFormError('')
    let ok
    if (editingId) {
      ok = await updateLesson(editingId, {
        student_id: form.studentId,
        instrument: form.instrument,
        lesson_start: form.lessonStart,
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
          <CCard className="app-card h-100">
            <CCardBody>
              <div className="text-medium-emphasis small">Total clases</div>
              <div className="fs-3 fw-semibold">{lessons.length}</div>
            </CCardBody>
          </CCard>
        </CCol>
      </CRow>
      <CCard className="app-card">
        <CCardHeader className="d-flex justify-content-between align-items-center">
          <span>Clases programadas</span>
          <CButton color="primary" size="sm" onClick={openCreate}>
            <CIcon icon={cilPlus} className="me-1" aria-hidden="true" /> Nueva clase
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
                <CTableHeaderCell>Fecha y hora</CTableHeaderCell>
                <CTableHeaderCell>Duración</CTableHeaderCell>
                <CTableHeaderCell>Profesor</CTableHeaderCell>
                <CTableHeaderCell className="text-center">Acciones</CTableHeaderCell>
              </CTableRow>
            </CTableHead>
            <CTableBody>
              {loading ? (
                <TableSkeletonRows rows={6} columns={6} />
              ) : (
                <>
                  {filtered.map((lesson) => (
                    <CTableRow key={lesson.id}>
                      <CTableDataCell>{lesson.profiles?.full_name || '—'}</CTableDataCell>
                      <CTableDataCell>
                        <CBadge color="info">{lesson.instrument}</CBadge>
                      </CTableDataCell>
                      <CTableDataCell>
                        {lesson.lesson_start
                          ? new Date(lesson.lesson_start).toLocaleString('es-ES', {
                              dateStyle: 'short',
                              timeStyle: 'short',
                            })
                          : '—'}
                      </CTableDataCell>
                      <CTableDataCell>{lesson.duration} min</CTableDataCell>
                      <CTableDataCell>{lesson.teacher}</CTableDataCell>
                      <CTableDataCell className="text-center">
                        <CButton
                          color="primary"
                          variant="ghost"
                          size="sm"
                          onClick={() => openEdit(lesson)}
                          aria-label={`Editar la clase del ${lesson.student?.full_name || 'estudiante'}`}
                        >
                          <CIcon icon={cilPencil} aria-hidden="true" />
                        </CButton>
                        <CButton
                          color="danger"
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDelete(lesson.id)}
                          aria-label={`Eliminar la clase del ${lesson.student?.full_name || 'estudiante'}`}
                        >
                          <CIcon icon={cilTrash} aria-hidden="true" />
                        </CButton>
                      </CTableDataCell>
                    </CTableRow>
                  ))}
                  {filtered.length === 0 && (
                    <CTableRow>
                      <CTableDataCell colSpan={6} className="p-0">
                        <EmptyState
                          compact
                          title="Sin clases"
                          description="No se encontraron clases con esos filtros."
                        />
                      </CTableDataCell>
                    </CTableRow>
                  )}
                </>
              )}
            </CTableBody>
          </CTable>
        </CCardBody>
      </CCard>

      <CModal visible={modalVisible} onClose={() => setModalVisible(false)} scrollable>
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
          <CFormInput
            label="Fecha y hora"
            type="datetime-local"
            className="mb-3"
            value={form.lessonStart}
            onChange={(e) => setForm((f) => ({ ...f, lessonStart: e.target.value }))}
          />
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
