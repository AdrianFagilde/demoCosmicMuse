import React, { useMemo, useState } from 'react'
import {
  CAlert,
  CButton,
  CCard,
  CCardBody,
  CCardHeader,
  CCol,
  CRow,
  CNav,
  CNavItem,
  CNavLink,
} from '@coreui/react'
import CIcon from '@coreui/icons-react'
import { cilBell, cilPlus } from '@coreui/icons'

import { useAuth } from '../../context/AuthContext'
import useSupabaseStudents from '../../hooks/useSupabaseStudents'
import useSupabasePayments from '../../hooks/useSupabasePayments'
import useSupabaseReminders from '../../hooks/useSupabaseReminders'
import useSupabaseNotifications from '../../hooks/useSupabaseNotifications'
import { computeStudentBalances } from '../../utils/students'
import {
  EMPTY_PAYMENT_FILTERS,
  filterPayments,
  sortPayments,
  summarizePayments,
} from '../../utils/payments'

import AdvancedFilters from './payments/AdvancedFilters'
import KPICards from './payments/KPICards'
import NotificationLog from './payments/NotificationLog'
import PaymentFormModal from './payments/PaymentFormModal'
import PaymentHistory from './payments/PaymentHistory'
import ReminderFormModal from './payments/ReminderFormModal'
import ReminderList from './payments/ReminderList'

const RECENT_PAYMENTS_COUNT = 8

const TABS = [
  { key: 'overview', label: 'Pagos' },
  { key: 'history', label: 'Historial' },
  { key: 'reminders', label: 'Recordatorios' },
]

const Payments = () => {
  const { user } = useAuth()
  const [activeTab, setActiveTab] = useState('overview')

  const [paymentModalOpen, setPaymentModalOpen] = useState(false)
  const [reminderModalOpen, setReminderModalOpen] = useState(false)
  const [editingReminder, setEditingReminder] = useState(null)

  const [filters, setFilters] = useState(EMPTY_PAYMENT_FILTERS)
  const [filtersCollapsed, setFiltersCollapsed] = useState(false)
  // Feedback in-app del envio de recordatorios (antes usaba la API nativa
  // Notification del navegador, retirada con el Web Push).
  const [reminderFeedback, setReminderFeedback] = useState(null)

  const { students } = useSupabaseStudents()
  const { payments, addPayment, getPaymentProofUrl } = useSupabasePayments(user?.id)
  const {
    reminders,
    upcomingReminders,
    addReminder,
    updateReminder,
    deleteReminder,
    sendReminder,
  } = useSupabaseReminders(user?.id)
  const { entries: notificationLog } = useSupabaseNotifications()

  const studentBalances = useMemo(
    () => computeStudentBalances(students, payments),
    [students, payments],
  )

  const studentOptions = useMemo(
    () => students.map((s) => ({ value: s.id, label: s.full_name })),
    [students],
  )

  const kpis = useMemo(() => {
    const { totalMonth } = summarizePayments(payments)
    return {
      totalMonth: `$${totalMonth.toFixed(2)}`,
      delinquentCount: studentBalances.filter((s) => s.paymentStatus === 'Moroso').length,
      paidCount: studentBalances.filter((s) => s.paymentsCount > 0).length,
      studentCount: students.length,
    }
  }, [payments, studentBalances, students.length])

  // Resumen de la cabecera: los ultimos registros sin filtros ni paginacion.
  const recentPayments = useMemo(
    () => sortPayments(payments, 'date', 'desc').slice(0, RECENT_PAYMENTS_COUNT),
    [payments],
  )

  const filteredPayments = useMemo(() => filterPayments(payments, filters), [payments, filters])

  const handleSendReminder = async (reminder, trigger) => {
    try {
      const entries = await sendReminder(reminder, trigger, studentBalances)
      if (entries && entries.length > 0) {
        const methodLabel = reminder.notify_whatsapp ? 'App + WhatsApp' : 'App'
        setReminderFeedback({
          color: 'success',
          text: `Recordatorio ${methodLabel}: ${entries.length} notificaciones enviadas a ${reminder.target_group}.`,
        })
      } else {
        setReminderFeedback({
          color: 'warning',
          text: 'No había destinatarios para este grupo.',
        })
      }
    } catch (err) {
      console.error('Payments: fallo al enviar el recordatorio', err?.message || err)
      setReminderFeedback({
        color: 'danger',
        text: 'No se pudo enviar el recordatorio. Inténtalo de nuevo.',
      })
    }
  }

  // Crear y editar comparten el modal; el hook decide si es insert o update.
  const handleSaveReminder = async (form, reminder) => {
    if (!reminder) {
      return addReminder(form)
    }
    const parsedSchedule = new Date(form.scheduleAt)
    if (!Number.isFinite(parsedSchedule.getTime())) return false
    return updateReminder(reminder.id, {
      student_id: form.targetGroup === 'Individual' ? form.studentId : null,
      message: form.message,
      notify_whatsapp: form.notifyWhatsApp || false,
      schedule_at: parsedSchedule.toISOString(),
      interval_value: Number(form.intervalValue) || 0,
      interval_unit: form.intervalUnit || 'Días',
      target_group: form.targetGroup,
      active: form.active !== false,
    })
  }

  const handleDeleteReminder = (reminder) => {
    if (window.confirm('¿Eliminar este recordatorio? Esta acción no se puede deshacer.')) {
      deleteReminder(reminder.id)
    }
  }

  const openCreateReminder = () => {
    setEditingReminder(null)
    setReminderModalOpen(true)
  }

  const openEditReminder = (reminder) => {
    setEditingReminder(reminder)
    setReminderModalOpen(true)
  }

  const closeReminderModal = () => {
    setReminderModalOpen(false)
    setEditingReminder(null)
  }

  return (
    <>
      <CNav variant="tabs" className="mb-4">
        {TABS.map((tab) => (
          <CNavItem key={tab.key}>
            <CNavLink
              active={activeTab === tab.key}
              onClick={() => setActiveTab(tab.key)}
              aria-current={activeTab === tab.key ? 'page' : undefined}
            >
              {tab.label}
            </CNavLink>
          </CNavItem>
        ))}
      </CNav>

      {activeTab === 'overview' && (
        <>
          <KPICards {...kpis} />

          <CRow className="mb-4">
            <CCol className="d-flex justify-content-end">
              <CButton color="primary" onClick={() => setPaymentModalOpen(true)}>
                <CIcon icon={cilPlus} className="me-2" aria-hidden="true" />
                Registrar pago
              </CButton>
            </CCol>
          </CRow>

          <CCard className="app-card">
            <CCardHeader>Últimos pagos</CCardHeader>
            <CCardBody>
              {recentPayments.length === 0 ? (
                <div className="text-center py-4">
                  <p className="text-body-secondary mb-3">Todavía no hay pagos registrados.</p>
                  <CButton color="primary" onClick={() => setPaymentModalOpen(true)}>
                    <CIcon icon={cilPlus} className="me-2" aria-hidden="true" />
                    Registrar el primero
                  </CButton>
                </div>
              ) : (
                <>
                  <PaymentHistory
                    payments={recentPayments}
                    onViewProof={getPaymentProofUrl}
                    showToolbar={false}
                  />
                  <div className="mt-3">
                    <CButton
                      color="secondary"
                      variant="outline"
                      onClick={() => setActiveTab('history')}
                    >
                      Ver historial completo
                    </CButton>
                  </div>
                </>
              )}
            </CCardBody>
          </CCard>
        </>
      )}

      {activeTab === 'history' && (
        <>
          <CCard className="app-card">
            <CCardHeader>Historial de pagos</CCardHeader>
            <CCardBody>
              <AdvancedFilters
                filters={filters}
                onChange={setFilters}
                students={students}
                collapsed={filtersCollapsed}
                onToggle={() => setFiltersCollapsed((v) => !v)}
              />
              <PaymentHistory
                payments={filteredPayments}
                onViewProof={getPaymentProofUrl}
                totalAll={payments.length}
              />
            </CCardBody>
          </CCard>
          <NotificationLog entries={notificationLog} />
        </>
      )}

      {activeTab === 'reminders' && (
        <>
          {reminderFeedback && (
            <CAlert
              color={reminderFeedback.color}
              dismissible
              onClose={() => setReminderFeedback(null)}
              className="mb-4"
            >
              {reminderFeedback.text}
            </CAlert>
          )}

          <CRow className="mb-3">
            <CCol className="d-flex justify-content-end">
              <CButton color="primary" onClick={openCreateReminder}>
                <CIcon icon={cilBell} className="me-2" aria-hidden="true" />
                Nuevo recordatorio
              </CButton>
            </CCol>
          </CRow>

          <CCard className="app-card">
            <CCardBody>
              <ReminderList
                reminders={reminders}
                onSend={handleSendReminder}
                onEdit={openEditReminder}
                onToggleActive={(reminder) =>
                  updateReminder(reminder.id, { active: !reminder.active })
                }
                onDelete={handleDeleteReminder}
              />
              {upcomingReminders.length === 0 && reminders.length > 0 && (
                <p className="text-body-secondary small mb-0 mt-3">
                  No hay recordatorios activos. Reactiva o crea uno nuevo.
                </p>
              )}
            </CCardBody>
          </CCard>
        </>
      )}

      {/* Los modales solo existen mientras estan abiertos: al desmontarse,
          reabrirlos arranca siempre con un formulario limpio. La key del
          recordatorio hace que editar uno distinto monte otro formulario. */}
      {paymentModalOpen && (
        <PaymentFormModal
          onClose={() => setPaymentModalOpen(false)}
          studentOptions={studentOptions}
          onSubmit={addPayment}
        />
      )}

      {reminderModalOpen && (
        <ReminderFormModal
          key={editingReminder?.id || 'new'}
          onClose={closeReminderModal}
          studentOptions={studentOptions}
          onSubmit={handleSaveReminder}
          reminder={editingReminder}
        />
      )}
    </>
  )
}

export default Payments
