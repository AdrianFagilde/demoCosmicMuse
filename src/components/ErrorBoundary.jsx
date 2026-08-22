import React from 'react'
import { CButton, CCard, CCardBody, CCol, CContainer } from '@coreui/react'

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props)
    this.state = { error: null }
  }

  static getDerivedStateFromError(error) {
    return { error }
  }

  componentDidCatch(error, errorInfo) {
    console.error('[ErrorBoundary]', error, errorInfo)
  }

  handleReload = () => {
    window.location.reload()
  }

  render() {
    if (this.state.error) {
      return (
        <CContainer className="d-flex align-items-center justify-content-center min-vh-100">
          <CCol md={6}>
            <CCard className="text-center">
              <CCardBody className="p-4">
                <h4 className="mb-3">Algo salio mal</h4>
                <p className="text-body-secondary">
                  Ocurrio un error inesperado en la aplicacion. Intenta recargar la pagina.
                </p>
                <pre
                  className="text-danger small text-start bg-body-secondary p-2 rounded"
                  style={{ maxHeight: '200px', overflow: 'auto' }}
                >
                  {String(this.state.error)}
                </pre>
                <CButton color="primary" onClick={this.handleReload}>
                  Recargar aplicacion
                </CButton>
              </CCardBody>
            </CCard>
          </CCol>
        </CContainer>
      )
    }
    return this.props.children
  }
}

export default ErrorBoundary
