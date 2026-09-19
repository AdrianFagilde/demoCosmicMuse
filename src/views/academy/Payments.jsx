import React, { useMemo, useState } from 'react'
import { CCard, CCardBody, CCardHeader, CCol, CNav, CNavItem, CNavLink, CRow } from '@coreui/react'

import { useAuth } from '../../context/AuthContext'
import useSupabaseStudents from '../../hooks/useSupabaseStudents'
import useSupabasePayments from '../../hooks/useSupabasePayments'
import useSupabaseReminders from '../../hooks/useSupabaseReminders'
import useSupabaseNotifications from '../../hooks/useSupabaseNotifications'
import { computeStudentBalances } from '../../utils/students'

import PaymentForm from './payments/PaymentForm'
import PaymentHistory from './payments/PaymentHistory'
import ReminderPanel from './payments/ReminderPanel'
import StudentBalances from './payments/StudentBalances'
import NotificationLog from './payments/NotificationLog'

const Payments = () => {
  const { user, profile } = useAuth()
  const [activeTab, setActiveTab] = useState('payments')
  const [filterText, setFilterText] = useState('')
  const [filterStatus, setFilterStatus] = useState('Todos')

  const { students } = useSupabaseStudents()
  const { payments, addPayment, getPaymentProofUrl } = useSupabasePayments(user?.id)
  const { upcomingReminders, addReminder, updateReminder, deleteReminder, sendReminder } =
    useSupabaseReminders(user?.id)
  const { entries: notificationLog, notifyBrowser } = useSupabaseNotifications()

  const studentBalances = useMemo(
    () => computeStudentBalances(students, payments),
    [students, payments],
  )

  const studentOptions = students.map((s) => ({ value: s.id, label: s.full_name }))

  const handleSendReminder = async (reminder, trigger) => {
    const entries = await sendReminder(reminder, trigger, studentBalances)
    if (entries && entries.length > 0) {
      const methodLabel = reminder.notify_whatsapp ? 'App + WhatsApp' : 'App'
      notifyBrowser(
        `Recordatorio ${methodLabel}`,
        `${entries.length} notificaciones enviadas a ${reminder.target_group}`,
      )
    }
  }

  const mappedPayments = payments.map((p) => ({
    ...p,
    studentName: p.profiles?.full_name || '—',
    recordedBy: p.recorder?.full_name || 'Administrador',
    date: p.payment_date,
  }))

  return (
    <>
      <CRow className="mb-4">
        <CCol>
          <CCard>
            <CCardHeader>Pagos</CCardHeader>
            <CCardBody>
              <p>
                Administra el historial de pagos, los estudiantes y los recordatorios desde esta
                vista.
              </p>
            </CCardBody>
          </CCard>
        </CCol>
      </CRow>

      <CRow className="mb-4">
        <CCol>
          <CNav variant="tabs">
            <CNavItem>
              <CNavLink active={activeTab === 'payments'} onClick={() => setActiveTab('payments')}>
                Pagos
              </CNavLink>
            </CNavItem>
            <CNavItem>
              <CNavLink
                active={activeTab === 'reminders'}
                onClick={() => setActiveTab('reminders')}
              >
                Recordatorios
              </CNavLink>
            </CNavItem>
            <CNavItem>
              <CNavLink active={activeTab === 'students'} onClick={() => setActiveTab('students')}>
                Estudiantes
              </CNavLink>
            </CNavItem>
            <CNavItem>
              <CNavLink active={activeTab === 'history'} onClick={() => setActiveTab('history')}>
                Historial de pagos
              </CNavLink>
            </CNavItem>
          </CNav>
        </CCol>
      </CRow>

      {activeTab === 'payments' && (
        <CRow className="mb-4">
          <CCol md={4}>
            <CCard>
              <CCardHeader>Saldo por estudiante</CCardHeader>
              <CCardBody>
                <table className="table table-borderless mb-0">
                  <thead>
                    <tr>
                      <th>Estudiante</th>
                      <th>Total pagado</th>
                    </tr>
                  </thead>
                  <tbody>
                    {studentBalances.length === 0 && (
                      <tr>
                        <td colSpan={2} className="text-center text-body-secondary py-4">
                          No hay estudiantes registrados.
                        </td>
                      </tr>
                    )}
                    {studentBalances.map((student) => (
                      <tr key={student.id}>
                        <td>{student.name}</td>
                        <td>${student.totalPaid.toFixed(2)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </CCardBody>
            </CCard>
          </CCol>
          <CCol md={8}>
            <CCard>
              <CCardHeader>Registrar nuevo pago</CCardHeader>
              <CCardBody>
                <PaymentForm studentOptions={studentOptions} onSubmit={addPayment} />
              </CCardBody>
            </CCard>
          </CCol>
        </CRow>
      )}

      {activeTab === 'reminders' && (
        <ReminderPanel
          studentOptions={studentOptions}
          upcomingReminders={upcomingReminders}
          onAddReminder={addReminder}
          onSendReminder={handleSendReminder}
          onUpdateReminder={updateReminder}
          onDeleteReminder={deleteReminder}
          userName={profile?.full_name}
        />
      )}

      {activeTab === 'students' && (
        <StudentBalances
          studentBalances={studentBalances}
          filterText={filterText}
          filterStatus={filterStatus}
          onFilterTextChange={setFilterText}
          onFilterStatusChange={setFilterStatus}
        />
      )}

      {activeTab === 'history' && (
        <>
          <PaymentHistory payments={mappedPayments} onViewProof={getPaymentProofUrl} />
          <NotificationLog entries={notificationLog} />
        </>
      )}
    </>
  )
}

export default Payments
