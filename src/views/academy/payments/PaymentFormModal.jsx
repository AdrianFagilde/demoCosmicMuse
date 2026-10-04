import React from 'react'
import { CModal, CModalBody, CModalFooter, CModalHeader, CButton } from '@coreui/react'
import PaymentForm from './PaymentForm'

/**
 * Modal de alta de pagos. Envuelve el formulario existente para que la vista de
 * Pagos no gaste media pantalla en un formulario que solo se usa de vez en
 * cuando. El formulario se cierra solo cuando el pago queda registrado.
 *
 * El padre lo monta solo mientras esta abierto, de modo que reabrirlo siempre
 * arranca con los campos vacios.
 */
const PaymentFormModal = ({ onClose, studentOptions, onSubmit }) => (
  <CModal visible onClose={onClose} size="lg" scrollable>
    <CModalHeader>Registrar nuevo pago</CModalHeader>
    <CModalBody>
      <PaymentForm studentOptions={studentOptions} onSubmit={onSubmit} onClose={onClose} />
    </CModalBody>
    <CModalFooter>
      <CButton color="secondary" onClick={onClose}>
        Cancelar
      </CButton>
    </CModalFooter>
  </CModal>
)

export default React.memo(PaymentFormModal)
