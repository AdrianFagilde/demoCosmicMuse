import React, { useState } from 'react'
import { CCard, CCardBody, CCardHeader, CCol, CNav, CNavItem, CNavLink, CRow } from '@coreui/react'

import { useAuth } from '../../context/AuthContext'
import usePayments from '../../hooks/usePayments'
import useReminders from '../../hooks/useReminders'
import useNotificationLog from '../../hooks/useNotificationLog'

import PaymentForm from './payments/PaymentForm'
import PaymentHistory from './payments/PaymentHistory'
import ReminderPanel from './payments/ReminderPanel'
import StudentBalances from './payments/StudentBalances'
import NotificationLog from './payments/NotificationLog'
import { students } from '../../data/academy'

const Payments = () => {
  const { user } = useAuth()
  const [activeTab, setActiveTab] = useState('payments')
  const [filterText, setFilterText] = useState('')
  const [filterStatus, setFilterStatus] = useState('Todos')

  const { payments, addPayment, studentBalances } = usePayments(user)
  const { notificationLog, addEntries, notifyBrowser } = useNotificationLog()
  const { upcomingReminders, addReminder, sendReminder } = useReminders(studentBalances, addEntries)

  const studentOptions = students.map((s) => ({ value: s.id, label: s.name }))

  const handleSendReminder = (reminder, trigger) => {
    sendReminder(reminder, trigger)
    const recipients = studentBalances.filter((s) => {
      if (reminder.targetGroup === 'Todos') return true
      if (reminder.targetGroup === 'Morosos') return s.paymentStatus === 'Moroso'
      if (reminder.targetGroup === 'Pagados') return s.paymentStatus === 'Pagado'
      return String(s.id) === String(reminder.studentId)
    })
    const methodLabel = reminder.notifyWhatsApp ? 'App + WhatsApp' : 'App'
    if (recipients.length > 0) {
      notifyBrowser(
        `Recordatorio ${methodLabel}`,
        `${recipients.length} notificaciones enviadas a ${reminder.targetGroup}`,
      )
    }
  }

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
          userName={user?.name}
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
          <PaymentHistory payments={payments} />
          <NotificationLog entries={notificationLog} />
        </>
      )}
    </>
  )
}

export default Payments
