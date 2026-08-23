import React, { useCallback, useState } from 'react'
import {
  CButton,
  CFormLabel,
  CFormRange,
  CModal,
  CModalBody,
  CModalFooter,
  CModalHeader,
  CModalTitle,
  CSpinner,
} from '@coreui/react'
import PropTypes from 'prop-types'
import Cropper from 'react-easy-crop'
import { getCroppedImg } from '../utils/image'

const AvatarCropModal = ({ visible, imageSrc, onCancel, onConfirm }) => {
  const [crop, setCrop] = useState({ x: 0, y: 0 })
  const [zoom, setZoom] = useState(1)
  const [rotation, setRotation] = useState(0)
  const [croppedAreaPixels, setCroppedAreaPixels] = useState(null)
  const [processing, setProcessing] = useState(false)

  const handleCropComplete = useCallback((_, areaPixels) => {
    setCroppedAreaPixels(areaPixels)
  }, [])

  const handleConfirm = async () => {
    if (!imageSrc || !croppedAreaPixels) return
    setProcessing(true)
    try {
      const blob = await getCroppedImg(imageSrc, croppedAreaPixels, rotation)
      await onConfirm(blob)
    } catch (_error) {
      onCancel()
    } finally {
      setProcessing(false)
    }
  }

  return (
    <CModal
      visible={visible}
      onClose={processing ? () => {} : onCancel}
      alignment="center"
      onClosed={() => {
        setCrop({ x: 0, y: 0 })
        setZoom(1)
        setRotation(0)
        setCroppedAreaPixels(null)
      }}
    >
      <CModalHeader>
        <CModalTitle>Ajustar foto de perfil</CModalTitle>
      </CModalHeader>
      <CModalBody>
        <div
          style={{
            position: 'relative',
            width: '100%',
            height: '320px',
            background: '#000',
            borderRadius: '8px',
            overflow: 'hidden',
          }}
        >
          {imageSrc && (
            <Cropper
              image={imageSrc}
              crop={crop}
              zoom={zoom}
              rotation={rotation}
              aspect={1}
              cropShape="round"
              showGrid={false}
              onCropChange={setCrop}
              onZoomChange={setZoom}
              onRotationChange={setRotation}
              onCropComplete={handleCropComplete}
            />
          )}
        </div>
        <CFormLabel className="mt-3">Zoom</CFormLabel>
        <CFormRange
          min={1}
          max={3}
          step={0.01}
          value={zoom}
          onChange={(e) => setZoom(Number(e.target.value))}
        />
        <CFormLabel className="mt-2">Rotación</CFormLabel>
        <CFormRange
          min={0}
          max={360}
          step={1}
          value={rotation}
          onChange={(e) => setRotation(Number(e.target.value))}
        />
      </CModalBody>
      <CModalFooter>
        <CButton color="secondary" variant="outline" onClick={onCancel} disabled={processing}>
          Cancelar
        </CButton>
        <CButton
          color="primary"
          onClick={handleConfirm}
          disabled={processing || !croppedAreaPixels}
        >
          {processing ? (
            <>
              <CSpinner size="sm" className="me-1" />
              Recortando...
            </>
          ) : (
            'Recortar y usar'
          )}
        </CButton>
      </CModalFooter>
    </CModal>
  )
}

AvatarCropModal.propTypes = {
  visible: PropTypes.bool.isRequired,
  imageSrc: PropTypes.string,
  onCancel: PropTypes.func.isRequired,
  onConfirm: PropTypes.func.isRequired,
}

export default AvatarCropModal
