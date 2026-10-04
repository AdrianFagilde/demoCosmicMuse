import React, { useCallback, useEffect, useState } from 'react'
import {
  CBadge,
  CButton,
  CCard,
  CCardBody,
  CCardHeader,
  CCol,
  CFormSelect,
  CRow,
  CTable,
  CTableBody,
  CTableDataCell,
  CTableHead,
  CTableHeaderCell,
  CTableRow,
} from '@coreui/react'
import { cilTrash, cilUser } from '@coreui/icons'
import CIcon from '@coreui/icons-react'
import { useAuth } from '../../context/AuthContext'
import supabase from '../../lib/supabase'
import RestrictedAccess from '../../components/RestrictedAccess'
import EmptyState from '../../components/EmptyState'
import { TableSkeletonRows } from '../../components/Skeleton'
import {
  INSTRUMENT_OPTIONS,
  UNASSIGNED_INSTRUMENT_LABEL,
  formatInstrument,
} from '../../utils/students'

const Users = () => {
  const { user, profile } = useAuth()
  const currentUserId = user?.id
  const [users, setUsers] = useState([])
  const [loading, setLoading] = useState(true)
  const [notice, setNotice] = useState({ type: '', text: '' })

  const showNotice = (type, text) => setNotice({ type, text })

  const fetchUsers = useCallback(async () => {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .order('created_at', { ascending: false })
    if (error) {
      console.error('[Users] Error fetching users:', error.message, error)
    }
    if (!error && data) {
      setUsers(data)
    }
    setLoading(false)
  }, [])

  useEffect(() => {
    if (profile?.role !== 'admin') return
    ;(async () => {
      await fetchUsers()
    })()
  }, [profile?.role, fetchUsers])

  if (!profile || profile.role !== 'admin') {
    return <RestrictedAccess message="Solo los administradores pueden gestionar usuarios." />
  }

  const handleRoleChange = async (targetUser, newRole) => {
    if (targetUser.id === currentUserId) return
    if (
      targetUser.role === 'admin' &&
      !window.confirm(
        `¿Quitar permisos de administrador a ${targetUser.full_name}? Esta acción no se puede deshacer desde la app.`,
      )
    ) {
      return
    }
    const { error } = await supabase
      .from('profiles')
      .update({ role: newRole })
      .eq('id', targetUser.id)
    if (error) {
      console.error('[Users] Error cambiando rol:', error.message, error)
      showNotice('danger', 'No se pudo cambiar el rol.')
      return
    }
    setUsers((prev) => prev.map((u) => (u.id === targetUser.id ? { ...u, role: newRole } : u)))
    showNotice('success', `Rol actualizado para ${targetUser.full_name}.`)
  }

  const handleStatusChange = async (userId, newStatus) => {
    const { error } = await supabase.from('profiles').update({ status: newStatus }).eq('id', userId)
    if (error) {
      console.error('[Users] Error cambiando estado:', error.message, error)
      showNotice('danger', 'No se pudo cambiar el estado.')
      return
    }
    setUsers((prev) => prev.map((u) => (u.id === userId ? { ...u, status: newStatus } : u)))
  }

  const handleInstrumentChange = async (targetUser, newInstrument) => {
    const instrument = newInstrument || null
    const { error } = await supabase
      .from('profiles')
      .update({ instrument, updated_at: new Date().toISOString() })
      .eq('id', targetUser.id)
    if (error) {
      console.error('[Users] Error cambiando instrumento:', error.message, error)
      showNotice('danger', `No se pudo cambiar el instrumento de ${targetUser.full_name}.`)
      return
    }
    setUsers((prev) => prev.map((u) => (u.id === targetUser.id ? { ...u, instrument } : u)))
    showNotice(
      'success',
      `Instrumento de ${targetUser.full_name}: ${formatInstrument(instrument) || UNASSIGNED_INSTRUMENT_LABEL}.`,
    )
  }

  const handleDelete = async (user) => {
    if (
      !window.confirm(
        `¿Eliminar a ${user.full_name}? Se eliminará su cuenta, su perfil y sus datos asociados. Esta acción no se puede deshacer.`,
      )
    ) {
      return
    }
    // Elimina la cuenta en auth.users (cascada al perfil) vía Edge Function
    const { data, error } = await supabase.functions.invoke('delete-user', {
      body: { userId: user.id },
    })
    if (error) {
      console.error('[Users] Error eliminando usuario:', error.message, error)
      showNotice('danger', 'No se pudo eliminar la cuenta. Intenta de nuevo.')
      return
    }
    if (data && data.error) {
      showNotice('danger', data.error)
      return
    }
    setUsers((prev) => prev.filter((u) => u.id !== user.id))
    showNotice('success', `${user.full_name} fue eliminado.`)
  }

  return (
    <>
      {notice.text && <div className={`alert alert-${notice.type} mb-3`}>{notice.text}</div>}
      <CRow className="mb-4">
        <CCol md={3} sm={6}>
          <CCard className="h-100">
            <CCardBody>
              <div className="text-medium-emphasis small">Total usuarios</div>
              <div className="fs-3 fw-semibold">{users.length}</div>
            </CCardBody>
          </CCard>
        </CCol>
        <CCol md={3} sm={6}>
          <CCard className="h-100">
            <CCardBody>
              <div className="text-medium-emphasis small">Administradores</div>
              <div className="fs-3 fw-semibold">
                {users.filter((u) => u.role === 'admin').length}
              </div>
            </CCardBody>
          </CCard>
        </CCol>
        <CCol md={3} sm={6}>
          <CCard className="h-100">
            <CCardBody>
              <div className="text-medium-emphasis small">Estudiantes</div>
              <div className="fs-3 fw-semibold">
                {users.filter((u) => u.role === 'student').length}
              </div>
            </CCardBody>
          </CCard>
        </CCol>
        <CCol md={3} sm={6}>
          <CCard className="h-100">
            <CCardBody>
              <div className="text-medium-emphasis small">Inactivos</div>
              <div className="fs-3 fw-semibold">
                {users.filter((u) => u.status === 'Inactivo').length}
              </div>
            </CCardBody>
          </CCard>
        </CCol>
      </CRow>
      <CCard>
        <CCardHeader className="d-flex justify-content-between align-items-center">
          <span>Gestión de usuarios</span>
          <span className="text-medium-emphasis small">{users.length} usuario(s)</span>
        </CCardHeader>
        <CCardBody>
          <CTable align="middle" className="mb-0 border" hover responsive>
            <CTableHead>
              <CTableRow>
                <CTableHeaderCell>Nombre</CTableHeaderCell>
                <CTableHeaderCell>Email</CTableHeaderCell>
                <CTableHeaderCell>Rol</CTableHeaderCell>
                <CTableHeaderCell>Estado</CTableHeaderCell>
                <CTableHeaderCell>Instrumento</CTableHeaderCell>
                <CTableHeaderCell>Registro</CTableHeaderCell>
                <CTableHeaderCell className="text-center">Acciones</CTableHeaderCell>
              </CTableRow>
            </CTableHead>
            <CTableBody>
              {loading ? (
                <TableSkeletonRows rows={6} columns={7} />
              ) : users.length === 0 ? (
                <CTableRow>
                  <CTableDataCell colSpan={7} className="p-0">
                    <EmptyState
                      compact
                      title="Sin usuarios"
                      description="No hay usuarios registrados todavía."
                    />
                  </CTableDataCell>
                </CTableRow>
              ) : (
                users.map((user) => (
                  <CTableRow key={user.id}>
                    <CTableDataCell>
                      <div className="d-flex align-items-center gap-2">
                        <CIcon icon={cilUser} className="text-medium-emphasis" aria-hidden="true" />
                        {user.full_name}
                      </div>
                    </CTableDataCell>
                    <CTableDataCell>{user.email}</CTableDataCell>
                    <CTableDataCell>
                      {user.id === currentUserId ? (
                        <CBadge color="info">Tu cuenta</CBadge>
                      ) : (
                        <CFormSelect
                          size="sm"
                          value={user.role}
                          onChange={(e) => handleRoleChange(user, e.target.value)}
                          className="w-140"
                        >
                          <option value="admin">Admin</option>
                          <option value="student">Estudiante</option>
                        </CFormSelect>
                      )}
                    </CTableDataCell>
                    <CTableDataCell>
                      {user.id === currentUserId ? (
                        user.status
                      ) : (
                        <CFormSelect
                          size="sm"
                          value={user.status}
                          onChange={(e) => handleStatusChange(user.id, e.target.value)}
                          className="w-130"
                        >
                          <option value="Activo">Activo</option>
                          <option value="Inactivo">Inactivo</option>
                        </CFormSelect>
                      )}
                    </CTableDataCell>
                    <CTableDataCell>
                      {user.id === currentUserId ? (
                        formatInstrument(user.instrument) || UNASSIGNED_INSTRUMENT_LABEL
                      ) : (
                        <CFormSelect
                          size="sm"
                          value={user.instrument || ''}
                          onChange={(e) => handleInstrumentChange(user, e.target.value)}
                          className="w-140"
                          aria-label={`Cambiar instrumento de ${user.full_name}`}
                        >
                          <option value="">{UNASSIGNED_INSTRUMENT_LABEL}</option>
                          {INSTRUMENT_OPTIONS.map((option) => (
                            <option key={option} value={option}>
                              {formatInstrument(option)}
                            </option>
                          ))}
                        </CFormSelect>
                      )}
                    </CTableDataCell>
                    <CTableDataCell>
                      {user.created_at
                        ? new Date(user.created_at).toLocaleDateString('es-ES')
                        : '—'}
                    </CTableDataCell>
                    <CTableDataCell className="text-center">
                      {user.id === currentUserId ? (
                        '—'
                      ) : (
                        <CButton
                          color="danger"
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDelete(user)}
                          aria-label={`Eliminar a ${user.full_name}`}
                        >
                          <CIcon icon={cilTrash} aria-hidden="true" />
                        </CButton>
                      )}
                    </CTableDataCell>
                  </CTableRow>
                ))
              )}
            </CTableBody>
          </CTable>
        </CCardBody>
      </CCard>
    </>
  )
}

export default Users
