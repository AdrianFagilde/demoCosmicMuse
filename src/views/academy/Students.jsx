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
import { cilPeople, cilSearch, cilPlus } from '@coreui/icons'
import CIcon from '@coreui/icons-react'
import { Link } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import useSupabaseStudents from '../../hooks/useSupabaseStudents'
import supabase from '../../lib/supabase'

const emptyForm = {
  fullName: '',
  email: '',
  password: '',
  instrument: '',
  level: 'Principiante',
}

const Students = () => {
  const { profile } = useAuth()
  const { students, loading, refetch } = useSupabaseStudents()
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('Todos')

  const [modalVisible, setModalVisible] = useState(false)
  const [form, setForm] = useState(emptyForm)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const filtered = useMemo(() => {
    const term = search.toLowerCase()
    return students.filter((s) => {
      const matchesSearch =
        !term ||
        s.full_name?.toLowerCase().includes(term) ||
        s.instrument?.toLowerCase().includes(term) ||
        s.teacher?.toLowerCase().includes(term)
      const matchesStatus = statusFilter === 'Todos' || s.status === statusFilter
      return matchesSearch && matchesStatus
    })
  }, [students, search, statusFilter])

  if (!profile || profile.role !== 'admin') {
    return (
      <CCard className="mb-4">
        <CCardBody>
          <h4>Acceso restringido</h4>
          <p>
            Solo los administradores pueden ver la lista de estudiantes y el control de la academia.
          </p>
        </CCardBody>
      </CCard>
    )
  }

  if (loading) {
    return (
      <div className="text-center pt-4">
        <CSpinner color="primary" />
      </div>
    )
  }

  const openCreate = () => {
    setForm(emptyForm)
    setError('')
    setModalVisible(true)
  }

  const handleCreate = async () => {
    if (!form.fullName || !form.email || !form.password) {
      setError('Nombre, email y contraseña son obligatorios')
      return
    }
    setSaving(true)
    setError('')

    const { error: invokeError } = await supabase.functions.invoke('create-student', {
      body: {
        fullName: form.fullName,
        email: form.email,
        password: form.password,
        instrument: form.instrument,
        level: form.level,
      },
    })

    if (invokeError) {
      setError(invokeError.message || 'Error al crear estudiante')
      setSaving(false)
      return
    }

    await refetch()
    setSaving(false)
    setModalVisible(false)
  }

  return (
    <>
      <CRow className="mb-4">
        <CCol md={3} sm={6} className="mb-3">
          <CCard className="h-100">
            <CCardBody>
              <div className="text-medium-emphasis small">Estudiantes activos</div>
              <div className="fs-3 fw-semibold">{students.length}</div>
              <div className="text-body-secondary mt-2 d-flex align-items-center">
                <CIcon icon={cilPeople} className="me-2" /> Total registrado
              </div>
            </CCardBody>
          </CCard>
        </CCol>
      </CRow>
      <CCard>
        <CCardHeader className="d-flex justify-content-between align-items-center">
          <span>Perfiles</span>
          <div className="d-flex align-items-center gap-3">
            <span className="text-medium-emphasis small">{filtered.length} resultado(s)</span>
            <CButton color="primary" size="sm" onClick={openCreate}>
              <CIcon icon={cilPlus} className="me-1" /> Agregar estudiante
            </CButton>
          </div>
        </CCardHeader>
        <CCardBody>
          <CRow className="mb-3">
            <CCol md={8} sm={12} className="mb-2 mb-md-0">
              <CFormInput
                type="text"
                placeholder="Buscar por nombre, instrumento o profesor..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                prepend={<CIcon icon={cilSearch} />}
              />
            </CCol>
            <CCol md={4} sm={12}>
              <CFormSelect value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
                <option value="Todos">Todos los estados</option>
                <option value="Activo">Activo</option>
                <option value="Inactivo">Inactivo</option>
              </CFormSelect>
            </CCol>
          </CRow>
          <CTable align="middle" className="mb-0 border" hover responsive>
            <CTableHead>
              <CTableRow>
                <CTableHeaderCell>Nombre</CTableHeaderCell>
                <CTableHeaderCell>Instrumento</CTableHeaderCell>
                <CTableHeaderCell>Profesor</CTableHeaderCell>
                <CTableHeaderCell>Progreso</CTableHeaderCell>
                <CTableHeaderCell>Asistencia</CTableHeaderCell>
                <CTableHeaderCell>Próxima clase</CTableHeaderCell>
                <CTableHeaderCell>Estado</CTableHeaderCell>
              </CTableRow>
            </CTableHead>
            <CTableBody>
              {filtered.map((student) => (
                <CTableRow key={student.id}>
                  <CTableDataCell>
                    <Link to={`/students/${student.id}`}>{student.full_name}</Link>
                  </CTableDataCell>
                  <CTableDataCell>{student.instrument}</CTableDataCell>
                  <CTableDataCell>{student.teacher}</CTableDataCell>
                  <CTableDataCell>
                    <div className="d-flex align-items-center gap-2">
                      <CBadge color="primary">{student.progress}%</CBadge>
                    </div>
                  </CTableDataCell>
                  <CTableDataCell>{student.attendance}%</CTableDataCell>
                  <CTableDataCell>
                    {student.next_lesson
                      ? new Date(student.next_lesson).toLocaleString('es-ES', {
                          dateStyle: 'short',
                          timeStyle: 'short',
                        })
                      : '—'}
                  </CTableDataCell>
                  <CTableDataCell>
                    <CBadge color={student.status === 'Activo' ? 'success' : 'secondary'}>
                      {student.status}
                    </CBadge>
                  </CTableDataCell>
                </CTableRow>
              ))}
              {filtered.length === 0 && (
                <CTableRow>
                  <CTableDataCell colSpan={7} className="text-center text-medium-emphasis">
                    No se encontraron estudiantes con esos filtros.
                  </CTableDataCell>
                </CTableRow>
              )}
            </CTableBody>
          </CTable>
        </CCardBody>
      </CCard>

      <CModal visible={modalVisible} onClose={() => setModalVisible(false)}>
        <CModalHeader>Agregar estudiante</CModalHeader>
        <CModalBody>
          {error && <div className="alert alert-danger">{error}</div>}
          <CFormInput
            label="Nombre completo"
            className="mb-3"
            value={form.fullName}
            onChange={(e) => setForm((f) => ({ ...f, fullName: e.target.value }))}
          />
          <CFormInput
            label="Correo electrónico"
            type="email"
            className="mb-3"
            value={form.email}
            onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
          />
          <CFormInput
            label="Contraseña (mínimo 6 caracteres)"
            type="password"
            className="mb-3"
            value={form.password}
            onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
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
        </CModalBody>
        <CModalFooter>
          <CButton color="secondary" onClick={() => setModalVisible(false)}>
            Cancelar
          </CButton>
          <CButton color="primary" onClick={handleCreate} disabled={saving}>
            {saving ? 'Creando...' : 'Crear estudiante'}
          </CButton>
        </CModalFooter>
      </CModal>
    </>
  )
}

export default Students
