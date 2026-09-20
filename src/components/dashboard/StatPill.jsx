import React from 'react'
import { CCard, CCardBody, CProgress } from '@coreui/react'
import CIcon from '@coreui/icons-react'

const StatPill = ({
  icon,
  value,
  label,
  subLabel,
  color = 'primary',
  progress,
  progressColor,
  onClick,
  children,
}) => (
  <CCard
    className="h-100 stat-pill"
    style={{ cursor: onClick ? 'pointer' : 'default' }}
    onClick={onClick}
  >
    <CCardBody className="d-flex flex-column align-items-center text-center py-3 px-2">
      <CIcon icon={icon} size="xl" className={`text-${color} mb-2`} />
      <div className={`fw-bold fs-4 text-${color} mb-1`}>{value}</div>
      <div className="text-medium-emphasis small">{label}</div>
      {subLabel && <div className="text-medium-emphasis small mt-1">{subLabel}</div>}
      {progress !== undefined && (
        <CProgress
          className="w-100 mt-2"
          value={progress}
          height={4}
          color={progressColor || color}
        />
      )}
      {children}
    </CCardBody>
  </CCard>
)

export default StatPill
