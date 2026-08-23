import React from 'react'
import { CCard, CCardBody } from '@coreui/react'
import PropTypes from 'prop-types'

const RestrictedAccess = ({ title, message }) => (
  <CCard className="mb-4">
    <CCardBody>
      <h4>{title}</h4>
      <p>{message}</p>
    </CCardBody>
  </CCard>
)

RestrictedAccess.propTypes = {
  title: PropTypes.string,
  message: PropTypes.string,
}

RestrictedAccess.defaultProps = {
  title: 'Acceso restringido',
  message: '',
}

export default RestrictedAccess
