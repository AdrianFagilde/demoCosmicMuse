import React from 'react'
import {
  CButton,
  CModal,
  CModalBody,
  CModalFooter,
  CModalHeader,
  CModalTitle,
  CSpinner,
} from '@coreui/react'

/**
 * Modal de confirmación reutilizable para sustituir window.confirm().
 *
 * Uso mínimo:
 *
 *   const [confirm, setConfirm] = useState(null) // null | { title, message, onConfirm }
 *   ...
 *   setConfirm({ title: 'Eliminar', message: '¿Seguro?', onConfirm: fn })
 *   <ConfirmModal
 *     visible={Boolean(confirm)}
 *     title={confirm?.title}
 *     message={confirm?.message}
 *     variant="danger"
 *     onClose={() => setConfirm(null)}
 *     onConfirm={() => {
 *       confirm?.onConfirm()
 *       setConfirm(null)
 *     }}
 *   />
 *
 * variant: color del botón de confirmar ('danger' para acciones
 * destructivas, 'primary' para el resto).
 */
const ConfirmModal = ({
  visible,
  title,
  message,
  confirmLabel = 'Confirmar',
  cancelLabel = 'Cancelar',
  variant = 'primary',
  loading = false,
  onConfirm,
  onClose,
}) => (
  <CModal visible={visible} onClose={onClose} alignment="center">
    <CModalHeader closeButton>
      <CModalTitle>{title}</CModalTitle>
    </CModalHeader>
    <CModalBody>{message}</CModalBody>
    <CModalFooter>
      <CButton color="secondary" variant="outline" onClick={onClose} disabled={loading}>
        {cancelLabel}
      </CButton>
      <CButton color={variant} onClick={onConfirm} disabled={loading}>
        {loading && <CSpinner size="sm" className="me-2" aria-hidden="true" />}
        {confirmLabel}
      </CButton>
    </CModalFooter>
  </CModal>
)

export default ConfirmModal
