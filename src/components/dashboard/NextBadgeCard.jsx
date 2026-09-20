import React from 'react'
import { CCard, CCardBody, CCardHeader, CProgress, CBadge } from '@coreui/react'
import CIcon from '@coreui/icons-react'
import { cilStar, cilFire, cilBook, cilStar as cilAward } from '@coreui/icons'

const BADGE_ICONS = {
  first_task: cilStar,
  tasks_10: cilStar,
  tasks_50: cilStar,
  tasks_100: cilStar,
  first_course: cilBook,
  courses_5: cilBook,
  week_streak: cilFire,
  month_streak: cilFire,
  century_streak: cilFire,
}

const BADGE_COLORS = {
  first_task: 'warning',
  tasks_10: 'info',
  tasks_50: 'primary',
  tasks_100: 'success',
  first_course: 'warning',
  courses_5: 'primary',
  week_streak: 'danger',
  month_streak: 'magenta',
  century_streak: 'purple',
}

const NextBadgeCard = ({ nextBadges }) => {
  const badge = nextBadges?.[0]

  if (!badge) {
    return (
      <CCard className="h-100 next-badge-complete">
        <CCardBody className="d-flex flex-column align-items-center text-center py-4">
          <CIcon icon={cilAward} size="xl" className="text-success mb-2" />
          <h6 className="mb-1">¡Todo completado!</h6>
          <p className="text-medium-emphasis small mb-0">Has desbloqueado todos los logros</p>
        </CCardBody>
      </CCard>
    )
  }

  const Icon = BADGE_ICONS[badge.badge_key] || cilStar
  const color = BADGE_COLORS[badge.badge_key] || 'primary'
  const progress = Math.min(100, Math.round((badge.progress / badge.target) * 100))
  const remaining = badge.target - badge.progress

  return (
    <CCard className="h-100 next-badge-card">
      <CCardHeader className="d-flex justify-content-between align-items-center py-2">
        <span className="fw-semibold d-flex align-items-center gap-2">
          <CIcon icon={cilStar} className="text-warning" />
          Próximo logro
        </span>
        <CBadge color={color}>{progress}%</CBadge>
      </CCardHeader>
      <CCardBody className="d-flex flex-column">
        <div className="d-flex align-items-center gap-3 mb-3">
          <div
            className={`badge-icon bg-${color} bg-opacity-10 rounded-circle d-flex align-items-center justify-content-center`}
            style={{ width: 56, height: 56 }}
          >
            <CIcon icon={Icon} className={`text-${color}`} size="xl" />
          </div>
          <div className="flex-grow-1">
            <div className="fw-semibold">{badge.badge_name}</div>
            <div className="text-medium-emphasis small">{badge.badge_description}</div>
          </div>
        </div>
        <CProgress value={progress} height={8} color={color} className="mb-2" />
        <div className="d-flex justify-content-between small text-medium-emphasis mb-3">
          <span>
            {badge.progress}/{badge.target}
          </span>
          <span className={`fw-semibold text-${color}`}>Faltan {remaining}</span>
        </div>
        <div className="mt-auto text-center">
          <small className="text-medium-emphasis">Sigue practicando para desbloquearlo</small>
        </div>
      </CCardBody>
    </CCard>
  )
}

export default NextBadgeCard
