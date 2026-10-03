import React from 'react'
import CIcon from '@coreui/icons-react'
import { cilInbox } from '@coreui/icons'

const EmptyState = ({
  icon = cilInbox,
  title,
  description,
  action,
  className = '',
  compact = false,
}) => (
  <div className={`empty-state ${compact ? 'empty-state--compact' : ''} ${className}`.trim()}>
    <CIcon icon={icon} className="empty-state__icon" aria-hidden="true" />
    {title && <p className="empty-state__title">{title}</p>}
    {description && <p className="empty-state__text">{description}</p>}
    {action && <div className="empty-state__action">{action}</div>}
  </div>
)

export default EmptyState
