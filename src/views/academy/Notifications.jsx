import React, { useEffect, useState, useCallback } from 'react'
import {
  CBadge,
  CButton,
  CCard,
  CCardBody,
  CCardHeader,
  CCol,
  CFormCheck,
  CFormInput,
  CFormSelect,
  CFormTextarea,
  CRow,
  CSpinner,
} from '@coreui/react'
import { cilSend, cilCheckAlt } from '@coreui/icons'
import CIcon from '@coreui/icons-react'
import { useAuth } from '../../context/AuthContext'
import useSupabaseUserNotifications from '../../hooks/useSupabaseUserNotifications'
import supabase from '../../lib/supabase'

const formatDateTime = (value) => {
  if (!value) return '--'
  return new Date(value).toLocaleString('es-ES', { dateStyle: 'short', timeStyle: 'short' })
}

const Notifications = () => {
  const { user, profile } = useAuth()
  const isAdmin = profile?.role === 'admin'

  if (isAdmin) {
    return <AdminNotifications userId={user?.id} />
  }
  return <StudentNotifications userId={user?.id} />
}

const AdminNotifications = ({ userId }) => {
  const [students, setStudents] = useState([])
  const [notifications, setNotifications] = useState([])
  const [loading, setLoading] = useState(true)
  const [sending, setSending] = useState(false)
  const [message, setMessage] = useState({ type: '', text: '' })

  const [form, setForm] = useState({
    title: '',
    body: '',
    target: 'all',
    selectedStudents: [],
  })

  const fetchData = useCallback(async () => {
    const [studentsRes, notifRes] = await Promise.all([
      supabase
        .from('profiles')
        .select('id, full_name, email')
        .eq('role', 'student')
        .order('full_name'),
      supabase
        .from('notifications')
        .select('*, sender:profiles!notifications_sender_id_fkey(full_name)')
        .order('created_at', { ascending: false })
        .limit(100),
    ])
    if (!studentsRes.error && studentsRes.data) setStudents(studentsRes.data)
    if (!notifRes.error && notifRes.data) setNotifications(notifRes.data)
    setLoading(false)
  }, [])

  useEffect(() => {
    ;(async () => {
      await fetchData()
    })()
  }, [fetchData])

  const toggleStudent = (id) => {
    setForm((f) => {
      const exists = f.selectedStudents.includes(id)
      return {
        ...f,
        selectedStudents: exists
          ? f.selectedStudents.filter((s) => s !== id)
          : [...f.selectedStudents, id],
      }
    })
  }

  const selectAll = () => {
    setForm((f) => ({
      ...f,
      selectedStudents:
        f.selectedStudents.length === students.length ? [] : students.map((s) => s.id),
    }))
  }

  const handleSend = async () => {
    if (!form.title.trim() || !form.body.trim()) {
      setMessage({ type: 'danger', text: 'Titulo y mensaje son obligatorios.' })
      return
    }

    let recipients = []
    if (form.target === 'all') {
      recipients = students
    } else if (form.target === 'selected') {
      recipients = students.filter((s) => form.selectedStudents.includes(s.id))
    } else if (form.target === 'morosos') {
      const { data } = await supabase
        .from('profiles')
        .select('id, full_name, email')
        .eq('role', 'student')
        .eq('status', 'Inactivo')
      recipients = data || []
    }

    if (recipients.length === 0) {
      setMessage({ type: 'warning', text: 'No hay destinatarios seleccionados.' })
      return
    }

    setSending(true)
    setMessage({ type: '', text: '' })

    const rows = recipients.map((r) => ({
      sender_id: userId,
      recipient_id: r.id,
      title: form.title.trim(),
      message: form.body.trim(),
    }))

    const { error } = await supabase.from('notifications').insert(rows)

    if (error) {
      setMessage({ type: 'danger', text: `Error al enviar: ${error.message}` })
    } else {
      setMessage({
        type: 'success',
        text: `Notificacion enviada a ${recipients.length} estudiante(s).`,
      })
      setForm({ title: '', body: '', target: 'all', selectedStudents: [] })
      await fetchData()
    }
    setSending(false)
  }

  if (loading) {
    return (
      <div className="text-center pt-4">
        <CSpinner color="primary" />
      </div>
    )
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
        <CCol md={5}>
          <CCard>
            <CCardHeader>Enviar notificacion</CCardHeader>
            <CCardBody>
              <CFormInput
                label="Titulo"
                className="mb-3"
                value={form.title}
                onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
                placeholder="Ej: Recordatorio de pago"
              />
              <CFormTextarea
                label="Mensaje"
                rows={4}
                className="mb-3"
                value={form.body}
                onChange={(e) => setForm((f) => ({ ...f, body: e.target.value }))}
                placeholder="Escribe el contenido de la notificacion..."
              />
              <CFormSelect
                label="Enviar a"
                className="mb-3"
                value={form.target}
                onChange={(e) => setForm((f) => ({ ...f, target: e.target.value }))}
              >
                <option value="all">Todos los estudiantes</option>
                <option value="selected">Seleccionados</option>
                <option value="morosos">Inactivos / Morosos</option>
              </CFormSelect>

              {form.target === 'selected' && (
                <div className="mb-3" style={{ maxHeight: '200px', overflow: 'auto' }}>
                  <div className="mb-2">
                    <CFormCheck
                      id="selectAll"
                      label={`Seleccionar todos (${students.length})`}
                      checked={
                        form.selectedStudents.length === students.length && students.length > 0
                      }
                      onChange={selectAll}
                    />
                  </div>
                  {students.map((s) => (
                    <CFormCheck
                      key={s.id}
                      id={`student-${s.id}`}
                      label={s.full_name}
                      checked={form.selectedStudents.includes(s.id)}
                      onChange={() => toggleStudent(s.id)}
                    />
                  ))}
                  {students.length === 0 && (
                    <div className="text-medium-emphasis small">
                      No hay estudiantes registrados.
                    </div>
                  )}
                </div>
              )}

              <div className="text-end">
                <CButton color="primary" onClick={handleSend} disabled={sending}>
                  <CIcon icon={cilSend} className="me-1" />
                  {sending ? 'Enviando...' : 'Enviar notificacion'}
                </CButton>
              </div>
            </CCardBody>
          </CCard>
        </CCol>
        <CCol md={7}>
          <CCard>
            <CCardHeader>Historial de notificaciones enviadas</CCardHeader>
            <CCardBody>
              <div className="table-responsive">
                <table className="table table-striped mb-0">
                  <thead>
                    <tr>
                      <th>Para</th>
                      <th>Titulo</th>
                      <th>Mensaje</th>
                      <th>Enviado</th>
                    </tr>
                  </thead>
                  <tbody>
                    {notifications.map((n) => (
                      <tr key={n.id}>
                        <td>
                          {n.recipient_id
                            ? students.find((s) => s.id === n.recipient_id)?.full_name || '...'
                            : 'N/A'}
                        </td>
                        <td className="fw-semibold">{n.title}</td>
                        <td className="text-truncate" style={{ maxWidth: '200px' }}>
                          {n.message}
                        </td>
                        <td>{formatDateTime(n.created_at)}</td>
                      </tr>
                    ))}
                    {notifications.length === 0 && (
                      <tr>
                        <td colSpan={4} className="text-center text-medium-emphasis">
                          No hay notificaciones enviadas aun.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </CCardBody>
          </CCard>
        </CCol>
      </CRow>
    </>
  )
}

const StudentNotifications = ({ userId }) => {
  const { notifications, unreadCount, loading, markAsRead, markAllAsRead } =
    useSupabaseUserNotifications(userId)

  if (loading) {
    return (
      <div className="text-center pt-4">
        <CSpinner color="primary" />
      </div>
    )
  }

  return (
    <CCard>
      <CCardHeader className="d-flex justify-content-between align-items-center">
        <span>Mis notificaciones</span>
        <div className="d-flex align-items-center gap-3">
          {unreadCount > 0 && <CBadge color="primary">{unreadCount} sin leer</CBadge>}
          {unreadCount > 0 && (
            <CButton color="link" size="sm" onClick={markAllAsRead}>
              <CIcon icon={cilCheckAlt} className="me-1" /> Marcar todo leido
            </CButton>
          )}
        </div>
      </CCardHeader>
      <CCardBody>
        {notifications.length === 0 ? (
          <div className="text-center text-medium-emphasis py-4">No tienes notificaciones.</div>
        ) : (
          <div className="list-group">
            {notifications.map((n) => (
              <div
                key={n.id}
                className={`list-group-item list-group-item-action ${!n.read ? 'bg-primary bg-opacity-10' : ''}`}
                style={{ cursor: 'pointer' }}
                onClick={() => !n.read && markAsRead(n.id)}
              >
                <div className="d-flex justify-content-between align-items-start">
                  <div>
                    <div className="fw-semibold">{n.title}</div>
                    <div className="small text-body-secondary">{n.message}</div>
                    <div className="text-medium-emphasis mt-1" style={{ fontSize: '0.75rem' }}>
                      {n.sender?.full_name ? `De: ${n.sender.full_name}` : ''} -{' '}
                      {formatDateTime(n.created_at)}
                    </div>
                  </div>
                  {!n.read && (
                    <CBadge color="primary" shape="pill" className="ms-2">
                      Nuevo
                    </CBadge>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </CCardBody>
    </CCard>
  )
}

export default Notifications
